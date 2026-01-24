import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { toContainerPath, toHostPath } from './pathUtils.js';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

// Improved Heuristic Regex
// Matches S01E01, 1x01, Season 1 Episode 1
const TV_REGEX = /(.*?)[ ._-]+(?:S(\d+)[ ._-]*E(\d+)|(\d+)x(\d+)|Season[ ._-]*(\d+)[ ._-]*Episode[ ._-]*(\d+))/i;
const MOVIE_REGEX = /(.*?)[ ._]\((\d{4})\)/i; 
const SIMPLE_YEAR_REGEX = /[ ._](\d{4})[ ._]/;

// --- TMDB Helpers (Server Side) ---
const searchTmdb = async (query, type, apiKey, language, year = null) => {
    if (!apiKey) return null;
    try {
        let url = `https://api.themoviedb.org/3/search/${type}?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(query)}&include_adult=false`;
        if (year && type === 'movie') url += `&year=${year}`;
        if (year && type === 'tv') url += `&first_air_date_year=${year}`;

        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.results && data.results.length > 0 ? data.results[0] : null;
    } catch (e) {
        console.error("TMDB Search Error:", e);
        return null;
    }
};

// --- Scanner Logic ---

// Recursive crawler using CONTAINER paths
async function crawlDirectory(dir, fileList = []) {
    try {
        const files = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                await crawlDirectory(fullPath, fileList);
            } else {
                const ext = path.extname(file.name).toLowerCase();
                if (VIDEO_EXTENSIONS.includes(ext)) {
                    fileList.push(fullPath);
                }
            }
        }
    } catch (e) {
        console.warn(`Skipping access denied: ${dir}`);
    }
    return fileList;
}

