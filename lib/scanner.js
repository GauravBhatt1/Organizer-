import fs from 'fs';
import path from 'path';
import { parseMediaMetaFromFilename } from './metadataParser.js';
import { autoIdentifyCandidate } from './tmdbServer.js';
import { organizeMediaItem } from './organizer.js';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const runScanJob = async (db, jobId) => {
    const updateJob = (u) => db.collection('jobs').updateOne({ _id: jobId }, u);
    
    try {
        let settings = await db.collection('settings').findOne({ id: 'global' });
        if (!settings || !settings.libraryRoot) {
             throw new Error("No Library Root configured. Please go to Settings.");
        }

        const libraryId = settings.libraryId;
        const root = settings.libraryRoot;
        const apiKey = settings.tmdbApiKey;

        // 1. Scan EVERYTHING inside root
        if (!fs.existsSync(root)) throw new Error(`Library Root does not exist: ${root}`);
        
        const fileList = await crawlDirectory(root);
        
        await updateJob({ $set: { totalFiles: fileList.length } });

        let processed = 0;
        let stats = { movies: 0, tv: 0, uncategorized: 0, errors: 0 };
        
        const moviesPath = path.join(root, 'Movies');
        const tvPath = path.join(root, 'TV Shows');

        for (const srcPath of fileList) {
            const fileName = path.basename(srcPath);

            // 2. Check if ALREADY ORGANIZED
            if (srcPath.startsWith(moviesPath)) {
                stats.movies++;
                await db.collection('items').updateOne(
                    { srcPath },
                    { $set: { libraryId, scanId: jobId, type: 'movie', status: 'organized', destPath: srcPath, updatedAt: new Date() } },
                    { upsert: true }
                );
            } else if (srcPath.startsWith(tvPath)) {
                stats.tv++;
                await db.collection('items').updateOne(
                    { srcPath },
                    { $set: { libraryId, scanId: jobId, type: 'tv', status: 'organized', destPath: srcPath, updatedAt: new Date() } },
                    { upsert: true }
                );
            } else {
                // 3. UNCATEGORIZED - Attempt Auto-ID
                const meta = parseMediaMetaFromFilename(fileName);
                
                // Rate limit protection (200ms)
                await delay(200); 

                const autoId = await autoIdentifyCandidate(meta, apiKey);

                if (autoId.ok) {
                    // CONFIDENT: Auto-Organize Immediately
                    try {
                        const orgResult = await organizeMediaItem(db, {
                            sourcePath: srcPath,
                            type: autoId.type,
                            tmdbData: autoId.tmdbData
                        });

                        if (orgResult.success) {
                            if (autoId.type === 'movie') stats.movies++;
                            else stats.tv++;
                        }
                    } catch (orgError) {
                         // Fallback if organize fails (e.g. permission)
                         console.error("Auto-Organize Failed:", orgError);
                         stats.errors++;
                         stats.uncategorized++;
                         await db.collection('items').updateOne(
                            { srcPath },
                            { $set: { 
                                libraryId, scanId: jobId, type: 'unknown', status: 'uncategorized', 
                                autoIdStatus: 'error', autoIdReason: orgError.message,
                                updatedAt: new Date() 
                            }},
                            { upsert: true }
                        );
                    }
                } else {
                    // NOT CONFIDENT: Save as Uncategorized
                    stats.uncategorized++;
                    await db.collection('items').updateOne(
                        { srcPath },
                        { $set: { 
                            libraryId, scanId: jobId, type: 'unknown', status: 'uncategorized', 
                            autoIdStatus: 'manual', autoIdReason: autoId.reason,
                            cleanTitle: meta.cleanTitle, // Helper for UI
                            updatedAt: new Date() 
                        }},
                        { upsert: true }
                    );
                }
            }

            processed++;
            if (processed % 5 === 0) await updateJob({ $set: { processedFiles: processed, stats } });
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
