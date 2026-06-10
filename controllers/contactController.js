import mongoose from "mongoose";
import { CONTACT_RECEIVER_EMAIL, GMAIL_USER, GMAIL_PASSWORD } from "../config.js";
import ContactMessage from "../models/contactMessage.js";
import { sendMailWithFallback } from "../utils/mailTransport.js";

// Send contact message email
async function sendMessage(req, res) {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const trimmedPayload = {
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    };

    let savedMessage = null;
    if (mongoose.connection.readyState === 1) {
      savedMessage = await ContactMessage.create(trimmedPayload);
    }

    const emailConfigured = Boolean(
      GMAIL_USER && GMAIL_PASSWORD && GMAIL_PASSWORD !== "your-app-specific-password-here"
    );

    const mailOptions = {
      from: `Timelyx Contact <${GMAIL_USER}>`,
      to: CONTACT_RECEIVER_EMAIL,
      cc: CONTACT_RECEIVER_EMAIL !== GMAIL_USER ? GMAIL_USER : undefined,
      subject: `New Contact Message from ${trimmedPayload.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New Contact Message</h2>
          <p><strong>Name:</strong> ${trimmedPayload.name}</p>
          <p><strong>Email:</strong> ${trimmedPayload.email}</p>
          <p><strong>Message:</strong></p>
          <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; white-space: pre-wrap;">
            ${trimmedPayload.message}
          </p>
          <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;">
          <p style="color: #999; font-size: 12px;">
            This is an automated message from Timelyx Contact Form
          </p>
        </div>
      `,
      replyTo: trimmedPayload.email,
    };

    if (!emailConfigured) {
      if (savedMessage) {
        savedMessage.deliveryStatus = "email_failed";
        savedMessage.emailError = "Email service is not configured";
        await savedMessage.save();

        return res.status(200).json({
          message: "Message received. Email delivery is not configured yet, but your message has been saved.",
          status: "saved",
        });
      }

      return res.status(503).json({
        message: "Email service is not properly configured. Please contact the administrator.",
      });
    }

    try {
      await sendMailWithFallback(mailOptions);

      if (savedMessage) {
        savedMessage.deliveryStatus = "delivered";
        savedMessage.emailError = null;
        await savedMessage.save();
      }

      return res.status(200).json({
        message: "Message sent successfully",
        status: savedMessage ? "delivered" : "success",
      });
    } catch (mailError) {
      console.error("Error sending contact message:", mailError);

      if (savedMessage) {
        savedMessage.deliveryStatus = "email_failed";
        savedMessage.emailError = mailError.message || "Unknown email error";
        await savedMessage.save();

        return res.status(200).json({
          message: "Message received. Email delivery is delayed, but your message has been saved.",
          status: "saved",
        });
      }

      if (mailError?.code === "EAUTH") {
        return res.status(500).json({
          message: "Email authentication failed. Check your mail app password in backend/.env.",
        });
      }

      if (mailError?.message?.includes("Mail send timed out") || mailError?.code === "ETIMEDOUT") {
        return res.status(503).json({
          message: "Message delivery timed out. Please try again shortly.",
        });
      }

      return res.status(500).json({
        message: "Failed to send message. Please try again later.",
        error: mailError.message,
      });
    }
  } catch (error) {
    console.error("Error sending contact message:", error);

    return res.status(500).json({
      message: "Failed to send message. Please try again later.",
      error: error.message,
    });
  }
}

export { sendMessage };
