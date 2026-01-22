import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import { runScanJob } from './lib/scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- Security & Constants ---
const JAIL_PATH = '/host';

// --- Configuration Management ---
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
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
    } catch (err) {
        console.error('Mongo connection failed:', err.message);
        db = null;
    }
}

if (currentConfig.mongoUri) {
    connectDB(currentConfig.mongoUri);
}

// --- Helper Functions ---
const sanitizePath = (requestedPath) => {
  if (!requestedPath) return JAIL_PATH;
  const normalized = path.normalize(requestedPath);
  if (!normalized.startsWith(JAIL_PATH)) return JAIL_PATH;
  return normalized;
};

// --- API Routes ---

// 1. Test Mongo Connection
app.post('/api/mongo/test', async (req, res) => {
    const { uri } = req.body;
    if (!uri) return res.status(400).json({ message: 'URI is required' });
    const testClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    try {
        await testClient.connect();
        await testClient.db('admin').command({ ping: 1 });
        await testClient.close();
        res.json({ success: true, message: 'Connection Successful!' });
    } catch (err) {
        res.status(400).json({ success: false, message: `Connection failed: ${err.message}` });
    }
});

// 2. Get Settings
app.get('/api/settings', async (req, res) => {
    const localConfig = loadConfig();
    let dbSettings = {};
    if (db) {
        try {
            dbSettings = await db.collection('settings').findOne({ id: 'global' }) || {};
            delete dbSettings._id;
            delete dbSettings.id;
        } catch (err) {
            console.error("Failed to fetch settings from DB:", err);
        }
    }
    res.json({
        ...dbSettings,
        mongoUri: localConfig.mongoUri || '',
        dbName: localConfig.dbName || ''
    });
});

