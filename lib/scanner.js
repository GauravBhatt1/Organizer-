import fs from 'fs';
import path from 'path';
import { parseMediaMetaFromFilename } from './metadataParser.js';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];
const TV_REGEX = /\b(?:s|season)\s*(\d{1,4})[^0-9]*?(?:e|x|episode)\s*(\d{1,4})\b|\b(\d{1,4})x(\d{1,4})\b/i;

async function crawlDirectory(dir, fileList = []) {
    try {
        const files = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            
            if (file.name.startsWith('.')) continue;

            if (file.isDirectory()) {
                await crawlDirectory(fullPath, fileList);
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
        if (!settings || !settings.libraryRoot) {
             throw new Error("No Library Root configured. Please go to Settings.");
        }

        const libraryId = settings.libraryId;
        const root = settings.libraryRoot;

        // 1. Scan EVERYTHING inside root
        if (!fs.existsSync(root)) throw new Error(`Library Root does not exist: ${root}`);
        
        const fileList = await crawlDirectory(root);
        
        await updateJob({ $set: { totalFiles: fileList.length } });

        let processed = 0;
        let stats = { movies: 0, tv: 0, uncategorized: 0, errors: 0 };
        
        // Define organized paths
        const moviesPath = path.join(root, 'Movies');
        const tvPath = path.join(root, 'TV Shows');

        for (const srcPath of fileList) {
            const fileName = path.basename(srcPath);
            const parentDir = path.basename(path.dirname(srcPath));
            const fileMeta = parseMediaMetaFromFilename(fileName);

            let status = 'uncategorized';
            let type = 'unknown';
            let meta = null;

            // 2. Check if ALREADY ORGANIZED
            // If the file is inside {root}/Movies or {root}/TV Shows, it is ORGANIZED.
            if (srcPath.startsWith(moviesPath)) {
                status = 'organized';
                type = 'movie';
                stats.movies++;
                // We could parse Title (Year) from parent folder here if we wanted better metadata for existing files
                // For now, we assume if it's there, it's good.
            } else if (srcPath.startsWith(tvPath)) {
                status = 'organized';
                type = 'tv';
                stats.tv++;
            } else {
                // 3. Uncategorized Item Detection
                stats.uncategorized++;
                
                // Try to guess type for UI suggestions
                if (TV_REGEX.test(fileName) || TV_REGEX.test(parentDir)) {
                    type = 'tv';
                } else {
                    type = 'movie'; // Default guess
                }
            }

            // Update DB
            await db.collection('items').updateOne(
                { srcPath },
                { 
                    $set: { 
                        libraryId,     
                        scanId: jobId, 
                        jobId,         
                        type, 
                        srcPath, 
                        // If organized, destPath is itself
                        destPath: status === 'organized' ? srcPath : null,
                        status, 
                        tmdb: meta, // Meta is null for now unless we do TMDB lookup during scan (omitted for speed/simplicity as per requirement)
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