import fs from 'fs';
import path from 'path';
import { isValidDataPath } from './pathUtils.js';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

const sanitize = (name) => {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
};

export const organizeMediaItem = async (db, params) => {
    // sourcePath comes from DB, which should now be a valid /data path
    const { sourcePath, type, tmdbData } = params;
    
    // 1. Validation
    if (!isValidDataPath(sourcePath)) {
         throw new Error(`Path Security: ${sourcePath} is not in /data`);
    }

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

    // Use first configured root
    const destinationRoot = roots[0];

    // Verify root exists
    if (!fs.existsSync(destinationRoot)) {
        throw new Error(`Configured root directory does not exist: ${destinationRoot}`);
    }

    // Check Mount Safety
    if (settings.mountSafety) {
        try {
            const testFile = path.join(destinationRoot, '.write_test');
            fs.writeFileSync(testFile, '');
            fs.unlinkSync(testFile);
        } catch (e) {
            throw new Error(`Destination root is not writable. Check permissions. Error: ${e.message}`);
        }
    }

    // 2. Construct Destination Paths
    let relativePath = '';
    const ext = path.extname(sourcePath);
    
    if (type === 'movie') {
        const cleanTitle = sanitize(tmdbData.title);
        const year = tmdbData.year ? String(tmdbData.year) : '';
        const folderName = year ? `${cleanTitle} (${year})` : cleanTitle;
        const fileName = year ? `${cleanTitle} (${year})${ext}` : `${cleanTitle}${ext}`;
        relativePath = path.join(folderName, fileName);

    } else if (type === 'tv') {
        const cleanSeries = sanitize(tmdbData.title);
        const targetDir = path.join(cleanSeries, 'Season 01');
        const targetFile = `${cleanSeries} - S01E01${ext}`;
        relativePath = path.join(targetDir, targetFile);
    }

    const destPath = path.join(destinationRoot, relativePath);

    // 3. Create Directory (Recursive)
    const destDir = path.dirname(destPath);
    
    if (VIDEO_EXTENSIONS.some(ex => destDir.toLowerCase().endsWith(ex))) {
        throw new Error(`Safety Block: Target directory looks like a video file.`);
    }

    try {
        await fs.promises.mkdir(destDir, { recursive: true });
    } catch (err) {
        throw new Error(`Failed to create directory: ${destDir}. Error: ${err.message}`);
    }

    // 4. Perform Move
    const isCopyMode = settings.isCopyMode || false;

    if (sourcePath === destPath) {
        return { success: true, newPath: destPath, message: "File is already in location." };
    }

    if (isCopyMode) {
        await fs.promises.copyFile(sourcePath, destPath);
    } else {
        try {
            await fs.promises.rename(sourcePath, destPath);
        } catch (e) {
            if (e.code === 'EXDEV') {
                await fs.promises.copyFile(sourcePath, destPath);
                await fs.promises.unlink(sourcePath);
            } else {
                throw e;
            }
        }
    }

    // 5. Cleanup
    if (!isCopyMode) {
        try {
            const parent = path.dirname(sourcePath);
            // Ensure we don't delete the root
            if (parent !== destinationRoot && parent !== '/data') {
                const files = await fs.promises.readdir(parent);
                if (files.length === 0) await fs.promises.rmdir(parent);
            }
        } catch (e) {}
    }

    // 6. Update Database
    await db.collection('items').deleteOne({ srcPath: sourcePath });

    const newItem = {
        type,
        srcPath: destPath, // New Location
        destPath: destPath,
        status: 'organized',
        tmdb: tmdbData,
        updatedAt: new Date()
    };

    await db.collection('items').updateOne(
        { srcPath: destPath }, 
        { $set: newItem },
        { upsert: true }
    );

    return { success: true, newPath: destPath };
};