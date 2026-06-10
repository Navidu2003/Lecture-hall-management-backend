import mongoose from "mongoose";

const rejectedRegistrationSchema = new mongoose.Schema(
    {
        emailLower: {
            type: String,
            required: false,
            default: null,
            trim: true,
        },
        usernameLower: {
            type: String,
            required: false,
            default: null,
            trim: true,
        },
        reason: {
            type: String,
            required: false,
            default: null,
            trim: true,
        },
        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
            default: null,
        },
    },
    { timestamps: true }
);

rejectedRegistrationSchema.index({ emailLower: 1 }, { unique: true, sparse: true });
rejectedRegistrationSchema.index({ usernameLower: 1 }, { unique: true, sparse: true });

const RejectedRegistration = mongoose.model("RejectedRegistration", rejectedRegistrationSchema);

export default RejectedRegistration;
