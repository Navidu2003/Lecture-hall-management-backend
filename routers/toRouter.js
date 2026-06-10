import express from "express";
import { requireTO } from "../middlewares/roleMiddleware.js";
import * as toController from "../controllers/toController.js";

const toRouter = express.Router();

// dashboard summary for TO
toRouter.get('/dashboard', requireTO, toController.getDashboard);

toRouter.get('/pending-users', requireTO, toController.getPendingUsers);
toRouter.put('/pending-users/:id', requireTO, toController.updatePendingUser);
toRouter.put('/approve/:id', requireTO, toController.approveUser);
toRouter.put('/reject/:id', requireTO, toController.rejectUser);

// history of decisions
toRouter.get('/history', requireTO, toController.getHistory);

// notice management endpoints
toRouter.get('/notices', requireTO, toController.getNotices);
toRouter.post('/notices', requireTO, toController.createNotice);
toRouter.put('/notices/:id', requireTO, toController.updateNotice);
toRouter.delete('/notices/:id', requireTO, toController.deleteNotice);

export default toRouter;
