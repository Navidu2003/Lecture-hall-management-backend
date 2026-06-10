import LectureHall from "../models/lectureHall.js";
import TimeSlot from "../models/timeSlot.js";
import Booking from "../models/booking.js";
import User from "../models/user.js";

export async function getDashboardStats(req, res) {
    try {

        if (!req.user) {
            return res.status(403).json({
                message: "Unauthorized"
            });
        }

        
        if (req.user.role === "ADMIN") {

            const totalHalls = await LectureHall.countDocuments();
            const totalSlots = await TimeSlot.countDocuments();
            const totalBookings = await Booking.countDocuments();
            const totalUsers = await User.countDocuments();

            return res.status(200).json({
                role: "ADMIN",
                totalHalls,
                totalSlots,
                totalBookings,
                totalUsers
            });
        }

        
        if (req.user.role === "HOD") {

            
            const lecturerFilter = { role: 'LECTURER' };
            if (req.user.department) lecturerFilter.department = req.user.department;

            const lecturers = await User.find(lecturerFilter).select('_id').lean();
            const lecturerIds = lecturers.map(l => l._id);

            const pending = await Booking.countDocuments({ status: "PENDING", lecturer: { $in: lecturerIds } });

            // approved today
            const startOfToday = new Date();
            startOfToday.setHours(0,0,0,0);
            const endOfToday = new Date();
            endOfToday.setHours(23,59,59,999);
            const approvedToday = await Booking.countDocuments({ status: "APPROVED", lecturer: { $in: lecturerIds }, updatedAt: { $gte: startOfToday, $lte: endOfToday } });

            const rejected = await Booking.countDocuments({ status: "REJECTED", lecturer: { $in: lecturerIds } });

            // total this month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            const totalMonth = await Booking.countDocuments({ lecturer: { $in: lecturerIds }, createdAt: { $gte: startOfMonth, $lte: endOfMonth } });

            return res.status(200).json({
                role: "HOD",
                pending,
                approvedToday,
                rejected,
                totalMonth
            });
        }

       
        if (req.user.role === "LECTURER") {

            const pending = await Booking.countDocuments({
                lecturer: req.user._id,
                status: "PENDING"
            });

            const approved = await Booking.countDocuments({
                lecturer: req.user._id,
                status: "APPROVED"
            });

            const rejected = await Booking.countDocuments({
                lecturer: req.user._id,
                status: "REJECTED"
            });

            return res.status(200).json({
                role: "LECTURER",
                pending,
                approved,
                rejected
            });
        }

       
        if (req.user.role === "STUDENT") {

            const totalApprovedBookings = await Booking.countDocuments({
                status: "APPROVED"
            });

            return res.status(200).json({
                role: "STUDENT",
                totalApprovedBookings
            });
        }

        
        if (req.user.role === "TO") {
            // pending users still waiting for approval
            const pendingUsers = await User.countDocuments({ role: "PENDING" });

            // approved today = users that are now non-PENDING/REJECTED
            // consider either updatedAt or createdAt in case timestamps weren't enabled earlier
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const endOfToday = new Date();
            endOfToday.setHours(23, 59, 59, 999);
            const approvedToday = await User.countDocuments({
                role: { $nin: ["PENDING", "REJECTED"] },
                $or: [
                  { updatedAt: { $gte: startOfToday, $lte: endOfToday } },
                  { createdAt: { $gte: startOfToday, $lte: endOfToday } }
                ]
            });

            const totalUsers = await User.countDocuments({ role: { $nin: ["PENDING", "REJECTED"] } });

            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

            const thisMonthCount = await User.countDocuments({
                role: { $nin: ["PENDING", "REJECTED"] },
                $or: [
                  { updatedAt: { $gte: startOfMonth, $lte: endOfMonth } },
                  { createdAt: { $gte: startOfMonth, $lte: endOfMonth } }
                ]
            });
            const lastMonthCount = await User.countDocuments({
                role: { $nin: ["PENDING", "REJECTED"] },
                $or: [
                  { updatedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } },
                  { createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }
                ]
            });

            let monthlyGrowth = 0;
            if (lastMonthCount === 0) {
                monthlyGrowth = thisMonthCount > 0 ? 100 : 0;
            } else {
                monthlyGrowth = ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100;
            }
            monthlyGrowth = Math.round(monthlyGrowth);

            console.debug('TO dashboard stats', { pendingUsers, approvedToday, totalUsers, thisMonthCount, lastMonthCount, monthlyGrowth });

            return res.status(200).json({
                role: "TO",
                pendingUsers,
                approvedToday,
                totalUsers,
                monthlyGrowth,
            });
        }

        
        return res.status(400).json({
            message: "Invalid user role"
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error fetching dashboard",
            error: error.message
        });
    }
}