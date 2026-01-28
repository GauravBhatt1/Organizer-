import fs from 'fs';
import path from 'path';
import { isValidDataPath, isPathInside } from './pathUtils.js';
import { parseMediaMetaFromFilename } from './metadataParser.js';

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

async function crawlDirectory(dir, fileList = [], excludeRoots = []) {
    try {
        // PRE-CHECK: If the directory ITSELF is inside a destination root, STOP RECURSION immediately.
        // This satisfies "NEVER scan destination roots".
        for (const root of excludeRoots) {
            // Check if dir IS the root or INSIDE the root
            if (dir === root || isPathInside(dir, root)) {
                return fileList;
            }
        }

        const files = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            
            // Skip hidden files/folders
            if (file.name.startsWith('.')) continue;

            if (file.isDirectory()) {
                await crawlDirectory(fullPath, fileList, excludeRoots);
            }
            else if (VIDEO_EXTENSIONS.includes(path.extname(file.name).toLowerCase())) {
                // Final Check: Is the file inside a destination?
                // (Redundant if recursion stopped, but good for safety if top-level file)
                let isExcluded = false;
                for (const root of excludeRoots) {
                    if (isPathInside(fullPath, root)) {
                        isExcluded = true;
                        break;
                    }
                }
                if (!isExcluded) {
                    fileList.push(fullPath);
                }
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
        if (!settings) settings = { sourceFolders: [], movieRoots: [], tvRoots: [], libraryId: 'default' };

        const libraryId = settings.libraryId; // CRITICAL: Scope scan to this ID
        const sourceFolders = settings.sourceFolders || [];
        const destRoots = [...(settings.movieRoots||[]), ...(settings.tvRoots||[])];

        // Rule 2: Scan ONLY the user-selected sourceFolders
        if (sourceFolders.length === 0) {
            // If no sources, we finish immediately with 0 files.
            await updateJob({ 
                $set: { status: 'completed', finishedAt: new Date(), totalFiles: 0, processedFiles: 0, stats: { movies: 0, tv: 0, uncategorized: 0, errors: 0 } } 
            });
            return;
        }

        // Crawl files from Source Folders ONLY, explicitly excluding Destination Roots
        let fileMap = [];
        for (const root of sourceFolders) {
            if (fs.existsSync(root)) {
                const files = await crawlDirectory(root, [], destRoots);
                files.forEach(f => fileMap.push({ path: f, root }));
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
            
            // Extract Quality Metadata
            const fileMeta = parseMediaMetaFromFilename(fileName);

            let matchType = 'uncategorized';
            let meta = null;

            // 1. Strict Type Detection
            const tvMatch = fileName.match(TV_REGEX) || parentDir.match(TV_REGEX);
            
            if (tvMatch) {
                matchType = 'tv';
                if (tmdbKey) {
                    const rawName = fileName.replace(TV_REGEX, '').replace(path.extname(fileName), '').replace(/[._-]/g, ' ').trim();
                    const season = parseInt(tvMatch[1] || tvMatch[3] || 0);
                    const episode = parseInt(tvMatch[2] || tvMatch[4] || 0);
                    
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
                matchType = 'movie';
                if (tmdbKey) {
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
                        matchType = 'uncategorized';
                    }
                }
            }

            // 2. Status determination
            // Since we ONLY scan source folders and EXCLUDE destinations, 
            // everything found here is by definition 'uncategorized' (Incoming).
            // Files in the destination are "Organized", but we don't scan them.
            // Therefore, we only add 'uncategorized' items from this process.
            let status = 'uncategorized';
            
            // Update Stats
            stats.uncategorized++;

            // Upsert into DB with LibraryID and ScanID
            await db.collection('items').updateOne(
                { srcPath },
                { 
                    $set: { 
                        libraryId,     
                        scanId: jobId, 
                        jobId,         
                        type: matchType === 'uncategorized' ? 'unknown' : matchType, 
                        srcPath, 
                        status, 
                        tmdb: meta, 
                        quality: fileMeta.quality,
                        source: fileMeta.source,
                        codec: fileMeta.codec,
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