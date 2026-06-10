import mongoose from "mongoose";
import Booking from "../models/booking.js";
import TimeSlot from "../models/timeSlot.js";
import Notification from "../models/notification.js";
import User from "../models/user.js";

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function canonicalText(value) {
    return normalizeText(value).replace(/[^a-z0-9]+/g, '');
}

function normalizeCourseList(courses) {
    if (!Array.isArray(courses)) return [];
    const expanded = [];
    for (const raw of courses) {
        const text = String(raw || '');
        const parts = text.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length) expanded.push(...parts);
    }
    return [...new Set(expanded.map(canonicalText).filter(Boolean))];
}

function toMinutes(hhmm) {
    const [h, m] = String(hhmm || '00:00').split(':');
    return (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0);
}

function toHHMM(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}


export async function createBooking(req, res) {
    try {

        
        if (!req.user || 
            (req.user.role !== "LECTURER" && req.user.role !== "HOD")) {
            return res.status(403).json({
                message: "Only Lecturer or HOD can book"
            });
        }

        const slot = await TimeSlot.findById(req.body.timeSlotId);
        const targetBatch = req.body.targetBatch || null;

        if (!slot) {
            return res.status(404).json({
                message: "Time slot not found"
            });
        }

        
        const now = new Date();
        const [_y,_m,_d] = slot.date.split('-');
        const [sh, sm] = slot.startTime.split(':');
        const slotDateTime = new Date(parseInt(_y,10), parseInt(_m,10)-1, parseInt(_d,10), parseInt(sh,10), parseInt(sm,10), 0);

        // allow HOD to override past-time restriction
        if (req.user.role !== "HOD") {
            if (slotDateTime < now) {
                return res.status(400).json({
                    message: "Cannot book past time slots"
                });
            }
        }

        // Block re-request: prevent a lecturer from re-booking a slot already rejected by HOD.
        if (req.user.role === "LECTURER") {
            const existingRejected = await Booking.findOne({ lecturer: req.user._id, timeSlot: slot._id, status: "REJECTED" });
            if (existingRejected) {
                return res.status(400).json({
                    message: "Your booking request for this hall on this date and time was previously rejected by HOD. You cannot re-submit the same request."
                });
            }
        }

        if (slot.status !== "AVAILABLE") {
            return res.status(400).json({
                message: "Slot already locked or booked"
            });
        }

       
        if (req.user.role === "HOD") {
            slot.status = "BOOKED";
        } else {
            slot.status = "LOCKED";
        }

        slot.lockedBy = req.user._id;
        await slot.save();

        const booking = new Booking({
            lecturer: req.user._id,
            timeSlot: slot._id,
            targetBatch,
            subject: req.body.subject || 'Class',
            status: req.user.role === "HOD" ? "APPROVED" : "PENDING"
        });

        await booking.save();

        return res.status(201).json({
            message: req.user.role === "HOD"
                ? "Booking confirmed successfully"
                : "Booking request sent for approval"
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error creating booking",
            error: error.message
        });
    }
}




