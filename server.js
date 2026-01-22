import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// --- Security & Constants ---
const JAIL_PATH = '/host';

// --- MongoDB Setup ---
const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
const client = new MongoClient(mongoUrl);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('jellyfin-organizer');
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Mongo connection error, retrying in 5s...', err.message);
    setTimeout(connectDB, 5000);
  }
}
connectDB();

// Helper to ensure paths stay inside the jail
const sanitizePath = (requestedPath) => {
  if (!requestedPath) return JAIL_PATH;
  const normalized = path.normalize(requestedPath);
  if (!normalized.startsWith(JAIL_PATH)) return JAIL_PATH;
  return normalized;
};

// --- API Routes ---

// Persistence Routes
app.get('/api/settings', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ message: 'DB not ready' });
    const settings = await db.collection('settings').findOne({ id: 'global' });
    res.json(settings || {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ message: 'DB not ready' });
    await db.collection('settings').updateOne(
      { id: 'global' },
      { $set: req.body },
      { upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    res.status(500).json({ message: 'Error listing directory' });
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
        return res.json({ valid: false, message: 'Storage mount not detected' });
      }
    }
    res.json({ valid: true });
  } catch (error) {
    res.json({ valid: false, message: 'Permission denied' });
  }
});

// Proxy for TMDB Test
app.get('/api/tmdb/test', async (req, res) => {
  const apiKey = req.query.key;
  if (!apiKey) return res.status(400).json({ message: 'Missing Key' });
  try {
    const response = await fetch(`https://api.themoviedb.org/3/configuration?api_key=${apiKey}`);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Broad Host Access mounted at: ${JAIL_PATH}`);
});
