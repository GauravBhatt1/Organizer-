import fs from 'fs';
import path from 'path';
import { isValidDataPath } from './pathUtils.js';
import { parseMediaMetaFromFilename } from './metadataParser.js';

// Ultra-safe sanitizer: Removes special chars like !, @, # to prevent filesystem errors
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

    try {
        await fs.promises.access(destRoot, fs.constants.W_OK);
    } catch (e) {
        throw new Error(`Permission Denied: App cannot write to ${destRoot}. Check Docker volume permissions.`);
    }

    const ext = path.extname(sourcePath);
    let destPath;

    // 4. Construct Destination Path (Strict Structure Rule)
    if (type === 'movie') {
        // Structure: MoviesRoot/Title (Year)/Title (Year)[optional quality].ext
        const title = sanitize(tmdbData.title);
        const year = tmdbData.year ? `(${tmdbData.year})` : '';
        const folderName = `${title} ${year}`.trim();
        
        // Add Quality suffix if available (e.g. "Title (Year) - 1080p.mkv")
        const qualitySuffix = fileMeta.quality ? ` - ${fileMeta.quality}` : '';
        const fileName = `${folderName}${qualitySuffix}${ext}`;
        
        destPath = path.join(destRoot, folderName, fileName);
    } else {
        // Structure: TvRoot/Show Name/Season 01/Show Name - S01E01.ext
        const title = sanitize(tmdbData.title);
        const seasonNum = pad(tmdbData.season || 1);
        const episodeNum = pad(tmdbData.episode || 1);
        
        const folderName = title;
        const seasonFolder = `Season ${seasonNum}`;
        const fileName = `${title} - S${seasonNum}E${episodeNum}${ext}`;
        
        destPath = path.join(destRoot, folderName, seasonFolder, fileName);
    }

    if (sourcePath === destPath) return { success: true, newPath: destPath };

    // 5. Create Destination Directory (Recursive)
    const destDir = path.dirname(destPath);
    try {
        await fs.promises.mkdir(destDir, { recursive: true });
    } catch (e) { 
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

    // 7. Update Database (Mark as Organized)
    // This ensures "Old organized files" are tracked and won't reappear in Uncategorized 
    // because they are now physically in the destination (which is skipped by scanner).
    await db.collection('items').deleteOne({ srcPath: sourcePath });
    await db.collection('items').updateOne(
        { srcPath: destPath },
        { 
            $set: { 
                type, 
                srcPath: destPath, 
                destPath, 
                status: 'organized', // Rule 3 count relies on this
                tmdb: tmdbData, 
                quality: fileMeta.quality,
                source: fileMeta.source,
                codec: fileMeta.codec,
                updatedAt: new Date(),
                libraryId: settings.libraryId // Bind to current library
            } 
        },
        { upsert: true }
    );

    return { success: true, newPath: destPath };
};