import fs from 'fs';
import path from 'path';
import { isValidDataPath } from './pathUtils.js';

// Robust sanitizer for folder names to prevent FS errors
const sanitize = (n) => n.replace(/[<>:"/\\|?*]/g, '').trim();

export const organizeMediaItem = async (db, { sourcePath, type, tmdbData }) => {
    // 1. Validate Source
    if (!isValidDataPath(sourcePath)) throw new Error(`Security: ${sourcePath} is not allowed. Must start with /data`);
    if (!fs.existsSync(sourcePath)) throw new Error(`Source file not found: ${sourcePath}`);

    // 2. Get Destination Root
    const settings = await db.collection('settings').findOne({ id: 'global' });
    const roots = type === 'movie' ? settings?.movieRoots : settings?.tvRoots;
    if (!roots?.length) throw new Error(`No ${type} root folders configured in settings.`);

    const destRoot = roots[0];
    // Strict Validation: Destination must be in /data
    if (!isValidDataPath(destRoot)) throw new Error(`Configured root ${destRoot} is invalid. It must start with /data`);
    
    // 3. Ensure Root Exists
    if (!fs.existsSync(destRoot)) {
        try { 
            await fs.promises.mkdir(destRoot, { recursive: true }); 
        } catch (e) { 
            throw new Error(`Could not create root folder ${destRoot}: ${e.message}`); 
        }
    }

    const ext = path.extname(sourcePath);
    let destPath;

    // 4. Construct Destination Path
    if (type === 'movie') {
        const title = sanitize(tmdbData.title);
        const year = tmdbData.year ? `(${tmdbData.year})` : '';
        const folder = `${title} ${year}`.trim();
        destPath = path.join(destRoot, folder, `${folder}${ext}`);
    } else {
        const title = sanitize(tmdbData.title);
        // Default to Season 1 for single file organization if not detected otherwise
        destPath = path.join(destRoot, title, `Season 01`, `${title} - S01E01${ext}`);
    }

    if (sourcePath === destPath) return { success: true, newPath: destPath };

    // 5. Create Destination Directory (Recursive)
    const destDir = path.dirname(destPath);
    try {
        await fs.promises.mkdir(destDir, { recursive: true });
    } catch (e) { 
        throw new Error(`Failed to create directory ${destDir}: ${e.message}`); 
    }

    // 6. Move or Copy
    const isCopy = settings.isCopyMode;
    if (isCopy) {
        await fs.promises.copyFile(sourcePath, destPath);
    } else {
        try {
            await fs.promises.rename(sourcePath, destPath);
        } catch (e) {
            if (e.code === 'EXDEV') { // Cross-device move fallback
                await fs.promises.copyFile(sourcePath, destPath);
                await fs.promises.unlink(sourcePath);
            } else throw e;
        }
    }

    // 7. Update Database
    await db.collection('items').deleteOne({ srcPath: sourcePath });
    await db.collection('items').updateOne(
        { srcPath: destPath },
        { $set: { type, srcPath: destPath, destPath, status: 'organized', tmdb: tmdbData, updatedAt: new Date() } },
        { upsert: true }
    );

    return { success: true, newPath: destPath };
};