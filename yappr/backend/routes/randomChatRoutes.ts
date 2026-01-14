import express from 'express';
import type {Request, Response} from 'express';
import db from '../database.js';
import mysql from 'mysql2/promise';

const router = express.Router();
export default router;