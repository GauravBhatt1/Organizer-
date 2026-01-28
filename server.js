import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import { runScanJob } from './lib/scanner.js';
import { organizeMediaItem } from './lib/organizer.js';
import { isValidDataPath } from './lib/pathUtils.js';
import { randomUUID } from 'crypto';
import { parseMediaMetaFromFilename } from './lib/metadataParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

// Middleware
app.use(cors());
app.use(express.json());

app.use('/api', (req, res, next) => {
    res.type('json');
    next();
});

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
            return raw ? JSON.parse(raw) : {};
        }
    } catch (e) { console.error("Config load error:", e); }
    return {};
}

function saveConfig(newConfig) {
    try {
        const current = loadConfig();
        const updated = { ...current, ...newConfig };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
        return updated;
    } catch (e) { throw new Error("Could not save config locally."); }
}

let client;
let db;
let currentConfig = loadConfig();

async function connectDB(uri) {
    if (!uri) return;
    if (client) try { await client.close(); } catch(e) {}
    try {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const dbName = currentConfig.dbName || 'jellyfin-organizer';
        db = client.db(dbName);
        console.log(`Connected to MongoDB: ${dbName}`);
        
        // Ensure Indexes
        await db.collection('items').createIndex({ libraryId: 1, scanId: 1, status: 1, type: 1 });
        await db.collection('jobs').createIndex({ libraryId: 1, finishedAt: -1 });

    } catch (err) {
        console.error('Mongo connection failed:', err.message);
        db = null;
    }
}

if (currentConfig.mongoUri) connectDB(currentConfig.mongoUri);

// --- HELPER: Get Active Context ---
async function getActiveContext() {
    if (!db) return null;
    const settings = await db.collection('settings').findOne({ id: 'global' });
    if (!settings || !settings.libraryId) return null;

    // Find latest scan (Running OR Completed) to show live data
    // Prefer running scan to show progress
    const runningScan = await db.collection('jobs').findOne({ libraryId: settings.libraryId, status: 'running' });
    if (runningScan) {
        return { libraryId: settings.libraryId, scanId: runningScan._id };
    }

    // Fallback to last completed
    const lastScan = await db.collection('jobs')
        .find({ libraryId: settings.libraryId, status: 'completed' })
        .sort({ finishedAt: -1 })
        .limit(1)
        .toArray();

    return {
        libraryId: settings.libraryId,
        scanId: lastScan.length > 0 ? lastScan[0]._id : null
    };
}

// --- ROUTES ---

// TMDB Proxy
app.get('/api/tmdb/search', async (req, res) => {
    const { type, query, key, language } = req.query;
    const safeKey = (key || '').trim();

    if (!safeKey) return res.status(400).json({ message: 'Missing API Key' });
    if (!query) return res.status(400).json({ message: 'Missing Query' });
    if (!type || !['movie', 'tv'].includes(type)) return res.status(400).json({ message: 'Invalid or missing search type' });

    try {
        console.log(`[TMDB] Searching ${type}: ${query}`);
        const tmdbUrl = `https://api.themoviedb.org/3/search/${type}?api_key=${safeKey}&language=${language || 'en-US'}&page=1&include_adult=false&query=${encodeURIComponent(query)}`;
        const response = await fetch(tmdbUrl);
        const data = await response.json();
        
        if (response.ok) {
            res.json(data);
        } else {
            console.error(`[TMDB] Error ${response.status}:`, data);
            res.status(response.status).json(data);
        }
    } catch (error) {
        console.error('[TMDB] Fetch Error:', error);
        res.status(500).json({ message: 'Internal Server Error: Unable to reach TMDB' });
    }
});

app.get('/api/tmdb/test', async (req, res) => {
    const apiKey = (req.query.key || '').trim();
    if (!apiKey) return res.status(400).json({ message: 'Missing API Key' });

    try {
        const tmdbUrl = `https://api.themoviedb.org/3/configuration?api_key=${apiKey}`;
        const response = await fetch(tmdbUrl);
        if (response.ok) {
            res.json({ success: true, status_code: response.status, message: 'Connection Successful' });
        } else {
            const data = await response.json();
            res.status(response.status).json({ success: false, message: data.status_message || 'Invalid API Key' });
        }
    } catch (error) {
        console.error('Backend TMDB Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error: Unable to reach TMDB' });
    }
});

