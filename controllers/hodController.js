import * as dashboardController from "./dashboardController.js";
import * as bookingController from "./bookingController.js";
import * as notificationController from "./notificationController.js";
import Notification from "../models/notification.js";
import User from "../models/user.js";

export async function getDashboard(req, res) {
    return dashboardController.getDashboardStats(req, res);
}

export async function getPending(req, res) {
    return bookingController.getPendingBookingRequests(req, res);
}

export async function updateRequest(req, res) {
    return bookingController.updateBookingStatus(req, res);
}

export async function getHistory(req, res) {
    return bookingController.getBookingHistory(req, res);
}

export async function bookHall(req, res) {
    return bookingController.createRangeBooking(req, res);
}

export async function getRequests(req, res) {
    return bookingController.getRequests(req, res);
}

export async function decisionNotification(req, res) {
    try {
        if (!req.user || req.user.role !== 'HOD') {
            return res.status(403).json({ message: 'Only HOD can send decision notifications' });
        }

        const { lecturerId, bookingId, status } = req.body;
        if (!lecturerId || !bookingId || !status) {
            return res.status(400).json({ message: 'lecturerId, bookingId and status are required' });
        }

        const msg = `Your booking (id: ${bookingId}) has been ${status.toLowerCase()} by HOD.`;
        const note = new Notification({ sender: req.user._id, receivers: [lecturerId], message: msg });
        await note.save();

        return res.status(201).json({ message: 'Notification sent' });
    } catch (error) {
        console.error('HOD decision notification error:', error);
        return res.status(500).json({ message: 'Error sending decision notification', error: error.message });
    }
}

export async function getNotices(req, res) {
    try {
        if (!req.user || req.user.role !== 'HOD') {
            return res.status(403).json({ message: 'HOD access required' });
        }

        // If MongoDB is temporarily unavailable, keep HOD notices page functional.
        const mongoose = await import("mongoose");
        if (mongoose.default.connection.readyState !== 1) {
            return res.status(200).json([]);
        }

        // reuse notification controller logic to fetch notifications relevant to the HOD
        // return notifications where sender is the HOD or receivers include the HOD
        const notifications = await Notification.find({ $or: [{ sender: req.user._id }, { receivers: req.user._id }] })
            .populate('sender', 'firstName lastName role')
            .populate('receivers', 'firstName lastName role')
            .sort({ createdAt: -1 });

        return res.status(200).json(notifications.map(n => {
            const safeMessage = typeof n.message === 'string' ? n.message : '';
            const safeTitle = typeof n.title === 'string' && n.title.trim()
                ? n.title
                : safeMessage || 'Notice';

            return {
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
                receivers: n.receivers || [],
                receiverCount: n.receivers ? n.receivers.length : 0
            };
        }));
    } catch (error) {
        console.error('HOD getNotices error:', error);
        return res.status(500).json({ message: 'Error fetching HOD notices', error: error.message });
    }
}

export async function createNotice(req, res) {
    // delegate to notificationController.sendNotification which already handles receiverRole, explicit receivers, batch, course
    return notificationController.sendNotification(req, res);
}

export async function updateNotice(req, res) {
    try {
        if (!req.user || req.user.role !== 'HOD') return res.status(403).json({ message: 'Only HOD can modify notices' });
        const id = req.params.id;
        const { title, message } = req.body;
        const note = await Notification.findById(id);
        if (!note) return res.status(404).json({ message: 'Notice not found' });
        if (note.sender.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not allowed' });
        if (message !== undefined) note.message = message;
        await note.save();
        return res.status(200).json({ message: 'Notice updated' });
    } catch (error) {
        console.error('HOD updateNotice error:', error);
        return res.status(500).json({ message: 'Error updating notice', error: error.message });
    }
}

export async function deleteNotice(req, res) {
    try {
        if (!req.user || req.user.role !== 'HOD') return res.status(403).json({ message: 'Only HOD can delete notices' });
        const id = req.params.id;
        const note = await Notification.findById(id);
        if (!note) return res.status(404).json({ message: 'Notice not found' });
        if (note.sender.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not allowed' });
        await Notification.deleteOne({ _id: id });
        return res.status(200).json({ message: 'Notice deleted' });
    } catch (error) {
        console.error('HOD deleteNotice error:', error);
        return res.status(500).json({ message: 'Error deleting notice', error: error.message });
    }
}

export default {
    getDashboard,
    getPending,
    updateRequest,
    getHistory,
    bookHall,
    decisionNotification
};
