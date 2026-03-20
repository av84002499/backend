// config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI environment variable is not set');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS:         30000,
    socketTimeoutMS:          45000,
  });

  console.log(`✅  MongoDB connected: ${mongoose.connection.host}`);
};

module.exports = connectDB;