app.post('/api/mongo/test', async (req, res) => {
    try {
        const { uri } = req.body;
        if (!uri) return res.status(400).json({ message: 'URI required' });
        const c = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await c.connect();
        await c.db('admin').command({ ping: 1 });
        await c.close();
        res.json({ success: true, message: 'Connected!' });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
});

app.get('/api/settings', async (req, res) => {
    let dbSettings = {};
    if (db) {
        try {
            const r = await db.collection('settings').findOne({ id: 'global' });
            if (r) { dbSettings = r; delete dbSettings._id; delete dbSettings.id; }
        } catch (e) {}
    }
    res.json({ ...dbSettings, mongoUri: currentConfig.mongoUri || '', dbName: currentConfig.dbName || '' });
});

app.post('/api/settings', async (req, res) => {
    try {
        const { mongoUri, dbName, ...appSettings } = req.body;
        
        // Single Root Validation
        const root = appSettings.libraryRoot;
        if (root && !isValidDataPath(root)) {
             return res.status(400).json({ message: `Path invalid` });
        }

        let libraryId = null;
        if (db) {
            const currentSettings = await db.collection('settings').findOne({ id: 'global' });
            if (currentSettings) {
                const oldRoot = currentSettings.libraryRoot || '';
                const newRoot = root || '';
                libraryId = currentSettings.libraryId;

                // New library ID if root changes
                if (oldRoot !== newRoot) {
                    libraryId = randomUUID();
                    console.log("Library root changed. Generated new libraryId:", libraryId);
                }
            } else {
                libraryId = randomUUID(); // First time setup
            }
        }

        const old = loadConfig();
        if ((mongoUri && mongoUri !== old.mongoUri) || (dbName && dbName !== old.dbName)) {
            currentConfig = saveConfig({ mongoUri, dbName });
            if (mongoUri !== old.mongoUri) await connectDB(mongoUri);
            else if (db) db = client.db(dbName);
            
            // If DB changed, ensure we have a library ID for the new DB context
            if (db) {
                const newDbSettings = await db.collection('settings').findOne({ id: 'global' });
                if (!newDbSettings) {
                    libraryId = randomUUID();
                } else if (!libraryId) {
                     libraryId = newDbSettings.libraryId || randomUUID();
                }
            }
        }

        if (db) {
            await db.collection('settings').updateOne(
                { id: 'global' }, 
                { $set: { ...appSettings, libraryId } }, 
                { upsert: true }
            );
        }
        res.json({ success: true, libraryId });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/library/reset', async (req, res) => {
    if (!db) return res.status(503).json({ message: 'DB Disconnected' });
    try {
        const settings = await db.collection('settings').findOne({ id: 'global' });
        if (!settings?.libraryId) return res.status(400).json({ message: 'No active library to reset' });

        await db.collection('items').deleteMany({ libraryId: settings.libraryId });
        await db.collection('jobs').deleteMany({ libraryId: settings.libraryId });
        
        res.json({ success: true, message: 'Library data reset.' });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/organize', async (req, res) => {
    if (!db) return res.status(503).json({ message: 'DB Disconnected' });
    try {
        const result = await organizeMediaItem(db, req.body);
        
        // RE-FETCH STATS IMMEDIATELY to allow atomic UI update
        const ctx = await getActiveContext();
        let stats = { movies: 0, tvShows: 0, uncategorized: 0 };
        
        if (ctx && ctx.scanId) {
            const [movies, tv, uncategorized] = await Promise.all([
                db.collection('items').countDocuments({ libraryId: ctx.libraryId, scanId: ctx.scanId, type: 'movie', status: 'organized' }),
                db.collection('items').countDocuments({ libraryId: ctx.libraryId, scanId: ctx.scanId, type: 'tv', status: 'organized' }),
                db.collection('items').countDocuments({ libraryId: ctx.libraryId, scanId: ctx.scanId, status: 'uncategorized' })
            ]);
            stats = { movies, tvShows: tv, uncategorized };
        }

        res.json({ ...result, stats });
    } catch (e) {
        console.error("Organize Error:", e);
        res.status(500).json({ message: e.message });
    }
});

app.post('/api/scan/start', async (req, res) => {
    if (!db) return res.status(503).json({ message: 'DB Disconnected' });
    try {
        const settings = await db.collection('settings').findOne({ id: 'global' });
        if (!settings?.libraryId) return res.status(400).json({ message: "Settings not initialized" });
        if (!settings?.libraryRoot) return res.status(400).json({ message: "No Library Root configured" });

        // Check for existing running job
        const active = await db.collection('jobs').findOne({ 
            libraryId: settings.libraryId,
            status: 'running' 
        });

        if (active) {
            // Auto-reset stuck jobs older than 5 minutes
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (active.startedAt < fiveMinutesAgo) {
                console.warn(`Resetting stuck job ${active._id}`);
                await db.collection('jobs').updateOne({ _id: active._id }, {
                    $set: { 
                        status: 'failed', 
                        finishedAt: new Date(), 
                        errors: ['System: Auto-terminated stuck job (timeout)']
                    }
                });
            } else {
                return res.status(409).json({ message: 'Scan already running' });
            }
        }

        const job = {
            libraryId: settings.libraryId, 
            status: 'running', 
            startedAt: new Date(),
            totalFiles: 0, processedFiles: 0,
            stats: { movies: 0, tv: 0, uncategorized: 0, errors: 0 },
            logs: [], errors: []
        };
        const r = await db.collection('jobs').insertOne(job);
        
        // Run scan in background, DO NOT await it here to avoid blocking response
        // The runScanJob function must handle its own errors/cleanup
        runScanJob(db, r.insertedId);
        
        res.json({ success: true, jobId: r.insertedId });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/scan/current', async (req, res) => {
    if (!db) return res.json(null);
    const settings = await db.collection('settings').findOne({ id: 'global' });
    if (!settings?.libraryId) return res.json(null);

    const jobs = await db.collection('jobs')
        .find({ libraryId: settings.libraryId })
        .sort({ startedAt: -1 })
        .limit(1).toArray();
    res.json(jobs[0] || null);
});

app.get('/api/dashboard', async (req, res) => {
    try {
        const ctx = await getActiveContext();
        
        // If no context, return empty
        if (!ctx || !ctx.scanId) {
            return res.json({ 
                movies: 0, 
                tvShows: 0, 
                uncategorized: 0, 
                message: "No scans found.",
                lastScan: null 
            });
        }

        // Global Totals (Scoped to active scan ID)
        // This allows seeing items fill up as the scan progresses if we use the running scanId
        const [movies, tv, uncategorized] = await Promise.all([
            db.collection('items').countDocuments({ libraryId: ctx.libraryId, scanId: ctx.scanId, type: 'movie', status: 'organized' }),
            db.collection('items').countDocuments({ libraryId: ctx.libraryId, scanId: ctx.scanId, type: 'tv', status: 'organized' }),
            db.collection('items').countDocuments({ libraryId: ctx.libraryId, scanId: ctx.scanId, status: 'uncategorized' })
        ]);

        // Fetch object for the active scan ID we are using
        let lastScan = await db.collection('jobs').findOne({ _id: ctx.scanId });

        res.json({ 
            movies, 
            tvShows: tv, 
            uncategorized,
            lastScan: lastScan || null
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/uncategorized', async (req, res) => {
    const ctx = await getActiveContext();
    if (!ctx || !ctx.scanId) return res.json([]);

    const items = await db.collection('items')
        .find({ libraryId: ctx.libraryId, scanId: ctx.scanId, status: 'uncategorized' })
        .limit(100)
        .toArray();
    
    res.json(items.map(i => {
        const quality = i.quality || parseMediaMetaFromFilename(path.basename(i.srcPath)).quality;
        return { 
            id: i._id, 
            fileName: path.basename(i.srcPath), 
            filePath: i.srcPath,
            cleanTitle: i.cleanTitle, // Helper for UI
            autoIdReason: i.autoIdReason, // Show why it wasn't auto-moved
            quality
        };
    }));
});

app.get('/api/fs/list', (req, res) => {
    // We allow ANY path now, default to /
    const browsePath = req.query.path || '/';
    
    try {
        if (!fs.existsSync(browsePath)) return res.status(404).json({ message: 'Path not found' });
        const items = fs.readdirSync(browsePath, { withFileTypes: true })
            .filter(i => i.isDirectory())
            .map(i => ({ name: i.name, path: path.join(browsePath, i.name), isDir: true }))
            .sort((a, b) => a.name.localeCompare(b.name));
        res.json({ currentPath: browsePath, items });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/fs/validate', (req, res) => {
    const p = req.query.path;
    if (!p) return res.json({ valid: false });
    try {
        if (!fs.existsSync(p)) return res.json({ valid: false });
        fs.accessSync(p, fs.constants.R_OK);
        res.json({ valid: true });
    } catch (e) { res.json({ valid: false }); }
});

app.get('/api/movies', async (req, res) => {
    try {
        const ctx = await getActiveContext();
        if (!ctx || !ctx.scanId) return res.json([]);

        const movies = await db.collection('items')
            .find({ libraryId: ctx.libraryId, scanId: ctx.scanId, type: 'movie', status: 'organized' })
            .sort({ 'tmdb.title': 1 }).limit(100).toArray();
        
        res.json(movies.map(m => {
            const quality = m.quality || parseMediaMetaFromFilename(path.basename(m.srcPath)).quality;
            return {
                id: m._id, title: m.tmdb?.title, year: m.tmdb?.year,
                posterPath: m.tmdb?.posterPath, overview: m.tmdb?.overview, filePath: m.destPath,
                quality
            };
        }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tvshows', async (req, res) => {
    try {
        const ctx = await getActiveContext();
        if (!ctx || !ctx.scanId) return res.json([]);

        const shows = await db.collection('items').aggregate([
            { $match: { libraryId: ctx.libraryId, scanId: ctx.scanId, type: 'tv', status: 'organized' } },
            { $group: {
                _id: "$tmdb.id", 
                title: { $first: "$tmdb.title" },
                year: { $first: "$tmdb.year" },
                posterPath: { $first: "$tmdb.posterPath" },
                overview: { $first: "$tmdb.overview" },
                filePath: { $first: "$destPath" },
                quality: { $first: "$quality" },
                srcPath: { $first: "$srcPath" }
            }},
            { $sort: { title: 1 } }
        ]).toArray();

        res.json(shows.map(s => {
            const quality = s.quality || parseMediaMetaFromFilename(path.basename(s.srcPath)).quality;
            return {
                id: s._id, title: s.title, year: s.year,
                posterPath: s.posterPath, overview: s.overview, filePath: s.filePath,
                quality
            };
        }));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on ${PORT}`);
});