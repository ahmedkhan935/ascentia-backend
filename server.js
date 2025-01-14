const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors');
const router = require('./routes/index');
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('./config/db');

app.use(cors());
app.use(express.json());
app.use('/api', router);
connectDB("local");

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    }
);
