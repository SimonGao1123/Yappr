import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import session from 'express-session';
import helmet from 'helmet';
import compression from 'compression';

// Uncomment and install connect-redis + redis for production session store
// import connectRedis from 'connect-redis';
// import { createClient } from 'redis';

import userLoginRouter from './routes/userLogin.js';
import friendsRouter from './routes/friendsRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messagingRoutes from './routes/messagingRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import geminiRoutes from './routes/geminiRoutes.js';
import randomChatRoutes from './routes/randomChatRoutes.js';
import { startChatMatcher } from './jobs/chatMatcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Public directory is inside the backend folder (where vite builds to)
const publicDir = path.join(__dirname, 'public');
const indexPath = path.join(publicDir, 'index.html');

const app = express();
app.use(express.json());

// If running behind a proxy (Heroku, nginx, Cloud Run, etc.)
if (process.env.NODE_ENV === 'production') {
  // MUST be set before session middleware so secure cookies work correctly
  app.set('trust proxy', 1);
}

// ---------- Session config ----------
// NOTE: express's default MemoryStore is not suitable for production.
// See the commented Redis example below if you want a production-ready store.
app.use(session({
  name: 'chat.sid',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // must be string 'none' for cross-site
    secure: process.env.NODE_ENV === 'production' // requires https and trust proxy
  }
}));

/* ---------- Optional Redis session store (recommended for production) ----------
Uncomment and run:
  npm install connect-redis redis

Then replace the session middleware above with the snippet below (and comment/remove the default session).
------------------------------------------------------------------------------
// const RedisStore = connectRedis(session);
// const redisClient = createClient({ legacyMode: true, url: process.env.REDIS_URL });
// redisClient.connect().catch(console.error);
// app.use(session({
//   store: new RedisStore({ client: redisClient }),
//   name: 'chat.sid',
//   secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
//   resave: false,
//   saveUninitialized: false,
//   cookie: {
//     httpOnly: true,
//     maxAge: 1000 * 60 * 60 * 24,
//     sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
//     secure: process.env.NODE_ENV === 'production'
//   }
// }));
-------------------------------------------------------------------------------*/

// Disable CSP for development to avoid blocking inline scripts (fixes CSP errors)
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false
}));
app.use(compression());

// ---------- API routes ----------
app.use('/api/userLogins', userLoginRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/chats', chatRoutes);
app.use('/api/message', messagingRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/randomChats', randomChatRoutes);

// ---------- Static assets ----------
app.use(express.static(publicDir, { maxAge: '1y', etag: false }));

// ---------- SPA fallback middleware (no path-to-regexp patterns) ----------
app.use((req: Request, res: Response, next: NextFunction) => {
  // Only serve index.html for GET requests that weren't handled by static/API routes
  if (req.method !== 'GET') return next();

  // sendFile will call next(err) on failure
  res.sendFile(indexPath, err => {
    if (err) return next(err);
  });
});

// ---------- Basic error handler ----------
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Ignore aborted requests (client disconnected) - this is normal behavior
  if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
    return;
  }
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).send(err.expose ? err.message : 'Server error');
  }
});

// ---------- Startup checks & listen ----------
const PORT = process.env.PORT || 3000;

function validatePublicDir() {
  const exists = fs.existsSync(publicDir);
  const indexExists = fs.existsSync(indexPath);
  if (!exists) {
    console.error(`ERROR: public folder not found at expected path:\n  ${publicDir}`);
    console.error('Make sure your frontend build files live in that folder (index.html, assets/...).');
  } else if (!indexExists) {
    console.error(`ERROR: index.html not found at:\n  ${indexPath}`);
    console.error('If your frontend is not built yet, build it (e.g. npm run build) so index.html is present.');
  } else {
    console.log(`Static assets: ${publicDir}`);
    console.log(`index.html found: ${indexPath}`);
  }
  // keep running even if missing — server will return 404s; this makes the error obvious early
}

validatePublicDir();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  startChatMatcher(); // chat matcher runs constantly checks every 5 seconds
});
