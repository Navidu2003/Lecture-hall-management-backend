import Notification from "../models/notification.js";
import User from "../models/user.js";
import RejectedRegistration from "../models/rejectedRegistration.js";
import mongoose from "mongoose";
import * as notificationController from "./notificationController.js";
import nodemailer from "nodemailer";
import { GMAIL_USER, GMAIL_PASSWORD, FRONTEND_BASE_URL } from "../config.js";

function createMailTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
    const isProduction = String(process.env.NODE_ENV || "development") === "production";
    const tlsRejectUnauthorized = String(
        process.env.SMTP_TLS_REJECT_UNAUTHORIZED || (isProduction ? "true" : "false")
    ).toLowerCase() === "true";

    if (smtpHost) {
        return nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD },
            tls: { rejectUnauthorized: tlsRejectUnauthorized },
        });
    }

    return nodemailer.createTransport({
        service: "gmail",
        auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD },
        tls: {
            rejectUnauthorized: String(process.env.NODE_ENV || "development") === "production",
        },
    });
}

async function sendRejectionEmail({ to, firstName, rejectionReason }) {
    if (!GMAIL_USER || !GMAIL_PASSWORD) return; // email not configured — skip silently

    const safeName = firstName || "Applicant";
    const loginUrl = `${FRONTEND_BASE_URL}/login`;

    const transporter = createMailTransporter();
    await transporter.sendMail({
        from: `"Timelyx" <${GMAIL_USER}>`,
        to,
        subject: "Timelyx — Your Registration Request Was Rejected",
        text: [
            `Hello ${safeName},`,
            ``,
            `We regret to inform you that your registration request for Timelyx has been reviewed and rejected.`,
            ``,
            `Reason: ${rejectionReason}`,
            ``,
            `If you believe this decision was made in error, please contact your department administrator or re-register with the correct details.`,
            ``,
            `Regards,`,
            `The Timelyx Team`,
        ].join("\n"),
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
                <div style="background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #fff; margin: 0; font-size: 22px;">Timelyx</h1>
                </div>
                <div style="background: #fff; border: 1px solid #e2e8f0; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
                    <h2 style="color: #dc2626; margin-top: 0;">Registration Request Rejected</h2>
                    <p>Hello <strong>${safeName}</strong>,</p>
                    <p>We regret to inform you that your registration request for <strong>Timelyx</strong> has been reviewed and <strong style="color:#dc2626;">rejected</strong>.</p>
                    <div style="background: #fef2f2; border-left: 4px solid #dc2626; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
                        <p style="margin: 0; font-weight: 600; color: #991b1b;">Reason for rejection:</p>
                        <p style="margin: 8px 0 0; color: #7f1d1d;">${rejectionReason}</p>
                    </div>
                    <p>If you believe this decision was made in error, please contact your department administrator or re-register with the correct information.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #94a3b8;">This is an automated message from Timelyx. Please do not reply directly to this email.</p>
                </div>
            </div>
        `,
    });
}

async function sendApprovalEmail({ to, firstName, role }) {
    if (!GMAIL_USER || !GMAIL_PASSWORD) return; // email not configured — skip silently

    const safeName = firstName || "Applicant";
    const safeRole = role ? role.charAt(0).toUpperCase() + role.slice(1).toLowerCase() : "User";
    const loginUrl = `${FRONTEND_BASE_URL}/login`;

    const transporter = createMailTransporter();
    await transporter.sendMail({
        from: `"Timelyx" <${GMAIL_USER}>`,
        to,
        subject: "Timelyx — Your Registration Request Has Been Approved!",
        text: [
            `Hello ${safeName},`,
            ``,
            `Great news! Your registration request for Timelyx has been reviewed and approved.`,
            ``,
            `You have been granted access as: ${safeRole}`,
            ``,
            `You can now log in to your account and start using Timelyx:`,
            loginUrl,
            ``,
            `If you have any questions, please contact your department administrator.`,
            ``,
            `Welcome aboard!`,
            `The Timelyx Team`,
        ].join("\n"),
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
                <div style="background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
                    <h1 style="color: #fff; margin: 0; font-size: 22px;">Timelyx</h1>
                </div>
                <div style="background: #fff; border: 1px solid #e2e8f0; border-top: none; padding: 32px; border-radius: 0 0 12px 12px;">
                    <h2 style="color: #16a34a; margin-top: 0;">Registration Approved &#127881;</h2>
                    <p>Hello <strong>${safeName}</strong>,</p>
                    <p>Great news! Your registration request for <strong>Timelyx</strong> has been reviewed and <strong style="color:#16a34a;">approved</strong>.</p>
                    <div style="background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
                        <p style="margin: 0; font-weight: 600; color: #15803d;">Your account role:</p>
                        <p style="margin: 8px 0 0; color: #14532d; font-size: 16px;">${safeRole}</p>
                    </div>
                    <p>You can now log in to your account and start using Timelyx.</p>
                    <div style="text-align: center; margin: 28px 0;">
                        <a href="${loginUrl}" style="background: #1e293b; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Log In to Timelyx</a>
                    </div>
                    <p>If you have any questions, please contact your department administrator.</p>
                    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #94a3b8;">This is an automated message from Timelyx. Please do not reply directly to this email.</p>
                </div>
            </div>
        `,
    });
}

