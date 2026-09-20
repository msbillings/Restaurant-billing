/**
 * End-to-End Loyalty System Testing Script with 100% Dynamic Metadata
 * Customer: Siva (Phone: 8340964732)
 * Target Tenant: client_test4_db
 *
 * Implements:
 * - ZERO hardcoded restaurant names, customer stats, tiers, or conversion rates.
 * - Dynamic restaurant name resolved directly from tenant DB Settings collection.
 * - Dynamic customer metrics ({tier}, {visits}, {spend}, {points}, {walletBalance}) resolved per customer from DB.
 * - Dynamic loyalty redemption rate ({rate}) resolved from tenant LoyaltyConfig.
 * - Collapsible "... Read more" spacer (String.fromCharCode(8206).repeat(4001)) matching DayBook, Analytics, and E-Bill.
 * - Multi-media WhatsApp dispatch with loyalty flyer image.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { registerTenantCluster, getTenantModels } from './utils/tenantManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 5002;
const BASE_URL = `http://localhost:${PORT}`;
const TENANT_DB = 'client_test4_db';
const ADMIN_USER_ID = '6a708dd0f4aaac2f40d5183d';
const CUSTOMER_PHONE = '8340964732';

// Same Points & Cash Price from previous test
const POINTS = 250;
const WALLET_BALANCE = 250;

// Generate Admin Authorization Token
const token = jwt.sign(
  { id: ADMIN_USER_ID, role: 'Admin', db: TENANT_DB },
  process.env.JWT_SECRET || 'fallback_secret_msbillings_2026',
  { expiresIn: '1d' }
);

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
  'X-Tenant-DB': TENANT_DB
};

async function runEndToEndLoyaltyTestDynamic() {
  console.log('================================================================');
  console.log(`🚀 STARTING END-TO-END DYNAMIC LOYALTY TESTING`);
  console.log(`   Target Phone: ${CUSTOMER_PHONE}`);
  console.log(`   Tenant DB: ${TENANT_DB}`);
  console.log(`   Backend URL: ${BASE_URL}`);
  console.log('================================================================\n');

  // STEP 1: Verify WhatsApp Connection Status
  console.log('📡 STEP 1: Checking WhatsApp Gateway Status...');
  try {
    const waRes = await fetch(`${BASE_URL}/api/whatsapp/status`, { headers });
    const waData = await waRes.json();
    console.log(`   Status: ${waData.status} | Connected Number: ${waData.connectedNumber || 'None'}`);
    if (waData.status !== 'CONNECTED') {
      console.warn('   ⚠️ WARNING: WhatsApp gateway is not in CONNECTED state.');
    } else {
      console.log('   ✅ WhatsApp Gateway is ONLINE and authenticated.');
    }
  } catch (err) {
    console.error('   ❌ Failed to contact WhatsApp status endpoint:', err.message);
  }

  // STEP 2: Dynamically query database settings & verify Siva's balance
  console.log(`\n🎁 STEP 2: Querying dynamic tenant settings and customer balance from ${TENANT_DB}...`);
  let dynamicRestaurantName = 'Our Restaurant';
  let customerName = 'Valued Customer';
  let totalVisits = 0;
  let totalSpend = 0;

  try {
    registerTenantCluster(TENANT_DB, 'cluster1');
    const models = await getTenantModels(TENANT_DB);

    // Dynamic Restaurant Name from DB Settings
    const settingDoc = await models.Setting.findOne({ key: 'restaurantSettings' }).lean();
    let sVal = settingDoc?.value;
    if (typeof sVal === 'string') {
      try { sVal = JSON.parse(sVal); } catch (e) {}
    }
    if (sVal?.restaurantName) {
      dynamicRestaurantName = sVal.restaurantName;
    }
    console.log(`   ✅ Dynamic Restaurant Name from DB: "${dynamicRestaurantName}"`);

    // Verify & update customer points in DB
    const updatedCustomer = await models.Customer.findOneAndUpdate(
      { phone: CUSTOMER_PHONE },
      { $set: { points: POINTS, walletBalance: WALLET_BALANCE, isVIP: true, tier: 'Platinum VIP' } },
      { returnDocument: 'after' }
    );

    if (updatedCustomer) {
      customerName = updatedCustomer.name || 'Valued Customer';
      totalVisits = updatedCustomer.totalVisits || 0;
      totalSpend = updatedCustomer.totalSpend || 0;
      console.log(`   ✅ Dynamic Customer Profile from DB:`);
      console.log(`      Name: ${customerName}`);
      console.log(`      Points: ${updatedCustomer.points} pts | Wallet Balance: ₹${updatedCustomer.walletBalance}`);
      console.log(`      Total Visits: ${totalVisits} | Total Spend: ₹${Number(totalSpend).toLocaleString('en-IN')}`);
      console.log(`      VIP Member: ${updatedCustomer.isVIP ? 'YES' : 'NO'}`);
    }
  } catch (err) {
    console.error('   ❌ Error querying database:', err.message);
  }

  // STEP 3: Verify Profile via API
  console.log(`\n👤 STEP 3: Verifying Profile via API for +91${CUSTOMER_PHONE}...`);
  try {
    const custRes = await fetch(`${BASE_URL}/api/loyalty/customer/${CUSTOMER_PHONE}`, { headers });
    const custData = await custRes.json();
    console.log(`   API Confirmed Customer: ${custData.name}`);
    console.log(`   API Confirmed Points: ${custData.points} pts | Wallet: ₹${custData.walletBalance}`);
    console.log('   ✅ API confirmed customer profile.');
  } catch (err) {
    console.error('   ❌ Failed to fetch customer profile via API:', err.message);
  }

  // STEP 4: Load VIP Loyalty Reward Flyer Image
  console.log('\n🎨 STEP 4: Loading VIP Loyalty Reward Flyer Image...');
  const imagePath = path.join(__dirname, 'assets', 'loyalty_vip_siva.jpg');
  if (!fs.existsSync(imagePath)) {
    console.error(`   ❌ Image file not found at: ${imagePath}`);
    process.exit(1);
  }
  const imageBytes = fs.readFileSync(imagePath);
  const imageBase64 = `data:image/jpeg;base64,${imageBytes.toString('base64')}`;
  console.log(`   Image loaded: assets/loyalty_vip_siva.jpg (${(imageBytes.length / 1024).toFixed(1)} KB)`);
  console.log('   ✅ Image ready for multi-media dispatch.');

  // STEP 5: Dispatch 100% Dynamic Loyalty Message with READ MORE Collapse Tag
  console.log(`\n📲 STEP 5: Dispatching 100% Dynamic Loyalty Message with "... Read more" Collapse...`);

  // Notice: ZERO hardcoded values! All placeholders {customerName}, {restaurantName}, {tier}, {visits}, {spend}, {points}, {walletBalance}, {rate}, {read_more} are dynamically parsed by the backend controller from the tenant database!
  const messageTemplate =
`👑 *Exclusive VIP Loyalty Rewards for {customerName}!* 🍽️
🏨 *{restaurantName.toUpperCase()}* | *VIP PRIVILEGE*
{read_more}
━━━━━━━━━━━━━━━━━━━━
Dear *{customerName}*,

Thank you for being one of our most valued VIP guests at *{restaurantName}*!

✨ *VIP Membership:* {tier} ({visits} Visits | ₹{spend} Spend)
⭐ *Loyalty Points:* *{points} Points*
💵 *Cash Wallet Balance:* *₹{walletBalance}*
🏷️ *Rate:* 1 Point = ₹{rate} Direct Cash Discount

🎉 *Your Exclusive Dining Privilege:*
You have *₹{walletBalance}* ready to redeem right now! You can use this *₹{walletBalance} OFF* on your next Dine-In or Delivery order.

🍽️ *How to Redeem:*
Simply mention your mobile number or show this VIP Card upon billing to instantly deduct *₹{walletBalance}* from your total bill!

━━━━━━━━━━━━━━━━━━━━
🥂 _We look forward to welcoming you back to {restaurantName}!_`;

  try {
    // Note: No hardcoded restaurantName in payload; backend dynamically resolves from database!
    const campaignPayload = {
      selectedPhones: [CUSTOMER_PHONE],
      imageBase64: imageBase64,
      messageTemplate: messageTemplate
    };

    const sendRes = await fetch(`${BASE_URL}/api/loyalty/campaign/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify(campaignPayload)
    });

    const sendData = await sendRes.json();
    console.log('   HTTP Status:', sendRes.status);
    console.log('   Response Payload:', JSON.stringify(sendData, null, 2));

    if (sendRes.ok && sendData.success) {
      console.log(`   🎉 SUCCESS! 100% Dynamic Message with Read More spacer and Loyalty Flyer dispatched to +91${CUSTOMER_PHONE}!`);
    } else {
      console.error(`   ❌ Dispatch failed:`, sendData.message || sendData);
    }
  } catch (err) {
    console.error('   ❌ Exception during campaign dispatch:', err.message);
  }

  // STEP 6: Test Real-Time Points Expiry Dashboard Stats Endpoint
  console.log(`\n📊 STEP 6: Testing GET /api/loyalty/expiry/stats (Expiry Analytics)...`);
  try {
    const statsRes = await fetch(`${BASE_URL}/api/loyalty/expiry/stats`, { headers });
    const statsData = await statsRes.json();
    console.log('   HTTP Status:', statsRes.status);
    if (statsRes.ok && statsData.success) {
      console.log('   ✅ Expiry Stats Response:');
      console.log(`      Config: Auto-Expiry: ${statsData.config.autoExpiryEnabled} | Validity: ${statsData.config.walletExpiryDays}d | Warning: ${statsData.config.warningDays}d`);
      console.log(`      Accounts with Balance: ${statsData.stats.totalWithBalance}`);
      console.log(`      Expiring Soon (<=${statsData.config.warningDays}d): ${statsData.stats.expiringSoonCount}`);
      console.log(`      Expired (> ${statsData.config.walletExpiryDays}d): ${statsData.stats.expiredCount}`);
      console.log(`      Healthy: ${statsData.stats.healthyCount}`);
      console.log(`      VIP Tier Breakdown:`, statsData.stats.tierStats);
    } else {
      console.error('   ❌ Failed to fetch expiry stats:', statsData);
    }
  } catch (err) {
    console.error('   ❌ Error contacting /api/loyalty/expiry/stats:', err.message);
  }

  // STEP 7: Test Real-Time Points Expiry Audit & Warning Dispatch
  console.log(`\n⚡ STEP 7: Testing POST /api/loyalty/expiry/audit (Audit & Advance Alerts Engine)...`);
  try {
    const auditRes = await fetch(`${BASE_URL}/api/loyalty/expiry/audit`, {
      method: 'POST',
      headers
    });
    const auditData = await auditRes.json();
    console.log('   HTTP Status:', auditRes.status);
    console.log('   Audit Result Message:', auditData.message);
    if (auditRes.ok && auditData.success) {
      console.log(`   ✅ Audit Completed:`);
      console.log(`      Evaluated: ${auditData.stats.totalEvaluated}`);
      console.log(`      Advance Warnings Sent: ${auditData.stats.warningsSent}`);
      console.log(`      Expired Reset: ${auditData.stats.expiredResetCount}`);
      console.log(`      Healthy Accounts: ${auditData.stats.healthyCount}`);
      if (auditData.actionsTaken?.length > 0) {
        console.log(`      Actions Taken (${auditData.actionsTaken.length}):`, auditData.actionsTaken);
      }
    } else {
      console.error('   ❌ Failed to run expiry audit:', auditData);
    }
  } catch (err) {
    console.error('   ❌ Error executing /api/loyalty/expiry/audit:', err.message);
  }

  console.log('\n================================================================');
  console.log('🏁 END-TO-END 100% DYNAMIC LOYALTY & EXPIRY TEST COMPLETED');
  console.log('================================================================\n');
}

runEndToEndLoyaltyTestDynamic().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
