import express from 'express';
import db from '../database.js';

const router = express.Router();

router.post("/setDescription", async (req, res) => {
    const {user_id, description} = req.body;

    if (!description || !user_id) return res.status(401).json({success: false, message: "Invalid description"});

    try {
        await db.promise().query(
            'UPDATE Users SET description=? WHERE user_id=?',
            [description, user_id]
        );
        return res.status(201).json({success: true, message: "Successfully updated description"});
    } catch (err) {
        console.log(err);
        return res.status(500).json({success: false, message: "Internal server error"});
    }
});

router.get("/getDescription/:user_id", async (req, res) => {
    const user_id = req.params.user_id;

    try {
       const [rows] = await db.promise().query(
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


// TODO:
router.post("/setColorTheme", async (req, res) => {

})
export default router;
