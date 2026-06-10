import "dotenv/config";

function normalizeEnv(value = "") {
	return String(value || "").trim().replace(/^['"]|['"]$/g, "");
}

function getEnvValue(key, fallback = "") {
	if (Object.prototype.hasOwnProperty.call(process.env, key)) {
		return normalizeEnv(process.env[key]);
	}

	for (const [envKey, envValue] of Object.entries(process.env)) {
		if (String(envKey).trim() === key) {
			return normalizeEnv(envValue);
		}
	}

	return normalizeEnv(fallback);
}

function normalizeOrigin(value = "") {
	return normalizeEnv(value).replace(/\/+$/, "");
}

export const JWT_SECRET = getEnvValue("JWT_SECRET", "lecturehallmanagement") || "lecturehallmanagement";
export const PORT = Number(getEnvValue("PORT", 3000) || 3000);
export const CORS_ALLOWED_ORIGINS = String(
	getEnvValue("CORS_ALLOWED_ORIGINS", "https://timely-x-frontend.vercel.app,http://localhost:5173,http://localhost:5174")
)
	.split(",")
	.map((v) => normalizeOrigin(v))
	.filter(Boolean);
export const FRONTEND_BASE_URL = getEnvValue("FRONTEND_BASE_URL", "https://timely-x-frontend.vercel.app");

const primaryUri = getEnvValue("MONGODB_URI", "");
const fallbackUri = getEnvValue("MONGODB_URI_FALLBACK", "mongodb://127.0.0.1:27017/timelyx");

if (!primaryUri && !fallbackUri) {
	throw new Error("Neither MONGODB_URI nor MONGODB_URI_FALLBACK is set. Add one to backend/.env");
}

export const MONGODB_URI = primaryUri || fallbackUri;
export const MONGODB_URI_FALLBACK = fallbackUri;

export const RESET_PASSWORD_EXPIRES_MINUTES = Number(getEnvValue("RESET_PASSWORD_EXPIRES_MINUTES", 15) || 15);

export const GOOGLE_CLIENT_ID = getEnvValue("GOOGLE_CLIENT_ID", "");
export const GOOGLE_CLIENT_SECRET = getEnvValue("GOOGLE_CLIENT_SECRET", "");
export const GOOGLE_REDIRECT_URI = getEnvValue("GOOGLE_REDIRECT_URI", "http://localhost:3000/users/oauth/google/callback");

// Email Configuration
export const GMAIL_USER = normalizeEnv(
	getEnvValue("GMAIL_USER", "") || getEnvValue("EMAIL_USER", "") || getEnvValue("SMTP_USER", "") || ""
);

// Gmail app passwords are often copied with spaces in groups; strip all whitespace.
const rawGmailPassword = normalizeEnv(
	getEnvValue("GMAIL_PASSWORD", "") ||
	getEnvValue("GMAIL_PASS", "") ||
	getEnvValue("EMAIL_PASSWORD", "") ||
	getEnvValue("SMTP_PASSWORD", "") ||
	""
);
export const GMAIL_PASSWORD = rawGmailPassword.replace(/\s+/g, "");

export const CONTACT_RECEIVER_EMAIL = normalizeEnv(
	getEnvValue("CONTACT_RECEIVER_EMAIL", "") || GMAIL_USER || "supporttimelyx@gmail.com"
);

export const MICROSOFT_CLIENT_ID = getEnvValue("MICROSOFT_CLIENT_ID", "");
export const MICROSOFT_CLIENT_SECRET = getEnvValue("MICROSOFT_CLIENT_SECRET", "");
export const MICROSOFT_TENANT_ID = getEnvValue("MICROSOFT_TENANT_ID", "common");
export const MICROSOFT_REDIRECT_URI = getEnvValue("MICROSOFT_REDIRECT_URI", "http://localhost:3000/users/oauth/microsoft/callback");
