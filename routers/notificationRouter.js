import express from "express";
import {sendNotification,getMyNotifications,markNotificationAsRead,getUnreadNotificationCount} from "../controllers/notificationController.js";

const notificationRouter = express.Router();

notificationRouter.post("/", sendNotification);
notificationRouter.get("/", getMyNotifications);
notificationRouter.get("/unread-count", getUnreadNotificationCount);
notificationRouter.put("/:id/read", markNotificationAsRead);

export default notificationRouter;