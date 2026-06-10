import User from "../models/user.js";
import Notification from "../models/notification.js";
import RejectedRegistration from "../models/rejectedRegistration.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
    FRONTEND_BASE_URL,
    GMAIL_PASSWORD,
    GMAIL_USER,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    JWT_SECRET,
    MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET,
    MICROSOFT_REDIRECT_URI,
    MICROSOFT_TENANT_ID,
    RESET_PASSWORD_EXPIRES_MINUTES,
} from "../config.js";
import { sendMailWithFallback } from "../utils/mailTransport.js";

function escapeRegex(value = "") {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeUrl(value = "") {
    return String(value || "").trim().replace(/\/+$/, "");
}

function extractOriginFromUrl(value = "") {
    try {
        return new URL(value).origin;
    } catch {
        return "";
    }
}

function isSafeHttpOrigin(value = "") {
    const origin = extractOriginFromUrl(value);
    return Boolean(origin && /^https?:\/\//i.test(origin));
}

function resolveBackendBaseUrl(req) {
    const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
    const proto = forwardedProto || req.protocol || "https";
    const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
    const host = forwardedHost || req.get("host");

    if (!host) {
        return "http://localhost:3000";
    }

    return `${proto}://${host}`;
}

function resolveFrontendBaseUrl(req) {
    const requestedFrontendBase = normalizeUrl(
        req.query?.frontendBaseUrl || req.query?.frontend || req.query?.redirectBase || ""
    );
    if (isSafeHttpOrigin(requestedFrontendBase)) {
        return requestedFrontendBase;
    }

    const configured = normalizeUrl(FRONTEND_BASE_URL);
    if (configured && !configured.includes("localhost")) {
        return configured;
    }

    const requestOrigin = normalizeUrl(req.get("origin") || "");
    if (requestOrigin) {
        return requestOrigin;
    }

    const refererOrigin = extractOriginFromUrl(req.get("referer") || "");
    if (refererOrigin) {
        return normalizeUrl(refererOrigin);
    }

    return configured || "http://localhost:5173";
}

function resolveOAuthRedirectUri(req, provider) {
    const configured = provider === "google"
        ? normalizeUrl(GOOGLE_REDIRECT_URI)
        : normalizeUrl(MICROSOFT_REDIRECT_URI);

    const expectedPath = `/users/oauth/${provider}/callback`;
    const backendBase = resolveBackendBaseUrl(req);
    const derived = `${backendBase}${expectedPath}`;

    if (!configured) {
        return derived;
    }

    const configuredLooksLocal = configured.includes("localhost") || configured.includes("127.0.0.1");

    let configuredPath = "";
    try {
        configuredPath = new URL(configured).pathname.replace(/\/+$/, "");
    } catch {
        configuredPath = configured;
    }

    const pathMatches = configuredPath === expectedPath;
    const configuredOrigin = extractOriginFromUrl(configured);
    const backendOrigin = extractOriginFromUrl(derived);
    const originMismatchInProd =
        Boolean(configuredOrigin && backendOrigin) &&
        configuredOrigin !== backendOrigin &&
        !backendOrigin.includes("localhost") &&
        !backendOrigin.includes("127.0.0.1");

    // In production, stale env values are common after domain changes.
    // Fall back to request-derived callback when configured URI is unsafe/mismatched.
    if (!configuredLooksLocal && pathMatches && !originMismatchInProd) {
        return configured;
    }

    return derived;
}

function createOAuthState(provider, frontendBaseUrl) {
    return jwt.sign(
        { provider, frontendBaseUrl: normalizeUrl(frontendBaseUrl), type: "oauth_state" },
        JWT_SECRET,
        { expiresIn: "10m" }
    );
}

function verifyOAuthState(token, provider) {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded?.type !== "oauth_state" || decoded?.provider !== provider) {
        return null;
    }

    return decoded;
}

function buildAuthErrorRedirect(message, frontendBaseUrl = FRONTEND_BASE_URL) {
    const safe = encodeURIComponent(message || "Authentication failed");
    return `${normalizeUrl(frontendBaseUrl)}/login?oauthError=${safe}`;
}

function buildAuthSuccessRedirect(token, role, username, frontendBaseUrl = FRONTEND_BASE_URL) {
    const params = new URLSearchParams({ token, role, username: username || "" });
    return `${normalizeUrl(frontendBaseUrl)}/oauth/callback?${params.toString()}`;
}

async function sendResetPasswordEmail({ to, firstName, resetLink }) {
    if (!GMAIL_USER || !GMAIL_PASSWORD || GMAIL_PASSWORD === "your-app-specific-password-here") {
        throw new Error("Email service is not configured");
    }

    const appName = "Timelyx";
    const safeName = firstName || "User";

    await sendMailWithFallback({
        from: `Timelyx <${GMAIL_USER}>`,
        to,
        subject: `${appName} Password Reset`,
        text: `Hello ${safeName},\n\nUse this link to reset your password:\n${resetLink}\n\nThis link expires in ${RESET_PASSWORD_EXPIRES_MINUTES} minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #222;">Reset your password</h2>
                <p>Hello ${safeName},</p>
                <p>We received a request to reset your ${appName} password.</p>
                <p>
                    <a href="${resetLink}" style="display: inline-block; padding: 10px 16px; background: #111827; color: #fff; text-decoration: none; border-radius: 6px;">
                        Reset Password
                    </a>
                </p>
                <p>Or copy and paste this link in your browser:</p>
                <p><a href="${resetLink}">${resetLink}</a></p>
                <p style="color: #555;">This link expires in ${RESET_PASSWORD_EXPIRES_MINUTES} minutes.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin-top: 24px;" />
                <p style="font-size: 12px; color: #888;">If you did not request this, you can safely ignore this email.</p>
            </div>
        `,
    });
}

async function generateUniqueUsername(base) {
    const cleaned = (base || "user").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase() || "user";
    let candidate = cleaned;
    let count = 0;

    while (count < 10) {
        const exists = await User.findOne({ username: { $regex: new RegExp(`^${escapeRegex(candidate)}$`, "i") } });
        if (!exists) return candidate;
        count += 1;
        candidate = `${cleaned}${Math.floor(Math.random() * 100000)}`;
    }

    return `${cleaned}${Date.now()}`;
}

async function findOrCreateOAuthUser({ provider, providerId, email, firstName, lastName }) {
    if (!email) {
        throw new Error("Email not provided by OAuth provider");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const blockedByEmail = await RejectedRegistration.findOne({ emailLower: normalizedEmail }).lean();
    if (blockedByEmail) {
        throw new Error("This registration email was previously rejected by TO and cannot be used to request access again");
    }

    let user = await User.findOne({ email: { $regex: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i") } });

    if (!user) {
        const usernameBase = normalizedEmail.split("@")[0] || "user";
        const username = await generateUniqueUsername(usernameBase);
        const randomPassword = crypto.randomBytes(24).toString("hex");

        user = new User({
            firstName: firstName || "User",
            lastName: lastName || "",
            email: normalizedEmail,
            username,
            password: await bcrypt.hash(randomPassword, 10),
            role: "PENDING",
            requestedRole: "STUDENT",
            isEmailVerified: true,
            authProvider: provider,
            googleId: provider === "GOOGLE" ? providerId : null,
            microsoftId: provider === "MICROSOFT" ? providerId : null,
        });

        await user.save();

        const toUsers = await User.find({ role: "TO" }).select("_id").lean();
        if (toUsers.length > 0) {
            await Notification.create({
                sender: user._id,
                receivers: toUsers.map((u) => u._id),
                title: "New Sign-up Request",
                category: "SIGNUP_REQUEST",
                targetUser: user._id,
                message: `${user.firstName} ${user.lastName || ""}`.trim() +
                    ` requested account access as ${user.requestedRole}.`
            });
        }

        return user;
    }

    if (provider === "GOOGLE" && !user.googleId) user.googleId = providerId;
    if (provider === "MICROSOFT" && !user.microsoftId) user.microsoftId = providerId;
    if (!user.authProvider || user.authProvider === "LOCAL") {
        user.authProvider = provider;
    }
    await user.save();

    return user;
}

function issueUserToken(user) {
    const payload = {
        _id: user._id,
        email: user.email,
        username: user.username,
        role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}


// ================= CREATE USER =================
export async function createUser(req, res) {
    try {

        const { firstName, lastName, email, username, password, requestedRole } = req.body;
        const normalizedEmail = (email || "").trim().toLowerCase();
        const normalizedUsername = (username || "").trim();
        const normalizedUsernameLower = normalizedUsername.toLowerCase();

        // 🔥 Basic validation
        if (!firstName || !normalizedEmail || !normalizedUsername || !password) {
            return res.status(400).json({
                message: "All required fields must be filled"
            });
        }

        const blockedIdentity = await RejectedRegistration.findOne({
            $or: [
                { emailLower: normalizedEmail },
                { usernameLower: normalizedUsernameLower }
            ]
        }).lean();

        if (blockedIdentity) {
            return res.status(403).json({
                message: "This email or username was previously rejected by TO and cannot be used for a new registration request"
            });
        }

        // requestedRole should be one of allowed roles; default to STUDENT
        const allowedReq = ["STUDENT", "LECTURER", "HOD", "TO"];
        const roleToRequest = (requestedRole || "STUDENT").toUpperCase();
        const finalRequestedRole = allowedReq.includes(roleToRequest) ? roleToRequest : "STUDENT";

        // 🔥 Check existing email
        const existingEmail = await User.findOne({
            email: { $regex: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i") }
        });
        if (existingEmail) {
            return res.status(400).json({
                message: "Email already exists"
            });
        }

        // 🔥 Check existing username
        const existingUsername = await User.findOne({
            username: { $regex: new RegExp(`^${escapeRegex(normalizedUsername)}$`, "i") }
        });
        if (existingUsername) {
            return res.status(400).json({
                message: "Username already taken"
            });
        }

        // 🔥 Hash password safely
        const passwordHash = await bcrypt.hash(password, 10);

        // always start pending; actual role assigned by TO
        const newUser = new User({
            firstName,
            lastName: lastName || "",
            email: normalizedEmail,
            username: normalizedUsername,
            password: passwordHash,
            role: "PENDING",
            requestedRole: finalRequestedRole
        });

        await newUser.save();

        // notify all TO users that a new signup approval request is waiting
        const toUsers = await User.find({ role: "TO" }).select("_id").lean();
        if (toUsers.length > 0) {
            await Notification.create({
                sender: newUser._id,
                receivers: toUsers.map((u) => u._id),
                title: "New Sign-up Request",
                category: "SIGNUP_REQUEST",
                targetUser: newUser._id,
                message: `${newUser.firstName} ${newUser.lastName || ""}`.trim() +
                    ` requested account access as ${newUser.requestedRole}.`
            });
        }

        // sign token so frontend can keep user in context (even if PENDING)
        const payload = {
            _id: newUser._id,
            email: newUser.email,
            username: newUser.username,
            role: newUser.role
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

        return res.status(201).json({
            message: "Account created",
            token,
            role: newUser.role,
            username: newUser.username
        });

    } catch (error) {

        console.log("CREATE USER ERROR:", error); // 🔥 IMPORTANT LOG

        // Handle duplicate index crash (Mongo error 11000)
        if (error.code === 11000) {
            return res.status(400).json({
                message: "Duplicate field value detected"
            });
        }

        return res.status(500).json({
            message: error.message || "Error creating user"
        });
    }
}


// ================= LOGIN USER =================
export async function loginUser(req, res) {
    try {

        const { email, password } = req.body;
        const identifier = (email || "").trim();

        if (!identifier || !password) {
            return res.status(400).json({
                message: "Email/Username and password are required"
            });
        }

        // Check if input is email or username
        const isEmail = identifier.includes("@");
        const query = isEmail 
            ? { email: { $regex: new RegExp(`^${escapeRegex(identifier.toLowerCase())}$`, "i") } }
            : { username: { $regex: new RegExp(`^${escapeRegex(identifier)}$`, "i") } };

        const user = await User.findOne(query);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        let isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        // Handle old records that may still contain plain-text passwords.
        if (!isPasswordCorrect && user.password === password) {
            user.password = await bcrypt.hash(password, 10);
            await user.save();
            isPasswordCorrect = true;
        }

        // Keep demo TO account recoverable even if seeded with stale credentials.
        const isDemoTO =
            (user.email || "").toLowerCase() === "to@timelyx.local" ||
            (user.username || "").toLowerCase() === "to";

        if (!isPasswordCorrect && isDemoTO && password === "password123") {
            user.password = await bcrypt.hash("password123", 10);
            await user.save();
            isPasswordCorrect = true;
        }

        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "Invalid password"
            });
        }

        if (user.role === "REJECTED") {
            return res.status(403).json({
                message: "Your account request was rejected"
            });
        }

        const payload = {
            _id: user._id,
            email: user.email,
            username: user.username,
            role: user.role
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

        return res.status(200).json({
            message: "Login successful",
            token,
            role: user.role,
            username: user.username
        });

    } catch (error) {

        console.log("LOGIN ERROR:", error); // 🔥 IMPORTANT LOG

        return res.status(500).json({
            message: error.message || "Server error during login"
        });
    }
}


// ================= UPDATE USER ROLE =================
export async function updateUserRole(req, res) {
    try {

        if (!req.user || req.user.role !== "ADMIN") {
            return res.status(403).json({
                message: "Admin access required"
            });
        }

        const { role } = req.body;

        const allowedRoles = ["STUDENT", "LECTURER", "HOD", "ADMIN"];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                message: "Invalid role value"
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        user.role = role;
        await user.save();

        return res.status(200).json({
            message: "User role updated successfully"
        });

    } catch (error) {

        console.log("UPDATE ROLE ERROR:", error);

        return res.status(500).json({
            message: error.message || "Error updating user role"
        });
    }
}


// ================= GET PENDING USERS =================
export async function getPendingUsers(req, res) {
    try {

        if (!req.user || req.user.role !== "ADMIN") {
            return res.status(403).json({
                message: "Admin access required"
            });
        }

        const users = await User.find({ role: "PENDING" })
            .select("firstName lastName email username role createdAt");

        return res.status(200).json(users);

    } catch (error) {

        console.log("GET PENDING USERS ERROR:", error);

        return res.status(500).json({
            message: error.message || "Error fetching pending users"
        });
    }
}


// ================= GET MY PROFILE =================
export async function getMyProfile(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const user = await User.findById(req.user._id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        return res.status(200).json(user);
    } catch (error) {
        console.log('GET MY PROFILE ERROR:', error);
        return res.status(500).json({ message: error.message || 'Error fetching profile' });
    }
}


// ================= UPDATE MY PROFILE =================
export async function updateMyProfile(req, res) {
    try {
        console.log('UPDATE MY PROFILE - User ID:', req.user?._id);
        console.log('UPDATE MY PROFILE - Request body:', JSON.stringify(req.body, null, 2));
        
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Check MongoDB connection status
        const mongoose = (await import('mongoose')).default;
        if (mongoose.connection.readyState !== 1) {
            console.log('UPDATE MY PROFILE - MongoDB not connected');
            return res.status(503).json({ 
                message: 'Database connection unavailable. Please try again later.' 
            });
        }

        const allowed = ['firstName', 'lastName', 'username', 'email', 'phone', 'image', 'department', 'designation', 'courses', 'batch', 'semester'];
        const updates = {};

        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        
        console.log('UPDATE MY PROFILE - Updates to apply:', JSON.stringify(updates, null, 2));

        // check username/email uniqueness if provided
        if (updates.email) {
            const exists = await User.findOne({ email: updates.email, _id: { $ne: req.user._id } });
            if (exists) {
                console.log('UPDATE MY PROFILE - Email already taken:', updates.email);
                return res.status(400).json({ message: 'Email already taken' });
            }
        }
        if (updates.username) {
            const exists = await User.findOne({ username: updates.username, _id: { $ne: req.user._id } });
            if (exists) {
                console.log('UPDATE MY PROFILE - Username already taken:', updates.username);
                return res.status(400).json({ message: 'Username already taken' });
            }
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            console.log('UPDATE MY PROFILE - User not found:', req.user._id);
            return res.status(404).json({ message: 'User not found' });
        }
        
        console.log('UPDATE MY PROFILE - Found user:', user.email, 'authProvider:', user.authProvider);

        Object.assign(user, updates);
        await user.save();
        
        console.log('UPDATE MY PROFILE - Profile updated successfully');

        const safeUser = user.toObject();
        delete safeUser.password;

        return res.status(200).json(safeUser);

    } catch (error) {
        console.log('UPDATE MY PROFILE ERROR:', error);
        console.log('UPDATE MY PROFILE ERROR NAME:', error.name);
        console.log('UPDATE MY PROFILE ERROR CODE:', error.code);
        console.log('UPDATE MY PROFILE ERROR MESSAGE:', error.message);
        
        // Better error messages for common MongoDB issues
        if (error.name === 'MongoNetworkError' || error.name === 'MongooseServerSelectionError') {
            return res.status(503).json({ message: 'Database connection unavailable. Please try again later.' });
        }
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Email or username already exists' });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message });
        }
        
        return res.status(500).json({ message: error.message || 'Error updating profile' });
    }
}

// ================= CHANGE PASSWORD =================
export async function changePassword(req, res) {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'Current password and new password are required' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        return res.status(200).json({ message: 'Password changed successfully' });

    } catch (error) {
        console.log('CHANGE PASSWORD ERROR:', error);
        return res.status(500).json({ message: error.message || 'Error changing password' });
    }
}

// list users by role (e.g., LECTURER) - allow HOD or ADMIN callers (router protects with requireHOD)
export async function getUsersByRole(req, res) {
    try {
        const role = (req.params.role || '').toUpperCase();
        if (!role) return res.status(400).json({ message: 'Role is required' });

        const users = await User.find({ role }).select('_id firstName lastName email username department');
        return res.status(200).json(users.map(u => ({ id: u._id, name: `${u.firstName || ''} ${u.lastName || ''}`.trim(), email: u.email, department: u.department })));
    } catch (error) {
        console.error('getUsersByRole error:', error);
        return res.status(500).json({ message: error.message });
    }
}


// ================= FORGOT PASSWORD =================
export async function forgotPassword(req, res) {
    try {
        const identifier = (req.body?.email || req.body?.identifier || "").trim();
        const requestOrigin = req.get("origin");
        const resetBaseUrl = requestOrigin && /^https?:\/\//i.test(requestOrigin)
            ? requestOrigin
            : FRONTEND_BASE_URL;

        if (!identifier) {
            return res.status(400).json({ message: "Email or username is required" });
        }

        const isEmail = identifier.includes("@");
        const query = isEmail
            ? { email: { $regex: new RegExp(`^${escapeRegex(identifier.toLowerCase())}$`, "i") } }
            : { username: { $regex: new RegExp(`^${escapeRegex(identifier)}$`, "i") } };

        const user = await User.findOne(query);

        // Keep response generic to avoid account enumeration.
        if (!user) {
            return res.status(200).json({
                message: "If an account exists, a password reset link has been sent."
            });
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + RESET_PASSWORD_EXPIRES_MINUTES * 60 * 1000);

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = expiresAt;
        await user.save();

        const resetLink = `${resetBaseUrl}/reset-password/${rawToken}`;
        await sendResetPasswordEmail({
            to: user.email,
            firstName: user.firstName,
            resetLink,
        });

        console.log(`[FORGOT PASSWORD] Reset email sent to ${user.email}`);

        const response = {
            message: "If an account exists, a password reset link has been sent."
        };

        if ((process.env.NODE_ENV || "development") !== "production") {
            response.previewResetLink = resetLink;
        }

        return res.status(200).json(response);
    } catch (error) {
        console.log("FORGOT PASSWORD ERROR:", error);
        if (error?.message?.includes("Mail send timed out") || error?.code === "ETIMEDOUT") {
            return res.status(503).json({
                message: "Email service is taking too long to respond. Please try again shortly."
            });
        }

        return res.status(500).json({
            message: error.message || "Error processing forgot password request"
        });
    }
}


// ================= RESET PASSWORD =================
export async function resetPassword(req, res) {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;

        if (!token) {
            return res.status(400).json({ message: "Reset token is required" });
        }

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: "New password must be at least 6 characters" });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ message: "Reset link is invalid or has expired" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        return res.status(200).json({ message: "Password reset successful. Please log in." });
    } catch (error) {
        console.log("RESET PASSWORD ERROR:", error);
        return res.status(500).json({
            message: error.message || "Error resetting password"
        });
    }
}

// ================= GOOGLE OAUTH START =================
export async function startGoogleOAuth(req, res) {
    try {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            return res.status(501).json({ message: "Google OAuth is not configured" });
        }

        const frontendBaseUrl = resolveFrontendBaseUrl(req);
        const redirectUri = resolveOAuthRedirectUri(req, "google");
        const state = createOAuthState("google", frontendBaseUrl);
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "openid email profile");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "select_account");

        return res.redirect(authUrl.toString());
    } catch (error) {
        console.error("startGoogleOAuth error:", error);
        return res.redirect(buildAuthErrorRedirect("Unable to start Google login", resolveFrontendBaseUrl(req)));
    }
}

