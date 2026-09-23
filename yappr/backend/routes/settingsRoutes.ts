import express from 'express';
import type {Request, Response} from 'express';
import prisma from '../prisma.js';

import type { SetDescriptionInput, SwitchLightDarkModeInput } from '../../definitions/settingsTypes.js';
import type { standardResponse } from '../../definitions/globalType.js';

const router = express.Router();

router.post("/setDescription", async (req: Request<{},{},SetDescriptionInput>, res: Response<standardResponse>) => {
    const {user_id, description} = req.body;

    if (!description || !user_id) return res.status(401).json({success: false, message: "Invalid description"});

    try {
        await prisma.users.updateMany({
            where: {user_id},
            data: {description}
        });
        return res.status(201).json({success: true, message: "Successfully updated description"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.get("/getDescription/:user_id", async (req: Request<{user_id: string}>, res: Response<standardResponse>) => {
    const user_id = Number(req.params.user_id);

    try {
       const row = Number.isInteger(user_id)
        ? await prisma.users.findUnique({
            where: {user_id},
            select: {description: true}
          })
        : null;
       if (!row || !row.description) {
        return res.status(200).json({success: true, message: "obtained description", desc: ""});
       }
       return res.status(200).json({success: true, message: "obtained description", desc: row.description});
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
        // light_mode is a tinyint column; mysql2 coerced the boolean, Prisma will not.
        await prisma.settings.updateMany({
            where: {user_id},
            data: {light_mode: Number(ifLightMode)}
        });
        return res.status(201).json({success: true, message: "Successfully updated mode"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }

})

router.get("/ifLightMode/:user_id", async (req: Request<{user_id: string}>, res: Response<standardResponse>) => {
    const user_id = Number(req.params.user_id);

    try {
        const row = Number.isInteger(user_id)
            ? await prisma.settings.findUnique({
                where: {user_id},
                select: {light_mode: true}
              })
            : null;
        if (!row || row.light_mode === null || row.light_mode === undefined) {
            return res.status(404).json({ success: false, message: "No light mode setting found for user" });
        }
        return res.status(200).json({success: true, message: "obtained mode", light_mode: row.light_mode});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});
export default router;
