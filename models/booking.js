import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    lecturer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    timeSlot: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TimeSlot",
        required: true
    },
    requestId: {
        type: mongoose.Schema.Types.ObjectId,
        required: false,
        index: true
    },
    subject: {
        type: String,
        default: 'Class'
    },
    targetBatch: {
        type: String,
        required: false,
        default: null
    },
    capacity: {
        type: Number,
        required: false,
        default: null
    },
    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED"],
        default: "PENDING"
    },
    rejectionReason: {
        type: String,
        required: false,
        default: null,
        trim: true
    },
    cancelledAt: {
        type: Date,
        default: null
    }
},{ timestamps: true });

const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;