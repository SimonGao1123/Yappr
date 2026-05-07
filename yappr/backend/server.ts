import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import session from 'express-session';
import helmet from 'helmet';
import compression from 'compression';
import { Server } from 'socket.io';

import MySQLStoreFactory from 'express-mysql-session';
import pool from './database.js';

import userLoginRouter from './routes/userLogin.js';
import friendsRouter from './routes/friendsRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messagingRoutes from './routes/messagingRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import geminiRoutes from './routes/geminiRoutes.js';
import randomChatRoutes from './routes/randomChatRoutes.js';
import { startChatMatcher } from './jobs/chatMatcher.js';
import { setIO } from './socketInstance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
const indexPath = path.join(publicDir, 'index.html');

const app = express();
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ---------- Session store (MySQL) ----------
const MySQLStore = MySQLStoreFactory(session as any);
const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: 86400000,
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
  },
  pool as any
);

// ---------- Session config ----------
const sessionMiddleware = session({
  name: 'chat.sid',
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
});

app.use(sessionMiddleware);

// Allow inline scripts (Vite/React) and WebSocket connections
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'sha256-ieoeWczDHkReVBsRBqaal5AFMlBtNjMzgwKvLqi/tSU='"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }
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

// ---------- SPA fallback ----------
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') return next();
  res.sendFile(indexPath, err => {
    if (err) return next(err);
  });
});

// ---------- Error handler ----------
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') return;
  console.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(err.status || 500).send(err.expose ? err.message : 'Server error');
  }
});

// ---------- HTTP + Socket.io server ----------
const httpServer = createServer(app);

const io = new Server(httpServer, {
  // Same-origin serving — no CORS needed
  cors: { origin: false },
});

setIO(io);

// Share session middleware with Socket.io so sockets can read req.session
io.use((socket, next) => {
  sessionMiddleware(socket.request as Request, {} as Response, next as NextFunction);
});

io.on('connection', (socket) => {
  const userId = (socket.request as any).session?.userId;
  if (!userId) {
    socket.disconnect();
    return;
  }
  socket.data.userId = userId;

  socket.on('join-chat', (chatId: number) => {
    socket.join(`chat:${chatId}`);
  });

  socket.on('leave-chat', (chatId: number) => {
    socket.leave(`chat:${chatId}`);
  });
});

// ---------- Startup ----------
const PORT = process.env.PORT || 3000;

function validatePublicDir() {
  const exists = fs.existsSync(publicDir);
  const indexExists = fs.existsSync(indexPath);
  if (!exists) {
    console.error(`ERROR: public folder not found at: ${publicDir}`);
  } else if (!indexExists) {
    console.error(`ERROR: index.html not found at: ${indexPath}`);
  } else {
    console.log(`Static assets: ${publicDir}`);
    console.log(`index.html found: ${indexPath}`);
  }
}

validatePublicDir();

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
  startChatMatcher();
});
