import express from "express";
import mongoose from "mongoose";

import userRouter from "./routers/userRouter.js";
import authenticateUser from "./middlewares/authentication.js";
import requireDatabaseConnection from "./middlewares/databaseConnection.js";
import { CORS_ALLOWED_ORIGINS, MONGODB_URI, MONGODB_URI_FALLBACK, PORT } from "./config.js";
import hallRouter from "./routers/hallRouter.js";
import bookingRouter from "./routers/bookingRouter.js";
import notificationRouter from "./routers/notificationRouter.js";
import slotGeneratorRouter from "./routers/slotGeneratorRouter.js";
import dashboardRouter from "./routers/dashboardRouter.js";
import hodRouter from "./routers/hodRouter.js";
import lectureHallRouter from "./routers/lectureHallRouter.js";
import studentRouter from "./routers/studentRouter.js";
import toRouter from "./routers/toRouter.js";
import contactRouter from "./routers/contactRouter.js";

const app = express();
app.set("trust proxy", 1);

const vercelPreviewRegex = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;
const defaultAllowedHeaders = ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"];

function normalizeOrigin(value = "") {
    return String(value || "").trim().replace(/\/+$/, "");
}

function isAllowedOrigin(origin) {
    if (!origin) return true;

    const normalizedOrigin = normalizeOrigin(origin);

    return CORS_ALLOWED_ORIGINS.includes(normalizedOrigin) || vercelPreviewRegex.test(normalizedOrigin);
}

// Fail fast on disconnected DB instead of hanging with buffering timeouts.
mongoose.set("bufferCommands", false);

let serverStarted = false;
const startServer = () => {
    if (serverStarted) return;
    serverStarted = true;
    app.listen(PORT, () => {
        console.log(`Server started on port ${PORT}`);
    });
};

const connectMongo = async () => {
    try {
        await mongoose.connect(MONGODB_URI, {
            serverSelectionTimeoutMS: 5000
        });
        console.log("Connected to MongoDB");
        return true;
    } catch (err) {
        console.error("Primary MongoDB connection failed:", err.message || err);

        const shouldTryFallback =
            Boolean(MONGODB_URI_FALLBACK) &&
            MONGODB_URI_FALLBACK !== MONGODB_URI;

        if (!shouldTryFallback) {
            return false;
        }

        try {
            console.log("Trying fallback MongoDB URI...");
            await mongoose.connect(MONGODB_URI_FALLBACK, {
                serverSelectionTimeoutMS: 5000
            });
            console.log("Connected to fallback MongoDB");
            return true;
        } catch (fallbackErr) {
            console.error("Fallback MongoDB connection failed:", fallbackErr.message || fallbackErr);
            return false;
        }
    }
};

app.use((req, res, next) => {
    const origin = normalizeOrigin(req.headers.origin);

    if (origin && isAllowedOrigin(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Vary", "Origin");
        res.header("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");

        const requestedHeaders = req.headers["access-control-request-headers"];
        res.header(
            "Access-Control-Allow-Headers",
            requestedHeaders || defaultAllowedHeaders.join(",")
        );
    }

    if (req.method === "OPTIONS") {
        if (!origin || isAllowedOrigin(origin)) {
            return res.sendStatus(204);
        }

        return res.status(403).json({
            message: "CORS blocked: origin not allowed"
        });
    }

    next();
});

app.use(express.json());

// Public routes (no authentication required)
app.use("/contact", contactRouter);

app.use(authenticateUser);

app.use("/users", requireDatabaseConnection, userRouter);
app.use("/halls", hallRouter);
app.use("/bookings", bookingRouter);
app.use("/notifications", notificationRouter);
app.use("/generate-slots", slotGeneratorRouter);
app.use("/dashboard", dashboardRouter);
app.use("/hod", hodRouter);
app.use("/lecture-halls", lectureHallRouter);
app.use("/student", studentRouter);
app.use("/to", toRouter);

const bootstrap = async () => {
    const connected = await connectMongo();
    if (!connected) {
        console.warn("MongoDB connection unavailable. Running in limited mode for public routes.");
    }

    // Keep API available for routes that do not require DB (e.g. contact form).
    startServer();
};

bootstrap();