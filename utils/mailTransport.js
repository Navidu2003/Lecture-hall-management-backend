import nodemailer from "nodemailer";
import { GMAIL_PASSWORD, GMAIL_USER } from "../config.js";

function getEnvValue(key, fallback = "") {
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
        return String(process.env[key] ?? "").trim();
    }

    for (const [envKey, envValue] of Object.entries(process.env)) {
        if (String(envKey).trim() === key) {
            return String(envValue ?? "").trim();
        }
    }

    return String(fallback ?? "").trim();
}

function parseBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    return String(value).trim().toLowerCase() === "true";
}

export function buildMailTransportOptions() {
    const smtpHost = getEnvValue("SMTP_HOST", "smtp.gmail.com") || "smtp.gmail.com";
    const smtpSecure = parseBoolean(getEnvValue("SMTP_SECURE", ""), false);
    const smtpPort = Number(getEnvValue("SMTP_PORT", smtpSecure ? 465 : 587) || (smtpSecure ? 465 : 587));
    const isProduction = getEnvValue("NODE_ENV", "development") === "production";
    const tlsRejectUnauthorized = parseBoolean(
        getEnvValue("SMTP_TLS_REJECT_UNAUTHORIZED", ""),
        isProduction
    );

    return {
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        requireTLS: !smtpSecure,
        auth: {
            user: GMAIL_USER,
            pass: GMAIL_PASSWORD,
        },
        connectionTimeout: Number(getEnvValue("SMTP_CONNECTION_TIMEOUT", 10000) || 10000),
        greetingTimeout: Number(getEnvValue("SMTP_GREETING_TIMEOUT", 10000) || 10000),
        socketTimeout: Number(getEnvValue("SMTP_SOCKET_TIMEOUT", 20000) || 20000),
        dnsTimeout: Number(getEnvValue("SMTP_DNS_TIMEOUT", 10000) || 10000),
        tls: {
            rejectUnauthorized: tlsRejectUnauthorized,
        },
    };
}

export async function sendMailWithTimeout(transporter, mailOptions) {
    const timeoutMs = Number(getEnvValue("MAIL_SEND_TIMEOUT_MS", 20000) || 20000);

    return await Promise.race([
        transporter.sendMail(mailOptions),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Mail send timed out after ${timeoutMs}ms`)), timeoutMs);
        }),
    ]);
}

function buildTransportCandidates() {
    const candidates = [];
    const smtpHost = getEnvValue("SMTP_HOST", "");
    const smtpUser = GMAIL_USER;
    const smtpPass = GMAIL_PASSWORD;

    if (!smtpUser || !smtpPass) {
        return candidates;
    }

    if (smtpHost) {
        candidates.push(buildMailTransportOptions());
    }

    // Gmail service strategy (often works even when direct host/port has issues).
    candidates.push({
        service: "gmail",
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
        connectionTimeout: Number(getEnvValue("SMTP_CONNECTION_TIMEOUT", 10000) || 10000),
        greetingTimeout: Number(getEnvValue("SMTP_GREETING_TIMEOUT", 10000) || 10000),
        socketTimeout: Number(getEnvValue("SMTP_SOCKET_TIMEOUT", 20000) || 20000),
        dnsTimeout: Number(getEnvValue("SMTP_DNS_TIMEOUT", 10000) || 10000),
    });

    // Explicit SSL strategy.
    candidates.push({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
        connectionTimeout: Number(getEnvValue("SMTP_CONNECTION_TIMEOUT", 10000) || 10000),
        greetingTimeout: Number(getEnvValue("SMTP_GREETING_TIMEOUT", 10000) || 10000),
        socketTimeout: Number(getEnvValue("SMTP_SOCKET_TIMEOUT", 20000) || 20000),
        dnsTimeout: Number(getEnvValue("SMTP_DNS_TIMEOUT", 10000) || 10000),
    });

    // Explicit STARTTLS strategy.
    candidates.push({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
        connectionTimeout: Number(getEnvValue("SMTP_CONNECTION_TIMEOUT", 10000) || 10000),
        greetingTimeout: Number(getEnvValue("SMTP_GREETING_TIMEOUT", 10000) || 10000),
        socketTimeout: Number(getEnvValue("SMTP_SOCKET_TIMEOUT", 20000) || 20000),
        dnsTimeout: Number(getEnvValue("SMTP_DNS_TIMEOUT", 10000) || 10000),
    });

    return candidates;
}

export async function sendMailWithFallback(mailOptions) {
    const candidates = buildTransportCandidates();
    if (candidates.length === 0) {
        throw new Error("Email service is not configured");
    }

    let lastError = null;

    for (const candidate of candidates) {
        try {
            const transporter = nodemailer.createTransport(candidate);
            const result = await sendMailWithTimeout(transporter, mailOptions);
            return result;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error("Mail delivery failed");
}