export type Mode = 'rider' | 'driver';

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle?: string;
  seats?: number;
};

export type Location = {
  label: string;
  lat: number;
  lng: number;
};

export type RideStatus =
  | 'searching'
  | 'matched'
  | 'driver_en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type Passenger = {
  id: string;
  name: string;
  pickup: Location;
  dropoff: Location;
  seats: number;
  fare: number;
};

export type Driver = {
  id: string;
  name: string;
  rating: number;
  vehicle: string;
  etaMinutes: number;
  seatsLeft: number;
  totalSeats: number;
  detourMinutes: number;
  fare: number;
  route: string;
};

export type Ride = {
  id: string;
  role: Mode;
  status: RideStatus;
  pickup: Location;
  dropoff: Location;
  seats: number;
  fare: number;
  createdAt: number;
  driver?: Driver;
  passengers?: Passenger[];
  etaMinutes?: number;
  progressPct?: number;
};

export type Screen =
  | 'welcome'
  | 'signup'
  | 'home'
  | 'rider_request'
  | 'rider_matches'
  | 'driver_requests'
  | 'driver_setup'
  | 'active_ride'
  | 'history'
  | 'profile';
