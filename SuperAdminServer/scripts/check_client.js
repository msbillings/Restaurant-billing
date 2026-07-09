import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const clientSchema = new mongoose.Schema({
  restaurantName: String,
  licenseKey: String,
  hardwareId: String,
  plan: String
}, { strict: false });

const Client = mongoose.model('Client', clientSchema);

async function run() {
  await mongoose.connect(process.env.SUPER_ADMIN_MONGO_URI || 'mongodb+srv://danishanwar211:T58a5o6lT1N71ZgL@maheer.o141d.mongodb.net/super_admin_db?retryWrites=true&w=majority');
  const mm = await Client.findOne({ restaurantName: /mm/i });
  console.log('MM Client:', mm);
  process.exit();
}
run();
