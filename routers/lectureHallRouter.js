import express from "express";
import {createHall,getAllHalls,updateHall,deleteHall, searchAvailableHalls} from "../controllers/lectureHallController.js";

import { requireAdmin } from "../middlewares/roleMiddleware.js";

const lectureHallRouter = express.Router();


lectureHallRouter.post("/", requireAdmin, createHall);
lectureHallRouter.put("/:id", requireAdmin, updateHall);
lectureHallRouter.delete("/:id", requireAdmin, deleteHall);


lectureHallRouter.get("/", getAllHalls);
lectureHallRouter.post("/search", searchAvailableHalls);

export default lectureHallRouter;