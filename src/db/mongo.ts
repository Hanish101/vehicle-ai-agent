import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as {
  _mongo?: MongoClient;
  _mongoIndexes?: Promise<void>;
};

export async function getDb(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Account store unavailable");
  }
  if (!globalForMongo._mongo) {
    const client = new MongoClient(uri);
    await client.connect();
    globalForMongo._mongo = client;
  }
  const db = globalForMongo._mongo.db(process.env.MONGODB_DB || "mahindra");
  if (!globalForMongo._mongoIndexes) {
    globalForMongo._mongoIndexes = db
      .collection("users")
      .createIndex({ email: 1 }, { unique: true })
      .then(() => undefined);
  }
  await globalForMongo._mongoIndexes;
  return db;
}
