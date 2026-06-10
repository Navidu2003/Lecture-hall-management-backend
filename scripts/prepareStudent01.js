import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { MONGODB_URI } from "../config.js";
import User from "../models/user.js";
import Booking from "../models/booking.js";

await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

const batches = await Booking.aggregate([
  { $match: { status: "APPROVED", targetBatch: { $nin: [null, ""] } } },
  { $group: { _id: "$targetBatch", count: { $sum: 1 } } },
  { $sort: { count: -1 } }
]);

const chosenBatch = batches.length ? batches[0]._id : "SE-2022";
const passwordHash = await bcrypt.hash("student123", 10);

const update = {
  firstName: "Student",
  lastName: "One",
  email: "student01@timelyx.local",
  username: "student01",
  password: passwordHash,
  role: "STUDENT",
  requestedRole: "STUDENT",
  isEmailVerified: true,
  department: "SE",
  batch: chosenBatch,
  semester: "1"
};

const result = await User.findOneAndUpdate(
  { username: "student01" },
  { $set: update },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

console.log("student01 ready:", {
  id: String(result._id),
  username: result.username,
  role: result.role,
  batch: result.batch,
  email: result.email
});
console.log("suggested login password:", "student123");
console.log("approved target batches:", batches.map((b) => ({ batch: b._id, count: b.count })));

await mongoose.disconnect();
