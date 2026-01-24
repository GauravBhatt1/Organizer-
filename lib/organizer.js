import fs from 'fs';
import path from 'path';
import { isValidDataPath } from './pathUtils.js';

const sanitize = (n) => n.replace(/[<>:"/\\|?*]/g, '').trim();

export const organizeMediaItem = async (db, { sourcePath, type, tmdbData }) => {
    if (!isValidDataPath(sourcePath)) throw new Error(`Security: ${sourcePath} not in /data`);
    if (!fs.existsSync(sourcePath)) throw new Error(`Source not found: ${sourcePath}`);

    const settings = await db.collection('settings').findOne({ id: 'global' });
    const roots = type === 'movie' ? settings?.movieRoots : settings?.tvRoots;
    if (!roots?.length) throw new Error(`No ${type} root configured`);

    const destRoot = roots[0];
    // Strict Validation: Destination must be in /data and exist
    if (!isValidDataPath(destRoot)) throw new Error(`Configured root ${destRoot} is invalid`);
    
    // Attempt to create root if missing (safe inside container)
    if (!fs.existsSync(destRoot)) {
        try { await fs.promises.mkdir(destRoot, { recursive: true }); } 
        catch (e) { throw new Error(`Root ${destRoot} unwriteable: ${e.message}`); }
    }

    const ext = path.extname(sourcePath);
    let destPath;

    if (type === 'movie') {
        const title = sanitize(tmdbData.title);
        const year = tmdbData.year ? `(${tmdbData.year})` : '';
        const folder = `${title} ${year}`.trim();
        destPath = path.join(destRoot, folder, `${folder}${ext}`);
    } else {
        // TV logic relies on user having seasons, simplistic for manual organize
        const title = sanitize(tmdbData.title);
        destPath = path.join(destRoot, title, `Season 01`, `${title} - S01E01${ext}`);
    }

    if (sourcePath === destPath) return { success: true, newPath: destPath };

    const destDir = path.dirname(destPath);
    try {
        // Critical Fix: Recursive creation to prevent ENOENT
        await fs.promises.mkdir(destDir, { recursive: true });
    } catch (e) { throw new Error(`Mkdir failed: ${destDir} - ${e.message}`); }

    const isCopy = settings.isCopyMode;
    if (isCopy) {
        await fs.promises.copyFile(sourcePath, destPath);
    } else {
        try {
            await fs.promises.rename(sourcePath, destPath);
        } catch (e) {
            if (e.code === 'EXDEV') {
                await fs.promises.copyFile(sourcePath, destPath);
                await fs.promises.unlink(sourcePath);
            } else throw e;
        }
    }

    await db.collection('items').deleteOne({ srcPath: sourcePath });
    await db.collection('items').updateOne(
        { srcPath: destPath },
        { $set: { type, srcPath: destPath, destPath, status: 'organized', tmdb: tmdbData, updatedAt: new Date() } },
        { upsert: true }
    );

    return { success: true, newPath: destPath };
};