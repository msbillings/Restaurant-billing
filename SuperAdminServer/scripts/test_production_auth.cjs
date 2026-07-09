// Native fetch is used

const mongoose = require('mongoose');

async function test() {
  console.log("Connecting to client_mm_db...");
  await mongoose.connect('mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/client_mm_db?retryWrites=true&w=majority');
  
  const UserSchema = new mongoose.Schema({
    username: String,
    activeSessions: Array
  }, { strict: false });
  const User = mongoose.models.User || mongoose.model('User', UserSchema);
  
  console.log("Clearing mm_admin sessions...");
  await User.updateOne({ username: 'mm_admin' }, { $set: { activeSessions: [] } });
  
  const loginUrl = 'https://enterprise-restaurant-billing-system.onrender.com/api/auth/login';
  console.log("Attempting to log in as mm_admin...");
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'mm_admin', password: 'mm_admin123' })
  });
  
  console.log("Login status:", loginRes.status);
  const loginData = await loginRes.json();
  console.log("Login response data:", JSON.stringify(loginData, null, 2));
  
  if (loginRes.status !== 200) {
    console.log("Login failed!");
    process.exit(1);
  }
  
  const token = loginData.accessToken;
  
  console.log("\nAttempting to query /bills/open WITHOUT X-Tenant-DB header...");
  const billsRes = await fetch('https://enterprise-restaurant-billing-system.onrender.com/api/bills/open', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
      // Explicitly leaving X-Tenant-DB header empty to test fallback
    }
  });
  
  console.log("Bills status:", billsRes.status);
  const billsData = await billsRes.json();
  console.log("Bills response:", JSON.stringify(billsData, null, 2));
  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});

test().catch(err => console.error(err));
