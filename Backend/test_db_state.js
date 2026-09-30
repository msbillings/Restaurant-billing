import mongoose from 'mongoose';
mongoose.connect('mongodb://localhost:27017/mscurechain').then(() => {
    console.log(mongoose.connection.readyState);
    process.exit();
});
