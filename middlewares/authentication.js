import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config.js";
import User from "../models/user.js";

function isPublicAuthPath(path = "") {
    if (!path.startsWith("/users")) return false;

    return (
        path === "/users" ||
        path === "/users/login" ||
        path === "/users/forgot-password" ||
        path.startsWith("/users/reset-password/") ||
        path === "/users/oauth/google" ||
        path === "/users/oauth/google/callback" ||
        path === "/users/oauth/microsoft" ||
        path === "/users/oauth/microsoft/callback"
    );
}

export default function authenticateUser(req, res, next) {
    const header = req.header("Authorization");

    if (!header) {
        return next();
    }

    const token = header.replace("Bearer ", "");

    jwt.verify(token, JWT_SECRET, async (error, decoded) => {
        if (error) {
            if (isPublicAuthPath(req.path)) {
                return next();
            }

            return res.status(401).json({
                message: "Invalid or Expired Token"
            });
        }

        try {
            // Re-verify the user still exists in the database.
            // This immediately invalidates tokens for deleted or rejected accounts.
            const dbUser = await User.findById(decoded._id).lean();
            if (!dbUser) {
                return res.status(401).json({
                    message: "Account no longer exists. Please register again."
                });
            }
            // Use fresh role from DB (not stale role embedded in the JWT)
            req.user = { ...decoded, role: dbUser.role };
        } catch (dbErr) {
            // DB temporarily unavailable — fall back to token data so
            // the request is not blocked by infrastructure issues.
            console.error('Auth DB check error (falling back to token):', dbErr.message);
            req.user = decoded;
        }

        next();
    });
}