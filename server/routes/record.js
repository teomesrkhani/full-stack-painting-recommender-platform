import express from "express";
import db from "../db/connection.js";
import { ObjectId } from "mongodb";

const router = express.Router();

// Get all liked paintings
router.get("/", async (req, res) => {
  try {
    let collection = await db.collection("likedPaintings");
    let results = await collection.find({}).sort({ likedTimestamp: -1 }).toArray();
    res.send(results).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching liked paintings");
  }
});

// Add a liked painting
router.post("/", async (req, res) => {
  try {
    const { title, artist, url } = req.body;
    
    // Check if painting already exists
    let collection = await db.collection("likedPaintings");
    const existingPainting = await collection.findOne({ url });
    
    if (existingPainting) {
      return res.status(200).send(existingPainting);
    }
    
    let newDocument = {
      title,
      artist,
      url,
      likedTimestamp: Date.now()
    };
    
    let result = await collection.insertOne(newDocument);
    res.send({ ...newDocument, _id: result.insertedId }).status(201);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error adding liked painting");
  }
});

// Check if a painting is liked by URL
router.get("/check/:url", async (req, res) => {
  try {
    const url = decodeURIComponent(req.params.url);
    let collection = await db.collection("likedPaintings");
    let result = await collection.findOne({ url });
    res.send({ liked: !!result, painting: result }).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error checking liked painting");
  }
});

// Remove a liked painting by ID
router.delete("/:id", async (req, res) => {
  try {
    const query = { _id: new ObjectId(req.params.id) };
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

// Get unique artists with counts
router.get("/artists", async (req, res) => {
  try {
    let collection = await db.collection("likedPaintings");
    let pipeline = [
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

// Check if there are any liked records
router.get("/hasRecords", async (req, res) => {
  try {
    let collection = await db.collection("likedPaintings");
    let count = await collection.countDocuments();
    res.send({ hasRecords: count > 0 }).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error checking for liked records");
  }
});

export default router;
