
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

// API Response Helper Middleware (Enforce JSON)
app.use('/api', (req, res, next) => {
    res.type('json');
    next();
});

// Request Logger
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
});

// --- Configuration Management ---
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
            return raw ? JSON.parse(raw) : {};
        }
    } catch (e) {
        console.error("Failed to load config file:", e);
    }
    return {};
}

function saveConfig(newConfig) {
    try {
        const current = loadConfig();
        const updated = { ...current, ...newConfig };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
        return updated;
    } catch (e) {
        console.error("Failed to save config file:", e);
        throw new Error("Could not save configuration locally.");
    }
}

// --- MongoDB Setup ---
let client;
let db;
let currentConfig = loadConfig();

async function connectDB(uri) {
    if (!uri) return;
    if (client) {
        try { await client.close(); } catch(e) {}
    }
    try {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await client.connect();
        const dbName = currentConfig.dbName || 'jellyfin-organizer';
        db = client.db(dbName);
        console.log(`Connected to MongoDB: ${dbName}`);

        // --- MIGRATION / CLEANUP ---
        // Clean up old paths that don't start with /data (from previous /host configuration)
        const invalidItems = await db.collection('items').countDocuments({ srcPath: { $not: { $regex: /^\/data/ } } });
        if (invalidItems > 0) {
            console.log(`Found ${invalidItems} records with invalid paths. Wiping items and jobs for a fresh start...`);
            await db.collection('items').deleteMany({});
            await db.collection('jobs').deleteMany({});
            console.log("Database cleaned. Please re-scan your library.");
        }

    } catch (err) {
        console.error('Mongo connection failed:', err.message);
        db = null;
    }
}

// Initial connection
if (currentConfig.mongoUri) {
    connectDB(currentConfig.mongoUri);
}

// ================= API ROUTES =================

// DB Test
app.post('/api/mongo/test', async (req, res) => {
    try {
        const { uri } = req.body;
        if (!uri) return res.status(400).json({ message: 'URI is required' });
        const testClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
        await testClient.connect();
        await testClient.db('admin').command({ ping: 1 });
        await testClient.close();
        res.json({ success: true, message: 'Connection Successful!' });
    } catch (err) {
        res.status(400).json({ success: false, message: `Connection failed: ${err.message}` });
    }
});

// TMDB Proxy
app.get('/api/tmdb/test', async (req, res) => {
    const apiKey = req.query.key;
    if (!apiKey) return res.status(400).json({ message: 'Missing API Key' });

    try {
        const tmdbUrl = `https://api.themoviedb.org/3/configuration?api_key=${apiKey}`;
        const response = await fetch(tmdbUrl);
        
        if (response.ok) {
            res.json({ success: true, status_code: response.status, message: 'Connection Successful' });
        } else {
            const data = await response.json();
            res.status(response.status).json({ success: false, status_code: response.status, message: data.status_message || 'Invalid API Key' });
        }
    } catch (error) {
        console.error('Backend TMDB Error:', error);
        res.status(500).json({ success: false, status_code: 500, message: 'Internal Server Error: Unable to reach TMDB' });
    }
});

app.get('/api/tmdb/search', async (req, res) => {
    const { type, query, key, language } = req.query;
    if (!key) return res.status(400).json({ message: 'Missing API Key' });
    if (!query) return res.status(400).json({ message: 'Missing Query' });
    if (!type || !['movie', 'tv'].includes(type)) return res.status(400).json({ message: 'Invalid or missing search type' });

    try {
        const tmdbUrl = `https://api.themoviedb.org/3/search/${type}?api_key=${key}&language=${language || 'en-US'}&page=1&include_adult=false&query=${encodeURIComponent(query)}`;
        const response = await fetch(tmdbUrl);
        const data = await response.json();
        
        if (response.ok) {
            res.json(data);
        } else {
            res.status(response.status).json(data);
        }
    } catch (error) {
        console.error('Backend TMDB Search Error:', error);
        res.status(500).json({ message: 'Internal Server Error: Unable to reach TMDB' });
    }
});

