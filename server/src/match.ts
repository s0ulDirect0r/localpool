import type { Location, RequestRow, TripRow } from './types.js';

export function distanceMiles(a: Location, b: Location): number {
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy) * 69;
}

export function estimateFare(
  pickup: Location,
  dropoff: Location,
  shared: boolean,
): number {
  const miles = Math.max(1.2, distanceMiles(pickup, dropoff));
  const base = 2.5 + miles * 1.4;
  return +(base * (shared ? 0.55 : 0.85)).toFixed(2);
}

// Score a trip against a request: lower is better.
// We use the sum of (rider pickup ↔ trip pickup) and (rider dropoff ↔ trip dropoff)
// distances as a rough "detour" proxy. Reject if dropoffs are far apart.
export function scoreTripForRequest(trip: TripRow, req: RequestRow): number {
  const pickupDelta = distanceMiles(
    { label: '', lat: trip.pickup_lat, lng: trip.pickup_lng },
    { label: '', lat: req.pickup_lat, lng: req.pickup_lng },
  );
  const dropoffDelta = distanceMiles(
    { label: '', lat: trip.dropoff_lat, lng: trip.dropoff_lng },
    { label: '', lat: req.dropoff_lat, lng: req.dropoff_lng },
  );
  return pickupDelta + dropoffDelta;
}
