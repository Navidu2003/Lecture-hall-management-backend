import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
        },
        lastName: {
            type: String,
            required: false,
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
         username: {
            type: String,
            required: true,
            unique: true
        },
        password : {
            type : String,
            required : true
        },
        role: {
            type: String,
            enum: ["PENDING", "REJECTED", "STUDENT", "LECTURER", "HOD", "TO", "ADMIN"],
            default: "PENDING"
         },
        requestedRole: {
            type: String,
            enum: ["STUDENT", "LECTURER", "HOD", "TO"],
            required: true,
            default: "STUDENT"
        },
        isEmailVerified : {
            type : Boolean,
            required : true,
            default : false
        },
        image : {
            type : String,
            default : "/images/default-profile.png"
        },
        authProvider: {
            type: String,
            enum: ["LOCAL", "GOOGLE", "MICROSOFT"],
            default: "LOCAL"
        },
        googleId: {
            type: String,
            required: false,
            default: null,
        },
        microsoftId: {
            type: String,
            required: false,
            default: null,
        },
        phone : {
            type : String,
            required : false
        }
        ,
        department: {
            type: String,
            required: false
        },
        designation: {
            type: String,
            required: false
        },
        courses: {
            type: [String],
            required: false,
            default: []
        },
        batch: {
            type: String,
            required: false
        },
        semester: {
            type: String,
            required: false
        },
        rejectionReason: {
            type: String,
            required: false,
            default: null,
            trim: true
        },
        resetPasswordToken: {
            type: String,
            required: false,
            default: null,
        },
        resetPasswordExpires: {
            type: Date,
            required: false,
            default: null,
        },
         
    },
    {
        timestamps: true
    }
) 

const User = mongoose.model("User" , userSchema)

export default User