// Settings
app.get('/api/settings', async (req, res) => {
    try {
        const localConfig = loadConfig();
        let dbSettings = {};
        if (db) {
            try {
                const result = await db.collection('settings').findOne({ id: 'global' });
                if (result) {
                    dbSettings = result;
                    delete dbSettings._id;
                    delete dbSettings.id;
                }
            } catch (err) { console.warn("DB settings fetch failed:", err.message); }
        }
        res.json({ ...dbSettings, mongoUri: localConfig.mongoUri || '', dbName: localConfig.dbName || '' });
    } catch (e) {
        console.error("Error serving settings:", e);
        res.status(500).json({ message: "Internal Server Error loading settings" });
    }
});

app.post('/api/settings', async (req, res) => {
    try {
        const { mongoUri, dbName, ...appSettings } = req.body;
        
        // Validate paths in settings
        const pathsToCheck = [...(appSettings.movieRoots || []), ...(appSettings.tvRoots || [])];
        for (const p of pathsToCheck) {
            if (!isValidDataPath(p)) {
                return res.status(400).json({ message: `Path ${p} is invalid. All paths must start with ${DATA_ROOT}` });
            }
        }

        const oldConfig = loadConfig();
        if ((mongoUri && mongoUri !== oldConfig.mongoUri) || (dbName && dbName !== oldConfig.dbName)) {
            currentConfig = saveConfig({ mongoUri, dbName });
            if (mongoUri !== oldConfig.mongoUri) await connectDB(mongoUri);
            else if (db && dbName !== oldConfig.dbName) db = client.db(dbName);
        }
        if (db) {
            await db.collection('settings').updateOne({ id: 'global' }, { $set: appSettings }, { upsert: true });
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});

// Organization Endpoint
app.post('/api/organize', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ message: 'Database not connected' });
        
        const { sourcePath } = req.body;
        if (!isValidDataPath(sourcePath)) {
            return res.status(400).json({ message: `Access Denied: Path must start with ${DATA_ROOT}` });
        }

        const result = await organizeMediaItem(db, req.body);
        res.json(result);
    } catch (e) {
        console.error("Organization Error:", e);
        res.status(500).json({ message: e.message });
    }
});

