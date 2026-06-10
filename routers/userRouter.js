import express from "express";
import {
	createUser,
	loginUser,
	updateUserRole,
	getPendingUsers,
	getMyProfile,
	updateMyProfile,
	changePassword,
	getUsersByRole,
	forgotPassword,
	resetPassword,
	startGoogleOAuth,
	googleOAuthCallback,
	startMicrosoftOAuth,
	microsoftOAuthCallback,
} from "../controllers/userController.js";
import { requireAdmin, requireHOD } from "../middlewares/roleMiddleware.js";

const userRouter = express.Router();

userRouter.post("/",createUser);
userRouter.post("/login", loginUser);
userRouter.get("/oauth/google", startGoogleOAuth);
userRouter.get("/oauth/google/callback", googleOAuthCallback);
userRouter.get("/oauth/microsoft", startMicrosoftOAuth);
userRouter.get("/oauth/microsoft/callback", microsoftOAuthCallback);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password/:token", resetPassword);
userRouter.get("/me", getMyProfile);
userRouter.put("/me", updateMyProfile);
userRouter.put("/change-password", changePassword);
userRouter.put("/:id/role", requireAdmin, updateUserRole);
userRouter.get("/pending", requireAdmin, getPendingUsers);
userRouter.get('/by-role/:role', requireHOD, getUsersByRole);

export default userRouter;