export async function updateBookingStatus(req, res) {
    try {

        if (!req.user || req.user.role !== "HOD") {
            return res.status(403).json({
                message: "Only HOD can approve or reject"
            });
        }

        let booking = await Booking.findById(req.params.id);

        // if not found by booking _id, treat param as requestId and fetch one booking for validation
        if (!booking) {
            const byRequest = await Booking.findOne({ requestId: req.params.id });
            if (!byRequest) {
                return res.status(404).json({ message: "Booking not found" });
            }
            booking = byRequest;
        }

        const { status } = req.body;
        const rejectionReason = typeof req.body.rejectionReason === 'string'
            ? req.body.rejectionReason.trim()
            : '';

        if (status !== "APPROVED" && status !== "REJECTED") {
            return res.status(400).json({ message: "Invalid status value" });
        }

        if (status === "REJECTED" && !rejectionReason) {
            return res.status(400).json({
                message: "Rejection reason is required when rejecting a booking request"
            });
        }

        // If this booking is part of a grouped request, operate on the whole group
        let bookingsToUpdate = [];
        if (booking.requestId) {
            bookingsToUpdate = await Booking.find({ requestId: booking.requestId })
                .populate('lecturer', 'firstName lastName email')
                .populate({ path: 'timeSlot', populate: { path: 'hall', select: 'name' } });
        } else {
            bookingsToUpdate = [await Booking.findById(booking._id)
                .populate('lecturer', 'firstName lastName email')
                .populate({ path: 'timeSlot', populate: { path: 'hall', select: 'name' } })];
        }

        for (const b of bookingsToUpdate) {
            b.status = status;
            b.rejectionReason = status === "REJECTED" ? rejectionReason : null;

            if (status === "APPROVED") {
                if (b.timeSlot) {
                    b.timeSlot.status = "BOOKED";
                    await b.timeSlot.save();
                }
            } else {
                if (b.timeSlot) {
                    b.timeSlot.status = "AVAILABLE";
                    b.timeSlot.lockedBy = null;
                    await b.timeSlot.save();
                }
            }

            await b.save();
        }

        // send notifications
        try {
            const lecturerObj = bookingsToUpdate[0].lecturer;
            const lecturerId = lecturerObj && lecturerObj._id ? lecturerObj._id : bookingsToUpdate[0].lecturer;
            const subject = bookingsToUpdate[0].subject;
            const hallNames = [...new Set(bookingsToUpdate.map(b => b.timeSlot && b.timeSlot.hall && b.timeSlot.hall.name).filter(Boolean))];
            const date = bookingsToUpdate[0]?.timeSlot?.date || '';

            const slots = bookingsToUpdate
                .map(b => b.timeSlot)
                .filter(Boolean)
                .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

            const startTime = slots.length ? slots[0].startTime : '';
            const endTime = slots.length ? slots[slots.length - 1].endTime : '';
            const timesLabel = startTime && endTime
                ? `${startTime} - ${endTime}`
                : slots.map(s => s.startTime).filter(Boolean).join(', ');

            if (status === "APPROVED") {
                // notify lecturer 
                const targetBatch = bookingsToUpdate[0].targetBatch;
                const msg = targetBatch
                    ? `Your booking for ${subject} (batch ${targetBatch}) on ${date} at ${timesLabel} in ${hallNames.join(', ')} has been approved.`
                    : `Your booking for ${subject} on ${date} at ${timesLabel} in ${hallNames.join(', ')} has been approved.`;
                const n = new Notification({
                    sender: req.user._id,
                    receivers: [lecturerId],
                    title: `Booking Approved: ${subject}`,
                    message: msg
                });
                await n.save();

                // notify students by subject enrollment; if targetBatch exists, intersect by batch.
                const students = await User.find({ role: "STUDENT" }).select("_id batch courses").lean();
                
                const canonicalSubject = canonicalText(subject);
                let matchedStudents = [];

                if (targetBatch) {
                    matchedStudents = students.filter(s => normalizeText(s.batch) === normalizeText(targetBatch));
                } else {
                    matchedStudents = students.filter(s => {
                        const enrolled = normalizeCourseList(s.courses);
                        if (!canonicalSubject || canonicalSubject === 'class') return true;
                        return enrolled.includes(canonicalSubject);
                    });

                    if ((!matchedStudents || matchedStudents.length === 0) && subject) {
                        const raw = normalizeText(subject);
                        matchedStudents = students.filter(s =>
                            (Array.isArray(s.courses) ? s.courses : []).some(c => normalizeText(c).includes(raw))
                        );
                    }
                }

                if (matchedStudents && matchedStudents.length) {
                    const uniqueById = new Map();
                    matchedStudents.forEach(s => {
                        const key = s._id?.toString();
                        if (key && !uniqueById.has(key)) uniqueById.set(key, s._id);
                    });
                    const studentIds = Array.from(uniqueById.values());
                    const sm = targetBatch
                        ? `A lecture for ${subject} has been scheduled for batch ${targetBatch} on ${date} at ${timesLabel} in ${hallNames.join(', ')}.`
                        : `A lecture for ${subject} has been scheduled on ${date} at ${timesLabel} in ${hallNames.join(', ')}.`;
                    const sn = new Notification({
                        sender: req.user._id,
                        receivers: studentIds,
                        title: `Class Scheduled: ${subject}`,
                        message: sm
                    });
                    await sn.save();
                } else {
                }
            } else if (status === "REJECTED") {
                const msg = `Your booking request for ${subject} on ${date} at ${timesLabel} has been rejected. Reason: ${rejectionReason}`;
                const n = new Notification({
                    sender: req.user._id,
                    receivers: [lecturerId],
                    title: `Booking Rejected: ${subject}`,
                    message: msg
                });
                await n.save();
            }
        } catch (notifyErr) {
            console.error('Notification send error after booking status update:', notifyErr);
        }

        return res.status(200).json({
            message: "Booking updated successfully",
            updated: bookingsToUpdate.length,
            rejectionReason: status === "REJECTED" ? rejectionReason : null
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error updating booking",
            error: error.message
        });
    }
}




