export type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  vehicle: string | null;
  seats: number | null;
  bio: string | null;
  created_at: number;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string | null;
  seats: number | null;
  bio: string | null;
};

export type ProfileSummary = PublicUser & {
  rating_avg: number | null;
  rating_count: number;
  rides_as_rider: number;
  rides_as_driver: number;
};

export type RatingRow = {
  id: string;
  trip_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  comment: string | null;
  created_at: number;
};

export type TripStatus = 'active' | 'in_progress' | 'completed' | 'cancelled';
export type RequestStatus =
  | 'pending'
  | 'matched'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type TripRow = {
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
  status: TripStatus;
  created_at: number;
};

export type RequestRow = {
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
  status: RequestStatus;
  created_at: number;
};

export type Location = {
  label: string;
  lat: number;
  lng: number;
};
