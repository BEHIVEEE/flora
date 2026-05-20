import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME && process.env.DB_NAME !== 'your_database_name'
  ? process.env.DB_NAME
  : 'chemistshop';

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  client = new MongoClient(uri, { connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000, maxPoolSize: 10, minPoolSize: 1 });
  global._mongoClientPromise = client.connect();
}
clientPromise = global._mongoClientPromise;

export async function getDb() {
  const c = await clientPromise;
  return c.db(dbName);
}
