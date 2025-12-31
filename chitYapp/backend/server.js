import express from 'express';
import cors from 'cors';

import userLoginRouter from './routes/userLogin.js';
import friendsRouter from './routes/friendsRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import messagingRoutes from './routes/messagingRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';

import session from 'express-session'; 

import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(express.json());

app.use(cors({
  origin: "http://localhost:5173",  // frontend origin
  credentials: true                 // allow cookies
})); // TEMPORARY

app.use(session({
  name: 'chat.sid',
  secret: process.env.SESSION_SECRET, // must be set
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  },
}));


// ROUTES
app.use("/userLogins", userLoginRouter);
app.use("/friends", friendsRouter);
app.use("/chats", chatRoutes);
app.use("/message", messagingRoutes);
app.use("/settings", settingsRoutes);

app.listen(3000, () => console.log("http://localhost:3000")); // temporary (for development)