export async function getDashboard(req, res) {
    try {
        if (!req.user || req.user.role !== "TO") {
            return res.status(403).json({ message: "TO access required" });
        }

        const pendingUsers = await User.countDocuments({ role: "PENDING" });

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const approvedToday = await User.countDocuments({
            role: { $in: ["STUDENT", "LECTURER", "HOD", "TO", "ADMIN"] },
            updatedAt: { $gte: startOfToday, $lte: endOfToday }
        });

        const totalUsers = await User.countDocuments({
            role: { $in: ["STUDENT", "LECTURER", "HOD", "TO", "ADMIN"] }
        });

        const now = new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        const thisMonthApproved = await User.countDocuments({
            role: { $in: ["STUDENT", "LECTURER", "HOD", "TO", "ADMIN"] },
            updatedAt: { $gte: startOfThisMonth }
        });

        const lastMonthApproved = await User.countDocuments({
            role: { $in: ["STUDENT", "LECTURER", "HOD", "TO", "ADMIN"] },
            updatedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        });

        const monthlyGrowthAmount = thisMonthApproved - lastMonthApproved;
        const monthlyGrowth = lastMonthApproved === 0
            ? (thisMonthApproved > 0 ? 100 : 0)
            : Math.round(((thisMonthApproved - lastMonthApproved) / lastMonthApproved) * 100);

        return res.status(200).json({
            pendingUsers,
            approvedToday,
            totalUsers,
            monthlyGrowth,
            monthlyGrowthAmount,
            thisMonthApproved
        });
    } catch (error) {
        console.error("TO getDashboard error:", error);
        return res.status(500).json({ message: "Error fetching TO dashboard", error: error.message });
    }
}

export async function getPendingUsers(req, res) {
    try {
        if (!req.user || req.user.role !== 'TO') {
            return res.status(403).json({ message: 'TO access required' });
        }
        // Clean up any legacy REJECTED-role users remaining from before auto-deletion was implemented.
        await User.deleteMany({ role: 'REJECTED' }).catch(e =>
            console.error('Legacy REJECTED user cleanup error:', e.message)
        );

        const users = await User.find({ role: 'PENDING' })
            .select('firstName lastName email username role requestedRole department designation batch semester courses createdAt')
            .sort({ createdAt: -1 });

        const mapped = users.map(u => ({
            id: u._id,
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            name: `${u.firstName} ${u.lastName}`.trim(),
            email: u.email,
            username: u.username,
            requestedRole: u.requestedRole,
            department: u.department || '',
            designation: u.designation || '',
            batch: u.batch || '',
            semester: u.semester || '',
            courses: Array.isArray(u.courses) ? u.courses : [],
            registeredDate: u.createdAt ? u.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }));

        return res.status(200).json(mapped);
    } catch (error) {
        console.error('TO getPendingUsers error:', error);
        return res.status(500).json({ message: 'Error fetching pending users', error: error.message });
    }
}

