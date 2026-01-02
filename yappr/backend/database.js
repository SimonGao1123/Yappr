// import mysql from 'mysql2';
import dotenv from "dotenv";
import pg from 'pg';
dotenv.config();

// MYSQL DATABASE: 
// const pool = mysql.createPool({
//     host: process.env.DB_HOST || "localhost",
//     user: process.env.DB_USER || "root",
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME || "chityapp",
//     port: process.env.DB_PORT || 3306,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
//     ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
// });
// export default pool;

// POSTGRESQL DATABASE (for testing purposes):
const {Pool} = pg;

const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "chityapp",
    port: process.env.DB_PORT || 5432,
    max: 10, // connection pool size
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

export default pool;