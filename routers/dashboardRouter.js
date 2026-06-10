import express from "express";
import { getDashboardStats } from "../controllers/dashboardController.js";

const dashboardRouter = express.Router();

dashboardRouter.get("/", getDashboardStats);

export default dashboardRouter;