// ================= GOOGLE OAUTH CALLBACK =================
export async function googleOAuthCallback(req, res) {
    let frontendBaseUrl = resolveFrontendBaseUrl(req);

    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.redirect(buildAuthErrorRedirect("Missing Google OAuth parameters", frontendBaseUrl));
        }

        const statePayload = verifyOAuthState(state, "google");
        if (!statePayload) {
            return res.redirect(buildAuthErrorRedirect("Invalid OAuth state", frontendBaseUrl));
        }

        frontendBaseUrl = normalizeUrl(statePayload.frontendBaseUrl) || frontendBaseUrl;
        const redirectUri = resolveOAuthRedirectUri(req, "google");

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code: String(code),
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenRes.ok) {
            return res.redirect(buildAuthErrorRedirect("Google token exchange failed", frontendBaseUrl));
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData?.access_token;
        if (!accessToken) {
            return res.redirect(buildAuthErrorRedirect("Google access token missing", frontendBaseUrl));
        }

        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userRes.ok) {
            return res.redirect(buildAuthErrorRedirect("Failed to fetch Google user profile", frontendBaseUrl));
        }

        const profile = await userRes.json();
        const user = await findOrCreateOAuthUser({
            provider: "GOOGLE",
            providerId: profile.sub,
            email: profile.email,
            firstName: profile.given_name || profile.name,
            lastName: profile.family_name || "",
        });

        if (user.role === "REJECTED") {
            return res.redirect(buildAuthErrorRedirect("Your account request was rejected", frontendBaseUrl));
        }

        const token = issueUserToken(user);
        return res.redirect(buildAuthSuccessRedirect(token, user.role, user.username, frontendBaseUrl));
    } catch (error) {
        console.error("googleOAuthCallback error:", error);

        // If state is still verifiable, prefer the frontend URL captured at OAuth start.
        try {
            const statePayload = verifyOAuthState(req.query?.state, "google");
            const fromState = normalizeUrl(statePayload?.frontendBaseUrl);
            if (fromState) {
                frontendBaseUrl = fromState;
            }
        } catch {
            // Keep previously resolved frontendBaseUrl fallback.
        }

        return res.redirect(buildAuthErrorRedirect("Google login failed", frontendBaseUrl));
    }
}

