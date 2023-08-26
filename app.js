// Import the express library
const express = require('express');

// Import additional libraries
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const mongoose = require('mongoose'); // Import mongoose

// Connect to MongoDB using Mongoose
mongoose.connect('mongodb://localhost:27017/creatorSwipes', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 5000
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Connection Error: ', err));

// Import speakeasy for 2FA
const speakeasy = require('speakeasy');

// Define the User schema
const UserSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    username: String,
    password: String,
    email: String,
    googleToken: String,
    stripeCustomerId: String,
    twoFA: {
      enabled: Boolean,
      secret: String
    },
    maxCollections: { type: Number, default: 5 }, // Max collections for free users
    maxSwipesPerCollection: { type: Number, default: 20 } // Max swipes per collection for free users
});

// Define the Swipe schema
const SwipeSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    url: { type: String, required: true },
    platform: { type: String, required: true },
    tags: { type: [String], required: true },
    notes: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

// Define the Collection schema
const CollectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Swipe' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Create Mongoose models
const User = mongoose.model('User', UserSchema);
const Swipe = mongoose.model('Swipe', SwipeSchema);
const Collection = mongoose.model('Collection', CollectionSchema);






// Initialize the express application
const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100 // limit each IP to 100 requests per windowMs
});

// Apply rate limiter to all requests
app.use(limiter);

// Enable JSON parsing for incoming requests
app.use(express.json());

// Secret key for JWT
const SECRET_KEY = 'your-secret-key-here'; // Replace with your own secret key

// Middleware to validate JWT
const authenticateJWT = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).send('Access Denied');
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Define a basic route for the home page
app.get('/', (req, res) => {
  res.send('Hello, Creator Swipes!');
});

// Route for user login
app.post('/login', async (req, res) => {
  // Dummy login logic (Replace this with actual database logic)
  const { username, password } = req.body;
  const user = await User.findOne({ username: username });
  if (user && bcrypt.compareSync(password, user.password)) {
    const token = jwt.sign({ _id: user._id.toString() }, SECRET_KEY, { expiresIn: '30d' });
    res.json({ token });
  } else {
    res.status(401).send('Invalid credentials');
  }
});

// Endpoint to add a swipe
app.post('/addSwipe', async (req, res) => {
  const { userId, url, platform, tags, notes } = req.body;
  const newSwipe = new Swipe({
    userId,
    url,
    platform,
    tags,
    notes,
    createdAt: new Date()
  });
  try {
    await newSwipe.save();
    res.status(201).json({ message: 'Swipe added successfully' });
  } catch (err) {
    res.status(500).send('Failed to add swipe');
  }
});



// Route for a secure endpoint
app.get('/secure', authenticateJWT, (req, res) => {
    res.send('Secure data');
  });
  


// CRUD for Collections
// Create a new collection
app.post('/createCollection', authenticateJWT, async (req, res) => {
    const userId = req.user._id;
    const { name, description } = req.body;
  
    // Check user limits: 5 collections for free users
    const userCollections = await Collection.find({ createdBy: userId });
    if (userCollections.length >= 5) {
      return res.status(403).send('Collection limit reached');
    }
  
    const newCollection = new Collection({
      name,
      description,
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await newCollection.save();
    res.status(201).json({ message: 'Collection created successfully' });
  });
  
  // Get all collections for a user
  app.get('/getCollections', authenticateJWT, async (req, res) => {
    const userId = req.user._id;
    const collections = await Collection.find({ createdBy: userId });
    res.json(collections);
  });
  
  // Update a collection
  app.put('/updateCollection/:id', authenticateJWT, async (req, res) => {
    const userId = req.user._id;
    const collectionId = req.params.id;
    const { name, description } = req.body;
  
    const collection = await Collection.findOne({ _id: collectionId, createdBy: userId });
    if (!collection) {
      return res.status(404).send('Collection not found');
    }
  
    collection.name = name;
    collection.description = description;
    collection.updatedAt = new Date();
    await collection.save();
  
    res.json({ message: 'Collection updated successfully' });
  });
  
  // Delete a collection
  app.delete('/deleteCollection/:id', authenticateJWT, async (req, res) => {
    const userId = req.user._id;
    const collectionId = req.params.id;
  
    const collection = await Collection.findOne({ _id: collectionId, createdBy: userId });
    if (!collection) {
      return res.status(404).send('Collection not found');
    }
  
    await Collection.deleteOne({ _id: collectionId });
    res.json({ message: 'Collection deleted successfully' });
  });
  
  // Add a swipe to a collection
  app.post('/addToCollection/:id', authenticateJWT, async (req, res) => {
    const userId = req.user._id;
    const collectionId = req.params.id;
    const { swipeId } = req.body;
  
    const collection = await Collection.findOne({ _id: collectionId, createdBy: userId });
    if (!collection) {
      return res.status(404).send('Collection not found');
    }
  
    // Check swipe limit: 20 swipes for free users
    if (collection.items.length >= 20) {
      return res.status(403).send('Swipe limit reached for this collection');
    }
  
    collection.items.push(swipeId);
    await collection.save();
  
    res.json({ message: 'Swipe added to collection successfully' });
  });
  
  // Listen on port 3000
  app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
  });