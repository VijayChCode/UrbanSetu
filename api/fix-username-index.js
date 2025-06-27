import mongoose from 'mongoose';

async function fixUsernameIndex() {
  await mongoose.connect('mongodb://localhost:27017/mern-estate');
  const collection = mongoose.connection.db.collection('users');
  try {
    const result = await collection.dropIndex('username_1');
    console.log('Dropped index:', result);
  } catch (e) {
    console.log('Drop index error:', e.message);
  }
  const indexes = await collection.indexes();
  console.log('Current indexes:', indexes);
  await mongoose.disconnect();
}

fixUsernameIndex(); 