import fs from 'fs';
import path from 'path';
import { isValidDataPath } from './pathUtils.js';
import { parseMediaMetaFromFilename } from './metadataParser.js';

const sanitize = (n) => {
    return n.replace(/[<>:"/\\|?*!@#$%^&]/g, '') 
            .replace(/\s+/g, ' ')                 
            .trim();
};

const pad = (num, size = 2) => {
    let s = "000000000" + num;
    return s.substr(s.length - size);
};

export const organizeMediaItem = async (db, { sourcePath, type, tmdbData }) => {
    // 1. Validate
    if (!fs.existsSync(sourcePath)) throw new Error(`Source file not found: ${sourcePath}`);

    // Capture metadata
    const sourceFileName = path.basename(sourcePath);
    const fileMeta = parseMediaMetaFromFilename(sourceFileName);

    // 2. Get Library Root
    const settings = await db.collection('settings').findOne({ id: 'global' });
    const root = settings?.libraryRoot;
    
    if (!root) throw new Error("Library Root not configured.");
    if (!fs.existsSync(root)) throw new Error(`Library Root does not exist: ${root}`);

    // 3. Construct Destination
    let destRoot;
    let destPath;
    const ext = path.extname(sourcePath);

    if (type === 'movie') {
        // {Root}/Movies/Title (Year)/Title (Year).ext
        destRoot = path.join(root, 'Movies');
        
        const title = sanitize(tmdbData.title);
        const year = tmdbData.year ? `(${tmdbData.year})` : '';
        const folderName = `${title} ${year}`.trim();
        const qualitySuffix = fileMeta.quality ? ` - ${fileMeta.quality}` : '';
        const fileName = `${folderName}${qualitySuffix}${ext}`;
        
        destPath = path.join(destRoot, folderName, fileName);
    } else {
        // {Root}/TV Shows/Title/Season XX/Title - SXXEXX.ext
        destRoot = path.join(root, 'TV Shows');
        
        const title = sanitize(tmdbData.title);
        const seasonNum = pad(tmdbData.season || 1);
        const episodeNum = pad(tmdbData.episode || 1);
        
        const folderName = title;
        const seasonFolder = `Season ${seasonNum}`;
        const fileName = `${title} - S${seasonNum}E${episodeNum}${ext}`;
        
        destPath = path.join(destRoot, folderName, seasonFolder, fileName);
    }

    if (sourcePath === destPath) return { success: true, newPath: destPath };

    // 4. Create Directories
    const destDir = path.dirname(destPath);
    await fs.promises.mkdir(destDir, { recursive: true });

    // 5. Move or Copy
    const isCopy = settings.isCopyMode;
    if (isCopy) {
        await fs.promises.copyFile(sourcePath, destPath);
    } else {
        try {
            await fs.promises.rename(sourcePath, destPath);
        } catch (e) {
            // Fallback for cross-device
            await fs.promises.copyFile(sourcePath, destPath);
            await fs.promises.unlink(sourcePath);
        }
    }

    // 6. Update DB
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
                quality: fileMeta.quality,
                source: fileMeta.source,
                codec: fileMeta.codec,
                updatedAt: new Date(),
                libraryId: settings.libraryId
            } 
        },
        { upsert: true }
    );

    return { success: true, newPath: destPath };
};