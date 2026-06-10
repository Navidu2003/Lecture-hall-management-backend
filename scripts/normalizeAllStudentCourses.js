import mongoose from "mongoose";
import { MONGODB_URI } from "../config.js";
import User from "../models/user.js";
import Booking from "../models/booking.js";

function canonical(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function run() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const students = await User.find({ role: "STUDENT" }).select("_id username batch courses").lean();
  let touched = 0;

  for (const s of students) {
    const existing = Array.isArray(s.courses) ? s.courses : [];
    const expanded = [];
    for (const item of existing) {
      const parts = String(item || "").split(",").map((x) => x.trim()).filter(Boolean);
      expanded.push(...parts);
    }

    let normalized = [...new Set(expanded.map((x) => canonical(x)).filter(Boolean))];

    if (normalized.length === 0 && s.batch) {
      const subjects = await Booking.distinct("subject", {
        status: "APPROVED",
        targetBatch: s.batch,
        subject: { $nin: [null, ""] }
      });
      normalized = [...new Set((subjects || []).map((x) => canonical(x)).filter(Boolean))];
    }

    if (normalized.length === 0) continue;

    await User.updateOne({ _id: s._id }, { $set: { courses: normalized } });
    touched += 1;
  }

  console.log("students:", students.length);
  console.log("updated:", touched);

  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
