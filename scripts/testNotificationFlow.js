import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/user.js';
import Booking from '../models/booking.js';
import Notification from '../models/notification.js';

dotenv.config();

async function testNotificationFlow() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_URI_FALLBACK, {
            serverSelectionTimeoutMS: 5000
        });
        console.log('Connected to MongoDB\n');

        // Check for students
        const students = await User.find({ role: 'STUDENT' }).select('_id username batch courses').lean();
        console.log(`Found ${students.length} students:`);
        students.forEach(s => {
            console.log(`  - ${s.username}: batch=${s.batch}, courses=${JSON.stringify(s.courses)}`);
        });
        console.log();

        //  Check for approved bookings
        const approvedBookings = await Booking.find({ status: 'APPROVED' })
            .select('subject targetBatch date startTime endTime')
            .limit(5)
            .lean();
        console.log(`Found ${approvedBookings.length} approved bookings:`);
        approvedBookings.forEach(b => {
            console.log(`  - Subject: ${b.subject}, Batch: ${b.targetBatch || 'N/A'}, Date: ${b.date}`);
        });
        console.log();

        //  Check for student notifications
        const studentNotifications = await Notification.find({})
            .populate('sender', 'username role')
            .populate('receivers', 'username role')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
        
        console.log(`Found ${studentNotifications.length} total notifications:`);
        studentNotifications.forEach(n => {
            const receiverNames = n.receivers.map(r => `${r.username}(${r.role})`).join(', ');
            console.log(`  - "${n.title}"`);
            console.log(`    From: ${n.sender?.username || 'unknown'}`);
            console.log(`    To: ${receiverNames}`);
            console.log(`    Message: ${n.message.substring(0, 100)}...`);
            console.log();
        });

        //  Check if students can receive notifications
        if (students.length > 0) {
            const testStudent = students[0];
            const notificationsForStudent = await Notification.find({ 
                receivers: testStudent._id 
            }).lean();
            console.log(`\nTest: Student ${testStudent.username} has ${notificationsForStudent.length} notifications`);
        }

        console.log('\n✓ Test completed');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

testNotificationFlow();
