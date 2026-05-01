import type { Driver, Location, Passenger } from '../types';

export const SAVED_PLACES: Location[] = [
  { label: 'Home', lat: 37.7749, lng: -122.4194 },
  { label: 'Work', lat: 37.7858, lng: -122.4065 },
  { label: 'Gym', lat: 37.7694, lng: -122.4862 },
  { label: 'Airport (SFO)', lat: 37.6213, lng: -122.379 },
  { label: 'University', lat: 37.8719, lng: -122.2585 },
  { label: 'Caltrain Station', lat: 37.7766, lng: -122.3947 },
];

const DRIVER_NAMES = [
  'Maya R.',
  'Daniel K.',
  'Priya S.',
  'Carlos M.',
  'Jordan P.',
  'Aisha T.',
];

const VEHICLES = [
  'Toyota Prius (Silver)',
  'Honda Civic (Blue)',
  'Tesla Model 3 (White)',
  'Ford Escape (Black)',
  'Subaru Outback (Green)',
  'Hyundai Ioniq (Gray)',
];

const ROUTES = [
  'Mission → SoMa → FiDi',
  'Sunset → Downtown',
  'Berkeley → Oakland → SF',
  'Daly City → SF',
  'Marina → FiDi',
  'Castro → SoMa',
];

function distanceMiles(a: Location, b: Location): number {
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy) * 69;
}

function rand(seed: number): () => number {
  let s = seed || 1;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateDriverMatches(
  pickup: Location,
  dropoff: Location,
  seats: number,
): Driver[] {
  const miles = Math.max(1.2, distanceMiles(pickup, dropoff));
  const baseFare = 2.5 + miles * 1.4;
  const seed =
    Math.abs(Math.floor((pickup.lat + dropoff.lat) * 1000)) +
    Math.abs(Math.floor((pickup.lng + dropoff.lng) * 1000));
  const rng = rand(seed);

  const count = 4;
  const drivers: Driver[] = [];
  for (let i = 0; i < count; i++) {
    const totalSeats = 3 + Math.floor(rng() * 2);
    const occupied = Math.floor(rng() * (totalSeats - seats + 1));
    const seatsLeft = totalSeats - occupied;
    const detour = Math.floor(rng() * 8) + 1;
    const eta = 2 + Math.floor(rng() * 9);
    const sharedDiscount = occupied > 0 ? 0.55 : 0.85;
    const fare = +(baseFare * sharedDiscount).toFixed(2);
    drivers.push({
      id: `drv_${i}_${seed}`,
      name: DRIVER_NAMES[(i + seed) % DRIVER_NAMES.length],
      rating: +(4.5 + rng() * 0.5).toFixed(2),
      vehicle: VEHICLES[(i + seed) % VEHICLES.length],
      etaMinutes: eta,
      seatsLeft,
      totalSeats,
      detourMinutes: detour,
      fare,
      route: ROUTES[(i + seed) % ROUTES.length],
    });
  }
  return drivers
    .filter((d) => d.seatsLeft >= seats)
    .sort((a, b) => a.fare - b.fare);
}

const PASSENGER_NAMES = [
  'Alex',
  'Sam',
  'Riley',
  'Jamie',
  'Taylor',
  'Morgan',
  'Casey',
  'Jordan',
];

export function generatePassengerRequests(
  driverPickup: Location,
  driverDropoff: Location,
  seed = Date.now(),
): Passenger[] {
  const rng = rand(seed);
  const count = 3 + Math.floor(rng() * 3);
  const requests: Passenger[] = [];
  for (let i = 0; i < count; i++) {
    const placeA = SAVED_PLACES[Math.floor(rng() * SAVED_PLACES.length)];
    const placeB = SAVED_PLACES[Math.floor(rng() * SAVED_PLACES.length)];
    if (placeA.label === placeB.label) continue;
    const miles = Math.max(1.2, distanceMiles(placeA, placeB));
    const fare = +(2.5 + miles * 0.9).toFixed(2);
    requests.push({
      id: `pax_${i}_${seed}`,
      name: PASSENGER_NAMES[Math.floor(rng() * PASSENGER_NAMES.length)],
      pickup: placeA,
      dropoff: placeB,
      seats: 1 + Math.floor(rng() * 2),
      fare,
    });
  }
  return requests;
}

export function estimateFare(pickup: Location, dropoff: Location, shared: boolean): number {
  const miles = Math.max(1.2, distanceMiles(pickup, dropoff));
  const base = 2.5 + miles * 1.4;
  return +(base * (shared ? 0.55 : 0.85)).toFixed(2);
}

export function distanceLabel(pickup: Location, dropoff: Location): string {
  const m = distanceMiles(pickup, dropoff);
  return `${m.toFixed(1)} mi`;
}
