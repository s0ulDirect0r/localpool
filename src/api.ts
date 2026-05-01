import type { Location, Mode, RideStatus, ServerActiveRider, ServerActiveDriver, ServerHistoryItem, ServerMatch, ServerRequestRow, ServerTripRow, ServerUser } from './types';

const DEFAULT_BASE = 'http://localhost:4000';

export const API_BASE_URL: string =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? DEFAULT_BASE;

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? `${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (init.token) headers['authorization'] = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (e) {
    throw new ApiError(0, 'network_error', (e as Error).message);
  }
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data && data.error) || `http_${res.status}`,
      typeof data === 'string' ? data : undefined,
    );
  }
  return data as T;
}

// ---------- Auth ----------
export type AuthResponse = { token: string; user: ServerUser };

export const api = {
  signup: (body: { name: string; email: string; phone: string; password: string }) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body }),
  signin: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/signin', { method: 'POST', body }),
  me: (token: string) => request<{ user: ServerUser }>('/me', { token }),
  updateMe: (
    token: string,
    patch: Partial<Pick<ServerUser, 'name' | 'phone' | 'vehicle' | 'seats'>>,
  ) => request<{ user: ServerUser }>('/me', { method: 'PATCH', body: patch, token }),

  // Rider
  riderRequest: (
    token: string,
    body: { pickup: Location; dropoff: Location; seats: number },
  ) => request<{ request: ServerRequestRow }>('/rider/request', { method: 'POST', body, token }),
  riderMatches: (token: string) =>
    request<{ matches: ServerMatch[]; request: ServerRequestRow }>('/rider/matches', { token }),
  riderJoin: (token: string, tripId: string) =>
    request<{ request: ServerRequestRow; trip: ServerTripRow }>('/rider/join', {
      method: 'POST',
      body: { trip_id: tripId },
      token,
    }),
  riderActive: (token: string) =>
    request<{ active: ServerActiveRider | null }>('/rider/active', { token }),
  riderCancel: (token: string) =>
    request<{ ok: boolean }>('/rider/cancel', { method: 'POST', token }),

  // Driver
  driverTrip: (
    token: string,
    body: { pickup: Location; dropoff: Location; seats: number },
  ) => request<{ trip: ServerTripRow }>('/driver/trip', { method: 'POST', body, token }),
  driverRequests: (token: string) =>
    request<{
      trip: ServerTripRow;
      requests: { request: ServerRequestRow & { rider: ServerUser }; score: number }[];
    }>('/driver/requests', { token }),
  driverAccept: (token: string, requestId: string) =>
    request<{ trip: ServerTripRow; request: ServerRequestRow }>('/driver/accept', {
      method: 'POST',
      body: { request_id: requestId },
      token,
    }),
  driverStart: (token: string) =>
    request<{ trip: ServerTripRow }>('/driver/start', { method: 'POST', token }),
  driverComplete: (token: string) =>
    request<{ trip: ServerTripRow }>('/driver/complete', { method: 'POST', token }),
  driverCancel: (token: string) =>
    request<{ ok: boolean }>('/driver/cancel', { method: 'POST', token }),
  driverActive: (token: string) =>
    request<{ active: ServerActiveDriver | null }>('/driver/active', { token }),

  // Shared
  history: (token: string) =>
    request<{ history: ServerHistoryItem[] }>('/rides/history', { token }),
};

export type _ApiKeys = keyof typeof api;
export type Mode_ = Mode;
export type RideStatus_ = RideStatus;
