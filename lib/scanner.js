import fs from 'fs';
import path from 'path';
import { parseMediaMetaFromFilename } from './metadataParser.js';
import { autoIdentifyCandidate } from './tmdbServer.js';
import { organizeMediaItem } from './organizer.js';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

async function crawlDirectory(dir, fileList = []) {
    try {
        // Strict check: if dir doesn't exist, throw immediately
        if (!fs.existsSync(dir)) {
            throw new Error(`Directory not found: ${dir}`);
        }

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
        // If this is the root directory that failed, we want to know
        if (fileList.length === 0 && e.message.includes('not found')) {
            throw e;
        }
    }
    return fileList;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const runScanJob = async (db, jobId) => {
    const updateJob = (u) => db.collection('jobs').updateOne({ _id: jobId }, u);
    
    let processed = 0;
    let stats = { movies: 0, tv: 0, uncategorized: 0, errors: 0 };
    let finalStatus = 'failed';
    let finalError = null;

    try {
        let settings = await db.collection('settings').findOne({ id: 'global' });
        if (!settings || !settings.libraryRoot) {
             throw new Error("No Library Root configured. Please go to Settings.");
        }

        const libraryId = settings.libraryId;
        const root = settings.libraryRoot;
        const apiKey = settings.tmdbApiKey;

        // 1. Scan EVERYTHING inside root
        if (!fs.existsSync(root)) {
             throw new Error(`Library Root path invalid or not accessible: ${root}`);
        }
        
        const fileList = await crawlDirectory(root);
        
        await updateJob({ $set: { totalFiles: fileList.length } });

        // If 0 files, we still complete successfully but with 0 stats
        if (fileList.length === 0) {
            finalStatus = 'completed';
            return; // Jumps to finally
        }
        
        for (const srcPath of fileList) {
            const fileName = path.basename(srcPath);

            // 2. Check if ALREADY ORGANIZED
            // Logic: 
            // - If Movie: Root/Title (Year)/File.ext (Depth 2, Parent matches (Year))
            // - If TV: Root/Show/Season XX/File.ext (Depth 3, Parent matches Season XX)
            
            const relPath = path.relative(root, srcPath);
            const pathParts = relPath.split(path.sep);
            const depth = pathParts.length;

            let isOrganized = false;
            let orgType = null;

            if (depth === 2 && / \(\d{4}\)$/.test(pathParts[0])) {
                // Likely a Movie: Title (Year)/File
                isOrganized = true;
                orgType = 'movie';
            } else if (depth === 3 && /^Season \d+$/i.test(pathParts[1])) {
                // Likely TV: Title/Season XX/File
                isOrganized = true;
                orgType = 'tv';
            }

            if (isOrganized) {
                if (orgType === 'movie') stats.movies++; else stats.tv++;
                await db.collection('items').updateOne(
                    { srcPath },
                    { $set: { libraryId, scanId: jobId, type: orgType, status: 'organized', destPath: srcPath, updatedAt: new Date() } },
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
            // Periodic update
            if (processed % 5 === 0) {
                 await updateJob({ $set: { processedFiles: processed, stats } });
            }
        }
        
        finalStatus = 'completed';

    } catch (e) {
        console.error("Scanner Error:", e);
        finalStatus = 'failed';
        finalError = [{ path: 'System', error: e.message || 'Unknown Critical Error' }];
    } finally {
        // ALWAYS finish the job, releasing the "running" state
        await updateJob({ 
            $set: { 
                status: finalStatus, 
                finishedAt: new Date(), 
                processedFiles: processed, 
                stats: stats,
                errors: finalError || []
            } 
        });
    }
};