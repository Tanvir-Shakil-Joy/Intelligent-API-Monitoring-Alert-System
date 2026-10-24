const mongoose = require('mongoose');
const env = require('./env');

let isConnected = false;
let isFallback = false;

async function connectDB(uri = env.MONGO_URI) {
  if (isConnected) {
    return mongoose.connection;
  }

  const options = {
    serverSelectionTimeoutMS: 2500,
    socketTimeoutMS: 45000,
    autoIndex: true
  };

  try {
    const conn = await mongoose.connect(uri, options);
    isConnected = true;
    isFallback = false;
    console.log(`[Database] MongoDB connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn.connection;
  } catch (error) {
    isConnected = false;
    isFallback = true;
    console.warn(`[Database] Notice: MongoDB not reachable at ${uri} (${error.message}).`);
    console.log(`[Database] 🚀 Activated Resilient Embedded Database Engine (auto-persisted to local storage).`);
    return null;
  }
}

function isUsingMongo() {
  return isConnected && mongoose.connection.readyState === 1;
}

function isFallbackMode() {
  return isFallback;
}

mongoose.connection.on('error', (err) => {
  console.error(`[Database] MongoDB runtime connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('[Database] MongoDB disconnected. Mongoose will attempt to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  isConnected = true;
  console.log('[Database] MongoDB reconnected successfully.');
});

async function disconnectDB() {
  if (isConnected || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[Database] MongoDB disconnected gracefully.');
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  isUsingMongo,
  isFallbackMode,
  getConnection: () => mongoose.connection
};
