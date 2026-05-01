import type { Location } from '../types';

export const SAVED_PLACES: Location[] = [
  { label: 'Home', lat: 37.7749, lng: -122.4194 },
  { label: 'Work', lat: 37.7858, lng: -122.4065 },
  { label: 'Gym', lat: 37.7694, lng: -122.4862 },
  { label: 'Airport (SFO)', lat: 37.6213, lng: -122.379 },
  { label: 'University', lat: 37.8719, lng: -122.2585 },
  { label: 'Caltrain Station', lat: 37.7766, lng: -122.3947 },
];

function distanceMiles(a: Location, b: Location): number {
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy) * 69;
}

export function estimateFare(pickup: Location, dropoff: Location, shared: boolean): number {
  const miles = Math.max(1.2, distanceMiles(pickup, dropoff));
  const base = 2.5 + miles * 1.4;
  return +(base * (shared ? 0.55 : 0.85)).toFixed(2);
}

export function distanceLabel(pickup: Location, dropoff: Location): string {
  return `${distanceMiles(pickup, dropoff).toFixed(1)} mi`;
}
