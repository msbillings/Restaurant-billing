# Load Testing with Artillery

This directory contains load testing configurations for the Restaurant Billing System.

## Prerequisites

Before running load tests, ensure:

1. **MongoDB is running**
   ```bash
   # Make sure MongoDB service is running
   # On Windows: Check Services or run mongod
   # On Linux/Mac: sudo systemctl start mongod (or equivalent)
   ```

2. **Backend server is running**
   ```bash
   npm start
   # or for development mode:
   npm run dev
   ```

3. **Server is accessible at** `http://localhost:5000`

## Running Load Tests

### Quick Start

```bash
npm run test:load
```

This command will:
- Automatically check if the server is running
- Display helpful error messages if the server is not running
- Run the load test if the server is available

### Manual Check

If you want to check the server status separately:

```bash
node tests/load/check-server.js
```

## Load Test Configuration

The load test (`load-test.yml`) simulates the following scenarios:

1. **Warm-up phase** (60 seconds)
   - 5 requests per second
   - Simulates initial system warm-up

2. **Normal load** (300 seconds / 5 minutes)
   - 2 requests per second
   - Simulates regular restaurant operations (~150 orders/day)

3. **Peak load** (180 seconds / 3 minutes)
   - 10 requests per second
   - Simulates lunch/dinner rush hours

4. **Stress test** (120 seconds / 2 minutes)
   - 20 requests per second
   - Tests system under high stress

## Test Flow

Each virtual user (vuser) performs:
1. Login to get authentication token
2. Create a new order
3. Generate bill with discount/tax
4. Settle bill with payment mode
5. Get daily statistics
6. Get bills list

## Customizing Load Tests

Edit `load-test.yml` to customize:
- Request rates (`arrivalRate`)
- Test durations (`duration`)
- Test endpoints and payloads
- Number of virtual users

## Troubleshooting

### Error: ECONNREFUSED

**Problem:** Server is not running or not accessible on port 5000.

**Solution:**
1. Start the backend server: `npm start` or `npm run dev`
2. Verify the server is running by visiting `http://localhost:5000/api/bills` in your browser
3. Check if MongoDB is running and connected

### Error: MongoDB connection errors

**Problem:** MongoDB is not running or connection string is incorrect.

**Solution:**
1. Start MongoDB service
2. Check `.env` file for correct `MONGO_URI`
3. Verify MongoDB is accessible at the configured URI

## Results

Load test results will be displayed in the terminal showing:
- Request rates
- Success/failure rates
- Response times
- Error counts

For more detailed analysis, you can configure Artillery to output results to a file.

