import mysql from 'mysql2';
import dotenv from "dotenv";
dotenv.config();

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: process.env.DB_PASSWORD,
    database: "chityapp",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
export default pool;