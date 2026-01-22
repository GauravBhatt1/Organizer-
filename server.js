
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// --- API Routes ---

// File System Browsing
// Restrict browsing to /host inside container
const ROOT_PATH = '/host';

app.get('/api/fs/list', (req, res) => {
  let requestPath = req.query.path || ROOT_PATH;
  
  // Security: Prevent path traversal
  if (!requestPath.startsWith(ROOT_PATH)) {
    requestPath = ROOT_PATH;
  }

  try {
    if (!fs.existsSync(requestPath)) {
      return res.status(404).json({ message: 'Path not found' });
    }

    const stats = fs.statSync(requestPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ message: 'Not a directory' });
    }

    const items = fs.readdirSync(requestPath, { withFileTypes: true })
      .filter(item => item.isDirectory()) // Only folders as per requirement
      .map(item => ({
        name: item.name,
        path: path.join(requestPath, item.name),
        isDir: true
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      currentPath: requestPath,
      parentPath: requestPath === ROOT_PATH ? null : path.dirname(requestPath),
      items
    });
  } catch (error) {
    console.error('FS List Error:', error);
    res.status(500).json({ message: 'Error listing directory' });
  }
});

app.get('/api/fs/validate', (req, res) => {
  const checkPath = req.query.path;
  if (!checkPath) return res.status(400).json({ message: 'Path required' });

  try {
    const exists = fs.existsSync(checkPath);
    if (!exists) return res.json({ valid: false, message: 'Does not exist' });

    const stats = fs.statSync(checkPath);
    if (!stats.isDirectory()) return res.json({ valid: false, message: 'Not a directory' });

    // Check readability
    fs.accessSync(checkPath, fs.constants.R_OK);
    
    res.json({ valid: true });
  } catch (error) {
    res.json({ valid: false, message: 'Permission denied' });
  }
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
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
  console.log(`Host root mapped to: ${ROOT_PATH}`);
});
