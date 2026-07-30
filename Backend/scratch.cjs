const { MongoClient } = require('mongodb');

async function run() {
  const uri = "mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/?appName=Cluster0";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    
    // Check mscurechain.clients
    const docs = await client.db('mscurechain').collection('clients').find({}).toArray();
    
    const star = docs.find(d => JSON.stringify(d).toLowerCase().includes('star chicken'));
    if (star) {
       console.log("\nFOUND STAR CHICKEN:", JSON.stringify({email: star.email, password: star.plainTextPassword, key: star.licenseKey}));
    }

    const waffles = docs.find(d => JSON.stringify(d).toLowerCase().includes('waffles'));
    if (waffles) {
       console.log("\nFOUND WAFFLES:", JSON.stringify({email: waffles.email, password: waffles.plainTextPassword, key: waffles.licenseKey}));
    }
  } finally {
    await client.close();
  }
}
run().catch(console.dir);
