import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import mongoose from 'mongoose';
import { getTenantModels } from '../utils/tenantManager.js';
import whatsappManager from '../services/whatsappService.js';

async function run() {
  await mongoose.connect('mongodb+srv://mscurechain_db_user:wnZRZ7iCrAkpcQ2j@cluster0.taof1ae.mongodb.net/mscurechain?appName=Cluster0');
  const models = await getTenantModels('client_test4_db');

  const Setting = models.Setting;
  
  // Get Review Link
  const settingsDoc = await Setting.findOne({ key: 'restaurantSettings' }).lean();
  let settings = settingsDoc?.value;
  let reviewLink = settings?.google_review_link || settings?.googleReviewLink;
  if (!reviewLink) {
    const reviewDoc = await Setting.findOne({ key: 'googleReviewLink' }).lean();
    reviewLink = reviewDoc?.value;
  }
  
  console.log('Review Link from DB:', reviewLink);
  
  if (!reviewLink) {
    console.error('No review link found in DB for client_test4_db');
    process.exit(1);
  }

  const restaurantName = settings?.restaurantName || "Anand's Restaurant";
  const targetPhone = '8328470402';
  const targetName = 'Anand';

  console.log(`Connecting to WhatsApp for client_test4_db...`);
  const waManager = whatsappManager.getInstance('client_test4_db', restaurantName);
  await waManager.ensureConnection();
  
  console.log(`Sending feedback message to ${targetPhone}...`);
  try {
    await new Promise(r => setTimeout(r, 4000)); // Wait for connection to stabilize
    await waManager.sendFeedbackMessage(targetPhone, targetName, reviewLink, restaurantName);
    console.log('Message sent successfully!');
  } catch (err) {
    console.error('Error sending message:', err);
  }
  
  setTimeout(() => process.exit(0), 2000);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
