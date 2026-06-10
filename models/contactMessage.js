import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
        },
        message: {
            type: String,
            required: true,
            trim: true,
        },
        deliveryStatus: {
            type: String,
            enum: ["pending", "delivered", "email_failed"],
            default: "pending",
        },
        emailError: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);

export default ContactMessage;