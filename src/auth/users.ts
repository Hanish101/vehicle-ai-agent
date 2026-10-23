import { ObjectId } from "mongodb";
import { getDb } from "@/db/mongo";
import { hashPassword, verifyPassword } from "./password";

export type PublicUser = {
  id: string;
  name: string;
  email: string;
};

type UserDoc = {
  _id: ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
};

function toPublic(doc: Pick<UserDoc, "_id" | "name" | "email">): PublicUser {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    email: doc.email,
  };
}

let dummyHash: Promise<string> | null = null;

function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword("not-a-real-password");
  return dummyHash;
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  const doc = await db
    .collection<UserDoc>("users")
    .findOne(
      { _id: new ObjectId(id) },
      { projection: { name: 1, email: 1 } },
    );
  return doc ? toPublic(doc) : null;
}

export async function verifyLogin(
  email: string,
  password: string,
): Promise<PublicUser | null> {
  const db = await getDb();
  const doc = await db.collection<UserDoc>("users").findOne({ email });
  const hash = doc?.passwordHash ?? (await dummyPasswordHash());
  const ok = await verifyPassword(password, hash);
  if (!doc || !ok) return null;
  return toPublic(doc);
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<PublicUser | "exists"> {
  const db = await getDb();
  try {
    const result = await db.collection<UserDoc>("users").insertOne({
      _id: new ObjectId(),
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(input.password),
      createdAt: new Date(),
    });
    return {
      id: result.insertedId.toHexString(),
      name: input.name,
      email: input.email,
    };
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      return "exists";
    }
    throw err;
  }
}
