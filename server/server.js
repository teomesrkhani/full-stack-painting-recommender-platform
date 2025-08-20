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
  development: ['http://localhost:5173'],
  production: 'https://teomesrkhani.com'
};

// Middleware
app.use(cors({
  origin: allowedOrigins[process.env.NODE_ENV] || ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));
// app.use(cors())
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
  // Prioritize client-provided user ID in header over cookie
  let userId = req.headers['x-user-id'] || req.cookies?.userId;

  if (!userId) {
    userId = uuidv4();
    res.cookie('userId', userId, {
      httpOnly: false, // Allow client-side access for synchronization
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });
    // Also send userId in response header as fallback
    res.set('x-user-id', userId);
  }

  req.userId = userId;
  next();
});

// Helper function to get ChromaDB recommendation
async function getChromaRecommendation(userId, savedPaintings, visitedIds) {
  return new Promise((resolve) => {
    if (!isChromaServiceReady) {
      resolve(null);
      return;
    }

    const chromaRequest = {
      action: 'recommend',
      liked_paintings: savedPaintings.map(p => p._id.toString()),
      exclude_paintings: visitedIds,
      count: 1
    };

    let responseData = '';
    
    const timeout = setTimeout(() => {
      resolve(null);
    }, 5000);

    const responseHandler = async (data) => {
      responseData += data.toString();
      
      try {
        const response = JSON.parse(responseData);
        clearTimeout(timeout);
        chromaRecommendationService.stdout.removeListener('data', responseHandler);
        
        if (response.error || !response.recommendations || response.recommendations.length === 0) {
          resolve(null);
        } else {
          // Get the painting details from MongoDB
          const collection = db.collection("artworks");
          const paintingId = response.recommendations[0].mongodb_id || response.recommendations[0]._id;
          
          try {
            let painting;
            if (ObjectId.isValid(paintingId)) {
              // paintingId is a valid ObjectId hex string
              painting = await collection.findOne({ _id: new ObjectId(paintingId) });
            } else {
              // paintingId is likely an integer, search by _id as integer
              const numericId = parseInt(paintingId);
              if (!isNaN(numericId)) {
                painting = await collection.findOne({ _id: numericId });
              } else {
                // If it's neither ObjectId nor integer, try as string
                painting = await collection.findOne({ _id: paintingId });
              }
            }
            
            if (painting) {
              resolve(painting);
            } else {
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        }
      } catch (e) {
        clearTimeout(timeout);
        resolve(null);
      }
    };

    chromaRecommendationService.stdout.on('data', responseHandler);
    chromaRecommendationService.stdin.write(JSON.stringify(chromaRequest) + '\n');
  });
}

// Random unviewed painting route with ChromaDB integration
app.post('/random-unviewed', async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }

    // Get saved paintings from request body
    const savedPaintings = req.body?.savedPaintings || [];
    const hasSavedPaintings = savedPaintings && savedPaintings.length > 0;

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
          return null;
        }
      })
      .filter(id => id !== null); // Remove invalid IDs

    let painting = null;
    let source = 'random';
    
    // If user has saved paintings, use 50/50 logic
    if (hasSavedPaintings) {
      const useRecommendation = Math.random() < 0.6;
      console.log(useRecommendation);
      if (useRecommendation) {
        // Try to get ChromaDB recommendation
        painting = await getChromaRecommendation(userId, savedPaintings, visitedIds);
        if (painting) {
          source = 'chromadb';
        }
        console.log(`painting ${painting}`)
      }
    }
    
    // If no painting from ChromaDB or user has no saved paintings, get random painting
    if (!painting) {
      const randomPaintings = await collection.aggregate([
        { $match: { _id: { $nin: visitedObjectIds } } },
        { $sample: { size: 1 } }
      ]).toArray();

      if (randomPaintings.length > 0) {
        painting = randomPaintings[0];
        source = 'random';
      } else {
        // If all paintings have been viewed, send an error message
        return res.status(404).json({ message: 'You have viewed all available paintings!' });
      }
    }

    const paintingWithUrl = {
      ...painting,
      _id: painting._id, // Convert _id to string for ChromaDB compatibility
      artist: painting.author, // Map author to artist
      imageUrl: process.env.S3_BASE_URL + painting.images,
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



// Start persistent ChromaDB recommendation service
let chromaRecommendationService = null;
let isChromaServiceReady = false;

function startChromaRecommendationService() {
  // Use virtual environment if available, otherwise system python
  const pythonPath = process.env.CHROMA_PYTHON_PATH || './recommend/chroma_env/bin/python';
  const chromaDir = process.env.CHROMA_DB_DIR || './chroma_db';
  
  chromaRecommendationService = spawn(pythonPath, [
    'recommend/chroma_recommendation_service.py',
    '--chroma-dir', chromaDir
  ], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });

  chromaRecommendationService.stderr.on('data', (data) => {
    const message = data.toString();
    console.log('🐍 ChromaDB stderr:', message);
    if (message.includes('ready. Waiting for requests')) {
      isChromaServiceReady = true;
      console.log('✅ ChromaDB service is now ready');
    }
  });

  chromaRecommendationService.on('close', (code) => {
    isChromaServiceReady = false;
    setTimeout(() => {
      if (!isChromaServiceReady) {
        startChromaRecommendationService();
      }
    }, 2000);
  });
}

// Start ChromaDB service
startChromaRecommendationService();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  if (chromaRecommendationService) {
    chromaRecommendationService.kill();
  }
  process.exit(0);
});

