import fs from 'fs';
import path from 'path';
import { isValidDataPath } from './pathUtils.js';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

// Strict TV Detection: S01E01, 1x01, Season 1 Episode 1
// Does NOT match generic numbers to avoid false positives on movies with numbers
const TV_REGEX = /\b(?:s|season)\s*(\d{1,4})[^0-9]*?(?:e|x|episode)\s*(\d{1,4})\b|\b(\d{1,4})x(\d{1,4})\b/i;

const searchTmdb = async (query, type, apiKey, language, year) => {
    if (!apiKey) return null;
    try {
        let url = `https://api.themoviedb.org/3/search/${type}?api_key=${apiKey}&language=${language}&query=${encodeURIComponent(query)}&include_adult=false`;
        if (year && type === 'movie') url += `&year=${year}`;
        if (year && type === 'tv') url += `&first_air_date_year=${year}`;
        
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
            if (file.isDirectory()) {
                // Skip hidden folders
                if (!file.name.startsWith('.')) await crawlDirectory(fullPath, fileList);
            }
            else if (VIDEO_EXTENSIONS.includes(path.extname(file.name).toLowerCase())) {
                fileList.push(fullPath);
            }
        }
    } catch (e) {
        console.warn(`Skipping ${dir}: ${e.message}`);
    }
    return fileList;
}

export const runScanJob = async (db, jobId) => {
    const updateJob = (u) => db.collection('jobs').updateOne({ _id: jobId }, u);
    
    try {
        let settings = await db.collection('settings').findOne({ id: 'global' });
        // Use empty defaults if no settings exist, do not force fake paths
        if (!settings) settings = { movieRoots: [], tvRoots: [] };

        const roots = [...(settings.movieRoots||[]), ...(settings.tvRoots||[])];
        if (roots.length === 0) throw new Error("No Library Roots configured. Please go to Settings and add your /data folders.");

        // Crawl files
        let fileMap = [];
        for (const root of roots) {
            if (fs.existsSync(root)) {
                const files = await crawlDirectory(root);
                files.forEach(f => fileMap.push({ path: f, root }));
            }
        }

        await updateJob({ $set: { totalFiles: fileMap.length } });

        let processed = 0;
        let stats = { movies: 0, tv: 0, uncategorized: 0 };
        const tmdbKey = (settings.tmdbApiKey || '').trim();

        for (const entry of fileMap) {
            const { path: srcPath, root } = entry;
            const fileName = path.basename(srcPath);
            const parentDir = path.basename(path.dirname(srcPath));
            
            let matchType = 'uncategorized';
            let meta = null;

            // 1. Strict Type Detection
            // Check filename AND parent folder for TV patterns
            const tvMatch = fileName.match(TV_REGEX) || parentDir.match(TV_REGEX);
            
            if (tvMatch) {
                matchType = 'tv';
                if (tmdbKey) {
                    // Extract Name: Remove S01E01 and extension
                    const rawName = fileName.replace(TV_REGEX, '').replace(path.extname(fileName), '').replace(/[._-]/g, ' ').trim();
                    const season = parseInt(tvMatch[1] || tvMatch[3] || 0);
                    const episode = parseInt(tvMatch[2] || tvMatch[4] || 0);
                    
                    // Simple caching check could go here, but omitted for simplicity
                    const tmdb = await searchTmdb(rawName, 'tv', tmdbKey, settings.tmdbLanguage || 'en-US');
                    if (tmdb) {
                        meta = { 
                            id: tmdb.id, 
                            title: tmdb.name, 
                            year: tmdb.first_air_date?.substr(0,4), 
                            posterPath: tmdb.poster_path, 
                            overview: tmdb.overview, 
                            season, 
                            episode 
                        };
                    }
                }
            } else {
                // If not TV, assume Movie
                matchType = 'movie';
                if (tmdbKey) {
                    // Clean filename: Remove year, extension, dots
                    const yearMatch = fileName.match(/\b(19|20)\d{2}\b/);
                    const year = yearMatch ? yearMatch[0] : null;
                    const cleanName = fileName.replace(path.extname(fileName), '').replace(/\b(19|20)\d{2}\b/, '').replace(/[._-]/g, ' ').trim();
                    
                    const tmdb = await searchTmdb(cleanName, 'movie', tmdbKey, settings.tmdbLanguage || 'en-US', year);
                    if (tmdb) {
                        meta = { 
                            id: tmdb.id, 
                            title: tmdb.title, 
                            year: tmdb.release_date?.substr(0,4), 
                            posterPath: tmdb.poster_path, 
                            overview: tmdb.overview 
                        };
                    } else {
                        // If no TMDB match for movie, treat as uncategorized so user can fix
                        matchType = 'uncategorized';
                    }
                }
            }

            // 2. Determine Status (Organized vs Uncategorized)
            // READ-ONLY Logic: We do not move files. We just check if they LOOK organized.
            let status = 'uncategorized';
            
            if (meta) {
                // Simple heuristic: Is it in a folder that matches the Title?
                // This is a loose check to populate the "Organized" tabs vs "Uncategorized" tabs
                const expectedTitle = meta.title.replace(/[^\w\s]/g, ''); // simplified check
                const parentNormalized = parentDir.replace(/[^\w\s]/g, '');
                
                if (parentNormalized.includes(expectedTitle)) {
                    status = 'organized';
                }
            }

            // Update Stats
            if (status === 'organized') {
                stats[matchType]++;
            } else {
                stats.uncategorized++;
            }

            // Upsert into DB
            await db.collection('items').updateOne(
                { srcPath },
                { 
                    $set: { 
                        jobId, 
                        type: matchType === 'uncategorized' ? 'unknown' : matchType, 
                        srcPath, 
                        status, 
                        tmdb: meta, 
                        updatedAt: new Date() 
                    } 
                },
                { upsert: true }
            );

            processed++;
            if (processed % 10 === 0) await updateJob({ $set: { processedFiles: processed, stats } });
        }

        await updateJob({ 
            $set: { 
                status: 'completed', 
                finishedAt: new Date(), 
                processedFiles: processed, 
                stats 
            } 
        });

    } catch (e) {
        console.error("Scanner Error:", e);
        await updateJob({ 
            $set: {
                status: 'failed', 
                finishedAt: new Date(), 
                errors: [{ path: 'General', error: e.message || 'Unknown Error' }] 
            }
        });
    }
};