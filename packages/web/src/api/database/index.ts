import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

function makeDb() {
  const client = createClient({
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

export const db = makeDb();

// Wrap any db operation with auto-reconnect on ECONNRESET
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    if (e?.cause?.code === 'ECONNRESET' || e?.code === 'ECONNRESET') {
      console.log("[db] ECONNRESET — retrying with fresh client");
      const freshDb = makeDb();
      // swap internals
      Object.assign(db, freshDb);
      return await fn();
    }
    throw e;
  }
}
