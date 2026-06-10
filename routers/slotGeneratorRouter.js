import express from "express";
import { generateWeeklySlots } from "../controllers/slotGeneratorController.js";

const slotGeneratorRouter = express.Router();

slotGeneratorRouter.post("/", generateWeeklySlots);

export default slotGeneratorRouter;