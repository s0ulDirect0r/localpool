export type Mode = 'rider' | 'driver';

export type Location = {
  label: string;
  lat: number;
  lng: number;
};

export type RideStatus =
  | 'pending'
  | 'matched'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'active';

export type Screen =
  | 'welcome'
  | 'signup'
  | 'signin'
  | 'home'
  | 'rider_request'
  | 'rider_matches'
  | 'driver_setup'
  | 'driver_requests'
  | 'active_ride'
  | 'history'
  | 'profile';

// ----- Server-shaped types (snake_case to mirror SQLite rows) -----

export type ServerUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string | null;
  seats: number | null;
};

export type ServerTripRow = {
  id: string;
  driver_id: string;
  pickup_label: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_label: string;
  dropoff_lat: number;
  dropoff_lng: number;
  seats_total: number;
  seats_available: number;
  status: 'active' | 'in_progress' | 'completed' | 'cancelled';
  created_at: number;
  driver?: ServerUser | null;
};

export type ServerRequestRow = {
  id: string;
  rider_id: string;
  trip_id: string | null;
  pickup_label: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_label: string;
  dropoff_lat: number;
  dropoff_lng: number;
  seats: number;
  fare: number;
  status: 'pending' | 'matched' | 'in_progress' | 'completed' | 'cancelled';
  created_at: number;
  rider?: ServerUser | null;
};

export type ServerMatch = {
  trip: ServerTripRow & { driver: ServerUser | null };
  score: number;
  fare: number;
};

export type ServerActiveRider = {
  request: ServerRequestRow;
  trip: (ServerTripRow & { driver: ServerUser | null }) | null;
};

export type ServerActiveDriver = {
  trip: ServerTripRow;
  requests: (ServerRequestRow & { rider: ServerUser | null })[];
};

export type ServerHistoryItem = {
  kind: 'rider' | 'driver';
  id: string;
  pickup_label: string;
  dropoff_label: string;
  seats: number;
  fare: number;
  status: 'completed' | 'cancelled';
  created_at: number;
  trip?: ServerTripRow | null;
  passenger_count?: number;
};
