console.log('Starting test script');

const mongoose = require('mongoose');

console.log('Variables declared, attempting to connect to MongoDB');

mongoose.connect('mongodb://localhost/test', {
  useNewUrlParser: true,
  useUnifiedTopology: true,  // Added missing comma here
  connectTimeoutMS: 5000, // Add a timeout to check if it's a connection issue
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Connection Error: ', err));

console.log('Script Ended');
