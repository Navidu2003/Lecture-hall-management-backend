import LectureHall from "../models/lectureHall.js";


export async function createHall(req, res) {
    try {

        const { name, capacity } = req.body;

        if (!name || !capacity) {
            return res.status(400).json({
                message: "Name and capacity are required"
            });
        }

        const existingHall = await LectureHall.findOne({ name });

        if (existingHall) {
            return res.status(400).json({
                message: "Hall with this name already exists"
            });
        }

        const hall = new LectureHall({
            name,
            capacity
        });

        await hall.save();

        return res.status(201).json({
            message: "Lecture hall created successfully",
            hall
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error creating hall",
            error: error.message
        });
    }
}



export async function getAllHalls(req, res) {
    try {

        const halls = await LectureHall.find();

        return res.status(200).json(halls);

    } catch (error) {
        return res.status(500).json({
            message: "Error fetching halls",
            error: error.message
        });
    }
}



// UPDATE HALL
export async function updateHall(req, res) {
    try {

        const { name, capacity } = req.body;

        const hall = await LectureHall.findById(req.params.id);

        if (!hall) {
            return res.status(404).json({
                message: "Hall not found"
            });
        }

        if (name) hall.name = name;
        if (capacity) hall.capacity = capacity;

        await hall.save();

        return res.status(200).json({
            message: "Hall updated successfully",
            hall
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error updating hall",
            error: error.message
        });
    }
}


// DELETE HALL
export async function deleteHall(req, res) {
    try {

        const hall = await LectureHall.findById(req.params.id);

        if (!hall) {
            return res.status(404).json({
                message: "Hall not found"
            });
        }

        await hall.deleteOne();

        return res.status(200).json({
            message: "Hall deleted successfully"
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error deleting hall",
            error: error.message
        });
    }
}


// Search available halls for a given date/time range and minimum capacity
export async function searchAvailableHalls(req, res) {
    try {
        const { date, startTime, endTime, capacity } = req.body;

        if (!date || !startTime || !endTime) {
            return res.status(400).json({ message: "date, startTime and endTime are required" });
        }

        // normalize incoming date to match seeded timeslot date format
        const dateParts = date.split('-');
        if (dateParts.length !== 3) return res.status(400).json({ message: 'Invalid date format' });
        const yyyy = parseInt(dateParts[0], 10);
        const mm = parseInt(dateParts[1], 10);
        const dd = parseInt(dateParts[2], 10);
        const normalizedDate = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

        // build required slot start times (hourly slots)
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

        // enforce hour-only times (minutes must be '00')
        if (sm !== "00" || em !== "00") {
            return res.status(400).json({ message: "Start and end times must be on the hour (HH:00)" });
        }

        while (s < e) {
            slots.push((s < 10 ? "0" : "") + s + ":00");
            s += 1;
        }

        // find halls matching capacity (if provided)
        const capacityFilter = capacity ? { capacity: { $gte: capacity } } : {};
        const LectureHall = (await import("../models/lectureHall.js")).default;
        const TimeSlot = (await import("../models/timeSlot.js")).default;

        const halls = await LectureHall.find(capacityFilter).lean();

        const results = [];

        for (const h of halls) {
                let foundSlots = await TimeSlot.find({
                    hall: h._id,
                    date: normalizedDate,
                    startTime: { $in: slots }
                });

                // If some requested slots are missing, create them as AVAILABLE so search reflects true availability
                const existingStartTimes = new Set(foundSlots.map(fs => fs.startTime));
                const missingSlots = slots.filter(slot => !existingStartTimes.has(slot));
                if (missingSlots.length > 0) {
                    try {
                        const createPromises = missingSlots.map(slot => {
                            const hour = parseInt(slot.split(':')[0], 10);
                            const endHour = hour + 1;
                            const endTime = (endHour < 10 ? '0' : '') + endHour + ':00';
                            const ts = new TimeSlot({ hall: h._id, date: normalizedDate, startTime: slot, endTime, status: 'AVAILABLE' });
                            return ts.save();
                        });
                        const created = await Promise.all(createPromises);
                        // merge created with foundSlots
                        foundSlots = foundSlots.concat(created.filter(Boolean));
                    } catch (err) {
                        // if creation fails, log and continue — we'll treat missing slots as not available
                        console.error('Failed to create missing timeslots', err.message || err);
                    }
                }

            // determine overall status for this hall across requested slots
            let status = "NOT_AVAILABLE";
            let available = false;
            let bookedSlots = [];
            let lockedSlots = [];

            if (foundSlots.length === slots.length) {
                bookedSlots = foundSlots.filter(s => s.status === "BOOKED").map(s => s.startTime);
                lockedSlots = foundSlots.filter(s => s.status === "LOCKED").map(s => s.startTime);

                // if any slot already booked, BOOKED
                if (bookedSlots.length > 0) {
                    status = "BOOKED";
                    available = false;
                }
                // else if any locked , pending request
                else if (lockedSlots.length > 0) {
                    status = "PENDING";
                    available = false;
                }
                // all available
                else {
                    status = "AVAILABLE";
                    available = true;
                }
            } else {
                // some slots missing , normally not available for requested continuous range
                // however if some slots exist and none are booked/locked, consider it available (partial availability)
                bookedSlots = foundSlots.filter(s => s.status === "BOOKED").map(s => s.startTime);
                lockedSlots = foundSlots.filter(s => s.status === "LOCKED").map(s => s.startTime);

                if (foundSlots.length > 0 && bookedSlots.length === 0 && lockedSlots.length === 0) {
                    status = "AVAILABLE";
                    available = true;
                } else {
                    status = "NOT_AVAILABLE";
                    available = false;
                }
                // report which requested slots are missing
                const missing = slots.filter(slot => !foundSlots.find(fs => fs.startTime === slot));

            }

            results.push({
                id: h._id,
                name: h.name,
                capacity: h.capacity,
                status,
                available,
                bookedSlots,
                lockedSlots
            });
        }

        return res.status(200).json(results);

    } catch (error) {
        return res.status(500).json({ message: "Error searching halls", error: error.message });
    }
}