import User from "../models/user.js";
import Notification from "../models/notification.js";
import Booking from "../models/booking.js";


function requireMatch(req, res) {
    // Use authenticated user identity from token as source of truth.
    // URL id can be stale in some frontend sessions.
    if (!req.user || req.user.role !== 'STUDENT') {
        return res.status(403).json({ message: "Forbidden" });
    }
    return null;
}

function normalizeBatch(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function canonicalSubject(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function normalizeCourses(courses) {
    if (!Array.isArray(courses)) return [];
    const expanded = [];
    for (const raw of courses) {
        const text = String(raw || '');
        const parts = text.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length) expanded.push(...parts);
    }

    return [...new Set(expanded
        .map(c => canonicalSubject(c))
        .filter(Boolean))];
}

function bookingVisibleToStudent(booking, studentBatch, studentCourses = []) {
    const target = booking?.targetBatch;
    if (target && String(target).trim() !== '') {
        if (!studentBatch) return false;
        if (normalizeBatch(target) !== normalizeBatch(studentBatch)) return false;

        // Batch-targeted classes should be visible to that batch even when
        // student course records are incomplete/inconsistent.
        return true;
    }

    // If courses are not configured for a student yet, allow batch-matched/common classes
    // so timetable does not stay empty.
    if (studentCourses.length === 0) return false;

    const subject = canonicalSubject(booking?.subject);
    // Generic subjects should still appear for eligible students.
    if (!subject || subject === 'class') return true;

    return studentCourses.includes(subject);
}

async function getStudentCriteria(userId) {
    const student = await User.findById(userId).select('batch courses').lean();
    return {
        batch: student?.batch || '',
        courses: normalizeCourses(student?.courses || [])
    };
}


export async function getProfile(req, res) {
    try {
        const forbidden = requireMatch(req, res);
        if (forbidden) return;

        const user = await User.findById(req.user._id).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        return res.status(200).json(user);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export async function updateProfile(req, res) {
    try {
        const forbidden = requireMatch(req, res);
        if (forbidden) return;

        const allowed = ['firstName', 'lastName', 'username', 'email', 'phone', 'image', 'department', 'designation', 'courses', 'batch', 'semester'];
        const updates = {};
        for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];

        // check uniqueness
        if (updates.email) {
            const exists = await User.findOne({ email: updates.email, _id: { $ne: req.user._id } });
            if (exists) return res.status(400).json({ message: 'Email already taken' });
        }
        if (updates.username) {
            const exists = await User.findOne({ username: updates.username, _id: { $ne: req.user._id } });
            if (exists) return res.status(400).json({ message: 'Username already taken' });
        }

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        Object.assign(user, updates);
        await user.save();

        const safe = user.toObject();
        delete safe.password;
        return res.status(200).json(safe);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export async function getNotices(req, res) {
    try {
        const forbidden = requireMatch(req, res);
        if (forbidden) return;

        // If MongoDB is temporarily unavailable, keep Student notices page functional.
        const mongoose = await import("mongoose");
        if (mongoose.default.connection.readyState !== 1) {
            console.log('[NOTICES] MongoDB not connected, returning empty array');
            return res.status(200).json([]);
        }

        console.log('[NOTICES] Fetching notifications for student:', req.user._id, 'username:', req.user.username);
        
        // First check if ANY notifications exist at all
        const totalNotifications = await Notification.countDocuments({});
        console.log('[NOTICES] Total notifications in database:', totalNotifications);
        
        // Check how many have this student in receivers
        const notices = await Notification.find({ receivers: req.user._id })
            .populate('sender', 'firstName lastName role')
            .populate('receivers', 'firstName lastName role')
            .sort({ createdAt: -1 });
        
        console.log('[NOTICES] Found', notices.length, 'notifications for this student');

        return res.status(200).json(notices.map(n => {
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
                isIncoming: true,  // Students only receive notifications, don't send them
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
        return res.status(500).json({ message: error.message });
    }
}

// helper to format timetable from bookings
function groupByDay(bookings) {
    const map = {};
    bookings.forEach(b => {
        const slot = b.timeSlot;
        const day = slot?.date || 'Unknown';
        if (!map[day]) map[day] = [];
        map[day].push({
            id: b._id,
            startTime: slot.startTime,
            endTime: slot.endTime,
            subject: b.subject || 'Class',
            hall: slot.hall?.name || 'Hall',
            lecturer: b.lecturer?.firstName ? `${b.lecturer.firstName} ${b.lecturer.lastName || ''}`.trim() : ''
        });
    });

    // Sort days chronologically and sort classes within each day by start time
    return Object.keys(map)
        .sort((a, b) => new Date(a) - new Date(b))
        .map(day => ({ 
            day, 
            classes: map[day].sort((a, b) => {
                // Convert time strings "HH:MM" to minutes for comparison
                const timeToMinutes = (time) => {
                    const [hh, mm] = String(time || '00:00').split(':').map(Number);
                    return hh * 60 + mm;
                };
                return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
            })
        }));
}

export async function getTimetable(req, res) {
    try {
        const forbidden = requireMatch(req, res);
        if (forbidden) return;

        const studentCriteria = await getStudentCriteria(req.user._id);

        const bookings = await Booking.find({ status: 'APPROVED' })
            .populate('timeSlot')
            .populate('lecturer', 'firstName lastName')
            .populate({ path: 'timeSlot', populate: { path: 'hall', select: 'name' } })
            .sort({ 'timeSlot.date': 1, 'timeSlot.startTime': 1 });

        const visibleBookings = bookings.filter(b =>
            bookingVisibleToStudent(b, studentCriteria.batch, studentCriteria.courses)
        );

        const grouped = groupByDay(visibleBookings);
        return res.status(200).json(grouped);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export async function getTodayClasses(req, res) {
    try {
        const forbidden = requireMatch(req, res);
        if (forbidden) return;

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        const studentCriteria = await getStudentCriteria(req.user._id);

        const bookings = await Booking.find({ status: 'APPROVED' })
            .populate('timeSlot')
            .populate('lecturer', 'firstName lastName')
            .populate({ path: 'timeSlot', populate: { path: 'hall', select: 'name' } })
            .sort({ 'timeSlot.startTime': 1 });

        const todayBookings = bookings
            .filter(b =>
                bookingVisibleToStudent(b, studentCriteria.batch, studentCriteria.courses) &&
                b.timeSlot?.date === dateStr
            )
            .map(b => ({
            id: b._id,
            time: `${b.timeSlot.startTime} - ${b.timeSlot.endTime}`,
            subject: b.subject || 'Class',
            hall: b.timeSlot.hall?.name || 'Hall',
            lecturer: b.lecturer?.firstName ? `${b.lecturer.firstName} ${b.lecturer.lastName || ''}`.trim() : ''
        }));

        return res.status(200).json(todayBookings);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

export async function getWeekClasses(req, res) {
    try {
        const forbidden = requireMatch(req, res);
        if (forbidden) return;

        const today = new Date();
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay()); // Sunday
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        const yyyy = d => d.getFullYear();
        const mm = d => String(d.getMonth() + 1).padStart(2, '0');
        const dd = d => String(d.getDate()).padStart(2, '0');

        const startStr = `${yyyy(start)}-${mm(start)}-${dd(start)}`;
        const endStr = `${yyyy(end)}-${mm(end)}-${dd(end)}`;

        const studentCriteria = await getStudentCriteria(req.user._id);

        const bookings = await Booking.find({ status: 'APPROVED' })
            .populate('timeSlot')
            .populate('lecturer', 'firstName lastName')
            .populate({ path: 'timeSlot', populate: { path: 'hall', select: 'name' } })
            .sort({ 'timeSlot.date': 1, 'timeSlot.startTime': 1 });

        const weekBookings = bookings.filter(b => {
            const d = b.timeSlot?.date;
            return bookingVisibleToStudent(b, studentCriteria.batch, studentCriteria.courses) && d >= startStr && d <= endStr;
        }).map(b => ({
            id: b._id,
            date: b.timeSlot.date,
            time: `${b.timeSlot.startTime} - ${b.timeSlot.endTime}`,
            subject: b.subject || 'Class'
        }));

        return res.status(200).json(weekBookings);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}
