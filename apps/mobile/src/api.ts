// Supabase access with the anon key: listings via REST, device/watch via the RPCs in
// supabase/migrations/20261013010000_push.sql (the app identifies itself by its push token).

export interface Listing {
  svc_id: string;
  title: string;
  status: string | null;
  day_type: string | null;
  time_band: string | null;
  period_start: string | null;
  period_end: string | null;
  url: string | null;
  updated_at: string;
  court: { label: string } | null;
  facility: { id: string; name: string; district: string | null };
}

export interface Watch {
  id: string;
  facility_ids: string[] | null;
  enabled: boolean;
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

export function fetchListings(): Promise<Listing[]> {
  const select =
    'svc_id,title,status,day_type,time_band,period_start,period_end,url,updated_at,court(label),facility(id,name,district)';
  return request(`listing?select=${encodeURIComponent(select)}&order=svc_id`);
}

export const registerDevice = (token: string, platform: string) =>
  rpc<null>('register_device', { p_token: token, p_platform: platform });

export const myWatches = (token: string) => rpc<Watch[]>('my_watches', { p_token: token });

export async function quietEnabled(token: string): Promise<boolean> {
  const [row] = await rpc<{ quiet_enabled: boolean }[]>('my_settings', { p_token: token });
  return row?.quiet_enabled ?? true;
}

export const setQuiet = (token: string, enabled: boolean) =>
  rpc<null>('set_quiet', { p_token: token, p_enabled: enabled });

// One watch per facility for now: every event kind, all courts and bands.
export const watchFacility = (token: string, facilityId: string) =>
  rpc<string>('save_watch', {
    p_token: token,
    p_id: null,
    p_facility_ids: [facilityId],
    p_court_ids: null,
    p_day_types: null,
    p_time_bands: null,
    p_events: null,
    p_enabled: true,
  });

export const deleteWatch = (token: string, id: string) => rpc<null>('delete_watch', { p_token: token, p_id: id });