// Helper function to get user's liked paintings from MongoDB
async function getUserLikedPaintings(userId) {
  try {
    const collection = db.collection("user_paintings");
    const likedPaintings = await collection.find({ userId }).toArray();
    return likedPaintings.map(painting => painting._id.toString());
  } catch (error) {
    console.error('Error fetching user liked paintings:', error);
    return [];
  }
}

// Helper function to get user's viewed paintings from Redis
async function getUserViewedPaintings(userId) {
  try {
    const viewedIds = await redisClient.sMembers(`visited:${userId}`);
    return viewedIds.filter(id => id && id.length > 0);
  } catch (error) {
    console.error('Error fetching user viewed paintings:', error);
    return [];
  }
}

// ChromaDB recommendation endpoint
app.post('/recommend', async (req, res) => {
  const userId = req.userId;
  
  try {
    // Check if ChromaDB service is ready
    if (!isChromaServiceReady) {
      return res.status(503).json({ 
        error: 'ChromaDB recommendation service not ready',
        source: 'chromadb_unavailable'
      });
    }
    
    return await handleChromaRecommendation(req, res);
    
  } catch (error) {
    console.error('Error in recommendation endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// ChromaDB recommendation handler
async function handleChromaRecommendation(req, res) {
  const { liked_paintings, count = 10, action = 'recommend' } = req.body;
  const userId = req.userId;
  
  try {
    // Get user's liked paintings if not provided
    let likedPaintingIds = liked_paintings;
    if (!likedPaintingIds || likedPaintingIds.length === 0) {
      likedPaintingIds = await getUserLikedPaintings(userId);
    }
    
    // If user has no liked paintings, return empty recommendations
    if (!likedPaintingIds || likedPaintingIds.length === 0) {
      return res.json({
        recommendations: [],
        source: 'chromadb',
        message: 'No liked paintings found for user',
        user_liked_count: 0
      });
    }
    
    // Get user's viewed paintings to exclude
    const viewedPaintingIds = await getUserViewedPaintings(userId);
    
    // Prepare ChromaDB request
    const chromaRequest = {
      action: action,
      liked_paintings: likedPaintingIds,
      exclude_paintings: viewedPaintingIds,
      count: count
    };
    
    let responseData = '';
    
    const timeout = setTimeout(() => {
      res.status(500).json({ error: 'ChromaDB recommendation timeout' });
    }, 10000); // Longer timeout for ChromaDB
    
    // Set up response handler
    const responseHandler = async (data) => {
      responseData += data.toString();
      
      try {
        const response = JSON.parse(responseData);
        clearTimeout(timeout);
        chromaRecommendationService.stdout.removeListener('data', responseHandler);
        
        if (response.error) {
          return res.status(500).json({ 
            error: response.error,
            source: 'chromadb_error'
          });
        } else {
          // Enhance response with painting details from MongoDB
          await enhanceRecommendationsWithDetails(response);
          res.json(response);
        }
      } catch (e) {
        console.error('Error parsing ChromaDB response:', e);
        clearTimeout(timeout);
        res.status(500).json({ error: 'Failed to parse ChromaDB response' });
      }
    };
    
    chromaRecommendationService.stdout.on('data', responseHandler);
    chromaRecommendationService.stdin.write(JSON.stringify(chromaRequest) + '\n');
    
  } catch (error) {
    console.error('Error in ChromaDB recommendation:', error);
    res.status(500).json({ error: error.message });
  }
}

// Helper function to enhance recommendations with painting details from MongoDB
async function enhanceRecommendationsWithDetails(response) {
  try {
    if (!response.recommendations || response.recommendations.length === 0) {
      return;
    }
    
    // Get painting IDs
    const paintingIds = response.recommendations.map(rec => {
      try {
        return new ObjectId(rec.mongodb_id || rec._id);
      } catch (e) {
        // If ObjectId conversion fails, try as string
        return rec.mongodb_id || rec._id;
      }
    });
    
    // Fetch painting details from MongoDB
    const collection = db.collection("artworks");
    const paintings = await collection.find({ 
      _id: { $in: paintingIds } 
    }).toArray();
    
    // Create a map for quick lookup
    const paintingMap = new Map();
    paintings.forEach(painting => {
      paintingMap.set(painting._id.toString(), painting);
    });
    
    // Enhance recommendations with details
    response.recommendations.forEach(rec => {
      const paintingId = rec.mongodb_id || rec._id;
      const paintingDetails = paintingMap.get(paintingId);
      
      if (paintingDetails) {
        rec.title = paintingDetails.title || '';
        rec.artist = paintingDetails.author || paintingDetails.artist || '';
        rec.year = paintingDetails.year || null;
        rec.imageUrl = process.env.S3_BASE_URL + paintingDetails.images;
        rec.style = paintingDetails.style || '';
        rec.genre = paintingDetails.genre || '';
      }
    });
    
  } catch (error) {
    console.error('Error enhancing recommendations with details:', error);
    // Don't fail the request if enhancement fails
  }
}

// New endpoint specifically for ChromaDB recommendations
app.post('/recommend/chroma', async (req, res) => {
  if (!isChromaServiceReady) {
    return res.status(503).json({ 
      error: 'ChromaDB recommendation service not ready',
      source: 'chromadb_unavailable'
    });
  }
  
  return await handleChromaRecommendation(req, res);
});


// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
