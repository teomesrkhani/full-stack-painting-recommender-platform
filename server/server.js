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

// Recommendation endpoint
app.post('/recommend', (req, res) => {
  const { artists, counts } = req.body;
  
  const pythonProcess = spawn('python3.10', [
    'recommend/recommend.py',
    '--artists', artists.join(','),
    '--weights', counts.join(','),
    '--model', '/Users/teomesrkhani/full-stack-painting-recommender-platform/server/recommend/artist_recommender.pt'
  ]);
  
  let recommendations = '';
  let error = '';
  
  pythonProcess.stdout.on('data', (data) => {
    recommendations += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    error += data.toString();
    console.error(`Python error: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    if(code !== 0 || error) {
      console.error('Recommendation failed with error:', error);
      return res.status(500).json({ error: 'Recommendation failed' });
    }
    
    try {
      res.json(JSON.parse(recommendations));
    } catch(e) {
      console.error(e);
      res.status(500).json({ error: 'Invalid recommendation output' });
    }
  });
});


// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