export async function cancelBooking(req, res) {
    try {

        if (!req.user) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // handle grouped request cancellation
        let bookingsToCancel = [];
        if (booking.requestId) {
            bookingsToCancel = await Booking.find({ requestId: booking.requestId }).populate("timeSlot");
        } else {
            bookingsToCancel = [await Booking.findById(booking._id).populate("timeSlot")];
        }

        // permission check: admin/HOD or owner lecturer
        if (!(req.user.role === "ADMIN" || req.user.role === "HOD")) {
            if (bookingsToCancel[0].lecturer.toString() !== req.user._id) {
                return res.status(403).json({ message: "You cannot cancel this booking" });
            }
        }

        // ensure not already rejected
        if (bookingsToCancel.some(b => b.status === "REJECTED")) {
            return res.status(400).json({ message: "One or more bookings already rejected" });
        }

        for (const b of bookingsToCancel) {
            if (b.timeSlot) {
                b.timeSlot.status = "AVAILABLE";
                b.timeSlot.lockedBy = null;
                await b.timeSlot.save();
            }

            b.status = "REJECTED";
            b.cancelledAt = new Date();
            await b.save();
        }

        return res.status(200).json({ message: "Booking cancelled successfully", cancelled: bookingsToCancel.length });

    } catch (error) {
        return res.status(500).json({
            message: "Error cancelling booking",
            error: error.message
        });
    }
}


export async function getBookingHistory(req, res) {
    try {

        if (!req.user) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        let bookings;

        
        if (req.user.role === "ADMIN") {

            bookings = await Booking.find()
                .populate("lecturer", "firstName lastName email role")
                .populate({
                    path: "timeSlot",
                    populate: {
                        path: "hall",
                        select: "name capacity"
                    }
                })
                .sort({ createdAt: -1 });
        }

        // HODs should only see their own bookings 
        else if (req.user.role === "HOD") {
            bookings = await Booking.find({ lecturer: req.user._id })
                .populate("lecturer", "firstName lastName email role")
                .populate({
                    path: "timeSlot",
                    populate: {
                        path: "hall",
                        select: "name capacity"
                    }
                })
                .sort({ createdAt: -1 });
        }

        
        else if (req.user.role === "LECTURER") {

            bookings = await Booking.find({
                lecturer: req.user._id
            })
                .populate({
                    path: "timeSlot",
                    populate: {
                        path: "hall",
                        select: "name capacity"
                    }
                })
                .sort({ createdAt: -1 });
        }

        
        else if (req.user.role === "STUDENT") {

            bookings = await Booking.find({
                status: "APPROVED"
            })
                .populate({
                    path: "timeSlot",
                    populate: {
                        path: "hall",
                        select: "name capacity"
                    }
                })
                .sort({ createdAt: -1 });
        }

        else {
            return res.status(400).json({
                message: "Invalid role"
            });
        }

        return res.status(200).json(bookings);

    } catch (error) {
        return res.status(500).json({
            message: "Error fetching booking history",
            error: error.message
        });
    }
}


