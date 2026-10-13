// Supabase access with the anon key: facilities/listings via REST, device/watch via the RPCs in
// supabase/migrations/20261013010000_push.sql (the app identifies itself by its push token).

export interface Facility {
  id: string;
  name: string;
  district: string | null;
  address: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  indoor: boolean | null;
}

export interface Listing {
  svc_id: string;
  facility_id: string;
  title: string;
  status: string | null;
  day_type: string | null;
  time_band: string | null;
  period_start: string | null;
  period_end: string | null;
  paid: boolean | null;
  price_note: string | null;
  receipt_start: string | null;
  receipt_end: string | null;
  url: string | null;
  updated_at: string;
  court: { id: string; label: string } | null;
}

export type EventKind = 'new_listing' | 'receipt_open' | 'status_change';

export interface WatchInput {
  facility_ids: string[] | null;
  court_ids: string[] | null;
  day_types: string[] | null;
  time_bands: string[] | null;
  events: EventKind[];
  enabled: boolean;
}

export interface Watch extends WatchInput {
  id: string;
}

export interface SentNotification {
  id: number;
  title: string;
  body: string;
  url: string | null;
  sent_at: string;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

async function request<T>(path: string, body?: unknown): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('apps/mobile/.env에 Supabase 값이 없습니다');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`요청 실패 (HTTP ${res.status})`);
  return (text ? JSON.parse(text) : null) as T;
}

const rpc = <T>(fn: string, args: object) => request<T>(`rpc/${fn}`, args);

export const fetchFacilities = () =>
  request<Facility[]>('facility?select=id,name,district,address,phone,lat,lng,image_url,indoor&order=name');

export function fetchListings(): Promise<Listing[]> {
  const select =
    'svc_id,facility_id,title,status,day_type,time_band,period_start,period_end,paid,price_note,' +
    'receipt_start,receipt_end,url,updated_at,court(id,label)';
  return request(`listing?select=${encodeURIComponent(select)}&gone_at=is.null&order=svc_id`);
}

export const registerDevice = (token: string, platform: string) =>
  rpc<null>('register_device', { p_token: token, p_platform: platform });

export const myWatches = (token: string) => rpc<Watch[]>('my_watches', { p_token: token });

export const myNotifications = (token: string) => rpc<SentNotification[]>('my_notifications', { p_token: token });

export async function quietEnabled(token: string): Promise<boolean> {
  const [row] = await rpc<{ quiet_enabled: boolean }[]>('my_settings', { p_token: token });
  return row?.quiet_enabled ?? true;
}

export const setQuiet = (token: string, enabled: boolean) =>
  rpc<null>('set_quiet', { p_token: token, p_enabled: enabled });

// Inserts when id is null, otherwise updates the device's own watch. Returns the watch id.
export const saveWatch = (token: string, id: string | null, w: WatchInput) =>
  rpc<string>('save_watch', {
    p_token: token,
    p_id: id,
    p_facility_ids: w.facility_ids,
    p_court_ids: w.court_ids,
    p_day_types: w.day_types,
    p_time_bands: w.time_bands,
    p_events: w.events,
    p_enabled: w.enabled,
  });

export const deleteWatch = (token: string, id: string) => rpc<null>('delete_watch', { p_token: token, p_id: id });
