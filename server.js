
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// --- API Routes ---

// Healthcheck & Mount Detection
app.get('/api/health', (req, res) => {
  const mediaPaths = ['/mnt/movies', '/mnt/tvshows']; // Matches docker-compose volumes
  const status = mediaPaths.map(p => {
    const isMounted = fs.existsSync(p) && fs.readdirSync(p).length > 0;
    return { path: p, mounted: isMounted };
  });

  const allMounted = status.every(s => s.mounted);
  
  res.status(allMounted ? 200 : 503).json({
    status: allMounted ? 'healthy' : 'degraded',
    mounts: status,
    timestamp: new Date().toISOString()
  });
});

// Proxy for TMDB Test (Existing logic)
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

// SPA Catch-all
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Mount points check:', fs.existsSync('/mnt/movies') ? 'Detected' : 'Missing');
});
