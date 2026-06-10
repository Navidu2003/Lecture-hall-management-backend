import TimeSlot from "../models/timeSlot.js";



export async function getTimetable(req, res) {
    try {
        const slots = await TimeSlot.find()
            .populate("hall")
            .populate("lockedBy", "firstName lastName");

        return res.status(200).json(slots);
    } catch (error) {
        console.error("TIMETABLE ERROR:", error);
        return res.status(500).json({
            message: "Error fetching timetable"
        });
    }
}


//  SEARCH AVAILABLE SLOTS
export async function searchTimeSlots(req, res) {
    try {

        const { date, startTime, endTime, minCapacity } = req.query;

        if (!date || !startTime || !endTime) {
            return res.status(400).json({
                message: "Date, start time and end time are required"
            });
        }

        const [day, month, year] = date.split("/");
        const formattedDate = `${year}-${month}-${day}`;

        const convertTo24Hour = (time) => {
            const [timePart, modifier] = time.split(" ");
            let [hours, minutes] = timePart.split(":");

            hours = parseInt(hours);

            if (modifier === "PM" && hours !== 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;

            return `${String(hours).padStart(2, "0")}:${minutes}`;
        };

        const formattedStart = convertTo24Hour(startTime);
        const formattedEnd = convertTo24Hour(endTime);

        const slots = await TimeSlot.find({
            date: formattedDate,
            startTime: formattedStart,
            endTime: formattedEnd,
            status: "AVAILABLE"
        }).populate("hall");

        if (!slots.length) {
            return res.status(200).json([]);
        }

        const halls = slots
            .map(slot => slot.hall)
            .filter(hall =>
                minCapacity
                    ? hall.capacity >= Number(minCapacity)
                    : true
            );

        return res.status(200).json(halls);

    } catch (error) {
        console.error("SEARCH ERROR:", error);
        return res.status(500).json({
            message: "Failed to search halls"
        });
    }
}