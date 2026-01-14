import express from 'express';
import type {Request, Response} from 'express';
import db from '../database.js';
import mysql from 'mysql2/promise';

const router = express.Router();
// TODO :

/*
- JOIN QUEUE
- MAKE CHAT
- DISPLAY CHAT (users + messages) /IF IN QUEUE
- DISPLAY # PPL IN QUEUE
- SEND MESSAGE (random_chat = TRUE)
- LEAVE CHAT (make available = TRUE)

*/

export default router;