import mongoose from 'mongoose';
import User from '../models/user.js';
import { MONGODB_URI } from '../config.js';

(async () => {
    try {
        await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to MongoDB for timestamp backfill');

        const users = await User.find({ $or: [{ updatedAt: { $exists: false } }, { createdAt: { $exists: false } }] });
        console.log(`Found ${users.length} users needing timestamps`);

        for (const u of users) {
            u.updatedAt = u.updatedAt || u.createdAt || new Date();
            u.createdAt = u.createdAt || u.updatedAt || new Date();
            await u.save();
        }

        console.log('Backfill complete');
        process.exit(0);
    } catch (err) {
        console.error('Backfill error', err);
        process.exit(1);
    }
})();
