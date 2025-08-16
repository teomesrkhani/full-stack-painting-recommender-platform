// server.js
import express from "express";
import session from "express-session";
import {RedisStore} from "connect-redis";
import {createClient} from "redis"
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
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

// Redis client setup
const redisClient = createClient({
  username: process.env.REDIS_USERNAME,
  password: process.env.REDIS_PASSWORD,
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
})

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

await redisClient.connect();

// Session middleware BEFORE routes
app.use(session({
  store: new RedisStore({ client: redisClient, prefix: "sess:" }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 365 * 24 * 60 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  console.log('Session ID:', req.sessionID);
  console.log('Session:', req.session);
  if (!req.session.userId) {
    req.session.userId = uuidv4();
    console.log('Assigned new userId:', req.session.userId);
  } else {
    console.log('Existing userId:', req.session.userId);
  }
  next();
});

// Random unviewed painting route (needs session access)
app.get('/random-unviewed', async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No user session found' });
    }

    const collection = db.collection("artworks");
    
    // Get visited painting IDs for this user
    const visitedIds = await redisClient.sMembers(`visited:${userId}`);
    const visitedNumericIds = visitedIds.map(id => parseInt(id));
    
    // Find a random unvisited painting
    let painting;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!painting && attempts < maxAttempts) {
      // Get a random painting from the database
      const randomPaintings = await collection.aggregate([{ $sample: { size: 1 } }]).toArray();
      
      if (randomPaintings.length === 0) {
        return res.status(404).json({ error: 'No paintings found in database' });
      }
      
      const candidatePainting = randomPaintings[0];
      
      // Check if this painting has been visited
      if (!visitedNumericIds.includes(candidatePainting._id)) {
        painting = candidatePainting;
        break;
      }
      
      attempts++;
    }
    
    if (!painting) {
      // If we couldn't find an unvisited painting after max attempts, just return a random one
      const randomPaintings = await collection.aggregate([{ $sample: { size: 1 } }]).toArray();
      painting = randomPaintings[0];
    }

    const paintingWithUrl = {
      ...painting,
      artist: painting.author, // Map author to artist
      imageUrl: process.env.S3_BASE_URL + painting.images
    };    res.json(paintingWithUrl);
  } catch (error) {
    console.error('Error getting random unviewed painting:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use("/record", records);

app.get('/test-session', (req, res) => {
  res.json({
    message: 'Session test endpoint',
    userId: req.session.userId,
    sessionId: req.sessionID,
    path: req.path
  });
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
