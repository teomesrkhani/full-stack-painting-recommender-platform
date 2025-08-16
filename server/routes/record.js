import express from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// Get all liked paintings for the current user
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }
    
    let collection = await db.collection("likedPaintings");
    let results = await collection.find({ userId }).sort({ likedTimestamp: -1 }).toArray();
    res.send(results).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching liked paintings");
  }
});

// Add a liked painting for the current user
router.post("/", async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }
    
    const { title, artist, url, imageUrl, originalUrl } = req.body;
    
    // Check if painting already exists for this user
    let collection = await db.collection("likedPaintings");
    const existingPainting = await collection.findOne({ userId, imageUrl: imageUrl || url });
    
    if (existingPainting) {
      return res.status(200).send(existingPainting);
    }
    
    let newDocument = {
      userId,
      title,
      artist,
      url: imageUrl || url, // Use imageUrl as primary URL
      imageUrl: imageUrl || url,
      originalUrl: originalUrl || url,
      likedTimestamp: Date.now()
    };
    
    let result = await collection.insertOne(newDocument);
    res.send({ ...newDocument, _id: result.insertedId }).status(201);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding liked painting");
  }
});

// Check if a painting is liked by URL for the current user
router.get("/check/:url", async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }
    
    const url = decodeURIComponent(req.params.url);
    let collection = await db.collection("likedPaintings");
    let result = await collection.findOne({ userId, $or: [{ url }, { imageUrl: url }] });
    res.send({ liked: !!result, painting: result }).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error checking liked painting");
  }
});

// Remove a liked painting by ID for the current user
router.delete("/:id", async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }
    
    const query = { _id: new ObjectId(req.params.id), userId };
    const collection = db.collection("likedPaintings");
    let result = await collection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).send("Painting not found");
    }

    res.send({ deletedCount: result.deletedCount }).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting liked painting");
  }
});

// Get unique artists with counts for the current user
router.get("/artists", async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }
    
    let collection = await db.collection("likedPaintings");
    let pipeline = [
      {
        $match: { userId }
      },
      {
        $group: {
          _id: "$artist",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ];
    
    let results = await collection.aggregate(pipeline).toArray();
    
    const artists = results.map(r => r._id);
    const counts = results.map(r => r.count);
    
    res.send({ artists, counts }).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching artist counts");
  }
});

// Check if there are any liked records for the current user
router.get("/hasRecords", async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'No user ID found' });
    }
    
    let collection = await db.collection("likedPaintings");
    let count = await collection.countDocuments({ userId });
    res.send({ hasRecords: count > 0 }).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error checking for liked records");
  }
});

export default router;
