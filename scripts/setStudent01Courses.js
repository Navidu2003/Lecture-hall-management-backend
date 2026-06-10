import mongoose from "mongoose";
import { MONGODB_URI } from "../config.js";
import User from "../models/user.js";
import Booking from "../models/booking.js";

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const student = await User.findOne({ username: "student01" }).select("_id batch");
  if (!student) {
    console.log("student01 not found");
    await mongoose.disconnect();
    return;
  }

  const batch = student.batch || "2024";
  const subjects = await Booking.distinct("subject", {
    status: "APPROVED",
    targetBatch: batch,
    subject: { $nin: [null, ""] }
  });

  const finalCourses = (subjects || []).slice(0, 5);
  await User.updateOne({ _id: student._id }, { $set: { courses: finalCourses } });

  const updated = await User.findById(student._id).select("username batch courses").lean();
  console.log("student01 updated courses:", updated);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (e) {}
  process.exit(1);
});
