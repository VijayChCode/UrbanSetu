import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Production: read credentials from environment variable (JSON string)
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        credential = admin.credential.cert(serviceAccount);
        console.log('🔑 Using Firebase credentials from environment variable');
    } else {
        // Development: read from local file
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
            ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
            : path.join(__dirname, 'firebase-service-account.json');
        credential = admin.credential.cert(serviceAccountPath);
        console.log('🔑 Using Firebase credentials from local file');
    }

    admin.initializeApp({ credential });
    console.log('✅ Firebase Admin SDK Initialized Successfully');
} catch (error) {
    console.error('❌ Failed to Initialize Firebase Admin SDK:', error.message);
}

export default admin;