export const runScanJob = async (db, jobId, overrides = {}) => {
    const log = async (msg) => {
        try {
             await db.collection('jobs').updateOne({ _id: jobId }, { $push: { logs: { ts: new Date(), msg } } });
        } catch(e) { console.error("Failed to log:", e); }
        console.log(`[Job ${jobId}] ${msg}`);
    };

    try {
        // 1. Load Settings
        const settings = await db.collection('settings').findOne({ id: 'global' });
        if (!settings) throw new Error("Settings not configured.");

        const dryRun = overrides.dryRun ?? settings.dryRun ?? true; 
        const isCopyMode = overrides.isCopyMode ?? settings.isCopyMode ?? false;
        const mountSafety = settings.mountSafety ?? true;

        await log(`Starting Scan. DryRun: ${dryRun}, CopyMode: ${isCopyMode}, Safety: ${mountSafety}`);

        const movieRootsHost = settings.movieRoots || [];
        const tvRootsHost = settings.tvRoots || [];

        // 2. Validate Mounts (Check CONTAINER paths)
        if (mountSafety) {
            const allRoots = [...movieRootsHost, ...tvRootsHost];
            for (const root of allRoots) {
                const containerRoot = toContainerPath(root);
                try {
                    // Check if it's a mount point in Linux
                    execSync(`findmnt -T "${containerRoot}"`);
                } catch (e) {
                    throw new Error(`Mount check failed for ${root} (mapped to ${containerRoot}). Aborting scan.`);
                }
            }
        }

        // 3. Crawl Files
        let fileMap = []; 

        for (const rootHost of movieRootsHost) {
            const containerRoot = toContainerPath(rootHost);
            const files = await crawlDirectory(containerRoot);
            // Store mapping: found path (Container) -> associated root (Host)
            files.forEach(f => fileMap.push({ path: f, type: 'movie', rootHost }));
        }
        for (const rootHost of tvRootsHost) {
            const containerRoot = toContainerPath(rootHost);
            const files = await crawlDirectory(containerRoot);
            files.forEach(f => fileMap.push({ path: f, type: 'tv', rootHost }));
        }

        const totalFiles = fileMap.length;
        await db.collection('jobs').updateOne({ _id: jobId }, { $set: { totalFiles } });
        await log(`Found ${totalFiles} video files.`);

        // 4. Process Files
        let processed = 0;
        let stats = { movies: 0, tv: 0, uncategorized: 0, errors: 0 };

        for (const entry of fileMap) {
            const { path: srcContainerPath, type: hintType, rootHost } = entry;
            
            // For DB storage, we convert back to Host Path
            const srcHostPath = toHostPath(srcContainerPath);

            const fileName = path.basename(srcContainerPath);
            const ext = path.extname(srcContainerPath);
            const parentDir = path.basename(path.dirname(srcContainerPath));

            let matchType = 'uncategorized';
            let meta = null;
            let tmdbResult = null;

            // --- Identification ---
            // Priority: Regex match determines type, fall back to hintType
            const tvMatch = fileName.match(TV_REGEX);
            
            if (tvMatch) {
                matchType = 'tv';
                const seriesName = tvMatch[1].replace(/\./g, ' ').trim();
                // Regex groups: 2/3 are S/E, 4/5 are X/X, 6/7 are Season/Episode words
                const season = tvMatch[2] || tvMatch[4] || tvMatch[6];
                const episode = tvMatch[3] || tvMatch[5] || tvMatch[7];
                
                tmdbResult = await searchTmdb(seriesName, 'tv', settings.tmdbApiKey, settings.tmdbLanguage);
                if (tmdbResult) {
                    meta = {
                        id: tmdbResult.id,
                        title: tmdbResult.name, 
                        year: tmdbResult.first_air_date ? tmdbResult.first_air_date.substring(0, 4) : '',
                        posterPath: tmdbResult.poster_path,
                        overview: tmdbResult.overview,
                        season: parseInt(season),
                        episode: parseInt(episode)
                    };
                }
            } else {
                matchType = 'movie';
                let title = fileName;
                let year = null;

                const movieMatch = fileName.match(MOVIE_REGEX) || parentDir.match(MOVIE_REGEX);
                if (movieMatch) {
                    title = movieMatch[1].replace(/\./g, ' ').trim();
                    year = movieMatch[2];
                } else {
                    const yearMatch = fileName.match(SIMPLE_YEAR_REGEX);
                    if (yearMatch) year = yearMatch[1];
                    title = fileName.replace(ext, '').replace(/\./g, ' ').trim();
                }

                tmdbResult = await searchTmdb(title, 'movie', settings.tmdbApiKey, settings.tmdbLanguage, year);
                
                if (tmdbResult) {
                     meta = {
                        id: tmdbResult.id,
                        title: tmdbResult.title,
                        year: tmdbResult.release_date ? tmdbResult.release_date.substring(0, 4) : '',
                        posterPath: tmdbResult.poster_path,
                        overview: tmdbResult.overview
                    };
                } else {
                    matchType = 'uncategorized';
                }
            }

            // --- Action Determination ---
            let destHostPath = null;
            let destContainerPath = null;
            let action = 'skip';
            let status = 'uncategorized';

            if (matchType === 'movie' && meta) {
                const cleanTitle = meta.title.replace(/[\/\\:]/g, '-');
                const folderName = `${cleanTitle} (${meta.year})`;
                // Construct Host Path
                destHostPath = path.join(rootHost, folderName, `${folderName}${ext}`);
                status = 'organized';
            } else if (matchType === 'tv' && meta) {
                const cleanSeries = meta.title.replace(/[\/\\:]/g, '-');
                const sPad = meta.season.toString().padStart(2, '0');
                const ePad = meta.episode.toString().padStart(2, '0');
                // Construct Host Path
                destHostPath = path.join(rootHost, cleanSeries, `Season ${sPad}`, `${cleanSeries} - S${sPad}E${ePad}${ext}`);
                status = 'organized';
            }

            // --- Execution ---
            if (destHostPath && destHostPath !== srcHostPath) {
                destContainerPath = toContainerPath(destHostPath);
                action = isCopyMode ? 'copy' : 'move';
                
                if (!dryRun) {
                    try {
                        // MKDIR Recursive using Container Path
                        await fs.promises.mkdir(path.dirname(destContainerPath), { recursive: true });
                        
                        if (isCopyMode) {
                            await fs.promises.copyFile(srcContainerPath, destContainerPath);
                        } else {
                            // Safe Move (Handle cross-device)
                            try {
                                await fs.promises.rename(srcContainerPath, destContainerPath);
                            } catch (renameErr) {
                                if (renameErr.code === 'EXDEV') {
                                    await fs.promises.copyFile(srcContainerPath, destContainerPath);
                                    await fs.promises.unlink(srcContainerPath);
                                } else {
                                    throw renameErr;
                                }
                            }
                            
                            // Cleanup empty parent in container
                            try {
                                const parent = path.dirname(srcContainerPath);
                                const remaining = await fs.promises.readdir(parent);
                                if (remaining.length === 0) await fs.promises.rmdir(parent);
                            } catch(e) {}
                        }
                    } catch (err) {
                        action = 'error';
                        status = 'error';
                        stats.errors++;
                        await db.collection('jobs').updateOne({ _id: jobId }, { 
                            $push: { errors: { path: srcHostPath, error: err.message } } 
                        });
                    }
                }
            } else if (matchType === 'uncategorized') {
                stats.uncategorized++;
                status = 'uncategorized';
            } else {
                // In place or already organized
                if (matchType === 'movie') stats.movies++;
                if (matchType === 'tv') stats.tv++;
            }

            // Update stats
            if (status === 'organized') {
                if (matchType === 'movie') stats.movies++;
                if (matchType === 'tv') stats.tv++;
            }

            // --- DB Record (Always Store HOST Paths) ---
            const itemRecord = {
                jobId,
                type: matchType,
                srcPath: srcHostPath,
                destPath: destHostPath, // Can be null
                action: dryRun ? `dry-${action}` : action,
                status: status, 
                tmdb: meta,
                updatedAt: new Date()
            };

            await db.collection('items').updateOne(
                { srcPath: srcHostPath },
                { $set: itemRecord },
                { upsert: true }
            );

            // Update Job Progress
            processed++;
            if (processed % 5 === 0) {
                 await db.collection('jobs').updateOne({ _id: jobId }, { 
                    $set: { processedFiles: processed, stats } 
                });
            }
            
            if (!dryRun) await new Promise(r => setTimeout(r, 100)); // Throttle slightly
        }

        await db.collection('jobs').updateOne({ _id: jobId }, { 
            $set: { status: 'completed', finishedAt: new Date(), processedFiles: processed, stats } 
        });
        await log('Scan completed successfully.');

    } catch (err) {
        console.error("Scanner crashed:", err);
        await log(`Crash: ${err.message}`);
        await db.collection('jobs').updateOne({ _id: jobId }, { 
            $set: { status: 'failed', finishedAt: new Date() } 
        });
    }
};