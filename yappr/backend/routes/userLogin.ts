import express from 'express';
import type {Request, Response} from 'express';
import prisma from '../prisma.js';
import { Prisma } from '../generated/prisma/index.js';
import crypto from 'crypto';
const router = express.Router();

import type { MeResponse, LoginInput, RegisterInput, UpdateUsernameInput } from '../../definitions/loginTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';

router.get("/me", (req: Request, res: Response<MeResponse>) => {
    if (!req.session.userId) {
        // no session detected
        return res.status(200).json({loggedIn: false});
    }

    return res.json({loggedIn: true, 
        user: {
            username: req.session.username ?? "",
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
        // Options must match the session cookie configuration
        res.clearCookie("chat.sid", {
            path: "/",
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            secure: process.env.NODE_ENV === 'production'
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

        const user = await prisma.users.findFirst({
            where: {OR: [{username: userOrEmail}, {email: userOrEmail}]},
            select: {user_id: true, username: true, password: true}
        }); // selects the first user with matched username or email

        if (!user) {
            return res.status(401).json({message: "Username or Email doesn't exist", success: false});
        }

        if (user.user_id === -1) {
            return res.status(401).json({message: `Invalid Username/Password`, success: false});
            // accidentally logged into server account (NOT)
        }

        const stored = user.password;
        if (comparePassword(password, stored)) {
            req.session.userId = user.user_id;
            req.session.username = user.username; // stores userId and username for session

            // password matches the password associated with the user
            return res.status(201).json({message: `Successfully logged in as ${user.username}`, success: true, user: {username: user.username, id: user.user_id}});
        } else {
            return res.status(401).json({message: `Invalid Username/Password`, success: false});
        }
    } catch (error) {
        console.log("Error occurred: ", error);
        return res.status(500).json({message: "Internal server error", success: false});
    }
});

router.post("/register", async (req: Request<{},{},RegisterInput>, res: Response<standardResponse>) => {
    const {username, password, email} = req.body;

    if (!username || !password || !email) return res.status(401).json({message: "Invalid username/password/email", success: false});

    try {
        const encryptedPass = encryptPassword(password);
        // Nested create so a user can never be left without a settings row.
        await prisma.users.create({
            data: {
                username,
                password: encryptedPass,
                email,
                settings: {create: {}}
            }
        });
        return res.status(201).json({message: `Successfully registered ${username}`, success: true});

    } catch(error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            // meta.target is the violated index name (uniq_username / uniq_email).
            const target = String(error.meta?.target ?? "").toLowerCase();
            if (target.includes("username")) {
                return res.status(409).json({message: "Username already exists", success: false});
            }
            else if (target.includes("email")) {
                return res.status(409).json({message: "Email already exists", success: false});
            }
            else {
                return res.status(409).json({message: "Username/Email already exists", success: false});
            }
        }
        console.log("Error in registration: ", error);
        return res.status(500).json({message: "Internal server error", success: false});
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
        const userRow = await prisma.users.findUnique({
            where: {user_id},
            select: {last_updated_username: true}
        });
        if (!userRow) {
            return res.status(401).json({success: false, message: "Invalid user"});
        }
        if (!isTwoWeeksOrOlder(userRow.last_updated_username)) {
            return res.status(401).json({success: false, message: `Can only change username every 2 weeks, last updated: ${formatDateTimeSmart(userRow.last_updated_username)}`});
        }

        await prisma.users.update({
            where: {user_id},
            data: {last_updated_username: new Date(), username: newUsername}
        });
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
        
    } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return res.status(401).json({success: false, message: "Username already exists"});
        }
        console.log("Error occurred: ", error);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

function isTwoWeeksOrOlder(lastUpdatedDate: Date): boolean {
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

function formatDateTimeSmart(isoString: Date): string {
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
    if (!salt) return false;
    const hashedPassword = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hashedPassword === hash;
}
export default router;