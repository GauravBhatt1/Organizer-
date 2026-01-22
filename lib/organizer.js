
import fs from 'fs';
import path from 'path';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

// Helper to sanitize filenames
const sanitize = (name) => {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
};

// Helper to sanitize paths (removes newlines, trailing slashes)
const cleanPath = (p) => String(p || '')
    .trim()
    .replace(/[\r\n]+/g, '')
    .replace(/\/+$/, '');

export const organizeMediaItem = async (db, params) => {
    const { sourcePath, type, tmdbData } = params;
    
    // 1. Validation
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file not found: ${sourcePath}`);
    }

    // Load Settings
    const settings = await db.collection('settings').findOne({ id: 'global' });
    if (!settings) throw new Error("Server settings not configured.");

    const roots = type === 'movie' ? settings.movieRoots : settings.tvRoots;
    if (!roots || roots.length === 0) {
        throw new Error(`No root folders configured for ${type}. Please go to Settings.`);
    }

    // Default to first root folder and sanitize
    let destinationRoot = roots[0];
    destinationRoot = cleanPath(destinationRoot);

    // DEBUG LOGS (Temporary for troubleshooting)
    console.log('[Organizer] destinationRoot raw:', JSON.stringify(destinationRoot), 'Len:', destinationRoot.length);
    
    // Verify root exists
    if (!fs.existsSync(destinationRoot)) {
        console.warn(`[Organizer] Root does not exist: ${destinationRoot}`);
        throw new Error(`Configured root directory does not exist on server: ${JSON.stringify(destinationRoot)}`);
    }

    // Check Mount Safety if enabled
    if (settings.mountSafety) {
        try {
            // Simple check: Try to write a temp file to root to ensure writability
            const testFile = path.join(destinationRoot, '.write_test');
            fs.writeFileSync(testFile, '');
            fs.unlinkSync(testFile);
        } catch (e) {
            throw new Error(`Destination root ${destinationRoot} is not writable or safe. Check Mount Safety settings. Error: ${e.message}`);
        }
    }

    // 2. Construct Destination Folder & File Name (Strict Split)
    let targetDir = '';
    let targetFile = '';
    const ext = path.extname(sourcePath);
    
    if (type === 'movie') {
        const cleanTitle = sanitize(tmdbData.title);
        const year = tmdbData.year ? String(tmdbData.year) : '';
        
        // Folder: "Title (Year)" or just "Title"
        const folderName = year ? `${cleanTitle} (${year})` : cleanTitle;
        targetDir = path.join(destinationRoot, folderName);
        
        // File: "Title (Year).ext" or "Title.ext"
        targetFile = year ? `${cleanTitle} (${year})${ext}` : `${cleanTitle}${ext}`;

    } else if (type === 'tv') {
        const cleanSeries = sanitize(tmdbData.title);
        // Folder: "Series/Season 01"
        targetDir = path.join(destinationRoot, cleanSeries, 'Season 01');
        
        // File: "Series - S01E01.ext"
        targetFile = `${cleanSeries} - S01E01${ext}`;
    }

    if (!targetDir || !targetFile) throw new Error("Could not determine destination paths.");

    // DEBUG LOGS
    console.log('[Organizer] targetDir raw:', JSON.stringify(targetDir), 'Len:', targetDir.length);
    console.log(`[Organizer] Plan: Move '${sourcePath}' -> '${targetDir}/${targetFile}'`);

    // 3. Create Directory (Defensive)
    
    // SAFETY CHECK: Ensure we are not creating a folder that looks like a video file
    if (VIDEO_EXTENSIONS.some(ex => targetDir.toLowerCase().endsWith(ex))) {
        throw new Error(`CRITICAL SAFETY BLOCK: Attempted to create a directory ending in video extension: ${targetDir}`);
    }

    // Explicit recursive creation
    try {
        await fs.promises.mkdir(targetDir, { recursive: true });
    } catch (err) {
        console.error(`[Organizer] mkdir failed for ${JSON.stringify(targetDir)}:`, err);
        throw new Error(`Failed to create directory: ${JSON.stringify(targetDir)}. Error: ${err.message}`);
    }

    // 4. Perform Move
    const destinationPath = path.join(targetDir, targetFile);
    const isCopyMode = settings.isCopyMode || false;
    
    // Check if source and dest are the same
    if (sourcePath === destinationPath) {
        return { success: true, newPath: destinationPath, message: "File is already in the correct location." };
    }

    if (isCopyMode) {
        await fs.promises.copyFile(sourcePath, destinationPath);
    } else {
        try {
            await fs.promises.rename(sourcePath, destinationPath);
        } catch (e) {
            if (e.code === 'EXDEV') {
                // Cross-device move: Copy then unlink
                await fs.promises.copyFile(sourcePath, destinationPath);
                await fs.promises.unlink(sourcePath);
            } else {
                throw e;
            }
        }
    }

    // 5. Cleanup Empty Parents (up to root)
    if (!isCopyMode) {
        try {
            const parent = path.dirname(sourcePath);
            // Only remove parent if it is NOT the root itself (basic safety)
            if (parent !== '/' && parent !== destinationRoot && parent !== path.dirname(destinationRoot)) {
                const files = await fs.promises.readdir(parent);
                if (files.length === 0) {
                    await fs.promises.rmdir(parent);
                    console.log(`[Organizer] Cleaned up empty directory: ${parent}`);
                }
            }
        } catch (e) { 
            // Ignore cleanup errors (non-critical)
            console.warn("Cleanup warning:", e.message);
        }
    }

    // 6. Update Database
    // Remove old Uncategorized record if it exists
    await db.collection('items').deleteOne({ srcPath: sourcePath });

    // Insert/Update new Organized record
    const newItem = {
        type,
        srcPath: destinationPath, // It is now located here
        destPath: destinationPath,
        status: 'organized',
        tmdb: tmdbData,
        updatedAt: new Date()
    };

    // We key by srcPath (current location)
    await db.collection('items').updateOne(
        { srcPath: destinationPath }, 
        { $set: newItem },
        { upsert: true }
    );

    return { success: true, newPath: destinationPath };
};
