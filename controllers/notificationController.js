import Notification from "../models/notification.js";
import User from "../models/user.js";



export async function sendNotification(req, res) {
    try {

        if (!req.user) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        const { receiverRole, message, receivers: explicitReceivers, batch, course } = req.body;

        if (!message) {
            return res.status(400).json({
                message: "Message is required"
            });
        }

        if (req.user.role !== "LECTURER" && req.user.role !== "HOD" && req.user.role !== "TO") {
            return res.status(403).json({
                message: "Only Lecturer, HOD or TO can send notifications"
            });
        }

        let receiversList = [];

        // explicit receiver ids
        if (Array.isArray(explicitReceivers) && explicitReceivers.length > 0) {
            receiversList = explicitReceivers.map(r => r);
        }

        // role-based receivers
        if (receiverRole) {
            const role = String(receiverRole).toUpperCase();
            const users = await User.find({ role: role }).select('_id').lean();
            receiversList.push(...users.map(u => u._id.toString()));
        }

        // batch targeting
        if (batch) {
            const students = await User.find({ role: 'STUDENT', batch }).select('_id').lean();
            receiversList.push(...students.map(s => s._id.toString()));
        }

       
        if (course) {
            const students = await User.find({ role: 'STUDENT', courses: course }).select('_id').lean();
            receiversList.push(...students.map(s => s._id.toString()));
        }

        
        receiversList = [...new Set(receiversList.map(id => id.toString()))];

        
        console.debug('sendNotification payload:', { receiverRole, batch, course, explicitReceivers, matchedCount: receiversList.length });

        if (receiversList.length === 0) {
            console.debug('No receivers matched. payload details:', { receiverRole, batch, course, explicitReceivers });
            return res.status(400).json({ message: 'No receivers matched for this notification' });
        }

        const receiverIds = receiversList.map(id => id);

        const notification = new Notification({
            sender: req.user._id,
            receivers: receiverIds,
            message
        });

        await notification.save();

        return res.status(201).json({
            message: "Notification sent successfully",
            notificationId: notification._id
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error sending notification",
            error: error.message
        });
    }
}




export async function getMyNotifications(req, res) {
    try {

        if (!req.user) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        const mongoose = await import("mongoose");
        if (mongoose.default.connection.readyState !== 1) {
            return res.status(200).json([]);
        }

        const notifications = await Notification.find({
            receivers: req.user._id
        })
        .populate("sender", "firstName lastName role")
        .populate("receivers", "firstName lastName role")
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
                isIncoming: true,  // All notifications retrieved via /notifications are incoming (user is receiver)
                isRead: Array.isArray(n.readBy)
                    ? n.readBy.map(id => id.toString()).includes(req.user._id.toString())
                    : false,
                author: `${n.sender?.firstName || ''} ${n.sender?.lastName || ''}`,
                senderUser: n.sender || null,
                receivers: n.receivers || [],
                receiverCount: n.receivers ? n.receivers.length : 0
            };
        }));

    } catch (error) {
        return res.status(500).json({
            message: "Error fetching notifications",
            error: error.message
        });
    }
}




export async function markNotificationAsRead(req, res) {
    try {

        if (!req.user) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                message: "Notification not found"
            });
        }

        
        if (!notification.receivers.includes(req.user._id)) {
            return res.status(403).json({
                message: "You are not allowed to access this notification"
            });
        }

       
        if (!notification.readBy.includes(req.user._id)) {
            notification.readBy.push(req.user._id);
            await notification.save();
        }

        return res.status(200).json({
            message: "Notification marked as read"
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error marking notification",
            error: error.message
        });
    }
}




export async function getUnreadNotificationCount(req, res) {
    try {

        if (!req.user) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        const notifications = await Notification.find({
            receivers: req.user._id
        });

        const unreadCount = notifications.filter(
            notification =>
                !notification.readBy.includes(req.user._id)
        ).length;

        return res.status(200).json({
            unreadCount
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error getting unread count",
            error: error.message
        });
    }
}