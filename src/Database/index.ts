import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { TokenModel, IToken, TokenInput, TokenAttrs } from './models/token';

let cached = globalThis as any;
if (!cached._mongoose) {
  cached._mongoose = { conn: null, promise: null };
}

export async function connectDB(mongoUri?: string) {
  // Respect ENVIRONMENT: if running in 'dev' or 'debug', prefer DOCKER_URI for local Docker workflows.
  // Otherwise prefer canonical MONGO_URI, then MONGODB_URI, then DOCKER_URI as a last resort.
  const env = process.env.ENVIRONMENT as string;
  let uri: string | undefined;
  if (mongoUri) uri = mongoUri;
  else if (env === 'dev' || env === 'debug') {
    uri = process.env.DOCKER_URI;
  } else {
    uri = process.env.MONGO_URI;
  }

  if (!uri) throw new Error('MongoDB connection string not set (expected MONGO_URI or MONGODB_URI or DOCKER_URI)');

  if (cached._mongoose.conn) {
    return cached._mongoose.conn;
  }

  if (!cached._mongoose.promise) {
    cached._mongoose.promise = mongoose.connect(uri).then((m) => m.connection);
  }
  cached._mongoose.conn = await cached._mongoose.promise;
  return cached._mongoose.conn;
}

export function getMongoose() {
  return mongoose;
}

export { TokenModel };
export type { IToken, TokenInput, TokenAttrs };

// Automatically attempt to connect when this module is imported if `MONGO_URI` is set.
// Export `dbReady` so callers can await the connection if they need to.
let dbReady: Promise<mongoose.Connection | null>;
// Choose autoUri according to ENVIRONMENT (prefer DOCKER_URI for dev/debug)
const envName = (process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? '').toLowerCase();
let autoUri: string | undefined;
if (envName === 'dev' || envName === 'debug') {
  autoUri = process.env.DOCKER_URI ?? process.env.MONGO_URI ?? process.env.MONGODB_URI;
} else {
  autoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI ?? process.env.DOCKER_URI;
}
if (autoUri) {
  // Log which environment variable provided the URI (redacted) to help debugging without exposing secrets.
  const chosenSource = envName === 'dev' || envName === 'debug'
    ? process.env.DOCKER_URI ? 'DOCKER_URI' : process.env.MONGO_URI ? 'MONGO_URI' : 'MONGODB_URI'
    : process.env.MONGO_URI ? 'MONGO_URI' : process.env.MONGODB_URI ? 'MONGODB_URI' : 'DOCKER_URI';
  const redacted = (u: string | undefined) => {
    if (!u) return '';
    try {
      // Redact password if present: mongodb://user:pass@host
      return u.replace(/:\/\/(.*?):.*?@/, '://$1:REDACTED@');
    } catch {
      return 'REDACTED';
    }
  };
  console.log(`Using MongoDB URI from ${chosenSource}: ${redacted(autoUri)}`);

  dbReady = connectDB(autoUri)
    .then((conn) => {
      console.log('MongoDB connected (auto)');
      return conn;
    })
    .catch((err) => {
      console.error('MongoDB auto-connect failed:', err?.message || err);
      throw err;
    });
} else {
  dbReady = Promise.resolve(null);
  console.warn('MongoDB URI not set — MongoDB will not auto-connect. Set MONGO_URI or MONGODB_URI or DOCKER_URI.');
}

export { dbReady };
