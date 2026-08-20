import Database from 'better-sqlite3';

export type DB = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  vehicle TEXT,
  seats INTEGER,
  bio TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES users(id),
  pickup_label TEXT NOT NULL,
  pickup_lat REAL NOT NULL,
  pickup_lng REAL NOT NULL,
  dropoff_label TEXT NOT NULL,
  dropoff_lat REAL NOT NULL,
  dropoff_lng REAL NOT NULL,
  seats_total INTEGER NOT NULL CHECK (seats_total BETWEEN 1 AND 7),
  seats_available INTEGER NOT NULL CHECK (seats_available BETWEEN 0 AND 7),
  status TEXT NOT NULL CHECK (status IN ('active','in_progress','completed','cancelled')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_driver ON trips(driver_id);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  rider_id TEXT NOT NULL REFERENCES users(id),
  trip_id TEXT REFERENCES trips(id),
  pickup_label TEXT NOT NULL,
  pickup_lat REAL NOT NULL,
  pickup_lng REAL NOT NULL,
  dropoff_label TEXT NOT NULL,
  dropoff_lat REAL NOT NULL,
  dropoff_lng REAL NOT NULL,
  seats INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 7),
  fare REAL NOT NULL CHECK (fare >= 0),
  status TEXT NOT NULL CHECK (status IN ('pending','matched','in_progress','completed','cancelled')),
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_rider ON requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_requests_trip ON requests(trip_id);

CREATE TABLE IF NOT EXISTS ratings (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id),
  rater_id TEXT NOT NULL REFERENCES users(id),
  ratee_id TEXT NOT NULL REFERENCES users(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (trip_id, rater_id, ratee_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_ratee ON ratings(ratee_id);
CREATE INDEX IF NOT EXISTS idx_ratings_trip ON ratings(trip_id);
`;

export function openDb(path: string = ':memory:'): DB {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
