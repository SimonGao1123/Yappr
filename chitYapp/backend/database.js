import mysql from 'mysql2';

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "w2qda#9dka0P@",
    database: "chityapp",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
export default pool;