// Scan Jobs
app.post('/api/scan/start', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ message: 'Database not connected' });
        const activeJob = await db.collection('jobs').findOne({ status: 'running' });
        if (activeJob) return res.status(409).json({ message: 'Scan running', jobId: activeJob._id });

        const { dryRun, isCopyMode } = req.body;
        const job = {
            status: 'running',
            startedAt: new Date(),
            totalFiles: 0,
            processedFiles: 0,
            stats: { movies: 0, tv: 0, uncategorized: 0, errors: 0 },
            logs: [],
            errors: []
        };
        const result = await db.collection('jobs').insertOne(job);
        // Scanner runs asynchronously
        runScanJob(db, result.insertedId, { dryRun, isCopyMode }).catch(err => {
            console.error("Scanner Error:", err);
            db.collection('jobs').updateOne({ _id: result.insertedId }, { $set: { status: 'failed', finishedAt: new Date() } });
        });
        res.json({ success: true, jobId: result.insertedId });
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/scan/status/:jobId', async (req, res) => {
    try {
        if (!db) return res.status(503).json({ message: 'Database not connected' });
        const job = await db.collection('jobs').findOne({ _id: new ObjectId(req.params.jobId) });
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json(job);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get('/api/scan/current', async (req, res) => {
    try {
        if (!db) return res.json(null);
        const job = await db.collection('jobs').find().sort({ startedAt: -1 }).limit(1).toArray();
        res.json(job[0] || null);
    } catch (e) { res.json(null); }
});

// Dashboard Data
app.get('/api/dashboard', async (req, res) => {
    try {
        if (!db) return res.json({ movies: 0, tvShows: 0, uncategorized: 0 });
        
        const [moviesCount, tvAggregation, uncategorizedCount] = await Promise.all([
            // Movies: Simple count of organized movie files
            db.collection('items').countDocuments({ type: 'movie', status: 'organized' }),
            
            // TV: Distinct count of Series (based on TMDB ID)
            db.collection('items').aggregate([
                { $match: { type: 'tv', status: 'organized' } },
                { $group: { _id: "$tmdb.id" } }, 
                { $count: "count" }
            ]).toArray(),
            
            // Uncategorized: Simple count
            db.collection('items').countDocuments({ status: 'uncategorized' })
        ]);

        res.json({ 
            movies: moviesCount, 
            tvShows: tvAggregation.length > 0 ? tvAggregation[0].count : 0, 
            uncategorized: uncategorizedCount 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/movies', async (req, res) => {
    try {
        if (!db) return res.json([]);
        const movies = await db.collection('items')
            .find({ type: 'movie', status: 'organized' })
            .sort({ 'tmdb.title': 1 })
            .limit(100)
            .toArray();
        res.json(movies.map(m => ({
            id: m._id,
            title: m.tmdb?.title,
            year: m.tmdb?.year,
            posterPath: m.tmdb?.posterPath,
            overview: m.tmdb?.overview,
            filePath: m.destPath || m.srcPath
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/tvshows', async (req, res) => {
    try {
        if (!db) return res.json([]);
        // Aggregate to return unique Shows
        const shows = await db.collection('items').aggregate([
            { $match: { type: 'tv', status: 'organized' } },
            { $sort: { 'tmdb.season': 1, 'tmdb.episode': 1 } },
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
            id: s._id,
            title: s.title,
            year: s.year,
            posterPath: s.posterPath,
            overview: s.overview,
            filePath: path.dirname(path.dirname(s.filePath)) 
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/uncategorized', async (req, res) => {
    try {
        if (!db) return res.json([]);
        const items = await db.collection('items')
            .find({ status: 'uncategorized' }) 
            .limit(100)
            .toArray();
        res.json(items.map(i => ({
            id: i._id,
            fileName: path.basename(i.srcPath),
            filePath: i.srcPath
        })));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// File System Routes
app.get('/api/fs/list', (req, res) => {
  const browsePath = req.query.path || DATA_ROOT;
  
  if (!isValidDataPath(browsePath)) {
      return res.status(400).json({ message: `Access Denied: Can only browse ${DATA_ROOT}` });
  }

  try {
    if (!fs.existsSync(browsePath)) return res.status(404).json({ message: 'Path not found' });
    const stats = fs.statSync(browsePath);
    if (!stats.isDirectory()) return res.status(400).json({ message: 'Not a directory' });
    
    const items = fs.readdirSync(browsePath, { withFileTypes: true })
      .filter(item => item.isDirectory())
      .map(item => ({ 
          name: item.name, 
          path: path.join(browsePath, item.name), 
          isDir: true 
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
      
    res.json({ 
        currentPath: browsePath, 
        parentPath: path.dirname(browsePath), 
        items 
    });
  } catch (error) { res.status(500).json({ message: 'FS Error: ' + error.message }); }
});

app.get('/api/fs/validate', (req, res) => {
  const p = req.query.path;
  const checkMount = req.query.mountSafety === 'true';

  if (!isValidDataPath(p)) {
      return res.json({ valid: false, message: 'Invalid Path Prefix' });
  }

  try {
    if (!fs.existsSync(p)) return res.json({ valid: false, message: 'Path not found' });
    try { fs.accessSync(p, fs.constants.R_OK); } catch(e) { return res.json({ valid: false, message: 'Permission denied' }); }
    
    if (checkMount) {
      try { execSync(`findmnt -T "${p}"`); } catch (e) { return res.json({ valid: false, message: 'Not a mount point' }); }
    }
    res.json({ valid: true });
  } catch (error) { res.json({ valid: false, message: error.message }); }
});

// API Error Fallback (Strict JSON)
app.use('/api/*', (err, req, res, next) => {
    console.error(`[API Error] ${err.message}`);
    if (!res.headersSent) {
        res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
    }
});

app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found', path: req.originalUrl });
});

// ================= STATIC FILES & SPA =================

// Serve Static Files (AFTER API routes to prevent shadowing)
app.use(express.static(__dirname));

// SPA Fallback (Last Route)
app.get('*', (req, res) => { 
    res.sendFile(path.join(__dirname, 'index.html')); 
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`DATA ROOT: ${DATA_ROOT}`);
});