export async function approveUser(req, res) {
    try {
        if (!req.user || req.user.role !== 'TO') {
            return res.status(403).json({ message: 'TO access required' });
        }
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.role !== 'PENDING') {
            return res.status(400).json({ message: 'User is not pending approval' });
        }

        // override fields from body if provided
        const {
            role: overrideRole,
            firstName,
            lastName,
            email,
            username,
            department,
            designation,
            batch,
            semester,
            courses
        } = req.body;

        const allowedRoles = ["STUDENT", "LECTURER", "HOD", "TO"];
        const finalRole = (overrideRole || user.requestedRole || "STUDENT").toUpperCase();
        if (!allowedRoles.includes(finalRole)) {
            return res.status(400).json({ message: "Invalid role selected" });
        }

        if (firstName !== undefined) user.firstName = firstName;
        if (lastName !== undefined) user.lastName = lastName;
        if (email !== undefined) user.email = String(email).trim().toLowerCase();
        if (username !== undefined) user.username = String(username).trim();
        if (department !== undefined) user.department = department;
        if (designation !== undefined) user.designation = designation;
        if (batch !== undefined) user.batch = batch;
        if (semester !== undefined) user.semester = semester;
        if (courses !== undefined) {
            user.courses = Array.isArray(courses)
                ? courses.map(c => String(c).trim()).filter(Boolean)
                : [];
        }

        // determine final role: explicit override > requestedRole > STUDENT
        user.role = finalRole;

        await user.save();

        // Send approval email — non-blocking so a mail failure never breaks the response
        sendApprovalEmail({
            to: user.email,
            firstName: user.firstName,
            role: finalRole,
        }).catch(e => console.error('Approval email error:', e.message));

        return res.status(200).json({ message: 'User approved' });
    } catch (error) {
        console.error('TO approveUser error:', error);
        return res.status(500).json({ message: 'Error approving user', error: error.message });
    }
}

export async function updatePendingUser(req, res) {
    try {
        if (!req.user || req.user.role !== "TO") {
            return res.status(403).json({ message: "TO access required" });
        }

        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        if (user.role !== "PENDING") {
            return res.status(400).json({ message: "Only pending users can be updated here" });
        }

        const {
            role: requestedRole,
            firstName,
            lastName,
            email,
            username,
            department,
            designation,
            batch,
            semester,
            courses
        } = req.body;

        const allowedRequestedRoles = ["STUDENT", "LECTURER", "HOD", "TO"];
        if (requestedRole !== undefined) {
            const normalizedRequestedRole = String(requestedRole).trim().toUpperCase();
            if (!allowedRequestedRoles.includes(normalizedRequestedRole)) {
                return res.status(400).json({ message: "Invalid requested role" });
            }
            user.requestedRole = normalizedRequestedRole;
        }

        if (firstName !== undefined) user.firstName = String(firstName).trim();
        if (lastName !== undefined) user.lastName = String(lastName).trim();
        if (email !== undefined) user.email = String(email).trim().toLowerCase();
        if (username !== undefined) user.username = String(username).trim();
        if (department !== undefined) user.department = String(department).trim();
        if (designation !== undefined) user.designation = String(designation).trim();
        if (batch !== undefined) user.batch = String(batch).trim();
        if (semester !== undefined) user.semester = String(semester).trim();
        if (courses !== undefined) {
            user.courses = Array.isArray(courses)
                ? courses.map(c => String(c).trim()).filter(Boolean)
                : [];
        }

        await user.save();

        return res.status(200).json({ message: "Pending user details updated" });
    } catch (error) {
        console.error("TO updatePendingUser error:", error);
        return res.status(500).json({ message: "Error updating pending user", error: error.message });
    }
}

