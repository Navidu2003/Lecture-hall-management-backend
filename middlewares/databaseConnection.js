import mongoose from "mongoose";

export default function requireDatabaseConnection(req, res, next) {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
            message: "Database connection unavailable. Please try again later."
        });
    }

    next();
}
