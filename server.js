import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import { runScanJob } from './lib/scanner.js';
import { organizeMediaItem } from './lib/organizer.js';
import { isValidDataPath, DATA_ROOT } from './lib/pathUtils.js';

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

        // --- MIGRATION: Enforce /data paths ---
        console.log("Running path consistency check...");
        
        const settings = await db.collection('settings').findOne({ id: 'global' });
        if (settings) {
            // Helper to replace ANY root that isn't /data with /data (naive replacement for /host)
            const fixPathArr = (arr) => (arr || []).map(p => {
                if (p.startsWith('/data')) return p;
                // Replace /host, /mnt, etc with /data if it looks like a migration
                if (p.startsWith('/host')) return p.replace('/host', '/data');
                return path.join('/data', path.basename(p)); // Fallback
            });

            const newMovieRoots = fixPathArr(settings.movieRoots);
            const newTvRoots = fixPathArr(settings.tvRoots);
            
            if (JSON.stringify(newMovieRoots) !== JSON.stringify(settings.movieRoots) || 
                JSON.stringify(newTvRoots) !== JSON.stringify(settings.tvRoots)) {
                
                await db.collection('settings').updateOne({ id: 'global' }, { 
                    $set: { movieRoots: newMovieRoots, tvRoots: newTvRoots } 
                });
                console.log("Migrated settings paths to /data structure");
            }
        }

        // Wipe Items with invalid paths (anything not starting with /data)
        const invalidItems = await db.collection('items').countDocuments({ srcPath: { $not: { $regex: /^\/data/ } } });
        if (invalidItems > 0) {
            console.log(`Found ${invalidItems} items with invalid paths. Removing...`);
            await db.collection('items').deleteMany({ srcPath: { $not: { $regex: /^\/data/ } } });
        }

    } catch (err) {
        console.error('Mongo connection failed:', err.message);
        db = null;
    }
}

if (currentConfig.mongoUri) connectDB(currentConfig.mongoUri);

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
        
        // Strict Path Validation
        const paths = [...(appSettings.movieRoots || []), ...(appSettings.tvRoots || [])];
        for (const p of paths) {
            if (!isValidDataPath(p)) return res.status(400).json({ message: `Path must start with ${DATA_ROOT}` });
        }

        const old = loadConfig();
        if ((mongoUri && mongoUri !== old.mongoUri) || (dbName && dbName !== old.dbName)) {
            currentConfig = saveConfig({ mongoUri, dbName });
            if (mongoUri !== old.mongoUri) await connectDB(mongoUri);
            else if (db) db = client.db(dbName);
        }
        if (db) await db.collection('settings').updateOne({ id: 'global' }, { $set: appSettings }, { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post('/api/organize', async (req, res) => {
    if (!db) return res.status(503).json({ message: 'DB Disconnected' });
    try {
        const result = await organizeMediaItem(db, req.body);
        res.json(result);
    } catch (e) {
        console.error("Organize Error:", e);
        res.status(500).json({ message: e.message });
    }
});

app.post('/api/scan/start', async (req, res) => {
    if (!db) return res.status(503).json({ message: 'DB Disconnected' });
    try {
        const active = await db.collection('jobs').findOne({ status: 'running' });
        if (active) return res.status(409).json({ message: 'Scan running' });

        const job = {
            status: 'running', startedAt: new Date(),
            totalFiles: 0, processedFiles: 0,
            stats: { movies: 0, tv: 0, uncategorized: 0, errors: 0 },
            logs: [], errors: []
        };
        const r = await db.collection('jobs').insertOne(job);
        
        // Scan is always read-only now
        runScanJob(db, r.insertedId).catch(e => {
            console.error("Critical Scanner Crash:", e);
            db.collection('jobs').updateOne({ _id: r.insertedId }, { 
                $set: { 
                    status: 'failed', 
                    finishedAt: new Date(),
                    errors: [{ path: 'System', error: e.message || 'Critical Crash' }]
                } 
            });
        });
        
        res.json({ success: true, jobId: r.insertedId });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/scan/current', async (req, res) => {
    if (!db) return res.json(null);
    const jobs = await db.collection('jobs').find().sort({ startedAt: -1 }).limit(1).toArray();
    res.json(jobs[0] || null);
});

app.get('/api/dashboard', async (req, res) => {
    if (!db) return res.json({ movies: 0, tvShows: 0, uncategorized: 0 });
    try {
        const [movies, tv, uncategorized] = await Promise.all([
            db.collection('items').countDocuments({ type: 'movie', status: 'organized' }),
            db.collection('items').countDocuments({ type: 'tv', status: 'organized' }),
            db.collection('items').countDocuments({ status: 'uncategorized' })
        ]);
        res.json({ movies, tvShows: tv, uncategorized });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/uncategorized', async (req, res) => {
    if (!db) return res.json([]);
    const items = await db.collection('items').find({ status: 'uncategorized' }).limit(100).toArray();
    res.json(items.map(i => ({ id: i._id, fileName: path.basename(i.srcPath), filePath: i.srcPath })));
});

app.get('/api/fs/list', (req, res) => {
    const browsePath = req.query.path || DATA_ROOT;
    if (!isValidDataPath(browsePath)) return res.status(400).json({ message: `Access restricted to ${DATA_ROOT}` });

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
    if (!isValidDataPath(p)) return res.json({ valid: false });
    try {
        if (!fs.existsSync(p)) return res.json({ valid: false });
        fs.accessSync(p, fs.constants.R_OK);
        res.json({ valid: true });
    } catch (e) { res.json({ valid: false }); }
});

app.get('/api/movies', async (req, res) => {
    try {
        if (!db) return res.json([]);
        const movies = await db.collection('items')
            .find({ type: 'movie', status: 'organized' })
            .sort({ 'tmdb.title': 1 }).limit(100).toArray();
        res.json(movies.map(m => ({
            id: m._id, title: m.tmdb?.title, year: m.tmdb?.year,
            posterPath: m.tmdb?.posterPath, overview: m.tmdb?.overview, filePath: m.destPath
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tvshows', async (req, res) => {
    try {
        if (!db) return res.json([]);
        const shows = await db.collection('items').aggregate([
            { $match: { type: 'tv', status: 'organized' } },
            { $group: {
                _id: "$tmdb.id", 
                title: { $first: "$tmdb.title" },
                year: { $first: "$tmdb.year" },
                posterPath: { $first: "$tmdb.posterPath" },
                overview: { $first: "$tmdb.overview" },
                filePath: { $first: "$destPath" }
            }},
            { $sort: { title: 1 } }
        ]).toArray();
        res.json(shows.map(s => ({
            id: s._id, title: s.title, year: s.year,
            posterPath: s.posterPath, overview: s.overview, filePath: s.filePath
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on ${PORT}`);
    console.log(`DATA ROOT: ${DATA_ROOT}`);
});