import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

// Heuristic Regex
const TV_REGEX = /(.*?)[ ._](?:S(\d+)[ ._]?E(\d+)|(\d+)x(\d+))/i;
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

const getTmdbDetails = async (id, type, apiKey, language) => {
     try {
        const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${apiKey}&language=${language}`;
        const res = await fetch(url);
        if(!res.ok) return null;
        return await res.json();
     } catch(e) { return null; }
};

// --- Scanner Logic ---

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
        // Skip permission denied folders etc.
        console.warn(`Skipping access denied: ${dir}`);
    }
    return fileList;
}

export const runScanJob = async (db, jobId, overrides = {}) => {
    const log = async (msg) => {
        await db.collection('jobs').updateOne({ _id: jobId }, { $push: { logs: { ts: new Date(), msg } } });
        console.log(`[Job ${jobId}] ${msg}`);
    };

    try {
        // 1. Load Settings
        const settings = await db.collection('settings').findOne({ id: 'global' });
        if (!settings) throw new Error("Settings not configured.");

        const dryRun = overrides.dryRun ?? settings.dryRun ?? true; // Default dry run for safety
        const isCopyMode = overrides.isCopyMode ?? settings.isCopyMode ?? false;
        const mountSafety = settings.mountSafety ?? true;

        await log(`Starting Scan. DryRun: ${dryRun}, CopyMode: ${isCopyMode}, Safety: ${mountSafety}`);

        // 2. Validate Mounts
        if (mountSafety) {
            const allRoots = [...(settings.movieRoots || []), ...(settings.tvRoots || [])];
            for (const root of allRoots) {
                try {
                    execSync(`findmnt -T "${root}"`);
                } catch (e) {
                    throw new Error(`Mount check failed for ${root}. Aborting scan for safety.`);
                }
            }
        }

        // 3. Crawl Files
        const movieRoots = settings.movieRoots || [];
        const tvRoots = settings.tvRoots || [];
        
        let allFiles = [];
        
        // Helper to know which root a file came from
        const fileMap = []; 

        for (const root of movieRoots) {
            const files = await crawlDirectory(root);
            files.forEach(f => fileMap.push({ path: f, type: 'movie', root }));
        }
        for (const root of tvRoots) {
            const files = await crawlDirectory(root);
            files.forEach(f => fileMap.push({ path: f, type: 'tv', root }));
        }

        const totalFiles = fileMap.length;
        await db.collection('jobs').updateOne({ _id: jobId }, { $set: { totalFiles } });
        await log(`Found ${totalFiles} video files.`);

        // 4. Process Files
        let processed = 0;
        let stats = { movies: 0, tv: 0, uncategorized: 0, errors: 0 };

        for (const entry of fileMap) {
            const { path: srcPath, type: hintType, root } = entry;
            const fileName = path.basename(srcPath);
            const ext = path.extname(srcPath);
            const parentDir = path.basename(path.dirname(srcPath));

            let matchType = 'uncategorized';
            let meta = null;
            let tmdbResult = null;

            // --- Identification ---
            // Try TV Regex
            const tvMatch = fileName.match(TV_REGEX);
            if (tvMatch) {
                matchType = 'tv';
                const seriesName = tvMatch[1].replace(/\./g, ' ').trim();
                const season = tvMatch[2] || tvMatch[4];
                const episode = tvMatch[3] || tvMatch[5];
                
                tmdbResult = await searchTmdb(seriesName, 'tv', settings.tmdbApiKey, settings.tmdbLanguage);
                if (tmdbResult) {
                    meta = {
                        id: tmdbResult.id,
                        title: tmdbResult.name, // TMDB uses 'name' for TV
                        year: tmdbResult.first_air_date ? tmdbResult.first_air_date.substring(0, 4) : '',
                        posterPath: tmdbResult.poster_path,
                        overview: tmdbResult.overview,
                        season: parseInt(season),
                        episode: parseInt(episode)
                    };
                }
            } else {
                // Try Movie Regex
                matchType = 'movie';
                let title = fileName;
                let year = null;

                const movieMatch = fileName.match(MOVIE_REGEX) || parentDir.match(MOVIE_REGEX);
                if (movieMatch) {
                    title = movieMatch[1].replace(/\./g, ' ').trim();
                    year = movieMatch[2];
                } else {
                    // Fallback year extraction
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
            let destPath = null;
            let action = 'skip';

            if (matchType === 'movie' && meta) {
                // Dest: Root / Title (Year) / Title (Year).ext
                const cleanTitle = meta.title.replace(/[\/\\:]/g, '-');
                const folderName = `${cleanTitle} (${meta.year})`;
                destPath = path.join(root, folderName, `${folderName}${ext}`); // Organize in place (in same root)
            } else if (matchType === 'tv' && meta) {
                // Dest: Root / Series / Season XX / Series - SXXEXX.ext
                const cleanSeries = meta.title.replace(/[\/\\:]/g, '-');
                const sPad = meta.season.toString().padStart(2, '0');
                const ePad = meta.episode.toString().padStart(2, '0');
                destPath = path.join(root, cleanSeries, `Season ${sPad}`, `${cleanSeries} - S${sPad}E${ePad}${ext}`);
            }

            // --- Execution ---
            if (destPath && destPath !== srcPath) {
                action = isCopyMode ? 'copy' : 'move';
                if (!dryRun) {
                    try {
                        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
                        if (isCopyMode) {
                            await fs.promises.copyFile(srcPath, destPath);
                        } else {
                            await fs.promises.rename(srcPath, destPath);
                            // Clean up empty parent dir if moved
                            try { await fs.promises.rmdir(path.dirname(srcPath)); } catch(e) {}
                        }
                    } catch (err) {
                        action = 'error';
                        stats.errors++;
                        await db.collection('jobs').updateOne({ _id: jobId }, { 
                            $push: { errors: { path: srcPath, error: err.message } } 
                        });
                    }
                }
            }

            // --- DB Record ---
            const itemRecord = {
                jobId,
                kind: matchType,
                srcPath,
                destPath,
                action: dryRun ? `dry-${action}` : action,
                status: action === 'error' ? 'error' : 'done',
                tmdb: meta,
                updatedAt: new Date()
            };

            // Update stats
            if (matchType === 'movie') stats.movies++;
            else if (matchType === 'tv') stats.tv++;
            else stats.uncategorized++;

            // Upsert item based on srcPath to avoid dupes
            await db.collection('items').updateOne(
                { srcPath },
                { $set: itemRecord },
                { upsert: true }
            );

            // Update Progress
            processed++;
            if (processed % 5 === 0) { // Update DB every 5 items to reduce load
                 await db.collection('jobs').updateOne({ _id: jobId }, { 
                    $set: { processedFiles: processed, stats } 
                });
            }
            
            // Artificial delay to respect TMDB rate limits (approx 40 req/10s allowed usually)
            if (!dryRun) await new Promise(r => setTimeout(r, 250)); 
        }

        // Final Update
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
