const mongoose = require('mongoose');
const dotenv = require('dotenv');   
dotenv.config();
const connectDB = async (mode) => {    
    try {
        if(mode == "local"){
            await mongoose.connect(process.env.MONGODB_URI_LOCAL, {
                useNewUrlParser: true,
                useUnifiedTopology: true
               
            });
        }
        else{
            await mongoose.connect(process.env.MONGODB_URI_ONLINE, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            
            });
        }
        console.log('Connected to the database');
    } catch (error) {
        console.log('Error connecting to the database');
        console.log(error);
    }
}
module.exports = connectDB;