// Create bookings for a range of hourly timeslots in a hall (multiple slots)
export async function createRangeBooking(req, res) {
    try {
        if (!req.user || (req.user.role !== "LECTURER" && req.user.role !== "HOD")) {
            return res.status(403).json({ message: "Only Lecturer or HOD can book" });
        }

        const { hallId, date, startTime, endTime, subject, targetBatch, capacity } = req.body;

        if (!hallId || !date || !startTime || !endTime || !subject) {
            return res.status(400).json({ message: "hallId, date, startTime, endTime and subject are required" });
        }

        // If lecturer has allocated courses, ensure they are allocated to this subject
        if (req.user.role === "LECTURER") {
            const User = (await import("../models/user.js")).default;
            const full = await User.findById(req.user._id).lean();
            const courses = full.courses || [];
            if (courses && courses.length > 0 && !courses.includes(subject)) {
                return res.status(403).json({ message: "You are not allocated to this subject" });
            }
        }

        // build required slot start times
        const slots = [];
        const partsStart = startTime.split(":");
        const partsEnd = endTime.split(":");
        const [sh, sm] = partsStart;
        const [eh, em] = partsEnd;
        let s = parseInt(sh, 10);
        const e = parseInt(eh, 10);

        if (isNaN(s) || isNaN(e) || s >= e) {
            return res.status(400).json({ message: "Invalid time range" });
        }

        // enforce minutes are zero
        if (sm !== "00" || em !== "00") {
            return res.status(400).json({ message: "Start and end times must be on the hour (HH:00)" });
        }

        while (s < e) {
            slots.push((s < 10 ? "0" : "") + s + ":00");
            s += 1;
        }

        const TimeSlot = (await import("../models/timeSlot.js")).default;
        const Booking = (await import("../models/booking.js")).default;

        // normalize date same as seed
        const dp = date.split('-');
        const yyyy = parseInt(dp[0], 10);
        const mm = parseInt(dp[1], 10);
        const dd = parseInt(dp[2], 10);
        const normalizedDate = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
        let foundSlots = await TimeSlot.find({ hall: hallId, date: normalizedDate, startTime: { $in: slots } }).sort({ startTime: 1 });

        // create missing TimeSlot documents on-demand so booking works even if search wasn't called first
        const existingStartTimes = new Set(foundSlots.map(fs => fs.startTime));
        const missingSlots = slots.filter(slot => !existingStartTimes.has(slot));
        if (missingSlots.length > 0) {
            try {
                const createPromises = missingSlots.map(slot => {
                    const hour = parseInt(slot.split(':')[0], 10);
                    const endHour = hour + 1;
                    const endTime = (endHour < 10 ? '0' : '') + endHour + ':00';
                    const ts = new TimeSlot({ hall: hallId, date: normalizedDate, startTime: slot, endTime, status: 'AVAILABLE' });
                    return ts.save();
                });
                const created = await Promise.all(createPromises);
                foundSlots = foundSlots.concat(created.filter(Boolean));
                // sort again by startTime
                foundSlots.sort((a,b) => a.startTime.localeCompare(b.startTime));
            } catch (err) {
                console.error('Failed to create missing timeslots for booking:', err.message || err);
                return res.status(500).json({ message: 'Failed to prepare time slots for booking' });
            }
        }

        if (foundSlots.length !== slots.length) {
            return res.status(400).json({ message: "Not all requested time slots exist for this hall" });
        }

        // Block re-request: if this lecturer already has a REJECTED booking for any of
        // the requested slots, they are not allowed to re-submit the same request.
        if (req.user.role === "LECTURER") {
            const slotIds = foundSlots.map(s => s._id);
            const existingRejected = await Booking.findOne({
                lecturer: req.user._id,
                timeSlot: { $in: slotIds },
                status: "REJECTED"
            });
            if (existingRejected) {
                return res.status(400).json({
                    message: "Your booking request for this hall on this date and time was previously rejected by HOD. You cannot re-submit the same request."
                });
            }
        }

       
        if (req.user.role === "LECTURER") {
            const slotIds = foundSlots.map(s => s._id);
            const existingRejected = await Booking.findOne({
                lecturer: req.user._id,
                timeSlot: { $in: slotIds },
                status: "REJECTED"
            });
            if (existingRejected) {
                return res.status(400).json({
                    message: "Your booking request for this hall on this date and time was previously rejected by HOD. You cannot re-submit the same request."
                });
            }
        }

        if (!foundSlots.every(s => s.status === "AVAILABLE")) {
            return res.status(400).json({ message: "One or more slots are not available" });
        }

        // group id for this booking request
        const requestId = new mongoose.Types.ObjectId();

        // lock/book each slot and create booking entries
        const bookings = [];
        const now = new Date();

            // lock/book each slot and create booking entries with rollback on error
            const createdBookings = [];
            const modifiedSlots = [];

            try {
                    const now = new Date();
                    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
                    const nowHour = now.getHours();
                    for (const slot of foundSlots) {
                        // prevent booking past time slots using date and hour comparison
                        const slotDateStr = slot.date; // 'YYYY-MM-DD'
                        const [sh, sm] = slot.startTime.split(':');
                        const slotHour = parseInt(sh, 10);

                            // allow HOD to override past-time restriction
                            if (req.user.role !== 'HOD') {
                                if (slotDateStr < todayStr) {
                                    console.error('Past slot detected (date less than today):', { slotDateStr, todayStr, slotHour, nowHour });
                                    return res.status(400).json({ message: "Cannot book past time slots", details: { slotDateStr, todayStr, slotHour, nowHour } });
                                }
                                if (slotDateStr === todayStr && slotHour <= nowHour) {
                                    console.error('Past slot detected (same day, hour past):', { slotDateStr, todayStr, slotHour, nowHour });
                                    return res.status(400).json({ message: "Cannot book past time slots", details: { slotDateStr, todayStr, slotHour, nowHour } });
                                }
                            }

                    if (req.user.role === "HOD") {
                        slot.status = "BOOKED";
                    } else {
                        slot.status = "LOCKED";
                    }

                    slot.lockedBy = req.user._id;
                    await slot.save();
                    modifiedSlots.push(slot);

                    const booking = new Booking({
                        lecturer: req.user._id,
                        timeSlot: slot._id,
                        requestId,
                        subject,
                        targetBatch: targetBatch || null,
                        capacity: capacity || null,
                        status: req.user.role === "HOD" ? "APPROVED" : "PENDING"
                    });

                    await booking.save();
                    createdBookings.push(booking);
                }

                // notify HODs when a lecturer creates a pending request
                if (req.user.role === "LECTURER") {
                    try {
                        const LectureHall = (await import('../models/lectureHall.js')).default;
                        const hall = await LectureHall.findById(hallId).select('name');
                        const hods = await User.find({ role: 'HOD' }).select('_id');
                        const hodIds = hods.map(h => h._id);
                        if (hodIds.length) {
                            const times = createdBookings.map(b => b.timeSlot ? b.timeSlot.toString() : '').filter(Boolean);
                            const msg = `Booking request from ${req.user.firstName || req.user.username} for ${subject}${targetBatch ? ` (batch ${targetBatch})` : ''} on ${normalizedDate} (${startTime} - ${endTime}) in ${hall ? hall.name : ''}`;
                            const note = new Notification({ sender: req.user._id, receivers: hodIds, message: msg });
                            await note.save();
                        }
                    } catch (nerr) {
                        console.error('Error sending HOD notification for range booking:', nerr);
                    }
                }

                return res.status(201).json({ message: req.user.role === "HOD" ? "Booking confirmed" : "Booking request sent", bookingsCount: createdBookings.length, requestId });
            } catch (err) {
                // log context for debugging
                console.error("RANGE BOOKING ERROR:", {
                    error: err.message,
                    user: req.user ? req.user._id : null,
                    hallId,
                    date,
                    startTime,
                    endTime,
                    subject,
                    requestId
                });

                // rollback: free any slots we locked and remove created bookings
                for (const s of modifiedSlots) {
                    try {
                        s.status = "AVAILABLE";
                        s.lockedBy = null;
                        await s.save();
                    } catch (inner) {
                        console.error("Rollback slot error:", inner);
                    }
                }

                for (const b of createdBookings) {
                    try {
                        await Booking.deleteOne({ _id: b._id });
                    } catch (inner) {
                        console.error("Rollback booking delete error:", inner);
                    }
                }

                return res.status(500).json({ message: err.message });
            }

        // inner try handled locking/creation and already returned; outer flow ends here

    } catch (error) {
        return res.status(500).json({ message: "Error creating range booking", error: error.message });
    }
}


