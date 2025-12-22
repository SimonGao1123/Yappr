import express from 'express';
import db from '../database.js';
import crypto from 'crypto';
const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const {username, password} = req.body;
        if (username && password) {
            const [rows] = await db.promise().query(
                "SELECT password FROM Users WHERE username = ?",
            [username]
            ); // selects all users with matched username
            

            if (rows.length === 0) {
                res.status(401).json({message: "Username doesn't exist", success: false});
            }

            const stored = rows[0].password;
            if (comparePassword(password, stored)) {
                // password matches the password associated with the user
                res.status(201).json({message: `Successfully logged in as ${username}`, success: true});
            } else {
                res.status(401).json({message: `Invalid Username/Password`, success: false});
            }
        } else {
            res.status(400).json({message: "Invalid Username/Password", success: false});
        }
    } catch (error) {
        console.log("Error occurred: ", error);
    }
});

router.post("/register", async (req, res) => {
    try {
        const {username, password, email} = req.body;
        if (username && password && email) {

            const encryptedPass = encryptPassword(password);
            await db.promise().query(
                'INSERT INTO Users (username, password, email) VALUES (?, ?, ?)',
                [username, encryptedPass, email]
            );
            res.status(201).json({message: `Successfully registered ${username}`, success: true});
        } else {
            res.status(400).json({message: "Invalid Username/Password/Email", success: false});
        }
    } catch(error) {
        if (error.code === "ER_DUP_ENTRY") {
            if (error.sqlMessage.includes("users.username")) {
                res.status(409).json({message: "Username already exists", success: false}); 

            }
            else if (error.sqlMessage.includes("users.email")) {
                res.status(409).json({message: "Email already exists", success: false}); 

            }
            else {
                res.status(409).json({message: "Username/Email already exists", success: false}); 

            }
        }
        console.log("Error in registration: ", error);
    }
})
// return encrypted password to be added to loginInfo.json
function encryptPassword (password) {
    const salt = crypto.randomBytes(16).toString('hex'); // adds salt
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}
// true if same password
function comparePassword (password, stored) {
    const [salt, hash] = stored.split(":"); // extract salt and hash
    const hashedPassword = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hashedPassword === hash;
}
export default router;