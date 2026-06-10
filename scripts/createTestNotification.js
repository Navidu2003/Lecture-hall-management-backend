import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/user.js';
import Notification from '../models/notification.js';

dotenv.config();

async function createTestNotification() {
    try {
        // Connect using existing connection if available
        if (mongoose.connection.readyState !== 1) {
            console.log('Connecting to MongoDB...');
            await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_URI_FALLBACK);
        }
        console.log('Connected to MongoDB\n');

        // Find a student
        const student = await User.findOne({ role: 'STUDENT' });
        if (!student) {
            console.log('No students found in database');
            process.exit(1);
        }

        console.log(`Found student: ${student.username} (${student._id})`);
        console.log(`Batch: ${student.batch}, Courses: ${JSON.stringify(student.courses)}\n`);

        // Find an HOD to use as sender
        const hod = await User.findOne({ role: 'HOD' });
        if (!hod) {
            console.log('No HOD found, using student as sender');
        }

        // Create a test notification
        const testNotification = new Notification({
            sender: hod ?._id || student._id,
            receivers: [student._id],
            title: 'Test Notification - Class Scheduled: Software Engineering',
            message: `A lecture for Software Engineering has been scheduled for batch ${student.batch || '2024'} on March 10, 2026 at 09:00-11:00 in Hall A.`,
            category: 'GENERAL'
        });

        await testNotification.save();
        console.log('✓ Test notification created successfully!');
        console.log(`  Title: ${testNotification.title}`);
        console.log(`  Message: ${testNotification.message}`);
        console.log(`  Receiver: ${student.username}\n`);

        // Verify it was saved
        const check = await Notification.findById(testNotification._id);
        console.log('✓ Verification: Notification exists in database');

        // Check how many notifications this student has total
        const studentNotifs = await Notification.find({ receivers: student._id });
        console.log(`✓ Total notifications for ${student.username}: ${studentNotifs.length}\n`);

        console.log('Now login as the student and check the Notices page!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

createTestNotification();
