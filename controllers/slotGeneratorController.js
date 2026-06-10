import LectureHall from "../models/lectureHall.js";
import TimeSlot from "../models/timeSlot.js";

export async function generateWeeklySlots(req, res) {
    try {

        // Only ADMIN can generate slots
        if (!req.user || req.user.role !== "ADMIN") {
            return res.status(403).json({
                message: "Only Admin can generate slots"
            });
        }

        const halls = await LectureHall.find();

        if (halls.length === 0) {
            return res.status(400).json({
                message: "No lecture halls found"
            });
        }

        const timePeriods = [
            { start: "08:00", end: "10:00" },
            { start: "10:00", end: "12:00" },
            { start: "13:00", end: "15:00" },
            { start: "15:00", end: "17:00" }
        ];

        const today = new Date();

        for (let i = 0; i < 7; i++) {

            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + i);

            const formattedDate = currentDate.toISOString().split("T")[0];

            for (let hall of halls) {

                for (let period of timePeriods) {

                    const existing = await TimeSlot.findOne({
                        hall: hall._id,
                        date: formattedDate,
                        startTime: period.start
                    });

                    if (!existing) {
                        await TimeSlot.create({
                            hall: hall._id,
                            date: formattedDate,
                            startTime: period.start,
                            endTime: period.end,
                            status: "AVAILABLE",
                            lockedBy: null
                        });
                    }
                }
            }
        }

        return res.status(201).json({
            message: "Weekly time slots generated successfully"
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error generating slots",
            error: error.message
        });
    }
}