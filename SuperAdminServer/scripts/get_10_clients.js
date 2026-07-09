import mongoose from 'mongoose';
import fs from 'fs';

const MONGO_URI_SUPERADMIN = 'mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0';

const clientSchema = new mongoose.Schema({
  restaurantName: String,
  email: String,
  plainTextPassword: String,
  licenseKey: String,
});

async function run() {
    const superAdminConn = await mongoose.createConnection(MONGO_URI_SUPERADMIN).asPromise();
    const Client = superAdminConn.model('Client', clientSchema);

    const clients = await Client.find({ email: { $regex: /^test/ } }).sort({ restaurantName: 1 });
    
    let results = [];
    clients.forEach((c, index) => {
        results.push({
            restaurantName: c.restaurantName,
            email: c.email,
            password: c.plainTextPassword,
            licenseKey: c.licenseKey,
            appUsername: `admin${index+1}`,
            appPassword: c.plainTextPassword
        });
    });

    fs.writeFileSync('10_restaurants.json', JSON.stringify(results, null, 2));
    console.log("Done");
    process.exit(0);
}

run();
