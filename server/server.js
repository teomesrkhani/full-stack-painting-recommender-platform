// server.js
import express from "express";
import cors from "cors";
import records from "./routes/record.js";
import { spawn } from 'child_process';

const PORT = process.env.PORT || 5050;
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/record", records);

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
