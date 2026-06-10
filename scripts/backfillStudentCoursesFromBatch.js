import mongoose from "mongoose";
import { MONGODB_URI } from "../config.js";
import User from "../models/user.js";
import Booking from "../models/booking.js";

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const students = await User.find({ role: "STUDENT" }).select("_id username batch courses").lean();
  let updatedCount = 0;

  for (const s of students) {
    const hasCourses = Array.isArray(s.courses) && s.courses.some((c) => String(c || "").trim());
    if (hasCourses) continue;

    const batch = String(s.batch || "").trim();
    if (!batch) continue;

    const subjects = await Booking.distinct("subject", {
      status: "APPROVED",
      targetBatch: batch,
      subject: { $nin: [null, ""] }
    });

    if (!subjects.length) continue;

    await User.updateOne({ _id: s._id }, { $set: { courses: subjects.slice(0, 8) } });
    updatedCount += 1;
  }

  console.log("Students processed:", students.length);
  console.log("Students updated:", updatedCount);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch (e) {}
  process.exit(1);
});
