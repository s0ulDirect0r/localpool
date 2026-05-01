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
  seats_total INTEGER NOT NULL,
  seats_available INTEGER NOT NULL,
  status TEXT NOT NULL,
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
  seats INTEGER NOT NULL,
  fare REAL NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_rider ON requests(rider_id);
CREATE INDEX IF NOT EXISTS idx_requests_trip ON requests(trip_id);
`;

export function openDb(path: string = ':memory:'): DB {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
