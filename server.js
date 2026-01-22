
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// --- Security & Constants ---
const JAIL_PATH = '/host';

// Helper to ensure paths stay inside the jail
const sanitizePath = (requestedPath) => {
  if (!requestedPath) return JAIL_PATH;
  const normalized = path.normalize(requestedPath);
  if (!normalized.startsWith(JAIL_PATH)) return JAIL_PATH;
  return normalized;
};

// --- API Routes ---

// File System Browsing
app.get('/api/fs/list', (req, res) => {
  const requestPath = sanitizePath(req.query.path);

  try {
    if (!fs.existsSync(requestPath)) {
      return res.status(404).json({ message: 'Path not found' });
    }

    const stats = fs.statSync(requestPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ message: 'Not a directory' });
    }

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
    console.error('FS List Error:', error);
    res.status(500).json({ message: 'Error listing directory' });
  }
});

// Validate path and mount status
app.get('/api/fs/validate', (req, res) => {
  const checkPath = sanitizePath(req.query.path);
  const checkMount = req.query.mountSafety === 'true';

  try {
    if (!fs.existsSync(checkPath)) {
      return res.json({ valid: false, message: 'Path does not exist' });
    }

    const stats = fs.statSync(checkPath);
    if (!stats.isDirectory()) {
      return res.json({ valid: false, message: 'Path is not a directory' });
    }

    // Check readability
    fs.accessSync(checkPath, fs.constants.R_OK);

    // Optional Mount Check
    if (checkMount) {
      try {
        // findmnt returns 0 if path is a mount point, 1 if not.
        // We check if the path itself is a mount OR if it's within a mounted tree.
        // Usually, for "Safety Mode", we want to ensure the specific path isn't empty 
        // if it's supposed to be an external drive.
        const output = execSync(`findmnt -T ${checkPath}`).toString();
        // Simple heuristic: if the mount source is 'rootfs' or '/' and we expected an external mount
        // this might be a point of failure, but for broad access, we just verify findmnt succeeds.
        if (!output) throw new Error('Mount check failed');
      } catch (e) {
        return res.json({ valid: false, message: 'Storage mount not detected or unavailable' });
      }
    }
    
    res.json({ valid: true });
  } catch (error) {
    res.json({ valid: false, message: 'Permission denied or system error' });
  }
});

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    container_root: JAIL_PATH,
    timestamp: new Date().toISOString() 
  });
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
