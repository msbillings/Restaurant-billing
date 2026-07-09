import mongoose from 'mongoose';

const RESTAURANT_URI = 'mongodb://narasimhaDln:728803Dln%40@ac-oooc0og-shard-00-00.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-01.btqf66f.mongodb.net:27017,ac-oooc0og-shard-00-02.btqf66f.mongodb.net:27017/restaurantbilling?ssl=true&authSource=admin&replicaSet=atlas-4ixmxj-shard-0';

const userSchema = new mongoose.Schema({
  username: String
});

async function run() {
  try {
    const restaurantConn = await mongoose.createConnection(RESTAURANT_URI).asPromise();
    const User = restaurantConn.model('User', userSchema);
    
    await User.deleteMany({ username: 'Al Mandi 29' });
    console.log('Deleted Al Mandi 29 from default database!');
    
    await restaurantConn.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