export async function getPendingBookingRequests(req, res) {
    try {
        if (!req.user || req.user.role !== "HOD") {
            return res.status(403).json({ message: "Only HOD can view pending requests" });
        }

        // find all pending bookings created by lecturers (optionally within HOD's department)
        const lecturerFilter = { role: 'LECTURER' };
        if (req.user.department) lecturerFilter.department = req.user.department;
        const lecturers = await User.find(lecturerFilter).select('_id').lean();
        const lecturerIds = lecturers.map(l => l._id);

        let pending = await Booking.find({ status: "PENDING", lecturer: { $in: lecturerIds } })
            .populate('lecturer', 'firstName lastName email department')
            .populate({ path: 'timeSlot', populate: { path: 'hall', select: 'name' } })
            .sort({ createdAt: -1 });

        const groups = {};
        for (const b of pending) {
            const key = b.requestId ? b.requestId.toString() : b._id.toString();
            if (!groups[key]) {
                groups[key] = {
                    requestId: key,
                    lecturer: b.lecturer,
                    subject: b.subject,
                    targetBatch: b.targetBatch || null,
                    capacity: b.capacity ?? null,
                    createdAt: b.createdAt,
                    hall: b.timeSlot && b.timeSlot.hall ? b.timeSlot.hall.name : null,
                    date: b.timeSlot ? b.timeSlot.date : null,
                    times: []
                };
            }

            // Keep the first available non-null values for grouped request metadata.
            if (!groups[key].targetBatch && b.targetBatch) groups[key].targetBatch = b.targetBatch;
            if (groups[key].capacity === null && b.capacity !== null && b.capacity !== undefined) {
                groups[key].capacity = b.capacity;
            }

            if (b.timeSlot && b.timeSlot.startTime) groups[key].times.push(b.timeSlot.startTime);
        }

        const raw = Object.values(groups).map(g => ({ ...g, times: g.times.sort() }));

        const result = await Promise.all(raw.map(async (g) => {
            const lecturerObj = g.lecturer || {};
            const lecturerId = lecturerObj && lecturerObj._id ? lecturerObj._id : (lecturerObj || null);
            const lecturerName = lecturerObj && (lecturerObj.firstName || lecturerObj.lastName)
                ? `${lecturerObj.firstName || ''} ${lecturerObj.lastName || ''}`.trim()
                : (lecturerObj && lecturerObj.email) || '';

            const times = Array.isArray(g.times) ? g.times.sort() : [];
            const startTime = times.length ? times[0] : null;
            let endTime = null;
            if (times.length) {
                const last = times[times.length - 1];
                const hh = parseInt(last.split(':')[0], 10) + 1;
                endTime = `${hh < 10 ? '0' : ''}${hh}:00`;
            }

            const hallName = g.hall || null;

            // compute student count for display: prefer targetBatch, otherwise count by course(subject)
            let students = 0;
            try {
                if (g.targetBatch) {
                    students = await User.countDocuments({ role: 'STUDENT', batch: g.targetBatch });
                } else if (g.subject) {
                    students = await User.countDocuments({ role: 'STUDENT', courses: g.subject });
                }
            } catch (e) {
                students = 0;
            }

            return {
                id: g.requestId || null,
                requestId: g.requestId || null,
                courseName: g.subject || null,
                lecturerName,
                lecturerId,
                lecturerEmail: lecturerObj && lecturerObj.email ? lecturerObj.email : null,
                lecturerDepartment: lecturerObj && lecturerObj.department ? lecturerObj.department : null,
                targetBatch: g.targetBatch || null,
                capacity: g.capacity ?? null,
                startTime,
                endTime,
                hallName,
                students,
                date: g.date || null,
                createdAt: g.createdAt,
                times
            };
        }));

        return res.status(200).json(result);
    } catch (error) {
        console.error('Get pending booking requests error:', error);
        return res.status(500).json({ message: 'Error fetching pending requests', error: error.message });
    }
}

// Generic: return requests filtered by status (PENDING|APPROVED|REJECTED|ALL) scoped to lecturers and optional HOD department
export async function getRequests(req, res) {
    try {
        if (!req.user || req.user.role !== "HOD") {
            return res.status(403).json({ message: "Only HOD can view requests" });
        }

        const status = (req.query.status || 'PENDING').toUpperCase(); // default pending

        // build lecturer list scoped to HOD department
        const lecturerFilter = { role: 'LECTURER' };
        if (req.user.department) lecturerFilter.department = req.user.department;
        const lecturers = await User.find(lecturerFilter).select('_id').lean();
        const lecturerIds = lecturers.map(l => l._id);

        const q = { lecturer: { $in: lecturerIds } };
        if (status !== 'ALL') q.status = status;

        const results = await Booking.find(q)
            .populate('lecturer', 'firstName lastName email department')
            .populate({ path: 'timeSlot', populate: { path: 'hall', select: 'name' } })
            .sort({ createdAt: -1 });

        return res.status(200).json(results);
    } catch (error) {
        console.error('getRequests error:', error);
        return res.status(500).json({ message: 'Error fetching requests', error: error.message });
    }
}