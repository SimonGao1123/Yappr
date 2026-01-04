import express from 'express';
import type {Request, Response} from 'express';
import mysql from 'mysql2/promise';
import db from '../database.js';

import type { SetDescriptionInput, SelectDescription, SwitchLightDarkModeInput, SelectLightMode } from '../../definitions/settingsTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';

const router = express.Router();

router.post("/setDescription", async (req: Request<{},{},SetDescriptionInput>, res: Response<standardResponse>) => {
    const {user_id, description} = req.body;

    if (!description || !user_id) return res.status(401).json({success: false, message: "Invalid description"});

    try {
        await db.query(
            'UPDATE Users SET description=? WHERE user_id=?',
            [description, user_id]
        );
        return res.status(201).json({success: true, message: "Successfully updated description"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.get("/getDescription/:user_id", async (req: Request<{user_id: number}>, res: Response<standardResponse>) => {
    const user_id = req.params.user_id;

    try {
       const [rows] = await db.execute<SelectDescription[]>(
        'SELECT description FROM Users WHERE user_id=?',
        [user_id]
       );
       if (!rows[0].description) {
        return res.status(200).json({success: true, message: "obtained description", desc: ""});
       } 
       return res.status(200).json({success: true, message: "obtained description", desc: rows[0].description});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
})

router.post("/switchLightDarkMode", async (req: Request<{},{},SwitchLightDarkModeInput>, res: Response<standardResponse>) => {
    // ifLightMode is true for light mode, false for dark mode
    const {ifLightMode, user_id} = req.body;
    if (ifLightMode === undefined || !user_id) return res.status(401).json({success: false, message: "Invalid option"});

    try {
        await db.query(
            'UPDATE Settings SET light_mode=? WHERE user_id=?',
            [ifLightMode, user_id]
        );
        return res.status(201).json({success: true, message: "Successfully updated mode"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
    
})

router.get("/ifLightMode/:user_id", async (req: Request<{user_id: number}>, res: Response<standardResponse>) => {
    const user_id = req.params.user_id;
    try {
        const [rows] = await db.execute<SelectLightMode[]>(
            'SELECT light_mode FROM Settings WHERE user_id=?',
            [user_id]
        );
        return res.status(200).json({success: true, message: "obtained mode", light_mode: rows[0].light_mode});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});
export default router;
