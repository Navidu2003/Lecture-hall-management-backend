import mongoose from 'mongoose';
import User from '../models/user.js';
import { MONGODB_URI } from '../config.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

async function testOAuthProfileUpdate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find or create a test Google OAuth user
        let user = await User.findOne({ authProvider: 'GOOGLE' });
        
        if (!user) {
            console.log('Creating test Google OAuth user...');
            const randomPassword = crypto.randomBytes(24).toString('hex');
            user = new User({
                firstName: 'Test',
                lastName: '',
                email: 'testoauth@gmail.com',
                username: 'testoauth',
                password: await bcrypt.hash(randomPassword, 10),
                role: 'STUDENT',
                requestedRole: 'STUDENT',
                isEmailVerified: true,
                authProvider: 'GOOGLE',
                googleId: 'test123',
            });
            await user.save();
            console.log('Test user created:', user.email);
        } else {
            console.log('Found existing OAuth user:', user.email);
        }

        // Test update
        console.log('\nBefore update:');
        console.log('firstName:', user.firstName);
        console.log('lastName:', user.lastName);
        console.log('authProvider:', user.authProvider);

        // Simulate profile update
        const updates = {
            firstName: 'Updated',
            lastName: '',  
            phone: '1234567890',
        };

        Object.assign(user, updates);
        await user.save();

        console.log('\nAfter update:');
        console.log('firstName:', user.firstName);
        console.log('lastName:', user.lastName);
        console.log('phone:', user.phone);
        console.log('\nProfile update successful!');

        await mongoose.connection.close();
    } catch (error) {
        console.error('Error during test:', error);
        console.error('Error name:', error.name);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
}

testOAuthProfileUpdate();
