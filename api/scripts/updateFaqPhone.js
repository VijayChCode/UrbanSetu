import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import About from '../models/about.model.js';
import FAQ from '../models/faq.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const updateFaqPhone = async () => {
  try {
    const mongoUri = process.env.MONGO || process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGO URI not found in environment!');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // 1. Update About document
    const about = await About.findOne();
    if (!about) {
      console.log('❌ No About document found in database!');
    } else {
      console.log(`Found About document with ID: ${about._id}`);
      let modified = false;

      if (Array.isArray(about.faqs)) {
        about.faqs.forEach((faq) => {
          if (faq.question && faq.question.toLowerCase().includes('support')) {
            const oldAnswer = faq.answer;
            let newAnswer = oldAnswer;

            // Ensure email is info.urbansetu@gmail.com
            newAnswer = newAnswer
              .replace(/support@urbansetu\.com/g, 'info.urbansetu@gmail.com')
              .replace(/urbansetu\.noreply@gmail\.com/g, 'info.urbansetu@gmail.com');

            // Add or ensure phone number is in helpline text
            if (!newAnswer.includes('+1 (970) 446-3758')) {
              newAnswer = newAnswer.replace(
                /call our helpline(?:\s+at\s+[\+\d\s\(\)\-]+)?/i,
                'call our helpline at +1 (970) 446-3758'
              );
            }

            if (oldAnswer !== newAnswer) {
              console.log(`Updating About FAQ [${faq.question}]:`);
              console.log(`  Old: ${oldAnswer}`);
              console.log(`  New: ${newAnswer}`);
              faq.answer = newAnswer;
              modified = true;
            }
          }
        });
      }

      if (modified) {
        about.lastUpdated = new Date();
        about.updatedBy = 'SystemMigration';
        await about.save();
        console.log('✅ About document updated and saved successfully!');
      } else {
        console.log('ℹ️ About document already up to date.');
      }
    }

    // 2. Update Global FAQs if applicable
    const globalFaqs = await FAQ.find({
      question: { $regex: /support/i }
    });

    for (const faq of globalFaqs) {
      const oldAnswer = faq.answer;
      let newAnswer = oldAnswer
        .replace(/support@urbansetu\.com/g, 'info.urbansetu@gmail.com')
        .replace(/urbansetu\.noreply@gmail\.com/g, 'info.urbansetu@gmail.com');

      if (!newAnswer.includes('+1 (970) 446-3758')) {
        newAnswer = newAnswer.replace(
          /call our toll-free helpline(?:\s+at\s+[\+\d\s\(\)\-]+)?/i,
          'call our toll-free helpline at +1 (970) 446-3758'
        ).replace(
          /call our helpline(?:\s+at\s+[\+\d\s\(\)\-]+)?/i,
          'call our helpline at +1 (970) 446-3758'
        );
      }

      if (oldAnswer !== newAnswer) {
        faq.answer = newAnswer;
        await faq.save();
        console.log(`Updated Global FAQ [${faq.question}]:`);
        console.log(`  Old: ${oldAnswer}`);
        console.log(`  New: ${newAnswer}`);
      }
    }

    // 3. Verification
    const verifiedAbout = await About.findOne();
    const supportFaq = verifiedAbout?.faqs?.find((f) => f.question?.toLowerCase().includes('support'));
    console.log('\n--- VERIFICATION RESULT ---');
    console.log('FAQ Question:', supportFaq?.question);
    console.log('FAQ Answer:', supportFaq?.answer);
    console.log('---------------------------\n');

  } catch (error) {
    console.error('❌ Error during update:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

updateFaqPhone();
