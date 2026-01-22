import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import { MongoClient } from 'mongodb';
import cors from 'cors';

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
    
    // Close existing connection if any
    if (client) {
        try { await client.close(); } catch(e) {}
    }

    try {
        // serverSelectionTimeoutMS is crucial for failing fast with bad URIs (Atlas etc)
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

// Attempt initial connection if URI exists in config file
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

// 1. Test Mongo Connection (On-demand)
app.post('/api/mongo/test', async (req, res) => {
    const { uri } = req.body;
    if (!uri) return res.status(400).json({ message: 'URI is required' });

    // Use a separate client for testing to avoid disrupting the main connection
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

    // Merge: Local config (Mongo URI) + DB Settings
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
        // A. Handle Connection Changes (Local Persistence)
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

        // B. Handle Application Settings (DB Persistence)
        if (db) {
            await db.collection('settings').updateOne(
                { id: 'global' },
                { $set: appSettings },
                { upsert: true }
            );
        } else if (!mongoUri) {
             // If we don't have a DB and no URI was provided to save, we can't do anything for app settings
             // But we successfully saved the empty/partial local config above.
        }

        res.json({ success: true });

    } catch (err) {
        console.error('Failed to save settings:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
});

// --- Data Endpoints (Return Real Data or Empty) ---

app.get('/api/dashboard', async (req, res) => {
    if (!db) return res.json({ movies: 0, tvShows: 0, uncategorized: 0 });
    try {
        const [movies, tvShows, uncategorized] = await Promise.all([
            db.collection('movies').countDocuments(),
            db.collection('tvshows').countDocuments(),
            db.collection('uncategorized').countDocuments()
        ]);
        res.json({ movies, tvShows, uncategorized });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/movies', async (req, res) => {
    if (!db) return res.json([]);
    try {
        const movies = await db.collection('movies').find().toArray();
        res.json(movies);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/tvshows', async (req, res) => {
    if (!db) return res.json([]);
    try {
        const shows = await db.collection('tvshows').find().toArray();
        res.json(shows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/uncategorized', async (req, res) => {
    if (!db) return res.json([]);
    try {
        const items = await db.collection('uncategorized').find().toArray();
        res.json(items);
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
    const stats = fs.statSync(checkPath);
    if (!stats.isDirectory()) return res.json({ valid: false, message: 'Not a directory' });
    fs.accessSync(checkPath, fs.constants.R_OK);

    if (checkMount) {
      try {
        const output = execSync(`findmnt -T ${checkPath}`).toString();
        if (!output) throw new Error('Mount check failed');
      } catch (e) {
        return res.json({ valid: false, message: 'Storage mount not detected (Safety Mode)' });
      }
    }
    res.json({ valid: true });
  } catch (error) {
    res.json({ valid: false, message: 'Permission denied or error: ' + error.message });
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
