import fs from 'fs';
import path from 'path';
import { isValidDataPath } from './pathUtils.js';
import { parseMediaMetaFromFilename } from './metadataParser.js';

// Ultra-safe sanitizer: Removes special chars like !, @, # to prevent filesystem errors on Cloud/Network drives
const sanitize = (n) => {
    return n.replace(/[<>:"/\\|?*!@#$%^&]/g, '') // Remove invalid chars AND special symbols
            .replace(/\s+/g, ' ')                 // Collapse multiple spaces
            .trim();
};

export const organizeMediaItem = async (db, { sourcePath, type, tmdbData }) => {
    // 1. Validate Source
    if (!isValidDataPath(sourcePath)) throw new Error(`Security: ${sourcePath} is not allowed. Must start with /data`);
    if (!fs.existsSync(sourcePath)) throw new Error(`Source file not found: ${sourcePath}`);

    // Capture metadata from original filename before it's lost
    const sourceFileName = path.basename(sourcePath);
    const fileMeta = parseMediaMetaFromFilename(sourceFileName);

    // 2. Get Destination Root
    const settings = await db.collection('settings').findOne({ id: 'global' });
    const roots = type === 'movie' ? settings?.movieRoots : settings?.tvRoots;
    if (!roots?.length) throw new Error(`No ${type} root folders configured in settings.`);

    const destRoot = roots[0];
    
    // Strict Validation: Destination must be in /data
    if (!isValidDataPath(destRoot)) throw new Error(`Configured root ${destRoot} is invalid. It must start with /data`);
    
    // 3. Ensure Root Exists & IS WRITABLE
    if (!fs.existsSync(destRoot)) {
        try { 
            await fs.promises.mkdir(destRoot, { recursive: true }); 
        } catch (e) { 
            throw new Error(`Could not create root folder ${destRoot}: ${e.message}`); 
        }
    }

    // CRITICAL: Check for Write Permissions before proceeding
    try {
        await fs.promises.access(destRoot, fs.constants.W_OK);
    } catch (e) {
        throw new Error(`Permission Denied: App cannot write to ${destRoot}. Check Docker volume permissions.`);
    }

    const ext = path.extname(sourcePath);
    let destPath;

    // 4. Construct Destination Path (Safely)
    if (type === 'movie') {
        const title = sanitize(tmdbData.title); // "Sweetheart!" -> "Sweetheart"
        const year = tmdbData.year ? `(${tmdbData.year})` : '';
        const folder = `${title} ${year}`.trim();
        destPath = path.join(destRoot, folder, `${folder}${ext}`);
    } else {
        const title = sanitize(tmdbData.title);
        destPath = path.join(destRoot, title, `Season 01`, `${title} - S01E01${ext}`);
    }

    if (sourcePath === destPath) return { success: true, newPath: destPath };

    // 5. Create Destination Directory (Recursive)
    const destDir = path.dirname(destPath);
    try {
        await fs.promises.mkdir(destDir, { recursive: true });
    } catch (e) { 
        // Enhance error message to help debug
        throw new Error(`Failed to create directory '${destDir}'. \nSystem Error: ${e.message}`); 
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
        { 
            $set: { 
                type, 
                srcPath: destPath, 
                destPath, 
                status: 'organized', 
                tmdb: tmdbData, 
                // Preserve parsed quality even after rename
                quality: fileMeta.quality,
                source: fileMeta.source,
                codec: fileMeta.codec,
                updatedAt: new Date() 
            } 
        },
        { upsert: true }
    );

    return { success: true, newPath: destPath };
};