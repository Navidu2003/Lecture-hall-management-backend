import mongoose from "mongoose";

const timeSlotSchema = new mongoose.Schema({
    hall: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LectureHall",
        required: true
    },

    date: {
        type: String,
        required: true
    },

    startTime: {
        type: String,
        required: true
    },

    endTime: {
        type: String,
        required: true
    },

    status: {
        type: String,
        enum: ["AVAILABLE", "LOCKED", "BOOKED"],
        default: "AVAILABLE"
    },

    lockedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    }

}, { timestamps: true });

const TimeSlot = mongoose.model("TimeSlot", timeSlotSchema);

export default TimeSlot;