// 3. Save Settings
app.post('/api/settings', async (req, res) => {
    const { mongoUri, dbName, ...appSettings } = req.body;
    try {
        const oldConfig = loadConfig();
        const hasUriChanged = mongoUri && mongoUri !== oldConfig.mongoUri;
        const hasDbNameChanged = dbName && dbName !== oldConfig.dbName;

        if (hasUriChanged || hasDbNameChanged) {
            currentConfig = saveConfig({ mongoUri, dbName });
            if (hasUriChanged) {
                console.log("Mongo URI changed, reconnecting...");
                await connectDB(mongoUri);
            } else if (hasDbNameChanged && client) {
                db = client.db(dbName); 
            }
        }

        if (db) {
            await db.collection('settings').updateOne(
                { id: 'global' },
                { $set: appSettings },
                { upsert: true }
            );
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Failed to save settings:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});

// --- SCANNING & JOBS ---

// Start Scan
app.post('/api/scan/start', async (req, res) => {
    if (!db) return res.status(503).json({ message: 'Database not connected' });
    
    // Check if job running
    const activeJob = await db.collection('jobs').findOne({ status: 'running' });
    if (activeJob) {
        return res.status(409).json({ message: 'A scan is already running', jobId: activeJob._id });
    }

    const { dryRun, isCopyMode } = req.body; // Overrides

    // Create Job
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
    const jobId = result.insertedId;

    // Start background process
    runScanJob(db, jobId, { dryRun, isCopyMode }).catch(err => {
        console.error("Critical Scanner Error:", err);
        db.collection('jobs').updateOne({ _id: jobId }, { 
            $set: { status: 'failed', finishedAt: new Date() },
            $push: { errors: { error: err.message } }
        });
    });

    res.json({ success: true, jobId });
});

// Get Job Status
app.get('/api/scan/status/:jobId', async (req, res) => {
    if (!db) return res.status(503).json({ message: 'Database not connected' });
    try {
        const job = await db.collection('jobs').findOne({ _id: new ObjectId(req.params.jobId) });
        if (!job) return res.status(404).json({ message: 'Job not found' });
        res.json(job);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// Get Latest Active or Last Job
app.get('/api/scan/current', async (req, res) => {
    if (!db) return res.json(null);
    try {
        // Find running or most recent
        const job = await db.collection('jobs').find().sort({ startedAt: -1 }).limit(1).toArray();
        res.json(job[0] || null);
    } catch (e) {
        res.json(null);
    }
});

// --- DATA ENDPOINTS ---

app.get('/api/dashboard', async (req, res) => {
    if (!db) return res.json({ movies: 0, tvShows: 0, uncategorized: 0 });
    try {
        const [movies, tvShows, uncategorized] = await Promise.all([
            db.collection('items').countDocuments({ kind: 'movie', status: 'done' }),
            db.collection('items').countDocuments({ kind: 'tv', status: 'done' }),
            db.collection('items').countDocuments({ kind: 'uncategorized' }) // count pending/skipped too
        ]);
        res.json({ movies, tvShows, uncategorized });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/movies', async (req, res) => {
    if (!db) return res.json([]);
    try {
        const movies = await db.collection('items')
            .find({ kind: 'movie', status: 'done' })
            .sort({ 'tmdb.title': 1 })
            .limit(100)
            .toArray();
            
        // Map to frontend expected format
        res.json(movies.map(m => ({
            id: m._id,
            title: m.tmdb?.title || m.titleGuess,
            year: m.tmdb?.year || m.yearGuess,
            posterPath: m.tmdb?.posterPath,
            overview: m.tmdb?.overview,
            filePath: m.destPath || m.srcPath
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tvshows', async (req, res) => {
    if (!db) return res.json([]);
    try {
        // Group by series? For now just list items or find unique series logic
        // Simplified: returning individual items or maybe aggregate. 
        // Let's return unique shows based on TMDB ID
        const shows = await db.collection('items').aggregate([
            { $match: { kind: 'tv', status: 'done' } },
            { $group: {
                _id: "$tmdb.id",
                title: { $first: "$tmdb.title" },
                year: { $first: "$tmdb.year" },
                posterPath: { $first: "$tmdb.posterPath" },
                overview: { $first: "$tmdb.overview" },
                filePath: { $first: "$destPath" }, // Just one example path
                count: { $sum: 1 }
            }},
            { $sort: { title: 1 } }
        ]).toArray();

        res.json(shows.map(s => ({
            id: s._id,
            title: s.title,
            year: s.year,
            posterPath: s.posterPath,
            overview: s.overview,
            filePath: s.filePath
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/uncategorized', async (req, res) => {
    if (!db) return res.json([]);
    try {
        const items = await db.collection('items')
            .find({ kind: 'uncategorized' })
            .limit(100)
            .toArray();
            
        res.json(items.map(i => ({
            id: i._id,
            fileName: path.basename(i.srcPath),
            filePath: i.srcPath
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// File System Browsing
app.get('/api/fs/list', (req, res) => {
  const requestPath = sanitizePath(req.query.path);
  try {
    if (!fs.existsSync(requestPath)) return res.status(404).json({ message: 'Path not found' });
    const stats = fs.statSync(requestPath);
    if (!stats.isDirectory()) return res.status(400).json({ message: 'Not a directory' });

    const items = fs.readdirSync(requestPath, { withFileTypes: true })
      .filter(item => item.isDirectory())
      .map(item => ({
        name: item.name,
        path: path.join(requestPath, item.name),
        isDir: true
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      currentPath: requestPath,
      parentPath: requestPath === JAIL_PATH ? null : path.dirname(requestPath),
      items
    });
  } catch (error) {
    console.error('FS list error:', error);
    res.status(500).json({ message: 'Error listing directory: ' + error.message });
  }
});

// Validate path and mount status
app.get('/api/fs/validate', (req, res) => {
  const checkPath = sanitizePath(req.query.path);
  const checkMount = req.query.mountSafety === 'true';
  try {
    if (!fs.existsSync(checkPath)) return res.json({ valid: false, message: 'Path does not exist' });
    
    // Attempt read access
    try {
        fs.accessSync(checkPath, fs.constants.R_OK);
    } catch(e) {
        return res.json({ valid: false, message: 'Read permission denied' });
    }

    if (checkMount) {
      try {
        // findmnt -T returns 0 if mountpoint found
        execSync(`findmnt -T "${checkPath}"`);
      } catch (e) {
        return res.json({ valid: false, message: 'Storage mount not detected (Safety Mode)' });
      }
    }
    res.json({ valid: true });
  } catch (error) {
    res.json({ valid: false, message: 'Error: ' + error.message });
  }
});

// Proxy for TMDB Test
app.get('/api/tmdb/test', async (req, res) => {
  const apiKey = req.query.key;
  if (!apiKey) return res.status(400).json({ message: 'Missing Key' });
  try {
    const tmdbUrl = `https://api.themoviedb.org/3/configuration?api_key=${apiKey}`;
    const response = await fetch(tmdbUrl);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('TMDB Proxy Error:', error);
    res.status(500).json({ error: 'PROXY_ERROR', message: 'Could not reach TMDB API' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Broad Host Access mounted at: ${JAIL_PATH}`);
});
