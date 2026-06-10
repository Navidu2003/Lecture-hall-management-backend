import express from "express";
import { getTimetable } from "../controllers/hallController.js";
import { searchTimeSlots } from "../controllers/hallController.js";


const hallRouter = express.Router();

hallRouter.get("/timetable", getTimetable);
hallRouter.get("/search", searchTimeSlots);
export default hallRouter;