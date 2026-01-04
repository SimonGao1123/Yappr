import express from 'express';
import type {Request, Response} from 'express';
import db from '../database.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
const router = express.Router();

import type { MeResponse, LoginInput, CheckValidLogin, RegisterInput, UpdateUsernameInput, LastUpdatedUsername } from '../../definitions/loginTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';

router.get("/me", (req: Request, res: Response<MeResponse>) => {
    if (!req.session.userId) {
        // no session detected
        return res.json({loggedIn: false});
    }

    return res.json({loggedIn: true, 
        user: {
            username: req.session.username,
            id: req.session.userId
        }
    });

}); // to skip login process with session 

router.post("/logout", (req: Request, res: Response<standardResponse>) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ success: false, message: "Logout failed" });
        }

        // Clear the session cookie in the browser
        res.clearCookie("chat.sid", {
            httpOnly: true,
            sameSite: "lax",
            secure: false
        });

        // Send success response
        return res.json({ success: true, message: "Logged out successfully" });
    });
});

// ensures body has password and user/email
router.post("/login", async (req: Request<{},{},LoginInput>, res: Response<standardResponse>) => {
    const {userOrEmail, password} = req.body;
    if (!userOrEmail || !password) return res.status(401).json({message: `Invalid Username/Password`, success: false});

    try {
        
        const [rows] = await db.execute<CheckValidLogin[]>(
            "SELECT user_id, username, password FROM Users WHERE username = ? OR email=?",
            [userOrEmail, userOrEmail]
        ); // selects all users with matched username or email

        if (rows.length === 0) {
            return res.status(401).json({message: "Username or Email doesn't exist", success: false});
        }

        if (rows[0].user_id === -1) {
            return res.status(401).json({message: `Invalid Username/Password`, success: false});
            // accidentally logged into server account (NOT)
        }

        const stored = rows[0].password;
        if (comparePassword(password, stored)) {
            req.session.userId = rows[0].user_id;
            req.session.username = rows[0].username; // stores userId and username for session

            // password matches the password associated with the user
            return res.status(201).json({message: `Successfully logged in as ${rows[0].username}`, success: true, user: {username: rows[0].username, id: rows[0].user_id}});
        } else {
            return res.status(401).json({message: `Invalid Username/Password`, success: false});
        }
    } catch (error) {
        console.log("Error occurred: ", error);
    }
});

router.post("/register", async (req: Request<{},{},RegisterInput>, res: Response<standardResponse>) => {
    const {username, password, email} = req.body;

    if (!username || !password || !email) return res.status(401).json({message: "Invalid username/password/email", success: false});

    try {
        const encryptedPass = encryptPassword(password);
        const [result] = await db.query(
            'INSERT INTO Users (username, password, email) VALUES (?, ?, ?)',
            [username, encryptedPass, email]
        ) as [mysql.ResultSetHeader, mysql.FieldPacket[]];
        
        await db.query(
            'INSERT INTO Settings (user_id) VALUES (?)',
            [result.insertId]
        );
        return res.status(201).json({message: `Successfully registered ${username}`, success: true});
        
    } catch(error) {
        if (error.code === "ER_DUP_ENTRY") {
            if (error.sqlMessage.includes("users.username")) {
                return res.status(409).json({message: "Username already exists", success: false}); 

            }
            else if (error.sqlMessage.includes("users.email")) {
                return res.status(409).json({message: "Email already exists", success: false}); 

            }
            else {
                return res.status(409).json({message: "Username/Email already exists", success: false}); 

            }
        }
        console.log("Error in registration: ", error);
    }
});

// 2 weeks between last updated date and now
router.post("/updateUsername", async (req: Request<{},{},UpdateUsernameInput>, res: Response<standardResponse>) => {
    const {username, user_id, newUsername} = req.body;

    
    if (!newUsername || !user_id) {
        return res.status(401).json({success: false, message: "Invalid username"});
    }
    if (username === newUsername) {
        return res.status(401).json({success: false, message: "Username needs to be different"});

    }
    try {
        const [rows] = await db.execute<LastUpdatedUsername[]>(
            'SELECT last_updated_username FROM Users WHERE user_id=?',
            [user_id]
        );
        if (rows.length === 0) {
            return res.status(401).json({success: false, message: "Invalid user"});
        }
        if (!isTwoWeeksOrOlder(rows[0].last_updated_username)) {
            return res.status(401).json({success: false, message: `Can only change username every 2 weeks, last updated: ${formatDateTimeSmart(rows[0].last_updated_username)}`});
        }
        
        await db.query(
            'UPDATE Users SET last_updated_username=CURRENT_TIMESTAMP, username=? WHERE user_id=?',
            [newUsername, user_id]
        );
        req.session.username = newUsername;
        req.session.save(err => {
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ success: false, message: "Could not update session" });
            }

    // Return the updated user info immediately
        return res.status(201).json({
            success: true,
            message: `Successfully updated username to ${newUsername}`,
            user: { id: user_id, username: newUsername }
        });
    });
        
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(401).json({success: false, message: "Username already exists"});
        }
        console.log("Error occurred: ", error);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

function isTwoWeeksOrOlder(lastUpdatedDate: string): boolean {
  if (!lastUpdatedDate) return false;

  // Convert MySQL timestamp to JS Date
  const updatedDate = new Date(lastUpdatedDate);

  // Guard against invalid date
  if (isNaN(updatedDate.getTime())) return false;

  const now = new Date();

  // 2 weeks in milliseconds
  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

  return (now.getTime() - updatedDate.getTime()) >= TWO_WEEKS_MS;
}

function formatDateTimeSmart(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();

  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const options: Intl.DateTimeFormatOptions = {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  };

  if (isSameDay) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } else {
    return date.toLocaleString("en-US", options);
  }
}

// return encrypted password to be added to loginInfo.json
function encryptPassword (password: string): string {
    const salt = crypto.randomBytes(16).toString('hex'); // adds salt
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
}
// true if same password
function comparePassword (password: string, stored: string): boolean {
    const [salt, hash] = stored.split(":"); // extract salt and hash
    const hashedPassword = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hashedPassword === hash;
}
export default router;