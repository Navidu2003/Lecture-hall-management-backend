import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import User from '../models/user.js';
import { MONGODB_URI } from '../config.js';

async function seed() {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const users = [
    { firstName: 'Demo', lastName: 'Student', email: 'student@timelyx.local', username: 'student', password: 'password123', role: 'STUDENT' },
    { firstName: 'Demo', lastName: 'Lecturer', email: 'lecturer@timelyx.local', username: 'lecturer', password: 'password123', role: 'LECTURER' },
    { firstName: 'Demo', lastName: 'HOD', email: 'hod@timelyx.local', username: 'hod', password: 'password123', role: 'HOD' },
    { firstName: 'Demo', lastName: 'TO', email: 'to@timelyx.local', username: 'to', password: 'password123', role: 'TO' }
  ];

  for (const u of users) {
    const exists = await User.findOne({ email: u.email });
    if (exists) {
      console.log('Skipping existing:', u.email);
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 10);
    const newUser = new User({ ...u, password: passwordHash });
    await newUser.save();
    console.log('Created user:', u.username);
  }

  await mongoose.disconnect();
  console.log('Seeding complete');
}

seed().catch(err => { console.error(err); process.exit(1); });
