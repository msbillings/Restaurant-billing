# Testing Documentation

This directory contains comprehensive tests for the Restaurant Billing System.

## Test Structure

```
tests/
├── unit/              # Unit tests for individual components
├── integration/       # Integration tests for workflows
├── load/              # Load and performance tests
├── feature/           # End-to-end feature tests
└── setup.js           # Test setup and teardown
```

## Running Tests

### Install Dependencies
```bash
cd Backend
npm install
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Load tests (requires Artillery)
npm run test:load

# All tests
npm run test:all
```

### Watch Mode
```bash
npm run test:watch
```

## Test Coverage

- **Unit Tests**: Test individual functions and controllers in isolation
- **Integration Tests**: Test complete workflows (Create -> Generate -> Settle)
- **Load Tests**: Simulate 150+ orders/day scenario with Artillery
- **Feature Tests**: End-to-end testing of complete features

## Load Testing

Load tests simulate:
- Normal load: 2 requests/second (150 orders/day)
- Peak load: 10 requests/second (lunch/dinner rush)
- Stress test: 20 requests/second

To run load tests:
1. Start the backend server: `npm start`
2. Run load tests: `npm run test:load`

## Environment Setup

Make sure your `.env` file is configured:
```
MONGO_URI=your_mongodb_connection_string
PORT=5000
JWT_SECRET=your_secret_key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=password123
```

## Test Data

Tests use a separate test database or clean up after themselves. No production data is affected.

