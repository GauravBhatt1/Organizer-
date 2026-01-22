
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const VIDEO_EXTENSIONS = ['.mkv', '.mp4', '.avi', '.m4v', '.ts', '.mov', '.wmv'];

// Helper to sanitize filenames
const sanitize = (name) => {
    return name.replace(/[<>:"/\\|?*]/g, '').trim();
};

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

    // Default to first root folder
    const destinationRoot = roots[0];

    // Check Mount Safety if enabled
    if (settings.mountSafety) {
        try {
            // Simple check: Try to write a temp file to root to ensure writability
            const testFile = path.join(destinationRoot, '.write_test');
            fs.writeFileSync(testFile, '');
            fs.unlinkSync(testFile);
        } catch (e) {
            throw new Error(`Destination root ${destinationRoot} is not writable or safe. Check Mount Safety settings.`);
        }
    }

    // 2. Construct Destination Path
    let destinationPath = '';
    const ext = path.extname(sourcePath);
    
    if (type === 'movie') {
        const cleanTitle = sanitize(tmdbData.title);
        const year = tmdbData.year || '';
        const folderName = year ? `${cleanTitle} (${year})` : cleanTitle;
        const fileName = year ? `${cleanTitle} (${year})${ext}` : `${cleanTitle}${ext}`;
        destinationPath = path.join(destinationRoot, folderName, fileName);
    } else if (type === 'tv') {
        // Basic TV support - assumes Season 1 Episode 1 if not provided, 
        // or just puts in Series folder if we lack S/E info.
        // For Uncategorized "Identify", we often lack S/E unless parsed.
        // This implementation focuses on Movies as per prompt context, 
        // but handles TV by placing in Series folder if S/E missing.
        const cleanSeries = sanitize(tmdbData.title);
        destinationPath = path.join(destinationRoot, cleanSeries, `Season 01`, `${cleanSeries} - S01E01${ext}`);
        // NOTE: A robust TV organizer needs S/E parsing from filename. 
        // For now, we are implementing the mechanism, defaulting to S01E01 for unparsed items 
        // to verify movement works.
    }

    if (!destinationPath) throw new Error("Could not determine destination path.");

    // 3. Perform Move
    const destDir = path.dirname(destinationPath);
    
    // Create directory
    await fs.promises.mkdir(destDir, { recursive: true });

    // Move file
    const isCopyMode = settings.isCopyMode || false;
    
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

    // 4. Cleanup Empty Parents (up to root)
    if (!isCopyMode) {
        try {
            const parent = path.dirname(sourcePath);
            const files = await fs.promises.readdir(parent);
            if (files.length === 0) {
                await fs.promises.rmdir(parent);
            }
        } catch (e) { 
            // Ignore cleanup errors (non-critical)
            console.warn("Cleanup warning:", e.message);
        }
    }

    // 5. Update Database
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
