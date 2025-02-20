// db/connection.js
import { MongoClient, ServerApiVersion } from "mongodb";

const uri = process.env.ATLAS_URI || "";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Modified connection handler
export async function connectToDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. Successfully connected to MongoDB!");
    return client.db("paintings");
  } catch(err) {
    console.error("Connection error:", err);
    throw err;
  }
}

let db = client.db("paintings");

export default db;