
import fs from 'fs';
import path from 'path';
import { toContainerPath, toHostPath } from './pathUtils.js';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

const sanitize = (name) => {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
};

export const organizeMediaItem = async (db, params) => {
    // Input: Source Path is a HOST path from the DB
    const { sourcePath: sourceHostPath, type, tmdbData } = params;
    
    // Convert to Container Path for FS operations
    const sourceContainerPath = toContainerPath(sourceHostPath);

    // 1. Validation
    if (!fs.existsSync(sourceContainerPath)) {
        throw new Error(`Source file not found (Container Path): ${sourceContainerPath}`);
    }

    // Load Settings
    const settings = await db.collection('settings').findOne({ id: 'global' });
    if (!settings) throw new Error("Server settings not configured.");

    const roots = type === 'movie' ? settings.movieRoots : settings.tvRoots;
    if (!roots || roots.length === 0) {
        throw new Error(`No root folders configured for ${type}. Please go to Settings.`);
    }

    // Use first configured root (Host Path)
    const destinationRootHost = roots[0];
    const destinationRootContainer = toContainerPath(destinationRootHost);

    // Verify root exists
    if (!fs.existsSync(destinationRootContainer)) {
        throw new Error(`Configured root directory does not exist: ${destinationRootContainer}`);
    }

    // Check Mount Safety
    if (settings.mountSafety) {
        try {
            const testFile = path.join(destinationRootContainer, '.write_test');
            fs.writeFileSync(testFile, '');
            fs.unlinkSync(testFile);
        } catch (e) {
            throw new Error(`Destination root is not writable. Check permissions. Error: ${e.message}`);
        }
    }

    // 2. Construct Destination Paths
    let relativePath = '';
    const ext = path.extname(sourceHostPath);
    
    if (type === 'movie') {
        const cleanTitle = sanitize(tmdbData.title);
        const year = tmdbData.year ? String(tmdbData.year) : '';
        const folderName = year ? `${cleanTitle} (${year})` : cleanTitle;
        const fileName = year ? `${cleanTitle} (${year})${ext}` : `${cleanTitle}${ext}`;
        relativePath = path.join(folderName, fileName);

    } else if (type === 'tv') {
        const cleanSeries = sanitize(tmdbData.title);
        // Default to S01E01 for manual organization if not present, but usually UI sends it? 
        // Assuming tmdbData doesn't have season/ep specific info in manual organize flow usually, 
        // but let's assume specific structure requirements or defaults.
        // NOTE: Manual organize implies we might lose specific episode info unless passed.
        // For Uncategorized view, we usually just match the Movie/Series. 
        // This is a limitation of the current Uncategorized UI payload. 
        // Let's assume Season 01 / S01E01 as a fallback for generic series matches.
        
        const targetDir = path.join(cleanSeries, 'Season 01');
        const targetFile = `${cleanSeries} - S01E01${ext}`;
        relativePath = path.join(targetDir, targetFile);
    }

    const destHostPath = path.join(destinationRootHost, relativePath);
    const destContainerPath = toContainerPath(destHostPath);

    // 3. Create Directory (Recursive)
    const destContainerDir = path.dirname(destContainerPath);
    
    if (VIDEO_EXTENSIONS.some(ex => destContainerDir.toLowerCase().endsWith(ex))) {
        throw new Error(`Safety Block: Target directory looks like a video file.`);
    }

    try {
        await fs.promises.mkdir(destContainerDir, { recursive: true });
    } catch (err) {
        throw new Error(`Failed to create directory: ${destContainerDir}. Error: ${err.message}`);
    }

    // 4. Perform Move
    const isCopyMode = settings.isCopyMode || false;

    if (sourceContainerPath === destContainerPath) {
        return { success: true, newPath: destHostPath, message: "File is already in location." };
    }

    if (isCopyMode) {
        await fs.promises.copyFile(sourceContainerPath, destContainerPath);
    } else {
        try {
            await fs.promises.rename(sourceContainerPath, destContainerPath);
        } catch (e) {
            if (e.code === 'EXDEV') {
                await fs.promises.copyFile(sourceContainerPath, destContainerPath);
                await fs.promises.unlink(sourceContainerPath);
            } else {
                throw e;
            }
        }
    }

    // 5. Cleanup
    if (!isCopyMode) {
        try {
            const parent = path.dirname(sourceContainerPath);
            // Ensure we don't delete the root mount
            if (parent !== destinationRootContainer && parent !== '/host') {
                const files = await fs.promises.readdir(parent);
                if (files.length === 0) await fs.promises.rmdir(parent);
            }
        } catch (e) {}
    }

    // 6. Update Database
    await db.collection('items').deleteOne({ srcPath: sourceHostPath });

    const newItem = {
        type,
        srcPath: destHostPath, // New Location
        destPath: destHostPath,
        status: 'organized',
        tmdb: tmdbData,
        updatedAt: new Date()
    };

    await db.collection('items').updateOne(
        { srcPath: destHostPath }, 
        { $set: newItem },
        { upsert: true }
    );

    return { success: true, newPath: destHostPath };
};
