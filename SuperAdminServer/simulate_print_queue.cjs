const dns = require('dns');
try { dns.setServers(['8.8.8.8']); } catch(e) {}
const mongoose = require('mongoose');
require('dotenv').config();

async function simulatePrintQueue() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Atlas DB');

  setInterval(async () => {
    try {
      const clients = await mongoose.connection.db.collection('clients').find({ status: 'Active' }).toArray();
      
      for (const client of clients) {
        // Randomize the queue stats for each client
        const isAnand = client.restaurantName && client.restaurantName.includes('Anand');
        
        let queuedKOTs = Math.floor(Math.random() * 3);
        let queuedBills = Math.floor(Math.random() * 2);
        let failedPrints = 0;
        let printNodesOnline = Math.floor(Math.random() * 3) + 1; // 1 to 3 POS devices online
        
        // Let's purposefully simulate a Printer Jam at Anand's Restaurant!
        if (isAnand && Math.random() > 0.5) {
          queuedKOTs = Math.floor(Math.random() * 15) + 5; // Huge backlog!
          failedPrints = Math.floor(Math.random() * 4) + 1; // 1 to 4 failed prints!
          printNodesOnline = 0; // The POS is offline!
        }
        
        await mongoose.connection.db.collection('clients').updateOne(
          { _id: client._id },
          { 
            $set: { 
              'realtimeMetrics.printQueue': {
                queuedKOTs,
                queuedBills,
                failedPrints,
                printNodesOnline,
                oldestWaitTime: (queuedKOTs > 0) ? Math.floor(Math.random() * 60) : 0
              } 
            } 
          }
        );
      }
      process.stdout.write('🖨️ ');
    } catch (e) {
      console.error(e.message);
    }
  }, 5000);
}

simulatePrintQueue().catch(console.error);
