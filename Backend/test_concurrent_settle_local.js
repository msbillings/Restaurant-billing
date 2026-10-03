import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { settleBill } from './controllers/orderController.js';
import BillDefault from './models/Bill.js';
import CreditAccountDefault from './models/CreditAccount.js';

// Mock socket/notifications since we are testing controllers directly
import * as socketUtils from './utils/socket.js';
import * as notifUtils from './utils/notificationHelper.js';

async function runTest() {
  console.log('--- STARTING CONCURRENT SETTLEMENT TEST ---');
  const mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  
  const Bill = mongoose.model('Bill', BillDefault.schema);
  const CreditAccount = mongoose.model('CreditAccount', CreditAccountDefault.schema);

  const reqMockTemplate = { tenantDb: 'test_resto_db', models: { Bill, CreditAccount } };

  let failures = 0;

  for (let run = 1; run <= 5; run++) {
    console.log(`\n--- RUN ${run} ---`);
    await Bill.deleteMany({});
    await CreditAccount.deleteMany({});

    // Create an order
    const order = new Bill({
      tableNo: 'Table 1',
      billType: 'Dine-In',
      status: 'Open',
      total: 500,
      subtotal: 500,
      items: [{ name: 'Test Item', price: 500, quantity: 1, total: 500 }]
    });
    await order.save();
    
    const resMocks = Array(10).fill(0).map(() => ({
      json: function(data) { this.data = data; return this; },
      status: function(code) { this.statusCode = code; return this; }
    }));

    const reqMocks = resMocks.map(() => ({
      ...reqMockTemplate,
      params: { id: order._id.toString() },
      body: {
        paymentMode: 'Unpaid',
        customerName: 'Tester',
        customerPhone: '1234567890',
        total: 500
      }
    }));

    console.log('Firing 10 concurrent requests...');
    await Promise.all(reqMocks.map((req, i) => settleBill(req, resMocks[i])));
    
    const khata = await CreditAccount.findOne({ phoneNumber: '1234567890' });
    const balance = khata ? khata.balance : 0;
    const txCount = khata ? khata.transactions.length : 0;
    const updatedOrder = await Bill.findById(order._id);
    
    console.log(`Khata Balance: ${balance}`);
    console.log(`Khata Transactions: ${txCount}`);
    console.log(`Final Order Status: ${updatedOrder.status}`);

    if (balance !== 500 || txCount !== 1) {
      console.error(`❌ RUN ${run} FAILED! Balance is ${balance}, expected 500.`);
      failures++;
    } else {
      console.log(`✅ RUN ${run} PASSED!`);
    }
  }
  
  await new Promise(r => setTimeout(r, 1000));
  await mongoose.disconnect();
  await mongoServer.stop();
  if (failures > 0) process.exit(1);
  console.log('\n--- ALL TESTS PASSED ---');
}

runTest().catch(console.error);