export async function rejectUser(req, res) {
    try {
        if (!req.user || req.user.role !== 'TO') {
            return res.status(403).json({ message: 'TO access required' });
        }
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.role !== 'PENDING') {
            return res.status(400).json({ message: 'User is not pending approval' });
        }

        const rejectionReason = typeof req.body.rejectionReason === 'string'
            ? req.body.rejectionReason.trim()
            : '';

        if (!rejectionReason) {
            return res.status(400).json({
                message: 'Rejection reason is required when rejecting a registration request'
            });
        }

        // Capture details before deletion so the email can still be sent
        const rejectedEmail = user.email;
        const rejectedFirstName = user.firstName;
        const rejectedUsername = user.username;

        // Persist rejected identity to block repeated registration attempts
        const emailLower = String(rejectedEmail || '').trim().toLowerCase();
        const usernameLower = String(rejectedUsername || '').trim().toLowerCase();
        await RejectedRegistration.updateOne(
            { $or: [{ emailLower }, { usernameLower }] },
            {
                $set: {
                    emailLower: emailLower || null,
                    usernameLower: usernameLower || null,
                    reason: rejectionReason,
                    rejectedBy: req.user._id,
                }
            },
            { upsert: true }
        );

        // Permanently delete the user — their registration details are removed from the system
        await User.deleteOne({ _id: user._id });

        // email notification — non-blocking so a missing email config never fails the request
        sendRejectionEmail({
            to: rejectedEmail,
            firstName: rejectedFirstName,
            rejectionReason,
        }).catch(emailErr => {
            console.error('TO rejectUser email error:', emailErr.message);
        });

        return res.status(200).json({ message: 'User rejected and removed from system' });
    } catch (error) {
        console.error('TO rejectUser error:', error);
        return res.status(500).json({ message: 'Error rejecting user', error: error.message });
    }
}

export async function getHistory(req, res) {
    try {
        if (!req.user || req.user.role !== 'TO') {
            return res.status(403).json({ message: 'TO access required' });
        }
        
        // build query filter - only approved (active) users; rejected users are deleted on rejection
        const filter = { role: { $nin: ['PENDING', 'REJECTED'] } };
        
        if (req.query.startDate || req.query.endDate) {
            filter.updatedAt = {};
            if (req.query.startDate) {
                // start of day
                filter.updatedAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                // end of day (23:59:59)
                const endDateObj = new Date(req.query.endDate);
                endDateObj.setHours(23, 59, 59, 999);
                filter.updatedAt.$lte = endDateObj;
            }
        }
        
        const users = await User.find(filter)
            .select('firstName lastName email username role requestedRole department designation updatedAt createdAt')
            .sort({ updatedAt: -1 });

        // build a safe date string using updatedAt if available, then createdAt, else now
        const mapped = users.map(u => {
            if (!u) return null;

            const dateSource = u.updatedAt || u.createdAt || new Date();
            const dateStr = dateSource instanceof Date ? dateSource.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

            // All records in history are approved (rejected users are deleted)
            const status = 'approved';

            return {
                id: u._id,
                name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown User',
                email: u.email || '',
                username: u.username || '',
                role: u.role || 'UNKNOWN',
                requestedRole: u.requestedRole,
                department: u.department || '',
                designation: u.designation || '',
                rejectionReason: u.rejectionReason || '',
                date: dateStr,
                status: status
            };
        }).filter(item => item !== null);

        return res.status(200).json(mapped);
    } catch (error) {
        console.error('TO getHistory error:', error);
        return res.status(500).json({ message: 'Error fetching history', error: error.message });
    }
}

// reuse notification controller functionality for notices but restrict to TO role
export async function getNotices(req, res) {
    try {
        if (!req.user || req.user.role !== 'TO') {
            return res.status(403).json({ message: 'TO access required' });
        }

        // If MongoDB is temporarily unavailable, keep TO notices page functional.
        if (mongoose.connection.readyState !== 1) {
            return res.status(200).json([]);
        }

        const notifications = await Notification.find({
            $or: [
                { sender: req.user._id },
                { receivers: req.user._id }
            ]
        })
            .populate('sender', 'firstName lastName email username role requestedRole department designation batch semester courses createdAt')
            .populate('targetUser', 'firstName lastName email username role requestedRole department designation batch semester courses createdAt')
            .populate('receivers', 'firstName lastName email role department')
            .sort({ createdAt: -1 });

        return res.status(200).json(notifications.map(n => {
            const safeMessage = typeof n.message === 'string' ? n.message : '';
            const safeTitle = typeof n.title === 'string' && n.title.trim()
                ? n.title
                : safeMessage || 'Notice';

            return ({
            id: n._id,
            title: safeTitle,
            message: safeMessage,
            date: n.createdAt,
            category: n.category || 'GENERAL',
            isIncoming: n.sender?._id?.toString() !== req.user._id.toString(),
            isRead: Array.isArray(n.readBy)
                ? n.readBy.map(id => id.toString()).includes(req.user._id.toString())
                : false,
            canEdit: n.sender?._id?.toString() === req.user._id.toString(),
            author: `${n.sender?.firstName || ''} ${n.sender?.lastName || ''}`,
            senderUser: n.sender || null,
            targetUserId: n.targetUser?._id || null,
            targetUser: n.targetUser || null,
            receivers: n.receivers || [],
            receiverCount: n.receivers ? n.receivers.length : 0
            });
        }));
    } catch (error) {
        console.error('TO getNotices error:', error);
        return res.status(500).json({ message: 'Error fetching TO notices', error: error.message });
    }
}

