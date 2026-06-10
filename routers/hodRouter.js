import express from "express";
import { requireHOD, requireLecturerOrHOD } from "../middlewares/roleMiddleware.js";
import * as hodController from "../controllers/hodController.js";

const hodRouter = express.Router();

hodRouter.get('/dashboard', requireHOD, hodController.getDashboard);
hodRouter.get('/pending', requireHOD, hodController.getPending);
hodRouter.get('/requests', requireHOD, hodController.getRequests);
hodRouter.put('/request/:id', requireHOD, hodController.updateRequest);
hodRouter.get('/history', requireHOD, hodController.getHistory);
hodRouter.get('/notices', requireHOD, hodController.getNotices);
hodRouter.post('/notices', requireHOD, hodController.createNotice);
hodRouter.put('/notices/:id', requireHOD, hodController.updateNotice);
hodRouter.delete('/notices/:id', requireHOD, hodController.deleteNotice);
hodRouter.post('/book-hall', requireLecturerOrHOD, hodController.bookHall);
hodRouter.post('/decision-notification', requireHOD, hodController.decisionNotification);

export default hodRouter;
