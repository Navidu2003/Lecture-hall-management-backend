import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/user.js';
import LectureHall from '../models/lectureHall.js';
import TimeSlot from '../models/timeSlot.js';
import Booking from '../models/booking.js';
import Notification from '../models/notification.js';
import { MONGODB_URI } from '../config.js';

async function connect() {
  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message || err);
    process.exit(1);
  }
}

function hourString(h) {
  return String(h).padStart(2, '0') + ':00';
}

async function seed() {
  await connect();

  // 1) Users
  const usersToCreate = [
    { firstName: 'Alice', lastName: 'Perera', email: 'alice.perera@university.edu', username: 'alice', password: 'Passw0rd!', role: 'LECTURER' },
    { firstName: 'Brian', lastName: 'Fernando', email: 'brian.fernando@university.edu', username: 'brian', password: 'Passw0rd!', role: 'STUDENT', batch: '2024', courses: ['Computer Networks', 'Software Engineering'] },
    { firstName: 'Chamara', lastName: 'Silva', email: 'chamara.silva@university.edu', username: 'chamara', password: 'Passw0rd!', role: 'HOD' },
    { firstName: 'Dinesh', lastName: 'Kumar', email: 'dinesh.kumar@university.edu', username: 'dinesh', password: 'Passw0rd!', role: 'TO' },
    { firstName: 'Admin', lastName: 'User', email: 'admin@university.edu', username: 'admin', password: 'AdminPass1!', role: 'ADMIN' },
    { firstName: 'Esha', lastName: 'Wijesinghe', email: 'esha.wijesinghe@university.edu', username: 'esha', password: 'Passw0rd!', role: 'LECTURER' },
    { firstName: 'Farhan', lastName: 'Rashid', email: 'farhan.rashid@university.edu', username: 'farhan', password: 'Passw0rd!', role: 'LECTURER' },
    { firstName: 'Gayani', lastName: 'Kumarasinghe', email: 'gayani.kumarasinghe@university.edu', username: 'gayani', password: 'Passw0rd!', role: 'STUDENT', batch: '2024', courses: ['Computer Networks'] },
    { firstName: 'Hiran', lastName: 'Jayawardena', email: 'hiran.jayawardena@university.edu', username: 'hiran', password: 'Passw0rd!', role: 'STUDENT', batch: '2025', courses: [] }
  ];

  const createdUsers = {};
  for (const u of usersToCreate) {
    let user = await User.findOne({ email: u.email });
    if (!user) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      user = new User({ ...u, password: passwordHash });
      await user.save();
      console.log('Created user:', u.email);
    } else {
      // If user exists, update batch/courses if provided in seed data
      const updates = {};
      if (u.batch && user.batch !== u.batch) updates.batch = u.batch;
      if (u.courses && JSON.stringify(user.courses || []) !== JSON.stringify(u.courses)) updates.courses = u.courses;
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        user = await User.findById(user._id);
        console.log('Updated user with seed fields:', u.email);
      } else {
        console.log('User exists, skipping:', u.email);
      }
    }
    createdUsers[u.username] = user;
  }

  // 2) Lecture Halls
  const hallsToCreate = [
    { name: 'Lecture Hall A101', capacity: 120 },
    { name: 'Lecture Hall B205', capacity: 80 },
    { name: 'Lecture Hall C301', capacity: 200 },
  ];

  const halls = [];
  for (const h of hallsToCreate) {
    let hall = await LectureHall.findOne({ name: h.name });
    if (!hall) {
      hall = new LectureHall(h);
      await hall.save();
      console.log('Created hall:', h.name);
    } else {
      console.log('Hall exists, skipping:', h.name);
    }
    halls.push(hall);
  }

  // 3) TimeSlots (next 30 days, hours 08..17)
  const today = new Date();
  const timeslotPromises = [];
  for (let d = 0; d < 30; d++) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
    const dateStr = date.toISOString().split('T')[0];
    for (const hall of halls) {
      for (let h = 8; h < 18; h++) {
        const start = hourString(h);
        const end = hourString(h + 1);
        // only create if not exists
        timeslotPromises.push((async () => {
          const exists = await TimeSlot.findOne({ hall: hall._id, date: dateStr, startTime: start });
          if (!exists) {
            const ts = new TimeSlot({ hall: hall._id, date: dateStr, startTime: start, endTime: end });
            await ts.save();
            return ts;
          }
          return exists;
        })());
      }
    }
  }

  const timeslots = (await Promise.all(timeslotPromises)).filter(Boolean);
  console.log('Ensured timeslots:', timeslots.length);

  // 4) Bookings: create a few realistic bookings
  // 4) Bookings: create multiple realistic approved bookings across the week
  const lecturerPool = [createdUsers['alice'], createdUsers['esha'], createdUsers['farhan']].filter(Boolean);
  const studentPool = [createdUsers['brian'], createdUsers['gayani'], createdUsers['hiran']].filter(Boolean);

  // pick up to 12 available timeslots and rotate lecturers, mark as APPROVED
  const availableSlots = await TimeSlot.find({ status: 'AVAILABLE' }).limit(20);
  let createdCount = 0;
  for (let i = 0; i < availableSlots.length && createdCount < 12; i++) {
    const ts = availableSlots[i];
    const existingBooking = await Booking.findOne({ timeSlot: ts._id });
    if (existingBooking) continue;

    const lecturer = lecturerPool[i % lecturerPool.length];
    if (!lecturer) break;

    const subjectNames = ['Computer Networks', 'Database Systems', 'Software Engineering', 'Algorithms', 'Operating Systems', 'Web Development'];
    const subject = subjectNames[i % subjectNames.length];

    const booking = new Booking({ lecturer: lecturer._id, timeSlot: ts._id, status: 'APPROVED', subject });
    await booking.save();
    ts.status = 'BOOKED';
    await ts.save();
    createdCount++;
    console.log('Created approved booking for timeslot', ts._id.toString(), 'subject:', subject);
  }

  // 5) Notifications
  const admin = createdUsers['admin'];
  const receivers = [];
  for (const uname of ['alice','brian','chamara','dinesh']) {
    if (createdUsers[uname]) receivers.push(createdUsers[uname]._id);
  }

  if (admin && receivers.length) {
    const noteText = 'Welcome to Timelyx — your lecture hall booking system is ready.';
    const existing = await Notification.findOne({ message: noteText });
    if (!existing) {
      const n = new Notification({ sender: admin._id, receivers, message: noteText, readBy: [] });
      await n.save();
      console.log('Created notification');
    } else {
      console.log('Notification exists, skipping');
    }
  }

  console.log('Seed complete.');
  await mongoose.disconnect();
}

seed().catch(err => { console.error('Seeding error:', err); process.exit(1); });
