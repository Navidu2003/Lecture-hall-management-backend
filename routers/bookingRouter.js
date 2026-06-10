import express from "express";
import { createBooking, updateBookingStatus } from "../controllers/bookingController.js";
import { cancelBooking } from "../controllers/bookingController.js";
import { getBookingHistory, getPendingBookingRequests } from "../controllers/bookingController.js";
import { createRangeBooking } from "../controllers/bookingController.js";

const bookingRouter = express.Router();

bookingRouter.post("/", createBooking);
bookingRouter.post("/range", createRangeBooking);
bookingRouter.put("/:id", updateBookingStatus);
bookingRouter.delete("/:id", cancelBooking);
bookingRouter.get("/", getBookingHistory);
bookingRouter.get("/pending", getPendingBookingRequests);

export default bookingRouter;