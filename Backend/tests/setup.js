// Test setup file
const mongoose = require('mongoose');
require('dotenv').config();

// Get MongoDB URI for testing
const MONGO_URI = process.env.MONGO_URI_TEST || process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant_billing_test';

// Connect to test database before all tests
beforeAll(async () => {
  try {
    // Close existing connection if any
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✓ Connected to test database');
  } catch (error) {
    console.error('✗ MongoDB connection error in test setup:', error.message);
    console.error('  Make sure MongoDB is running and accessible at:', MONGO_URI);
    throw error;
  }
});

// Close database connection after all tests
afterAll(async () => {
  try {
    // Small delay to ensure all async operations complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('✓ Test database connection closed');
    }
  } catch (error) {
    // Connection might already be closed or closing, ignore error
  }
});
