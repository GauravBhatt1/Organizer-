import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { isValidDataPath } from './pathUtils.js';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

// Heuristics
const TV_REGEX = /(.*?)[ ._-]+(?:S(\d+)[ ._-]*E(\d+)|(\d+)x(\d+)|Season[ ._-]*(\d+)[ ._-]*Episode[ ._-]*(\d+))/i;

const searchTmdb = async (query, type, apiKey, language, year) => {
    if (!apiKey) return null;
    try {
        let url = `https://api.themoviedb.org/3/search/${type}?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(query)}&include_adult=false`;
        if (year && type === 'movie') url += `&year=${year}`;
        if (year && type === 'tv') url += `&first_air_date_year=${year}`;
        
        // Native fetch required (Node 18+)
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        return data.results?.[0] || null;
    } catch (e) { 
        console.warn(`TMDB Search failed for ${query}: ${e.message}`);
        return null; 
    }
};

async function crawlDirectory(dir, fileList = []) {
    try {
        const files = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) await crawlDirectory(fullPath, fileList);
            else if (VIDEO_EXTENSIONS.includes(path.extname(file.name).toLowerCase())) fileList.push(fullPath);
        }
    } catch (e) {
        console.warn(`Skipping ${dir}: ${e.message}`);
    }
    return fileList;
}

export const runScanJob = async (db, jobId, overrides = {}) => {
    const updateJob = (u) => db.collection('jobs').updateOne({ _id: jobId }, u);
    
    try {
        let settings = await db.collection('settings').findOne({ id: 'global' });
        // Fallback if settings missing to prevent crash
        if (!settings) {
             console.log("No settings found in DB, using scan defaults.");
             settings = { 
                 movieRoots: ['/data/movies'], 
                 tvRoots: ['/data/tvshows'], 
                 dryRun: true, 
                 isCopyMode: false 
             };
        }

        const dryRun = overrides.dryRun ?? settings.dryRun ?? true;
        const isCopyMode = overrides.isCopyMode ?? settings.isCopyMode ?? false;
        
        const roots = [...(settings.movieRoots||[]), ...(settings.tvRoots||[])];
        
        // Ensure at least one root
        if (roots.length === 0) {
            throw new Error("No Library Roots configured in Settings.");
        }

        // Validate Paths
        for (const r of roots) {
            if (!isValidDataPath(r)) throw new Error(`Invalid path configuration: ${r}`);
        }

        let fileMap = [];
        for (const root of roots) {
            if (fs.existsSync(root)) {
                const files = await crawlDirectory(root);
                files.forEach(f => fileMap.push({ path: f, root }));
            } else {
                 console.warn(`Root not found: ${root}`);
            }
        }

        await updateJob({ $set: { totalFiles: fileMap.length } });

        let processed = 0;
        let stats = { movies: 0, tv: 0, uncategorized: 0, errors: 0 };
        const tmdbKey = (settings.tmdbApiKey || '').trim();

        for (const entry of fileMap) {
            const { path: srcPath, root } = entry;
            const fileName = path.basename(srcPath);
            const parentDir = path.basename(path.dirname(srcPath));
            
            let matchType = 'uncategorized';
            let meta = null;

            // 1. Detect Type
            const tvMatch = fileName.match(TV_REGEX) || parentDir.match(TV_REGEX);
            
            if (tvMatch) {
                matchType = 'tv';
                const seriesName = tvMatch[1].replace(/[\._]/g, ' ').trim();
                const season = tvMatch[2] || tvMatch[4] || tvMatch[6];
                const episode = tvMatch[3] || tvMatch[5] || tvMatch[7];
                
                if (tmdbKey) {
                    const tmdb = await searchTmdb(seriesName, 'tv', tmdbKey, settings.tmdbLanguage);
                    if (tmdb) meta = { id: tmdb.id, title: tmdb.name, year: tmdb.first_air_date?.substr(0,4), posterPath: tmdb.poster_path, overview: tmdb.overview, season: parseInt(season), episode: parseInt(episode) };
                }
            } else {
                matchType = 'movie';
                const cleanName = fileName.replace(path.extname(fileName), '').replace(/[\._]/g, ' ');
                if (tmdbKey) {
                    const tmdb = await searchTmdb(cleanName, 'movie', tmdbKey, settings.tmdbLanguage);
                    if (tmdb) meta = { id: tmdb.id, title: tmdb.title, year: tmdb.release_date?.substr(0,4), posterPath: tmdb.poster_path, overview: tmdb.overview };
                    else matchType = 'uncategorized';
                }
            }

            // 2. Determine Action
            let destPath = null;
            let status = 'uncategorized';
            
            if (meta) {
                status = 'organized';
                if (matchType === 'movie') {
                    const safeTitle = meta.title.replace(/[^\w\s\(\)-]/g, '').trim();
                    const folder = meta.year ? `${safeTitle} (${meta.year})` : safeTitle;
                    destPath = path.join(root, folder, `${folder}${path.extname(srcPath)}`);
                } else if (matchType === 'tv') {
                    const safeTitle = meta.title.replace(/[^\w\s\(\)-]/g, '').trim();
                    const s = String(meta.season).padStart(2,'0');
                    const e = String(meta.episode).padStart(2,'0');
                    destPath = path.join(root, safeTitle, `Season ${s}`, `${safeTitle} - S${s}E${e}${path.extname(srcPath)}`);
                }
            } else {
                matchType = 'uncategorized';
            }

            // 3. Execute
            if (destPath && destPath !== srcPath && !dryRun) {
                try {
                    await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
                    if (isCopyMode) await fs.promises.copyFile(srcPath, destPath);
                    else await fs.promises.rename(srcPath, destPath);
                } catch (e) {
                    if (e.code === 'EXDEV') { // Cross-device move fallback
                        await fs.promises.copyFile(srcPath, destPath);
                        await fs.promises.unlink(srcPath);
                    } else {
                        status = 'error';
                        stats.errors++;
                        await updateJob({ $push: { errors: { path: srcPath, error: e.message } } });
                    }
                }
            }

            stats[matchType === 'uncategorized' ? 'uncategorized' : (matchType === 'movie' ? 'movies' : 'tv')]++;

            await db.collection('items').updateOne(
                { srcPath },
                { $set: { jobId, type: matchType, srcPath, destPath, status, tmdb: meta, updatedAt: new Date() } },
                { upsert: true }
            );

            processed++;
            if (processed % 10 === 0) await updateJob({ processedFiles: processed, stats });
        }

        await updateJob({ status: 'completed', finishedAt: new Date(), processedFiles: processed, stats });

    } catch (e) {
        console.error("Scanner Error:", e);
        // Important: Return error as an object in the array so UI can map it
        await updateJob({ 
            status: 'failed', 
            finishedAt: new Date(), 
            errors: [{ path: 'General', error: e.message || 'Unknown Error' }] 
        });
    }
};