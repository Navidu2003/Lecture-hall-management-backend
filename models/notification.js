import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receivers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }],
    title: {
        type: String,
        default: ""
    },
    category: {
        type: String,
        enum: ["GENERAL", "SIGNUP_REQUEST"],
        default: "GENERAL"
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false
    },
    message: {
        type: String,
        required: true
    },
    readBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification; 