// server.js
import express from "express";
import {createClient} from "redis"
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import cookieParser from "cookie-parser";
import records from "./routes/record.js";
import { spawn } from 'child_process';
import db from "./db/connection.js";
import { ObjectId } from "mongodb";

const PORT = process.env.PORT || 5050;
const app = express();

const allowedOrigins = {
  development: 'http://localhost:5173',
  production: 'https://teomesrkhani.com'
};

// Middleware
app.use(cors({
  origin: allowedOrigins[process.env.NODE_ENV]  || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Redis client setup
const redisClient = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

await redisClient.connect();

// Middleware to manage user UUID
app.use((req, res, next) => {
  let userId = req.cookies?.userId || req.headers['x-user-id'];

  if (!userId) {
    userId = uuidv4();
    res.cookie('userId', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });
    // Also send userId in response header as fallback
    res.set('x-user-id', userId);
    console.log('Generated new userId:', userId);
  } else {
    console.log('Existing userId:', userId);
  }

  req.userId = userId;
  next();
});

// Random unviewed painting route
app.get('/random-unviewed', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }

    const collection = db.collection("artworks");
    
    // Get visited painting IDs for this user from Redis
    const visitedIds = await redisClient.sMembers(`visited:${userId}`);
    
    // Convert visited IDs to appropriate format for MongoDB query
    const visitedObjectIds = visitedIds
      .filter(id => id && id.length > 0) // Filter out empty strings
      .map(id => {
        try {
          // Try to create ObjectId if it's a valid hex string
          if (ObjectId.isValid(id)) {
            return new ObjectId(id);
          } else {
            // If it's a number, convert to number for comparison
            const numId = parseInt(id);
            return isNaN(numId) ? null : numId;
          }
        } catch (error) {
          console.warn(`Invalid ID format in visited set: ${id}`);
          return null;
        }
      })
      .filter(id => id !== null); // Remove invalid IDs
    
    // Find a random painting that has not been viewed
    const randomPaintings = await collection.aggregate([
      { $match: { _id: { $nin: visitedObjectIds } } },
      { $sample: { size: 1 } }
    ]).toArray();

    let painting;
    if (randomPaintings.length > 0) {
      painting = randomPaintings[0];
    } else {
      // If all paintings have been viewed, you could either send an error
      // or start showing paintings again by picking a random one.
      // For now, we'll send a message.
      return res.status(404).json({ message: 'You have viewed all available paintings!' });
    }

    // Add this painting to the viewed set immediately when it's fetched
    // await redisClient.sAdd(`visited:${userId}`, painting._id.toString());

    const paintingWithUrl = {
      ...painting,
      artist: painting.author, // Map author to artist
      imageUrl: process.env.S3_BASE_URL + painting.images
    };
    res.json(paintingWithUrl);
  } catch (error) {
    console.error('Error getting random unviewed painting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to mark a painting as viewed
app.post('/viewed', async (req, res) => {
  try {
    const userId = req.userId;
    const { paintingId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }
    if (!paintingId) {
      return res.status(400).json({ error: 'paintingId is required' });
    }

    // Add the paintingId to the set of viewed paintings for this user
    await redisClient.sAdd(`visited:${userId}`, paintingId.toString());
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error marking painting as viewed:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use("/record", records);

// Simple test endpoint that sets and reads cookies
app.get('/test-cookie', (req, res) => {
  console.log('Test cookie request - cookies received:', req.cookies);
  
  if (!req.cookies.testCookie) {
    res.cookie('testCookie', 'test123', {
      httpOnly: false, // Make it accessible to JS for testing
      secure: false,
      sameSite: 'lax',
      maxAge: 60000 // 1 minute
    });
    res.send('<html><body><h1>Cookie Set</h1><p>Refresh to test if cookie persists</p><script>console.log("document.cookie:", document.cookie);</script></body></html>');
  } else {
    res.send('<html><body><h1>Cookie Found!</h1><p>Value: ' + req.cookies.testCookie + '</p><script>console.log("document.cookie:", document.cookie);</script></body></html>');
  }
});

// Test endpoint to check database
app.get('/test-db', async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const artworksCount = await db.collection("artworks").countDocuments();
    const artworkSample = await db.collection("artworks").findOne();
    
    // Try other possible collection names
    const allCollections = {};
    for (const name of collectionNames) {
      const count = await db.collection(name).countDocuments();
      allCollections[name] = count;
    }
    
    res.json({
      dbName: db.databaseName,
      allCollections,
      artworksCollection: {
        count: artworksCount,
        sample: artworkSample
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Start persistent Python recommendation service
let recommendationService = null;
let isServiceReady = false;

function startRecommendationService() {
  console.log('Starting persistent recommendation service...');
  recommendationService = spawn('python3.10', [
    'recommend/recommendation_service.py',
    'recommend/artist_recommender.pt'
  ], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  recommendationService.stderr.on('data', (data) => {
    const message = data.toString();
    console.log(`Recommendation service: ${message.trim()}`);
    if (message.includes('Ready for requests')) {
      isServiceReady = true;
    }
  });

  recommendationService.on('close', (code) => {
    console.log(`Recommendation service exited with code ${code}`);
    isServiceReady = false;
    setTimeout(() => {
      if (!isServiceReady) {
        startRecommendationService();
      }
    }, 2000);
  });
}

// Start the service
startRecommendationService();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (recommendationService) {
    recommendationService.kill();
  }
  process.exit(0);
});

// Recommendation endpoint with persistent service
app.post('/recommend', (req, res) => {
  const { artists, counts } = req.body;
  
  if (!isServiceReady) {
    return res.status(503).json({ error: 'Recommendation service not ready' });
  }
  
  const request = JSON.stringify({ artists, counts });
  let responseData = '';
  
  const timeout = setTimeout(() => {
    res.status(500).json({ error: 'Recommendation timeout' });
  }, 5000);
  
  // Set up response handler
  const responseHandler = (data) => {
    responseData += data.toString();
    
    try {
      const response = JSON.parse(responseData);
      clearTimeout(timeout);
      recommendationService.stdout.removeListener('data', responseHandler);
      
      if (response.error) {
        res.status(500).json({ error: response.error });
      } else {
        res.json(response);
      }
    } catch (e) {
      console.log(e);
    }
  };
  
  recommendationService.stdout.on('data', responseHandler);
  
  recommendationService.stdin.write(request + '\n');
});


// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
