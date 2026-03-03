import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
        ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
        : path.join(__dirname, 'firebase-service-account.json');

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccountPath)
    });
    console.log('✅ Firebase Admin SDK Initialized Successfully');
} catch (error) {
    console.error('❌ Failed to Initialize Firebase Admin SDK:', error.message);
}

export default admin;
