import express from "express";
import {
    getProfile,
    updateProfile,
    getNotices,
    getTimetable,
    getTodayClasses,
    getWeekClasses
} from "../controllers/studentController.js";

const router = express.Router();

router.get("/:id/profile", getProfile);
router.put("/:id/profile", updateProfile);
router.get("/:id/notices", getNotices);
router.get("/:id/timetable", getTimetable);
router.get("/:id/today", getTodayClasses);
router.get("/:id/week", getWeekClasses);

export default router;
