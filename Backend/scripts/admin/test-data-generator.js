/**
 * Test Data Generator for Restaurant Billing System
 * Generates realistic dummy data for 100-150 orders per day
 * Usage: node test-data-generator.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Bill = require('./models/Bill');
const Menu = require('./models/Menu');
const Category = require('./models/Category');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/restaurant_billing';

// Payment modes
const PAYMENT_MODES = ['Cash', 'UPI', 'Card'];
const BILL_TYPES = ['Dine-In', 'Takeaway'];
const ORDER_STATUSES = ['Open', 'Billed', 'Paid', 'Cancelled'];

// Time ranges for realistic order distribution
const TIME_SLOTS = {
  morning: { start: 7, end: 11 },      // 7 AM - 11 AM
  afternoon: { start: 11, end: 15 },   // 11 AM - 3 PM
  evening: { start: 15, end: 19 },     // 3 PM - 7 PM
  night: { start: 19, end: 23 }        // 7 PM - 11 PM
};

// Order size distributions (weights)
const ORDER_SIZE_DISTRIBUTIONS = [
  { type: 'single', weight: 20, minItems: 1, maxItems: 1 },      // 20% single items
  { type: 'small', weight: 15, minItems: 2, maxItems: 2 },       // 15% small (2 items)
  { type: 'medium', weight: 40, minItems: 3, maxItems: 5 },      // 40% medium (3-5 items)
  { type: 'large', weight: 25, minItems: 8, maxItems: 12 }       // 25% large (8-12 items)
];

// Edge case scenarios
const EDGE_CASES = [
  { name: 'high_quantity', weight: 5, quantity: { min: 10, max: 20 } },
  { name: 'zero_discount', weight: 10, discount: 0 },
  { name: 'max_discount', weight: 5, discount: { min: 30, max: 50 } },
  { name: 'high_tax', weight: 10, tax: { min: 15, max: 18 } },
  { name: 'zero_tax', weight: 15, tax: 0 },
  { name: 'normal', weight: 55 } // Normal cases
];

// Helper functions
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function getWeightedRandom(distributions) {
  const totalWeight = distributions.reduce((sum, d) => sum + d.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const dist of distributions) {
    random -= dist.weight;
    if (random <= 0) return dist;
  }
  return distributions[distributions.length - 1];
}

function getRandomTimeSlot() {
  const slots = Object.keys(TIME_SLOTS);
  const slotName = getRandomElement(slots);
  const slot = TIME_SLOTS[slotName];
  const hour = getRandomInt(slot.start, slot.end - 1);
  const minute = getRandomInt(0, 59);
  return { hour, minute, slotName };
}

function generateOrderDate(baseDate, hour, minute) {
  const date = new Date(baseDate);
  date.setHours(hour, minute, getRandomInt(0, 59), 0);
  return date;
}

function generateTableNumber() {
  return `TBL-${String(getRandomInt(1, 20)).padStart(2, '0')}`;
}

function generateCustomerName() {
  const firstNames = ['Rajesh', 'Priya', 'Amit', 'Sneha', 'Rohit', 'Kavya', 'Vikram', 'Ananya', 
                      'Arjun', 'Divya', 'Karan', 'Meera', 'Siddharth', 'Pooja', 'Aditya', 'Nisha'];
  const lastNames = ['Kumar', 'Sharma', 'Patel', 'Singh', 'Reddy', 'Mehta', 'Joshi', 'Gupta',
                     'Iyer', 'Nair', 'Rao', 'Verma', 'Malik', 'Shah', 'Desai', 'Khan'];
  return `${getRandomElement(firstNames)} ${getRandomElement(lastNames)}`;
}

function generatePhoneNumber() {
  return `+91 ${getRandomInt(90000, 99999)}${getRandomInt(10000, 99999)}`;
}

function shouldIncludeAddon() {
  return Math.random() < 0.35; // 35% chance
}

async function generateTestData(numOrders = 300, targetDate = new Date()) {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Fetch menu items
    const menuItems = await Menu.find({ isAvailable: true }).populate('category', 'name');
    if (menuItems.length === 0) {
      throw new Error('No menu items found. Please run seed.js first.');
    }

    // Separate menu items by type and add-ons
    const regularItems = menuItems.filter(item => 
      !item.category?.name?.includes('Extras') && 
      !item.category?.name?.includes('Add-Ons')
    );
    const addonItems = menuItems.filter(item => 
      item.category?.name?.includes('Extras') || 
      item.category?.name?.includes('Add-Ons')
    );

    if (regularItems.length === 0) {
      throw new Error('No regular menu items found.');
    }

    console.log(`Generating ${numOrders} orders...`);
    console.log(`Available items: ${regularItems.length} regular, ${addonItems.length} add-ons`);

    const bills = [];
    const baseDate = new Date(targetDate);
    baseDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < numOrders; i++) {
      // Determine order size
      const sizeDist = getWeightedRandom(ORDER_SIZE_DISTRIBUTIONS);
      const numItems = getRandomInt(sizeDist.minItems, sizeDist.maxItems);

      // Generate time
      const timeSlot = getRandomTimeSlot();
      const orderDate = generateOrderDate(baseDate, timeSlot.hour, timeSlot.minute);

      // Select items
      const selectedItems = [];
      const usedItemNames = new Set();

      // Select regular items
      for (let j = 0; j < numItems; j++) {
        let item;
        let attempts = 0;
        do {
          item = getRandomElement(regularItems);
          attempts++;
        } while (usedItemNames.has(item.name) && attempts < 50);

        if (item) {
          usedItemNames.add(item.name);
          
          // Edge case: high quantity (10-20)
          const edgeCase = getWeightedRandom(EDGE_CASES);
          let quantity = edgeCase.name === 'high_quantity' 
            ? getRandomInt(edgeCase.quantity.min, edgeCase.quantity.max)
            : getRandomInt(1, 5);

          selectedItems.push({
            name: item.name,
            price: item.price,
            quantity: quantity,
            total: item.price * quantity
          });
        }
      }

      // Add add-ons randomly (35% chance)
      if (shouldIncludeAddon() && addonItems.length > 0) {
        const numAddons = getRandomInt(1, Math.min(3, addonItems.length));
        for (let j = 0; j < numAddons; j++) {
          const addon = getRandomElement(addonItems);
          const quantity = getRandomInt(1, 2);
          selectedItems.push({
            name: addon.name,
            price: addon.price,
            quantity: quantity,
            total: addon.price * quantity
          });
        }
      }

      if (selectedItems.length === 0) continue;

      // Calculate subtotal
      const subtotal = selectedItems.reduce((sum, item) => sum + item.total, 0);

      // Determine discount and tax based on edge cases
      const edgeCase = getWeightedRandom(EDGE_CASES);
      let discount = 0;
      let tax = 0;

      if (edgeCase.name === 'zero_discount') {
        discount = 0;
      } else if (edgeCase.name === 'max_discount') {
        discount = subtotal * (getRandomFloat(edgeCase.discount.min, edgeCase.discount.max) / 100);
      } else {
        // Normal discount (0-20%)
        discount = Math.random() < 0.3 ? subtotal * (getRandomFloat(0, 20) / 100) : 0;
      }

      if (edgeCase.name === 'zero_tax') {
        tax = 0;
      } else if (edgeCase.name === 'high_tax') {
        tax = getRandomFloat(edgeCase.tax.min, edgeCase.tax.max);
      } else {
        // Normal tax (5-12%)
        tax = getRandomFloat(5, 12);
      }

      const taxableAmount = subtotal - discount;
      const taxAmount = (taxableAmount * tax) / 100;
      const total = Math.round(taxableAmount + taxAmount);

      // Determine status
      let status;
      const statusRoll = Math.random();
      if (statusRoll < 0.1) {
        status = 'Open'; // 10% open orders
      } else if (statusRoll < 0.15) {
        status = 'Billed'; // 5% billed but not paid
      } else if (statusRoll < 0.98) {
        status = 'Paid'; // 83% paid
      } else {
        status = 'Cancelled'; // 2% cancelled
      }

      // Generate bill number if status is Billed or Paid
      let billNumber = null;
      if (status === 'Billed' || status === 'Paid') {
        billNumber = `BILL-${Date.now()}-${i}`;
      }

      // Determine payment mode (only for Paid orders)
      let paymentMode = null;
      if (status === 'Paid') {
        paymentMode = getRandomElement(PAYMENT_MODES);
      }

      // Generate customer info (70% chance)
      let customerName = null;
      let customerPhone = null;
      if (Math.random() < 0.7) {
        customerName = generateCustomerName();
        customerPhone = generatePhoneNumber();
      }

      const bill = {
        billNumber,
        tableNo: generateTableNumber(),
        items: selectedItems,
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        discount: Math.round(discount * 100) / 100,
        total,
        paymentMode,
        status,
        billType: getRandomElement(BILL_TYPES),
        customerName,
        customerPhone,
        kitchenNotes: Math.random() < 0.2 ? 'Less spicy please' : undefined,
        createdAt: orderDate,
        updatedAt: orderDate
      };

      bills.push(bill);
    }

    // Clear existing test data (optional - comment out if you want to keep existing data)
    console.log('Clearing existing bills...');
    await Bill.deleteMany({});

    // Insert bills
    console.log('Inserting bills...');
    const result = await Bill.insertMany(bills);
    console.log(`✅ Successfully generated ${result.length} orders`);

    // Print statistics
    printStatistics(result);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    
    return result;
  } catch (error) {
    console.error('Error generating test data:', error);
    throw error;
  }
}

function printStatistics(bills) {
  console.log('\n=== Test Data Statistics ===');
  
  const statusCounts = bills.reduce((acc, bill) => {
    acc[bill.status] = (acc[bill.status] || 0) + 1;
    return acc;
  }, {});

  const paymentModeCounts = bills.reduce((acc, bill) => {
    if (bill.paymentMode) {
      acc[bill.paymentMode] = (acc[bill.paymentMode] || 0) + 1;
    }
    return acc;
  }, {});

  const billTypeCounts = bills.reduce((acc, bill) => {
    acc[bill.billType] = (acc[bill.billType] || 0) + 1;
    return acc;
  }, {});

  const itemCounts = bills.reduce((acc, bill) => {
    const count = bill.items.length;
    if (count === 1) acc['1 item'] = (acc['1 item'] || 0) + 1;
    else if (count <= 2) acc['2 items'] = (acc['2 items'] || 0) + 1;
    else if (count <= 5) acc['3-5 items'] = (acc['3-5 items'] || 0) + 1;
    else acc['8-12 items'] = (acc['8-12 items'] || 0) + 1;
    return acc;
  }, {});

  const totalRevenue = bills
    .filter(b => b.status === 'Paid')
    .reduce((sum, b) => sum + b.total, 0);

  console.log('\nStatus Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count} (${((count / bills.length) * 100).toFixed(1)}%)`);
  });

  console.log('\nPayment Mode Distribution:');
  Object.entries(paymentModeCounts).forEach(([mode, count]) => {
    console.log(`  ${mode}: ${count}`);
  });

  console.log('\nBill Type Distribution:');
  Object.entries(billTypeCounts).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} (${((count / bills.length) * 100).toFixed(1)}%)`);
  });

  console.log('\nOrder Size Distribution:');
  Object.entries(itemCounts).forEach(([size, count]) => {
    console.log(`  ${size}: ${count} (${((count / bills.length) * 100).toFixed(1)}%)`);
  });

  console.log(`\nTotal Revenue (Paid orders): ₹${totalRevenue.toLocaleString()}`);
  console.log(`Average Order Value: ₹${Math.round(totalRevenue / (statusCounts['Paid'] || 1))}`);
  console.log('===========================\n');
}

// Run if called directly
if (require.main === module) {
  const numOrders = parseInt(process.argv[2]) || 125;
  const targetDate = process.argv[3] ? new Date(process.argv[3]) : new Date();
  
  generateTestData(numOrders, targetDate)
    .then(() => {
      console.log('Test data generation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test data generation failed:', error);
      process.exit(1);
    });
}

module.exports = { generateTestData };