export async function createNotice(req, res) {
    try {
        if (!req.user || req.user.role !== 'TO') {
            return res.status(403).json({ message: 'TO access required' });
        }

        const { title, message, receiverRole, receivers: explicitReceivers, batch } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ message: "Message is required" });
        }

        let receiversList = [];

        // explicit receiver ids
        if (Array.isArray(explicitReceivers) && explicitReceivers.length > 0) {
            receiversList = explicitReceivers.map(r => r.toString());
        }

        // role-based receivers
        if (receiverRole && receiverRole !== 'all') {
            const role = String(receiverRole).toUpperCase();
            const users = await User.find({ role: role }).select('_id').lean();
            receiversList.push(...users.map(u => u._id.toString()));
        }

        // batch targeting (students only)
        if (batch && batch.trim()) {
            const students = await User.find({ role: 'STUDENT', batch: batch.trim() }).select('_id').lean();
            receiversList.push(...students.map(s => s._id.toString()));
        }

        // If "all" is selected, get all active users
        if (receiverRole === 'all' && !batch) {
            const allUsers = await User.find({ 
                role: { $in: ['STUDENT', 'LECTURER', 'HOD', 'TO', 'ADMIN'] } 
            }).select('_id').lean();
            receiversList.push(...allUsers.map(u => u._id.toString()));
        }

        // dedupe ids
        receiversList = [...new Set(receiversList)];

        if (receiversList.length === 0) {
            return res.status(400).json({ message: 'No receivers selected for this notice' });
        }

        const notification = new Notification({
            sender: req.user._id,
            receivers: receiversList,
            title: title || '',
            message: message.trim()
        });

        await notification.save();

        return res.status(201).json({
            message: "Notice published successfully",
            notificationId: notification._id
        });
    } catch (error) {
        console.error('TO createNotice error:', error);
        return res.status(500).json({ message: 'Error creating notice', error: error.message });
    }
}

export async function updateNotice(req, res) {
    try {
        if (!req.user || req.user.role !== 'TO') return res.status(403).json({ message: 'Only TO can modify notices' });
        const id = req.params.id;

        const notif = await Notification.findById(id);
        if (!notif) return res.status(404).json({ message: 'Notification not found' });

        // only allow TO (sender) to update
        if (notif.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Cannot modify notifications from other users' });
        }

        if (req.body.title !== undefined) notif.title = req.body.title;
        if (req.body.message) notif.message = req.body.message;

        await notif.save();
        return res.status(200).json({ message: 'Notice updated successfully', notif });
    } catch (error) {
        console.error('TO updateNotice error:', error);
        return res.status(500).json({ message: 'Error updating notice', error: error.message });
    }
}

export async function deleteNotice(req, res) {
    try {
        if (!req.user || req.user.role !== 'TO') return res.status(403).json({ message: 'Only TO can delete notices' });
        const id = req.params.id;

        const notif = await Notification.findById(id);
        if (!notif) return res.status(404).json({ message: 'Notification not found' });

        if (notif.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Cannot delete notifications from other users' });
        }

        await Notification.deleteOne({ _id: id });
        return res.status(200).json({ message: 'Deleted' });
    } catch (error) {
        console.error('TO deleteNotice error:', error);
        return res.status(500).json({ message: 'Error deleting notice', error: error.message });
    }
}

export default {
    getDashboard,
    getPendingUsers,
    updatePendingUser,
    approveUser,
    rejectUser,
    getHistory,
    getNotices,
    createNotice,
    updateNotice,
    deleteNotice
};