// ================= MICROSOFT OAUTH START =================
export async function startMicrosoftOAuth(req, res) {
    try {
        if (!MICROSOFT_CLIENT_ID || !MICROSOFT_CLIENT_SECRET) {
            return res.status(501).json({ message: "Microsoft OAuth is not configured" });
        }

        const frontendBaseUrl = resolveFrontendBaseUrl(req);
        const redirectUri = resolveOAuthRedirectUri(req, "microsoft");
        const state = createOAuthState("microsoft", frontendBaseUrl);
        const authUrl = new URL(`https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`);
        authUrl.searchParams.set("client_id", MICROSOFT_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", redirectUri);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "openid profile email User.Read");
        authUrl.searchParams.set("response_mode", "query");
        authUrl.searchParams.set("state", state);
        authUrl.searchParams.set("prompt", "select_account");

        return res.redirect(authUrl.toString());
    } catch (error) {
        console.error("startMicrosoftOAuth error:", error);
        return res.redirect(buildAuthErrorRedirect("Unable to start Microsoft login", resolveFrontendBaseUrl(req)));
    }
}

// ================= MICROSOFT OAUTH CALLBACK =================
export async function microsoftOAuthCallback(req, res) {
    let frontendBaseUrl = resolveFrontendBaseUrl(req);

    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.redirect(buildAuthErrorRedirect("Missing Microsoft OAuth parameters", frontendBaseUrl));
        }

        const statePayload = verifyOAuthState(state, "microsoft");
        if (!statePayload) {
            return res.redirect(buildAuthErrorRedirect("Invalid OAuth state", frontendBaseUrl));
        }

        frontendBaseUrl = normalizeUrl(statePayload.frontendBaseUrl) || frontendBaseUrl;
        const redirectUri = resolveOAuthRedirectUri(req, "microsoft");

        const tokenRes = await fetch(`https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0/token`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code: String(code),
                client_id: MICROSOFT_CLIENT_ID,
                client_secret: MICROSOFT_CLIENT_SECRET,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });

        if (!tokenRes.ok) {
            return res.redirect(buildAuthErrorRedirect("Microsoft token exchange failed", frontendBaseUrl));
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData?.access_token;
        if (!accessToken) {
            return res.redirect(buildAuthErrorRedirect("Microsoft access token missing", frontendBaseUrl));
        }

        const userRes = await fetch("https://graph.microsoft.com/v1.0/me", {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userRes.ok) {
            return res.redirect(buildAuthErrorRedirect("Failed to fetch Microsoft profile", frontendBaseUrl));
        }

        const profile = await userRes.json();
        const email = profile.mail || profile.userPrincipalName;
        const firstName = profile.givenName || profile.displayName || "User";
        const lastName = profile.surname || "";

        const user = await findOrCreateOAuthUser({
            provider: "MICROSOFT",
            providerId: profile.id,
            email,
            firstName,
            lastName,
        });

        if (user.role === "REJECTED") {
            return res.redirect(buildAuthErrorRedirect("Your account request was rejected", frontendBaseUrl));
        }

        const token = issueUserToken(user);
        return res.redirect(buildAuthSuccessRedirect(token, user.role, user.username, frontendBaseUrl));
    } catch (error) {
        console.error("microsoftOAuthCallback error:", error);

        // If state is still verifiable, prefer the frontend URL captured at OAuth start.
        try {
            const statePayload = verifyOAuthState(req.query?.state, "microsoft");
            const fromState = normalizeUrl(statePayload?.frontendBaseUrl);
            if (fromState) {
                frontendBaseUrl = fromState;
            }
        } catch {
            // Keep previously resolved frontendBaseUrl fallback.
        }

        return res.redirect(buildAuthErrorRedirect("Microsoft login failed", frontendBaseUrl));
    }
}