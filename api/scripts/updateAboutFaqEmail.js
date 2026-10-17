import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import About from '../models/about.model.js';
import FAQ from '../models/faq.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const updateToInfoEmail = async () => {
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
      let aboutModified = false;

      // Update in faqs array
      if (Array.isArray(about.faqs)) {
        about.faqs.forEach((faq) => {
          if (
            faq.answer &&
            (faq.answer.includes('urbansetu.noreply@gmail.com') ||
              faq.answer.includes('support@urbansetu.com') ||
              faq.question.toLowerCase().includes('support'))
          ) {
            const oldAnswer = faq.answer;
            const updatedAnswer = oldAnswer
              .replace(/urbansetu\.noreply@gmail\.com/g, 'info.urbansetu@gmail.com')
              .replace(/support@urbansetu\.com/g, 'info.urbansetu@gmail.com');

            if (oldAnswer !== updatedAnswer) {
              console.log(`Updating FAQ [${faq.question}]:`);
              console.log(`  Old: ${oldAnswer}`);
              console.log(`  New: ${updatedAnswer}`);
              faq.answer = updatedAnswer;
              aboutModified = true;
            }
          }
        });
      }

      // Check contact field in About document
      if (about.contact && (about.contact.includes('urbansetu.noreply@gmail.com') || about.contact.includes('support@urbansetu.com'))) {
        console.log(`Updating About contact text...`);
        about.contact = about.contact
          .replace(/urbansetu\.noreply@gmail\.com/g, 'info.urbansetu@gmail.com')
          .replace(/support@urbansetu\.com/g, 'info.urbansetu@gmail.com');
        aboutModified = true;
      }

      if (aboutModified) {
        about.lastUpdated = new Date();
        about.updatedBy = 'SystemMigration';
        await about.save();
        console.log('✅ About document updated and saved successfully with info.urbansetu@gmail.com!');
      } else {
        console.log('ℹ️ About document already up to date.');
      }
    }

    // 2. Update global FAQ collection if any
    const globalFaqs = await FAQ.find({
      answer: { $regex: /urbansetu\.noreply@gmail\.com|support@urbansetu\.com/i }
    });

    if (globalFaqs.length > 0) {
      console.log(`Found ${globalFaqs.length} global FAQs to update`);
      for (const faq of globalFaqs) {
        const oldAns = faq.answer;
        faq.answer = faq.answer
          .replace(/urbansetu\.noreply@gmail\.com/g, 'info.urbansetu@gmail.com')
          .replace(/support@urbansetu\.com/g, 'info.urbansetu@gmail.com');
        await faq.save();
        console.log(`Updated Global FAQ [${faq.question}]:`);
        console.log(`  Old: ${oldAns}`);
        console.log(`  New: ${faq.answer}`);
      }
      console.log('✅ Global FAQs updated successfully with info.urbansetu@gmail.com!');
    } else {
      console.log('ℹ️ No global FAQs needed updating.');
    }

    // 3. Verify changes in About document
    const verifiedAbout = await About.findOne();
    const supportFaq = verifiedAbout?.faqs?.find(
      (f) => f.question?.toLowerCase().includes('support') || f.answer?.includes('info.urbansetu@gmail.com')
    );
    console.log('\n--- VERIFICATION RESULT ---');
    console.log('FAQ Question:', supportFaq?.question);
    console.log('FAQ Answer:', supportFaq?.answer);
    console.log('Contact Field:', verifiedAbout?.contact);
    console.log('---------------------------\n');
  } catch (error) {
    console.error('❌ Error during update:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

updateToInfoEmail();
