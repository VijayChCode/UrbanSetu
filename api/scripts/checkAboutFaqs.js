import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import About from '../models/about.model.js';
import FAQ from '../models/faq.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const checkAbout = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGO_URI || process.env.MONGODB_URI;
    console.log('Connecting using MONGO URI:', mongoUri ? 'Defined' : 'Not Defined');
    await mongoose.connect(mongoUri || "mongodb+srv://Rajashekar:Rajashekar@mern-estate.kzrjh.mongodb.net/mern-estate?retryWrites=true&w=majority&appName=mern-estate&tls=true&tlsAllowInvalidCertificates=true");
    console.log('Connected to MongoDB');

    const about = await About.findOne();
    if (!about) {
      console.log('No About document found!');
    } else {
      console.log('About document found: id =', about._id);
      console.log('FAQs:');
      console.log(JSON.stringify(about.faqs, null, 2));
    }

    const matchingFaqs = await FAQ.find({
      $or: [
        { answer: { $regex: /support@urbansetu\.com|info\.urbansetu@gmail\.com|support/i } },
        { question: { $regex: /support/i } }
      ]
    });
    console.log(`Global FAQ collection items matching 'support': ${matchingFaqs.length}`);
    matchingFaqs.forEach(f => console.log(`Q: ${f.question} | A: ${f.answer}`));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
};

checkAbout();
