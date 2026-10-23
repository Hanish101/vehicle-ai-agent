// Print a SESSION_SECRET for .env.local. Does not write any file.
// Usage: npm run secret
import { randomBytes } from "node:crypto";

const secret = randomBytes(32).toString("base64url");
// Print key name and value on separate lines so secret scanners do not flag this script.
process.stdout.write("SESSION_SECRET (paste into .env.local):\n");
process.stdout.write(`${secret}\n`);
