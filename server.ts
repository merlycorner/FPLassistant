import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// In-memory cache with timestamp
interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > entry.ttlMs) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlSeconds: number): void {
  memoryCache.set(key, {
    data,
    cachedAt: Date.now(),
    ttlMs: ttlSeconds * 1000,
  });
}

const FPL_BASE = 'https://fantasy.premierleague.com/api';
const FPL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json',
};

async function fetchFromFPL(endpoint: string, options: { ttlSeconds?: number } = {}) {
  const { ttlSeconds = 300 } = options;
  const cacheKey = endpoint;
  const cached = getCached(cacheKey);
  if (cached) {
    return { data: cached, fromCache: true, cachedAt: memoryCache.get(cacheKey)?.cachedAt };
  }

  const url = `${FPL_BASE}${endpoint}`;
  const response = await fetch(url, { headers: FPL_HEADERS });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw {
      status: response.status,
      statusText: response.statusText,
      url,
      body: errorBody.slice(0, 500),
    };
  }

  const json = await response.json();
  if (ttlSeconds > 0) {
    setCache(cacheKey, json, ttlSeconds);
  }

  return { data: json, fromCache: false, cachedAt: Date.now() };
}

// 1. Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    cachedEndpoints: Array.from(memoryCache.keys()),
  });
});

// 2. Bootstrap Static
app.get('/api/fpl/bootstrap-static', async (_req: Request, res: Response) => {
  try {
    const result = await fetchFromFPL('/bootstrap-static/', { ttlSeconds: 300 }); // 5 min cache
    res.json({
      success: true,
      lastUpdated: new Date(result.cachedAt || Date.now()).toISOString(),
      fromCache: result.fromCache,
      data: result.data,
    });
  } catch (error: any) {
    console.error('Error fetching bootstrap-static:', error);
    res.status(error?.status || 502).json({
      success: false,
      message: 'Failed to retrieve FPL bootstrap data from official API',
      error: error?.statusText || 'External API Error',
      status: error?.status || 502,
    });
  }
});

// 3. Fixtures (all or by event)
app.get('/api/fpl/fixtures', async (req: Request, res: Response) => {
  try {
    const event = req.query.event ? `?event=${encodeURIComponent(String(req.query.event))}` : '';
    const result = await fetchFromFPL(`/fixtures/${event}`, { ttlSeconds: 600 }); // 10 min cache
    res.json({
      success: true,
      lastUpdated: new Date(result.cachedAt || Date.now()).toISOString(),
      fromCache: result.fromCache,
      data: result.data,
    });
  } catch (error: any) {
    console.error('Error fetching fixtures:', error);
    res.status(error?.status || 502).json({
      success: false,
      message: 'Failed to retrieve fixtures from official FPL API',
      error: error?.statusText || 'External API Error',
      status: error?.status || 502,
    });
  }
});

// 4. Dream Team for Gameweek
app.get('/api/fpl/dream-team/:eventId', async (req: Request, res: Response) => {
  const eventId = Number(req.params.eventId);
  if (isNaN(eventId) || eventId < 1 || eventId > 38) {
    return res.status(400).json({ success: false, message: 'Invalid Gameweek ID (must be between 1 and 38)' });
  }

  try {
    const result = await fetchFromFPL(`/dream-team/${eventId}/`, { ttlSeconds: 600 });
    res.json({
      success: true,
      lastUpdated: new Date(result.cachedAt || Date.now()).toISOString(),
      fromCache: result.fromCache,
      data: result.data,
    });
  } catch (error: any) {
    console.error(`Error fetching dream team for GW${eventId}:`, error);
    res.status(error?.status || 502).json({
      success: false,
      message: `Failed to retrieve Dream Team for Gameweek ${eventId}`,
      error: error?.statusText || 'External API Error',
      status: error?.status || 502,
    });
  }
});

// 5. Entry profile
app.get('/api/fpl/entry/:teamId', async (req: Request, res: Response) => {
  const teamId = Number(req.params.teamId);
  if (isNaN(teamId) || teamId <= 0) {
    return res.status(400).json({ success: false, message: 'Team ID must be a positive number' });
  }

  try {
    const result = await fetchFromFPL(`/entry/${teamId}/`, { ttlSeconds: 120 }); // 2 min cache
    res.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    if (error?.status === 404) {
      return res.status(404).json({
        success: false,
        message: `FPL Team ID ${teamId} was not found. Please verify the ID.`,
      });
    }
    res.status(error?.status || 502).json({
      success: false,
      message: `Failed to load team with ID ${teamId}.`,
      error: error?.statusText || 'External API Error',
    });
  }
});

// 6. Entry picks for a Gameweek
app.get('/api/fpl/entry/:teamId/picks/:eventId', async (req: Request, res: Response) => {
  const teamId = Number(req.params.teamId);
  const eventId = Number(req.params.eventId);

  if (isNaN(teamId) || teamId <= 0) {
    return res.status(400).json({ success: false, message: 'Team ID must be a positive number' });
  }
  if (isNaN(eventId) || eventId < 1 || eventId > 38) {
    return res.status(400).json({ success: false, message: 'Invalid Gameweek ID' });
  }

  try {
    const result = await fetchFromFPL(`/entry/${teamId}/event/${eventId}/picks/`, { ttlSeconds: 120 });
    res.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    if (error?.status === 404) {
      return res.status(404).json({
        success: false,
        message: `Picks for Gameweek ${eventId} on Team ID ${teamId} are not available yet or do not exist.`,
      });
    }
    res.status(error?.status || 502).json({
      success: false,
      message: `Failed to load picks for Team ID ${teamId} at Gameweek ${eventId}.`,
      error: error?.statusText || 'External API Error',
    });
  }
});

// 7. Player element summary
app.get('/api/fpl/element-summary/:playerId', async (req: Request, res: Response) => {
  const playerId = Number(req.params.playerId);
  if (isNaN(playerId) || playerId <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid player ID' });
  }

  try {
    const result = await fetchFromFPL(`/element-summary/${playerId}/`, { ttlSeconds: 600 });
    res.json({
      success: true,
      data: result.data,
    });
  } catch (error: any) {
    res.status(error?.status || 502).json({
      success: false,
      message: `Failed to fetch element summary for player ${playerId}.`,
      error: error?.statusText || 'External API Error',
    });
  }
});

// 8. Event Live data (GW live scores and player points)
app.get('/api/fpl/event/:eventId/live', async (req: Request, res: Response) => {
  const eventId = Number(req.params.eventId);
  if (isNaN(eventId) || eventId < 1 || eventId > 38) {
    return res.status(400).json({ success: false, message: 'Invalid Gameweek ID' });
  }

  try {
    const result = await fetchFromFPL(`/event/${eventId}/live/`, { ttlSeconds: 120 }); // 2 min cache
    res.json({
      success: true,
      lastUpdated: new Date(result.cachedAt || Date.now()).toISOString(),
      fromCache: result.fromCache,
      data: result.data,
    });
  } catch (error: any) {
    res.status(error?.status || 502).json({
      success: false,
      message: `Failed to fetch live event data for Gameweek ${eventId}.`,
      error: error?.statusText || 'External API Error',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[FPL Assistant] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
