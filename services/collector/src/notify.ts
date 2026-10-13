// Push sending (docs/PRD.md "알림 규칙"). Runs after each collection:
// one bundled push per device per run (the run interval is the bundling window),
// quiet hours keep the device cursor in place so held events go out in the first run after.

import type { Db } from './supabase.ts';

export interface EventRow {
  id: number;
  svc_id: string;
  kind: 'new_listing' | 'receipt_open' | 'status_change';
  old_status: string | null;
  new_status: string | null;
  listing: {
    title: string;
    day_type: string | null;
    time_band: string | null;
    period_start: string | null;
    period_end: string | null;
    url: string | null;
    facility_id: string;
    court_id: string | null;
    facility: { name: string };
    court: { label: string } | null;
  };
}

export interface WatchRow {
  device_id: string;
  facility_ids: string[] | null;
  court_ids: string[] | null;
  day_types: string[] | null;
  time_bands: string[] | null;
  events: string[];
}

export interface DeviceRow {
  id: string;
  expo_push_token: string;
  quiet_enabled: boolean;
  quiet_from: string | null; // "23:00:00"
  quiet_to: string | null;
  last_event_id: number;
}

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { url?: string; facilityId?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EVENT_WINDOW_HOURS = 24; // never deliver events older than this (e.g. a device that was quiet for long)

// Facilities the user confirmed are closed or not bookable online on the Seoul booking site;
// their listings stay in the open API, so their events are never pushed. Keyed by name without spaces.
// Keep in sync with OFFLINE_FACILITIES in apps/mobile/src/format.ts.
const OFFLINE_FACILITIES = new Set([
  '월곡테니스장',
  '정릉테니스장',
  '난지한강공원테니스장',
  '난지물재생센터테니스장',
  '손기정문화체육센터테니스장',
  '동부도로사업소테니스장',
  '남부도로사업소테니스장',
  '현저테니스장',
  '홍은테니스장',
  '다락원체육공원테니스장',
]);

export const isOfflineEvent = (e: EventRow) => OFFLINE_FACILITIES.has(e.listing.facility.name.replace(/\s/g, ''));

const any = (list: string[] | null) => !list || list.length === 0;

// Unparsed (null) or mixed ('혼합') day/time values match any filter so alerts are not missed.
function matchesBand(filter: string[] | null, value: string | null): boolean {
  return any(filter) || value === null || value === '혼합' || filter!.includes(value);
}

export function matchesWatch(watch: WatchRow, e: EventRow): boolean {
  const l = e.listing;
  return (
    watch.events.includes(e.kind) &&
    (any(watch.facility_ids) || watch.facility_ids!.includes(l.facility_id)) &&
    (any(watch.court_ids) || (l.court_id !== null && watch.court_ids!.includes(l.court_id))) &&
    matchesBand(watch.day_types, l.day_type) &&
    matchesBand(watch.time_bands, l.time_band)
  );
}

export function inQuietHours(device: DeviceRow, now: Date): boolean {
  if (!device.quiet_enabled || !device.quiet_from || !device.quiet_to) return false;
  const kst = new Date(now.getTime() + 9 * 3600_000).toISOString().slice(11, 19);
  const { quiet_from: from, quiet_to: to } = device;
  return from <= to ? kst >= from && kst < to : kst >= from || kst < to;
}

function describe(e: EventRow): string {
  if (e.kind === 'new_listing') return '새 상품';
  if (e.kind === 'receipt_open') return '접수 시작';
  return `${e.old_status ?? '?'} → ${e.new_status ?? '?'}`;
}

function place(e: EventRow): string {
  return [e.listing.facility.name, e.listing.court?.label].filter(Boolean).join(' ');
}

export function buildMessage(token: string, events: EventRow[]): PushMessage {
  if (events.length === 1) {
    const [e] = events;
    const l = e.listing;
    const tags = [l.day_type, l.time_band].filter(Boolean).join(' ');
    const period = l.period_start && l.period_end ? `${l.period_start.slice(5)}~${l.period_end.slice(5)}` : '';
    return {
      to: token,
      title: place(e),
      body: [describe(e), tags, period].filter(Boolean).join(' · '),
      sound: 'default',
      data: l.url ? { url: l.url, facilityId: l.facility_id } : { facilityId: l.facility_id },
    };
  }
  const lines = events.slice(0, 3).map((e) => `${place(e)} ${describe(e)}`);
  if (events.length > 3) lines.push(`외 ${events.length - 3}건`);
  // A bundle about one facility opens that facility; a mixed bundle opens the 알림 tab.
  const facilities = new Set(events.map((e) => e.listing.facility_id));
  const data = facilities.size === 1 ? { facilityId: events[0].listing.facility_id } : {};
  return { to: token, title: `관심 테니스장 소식 ${events.length}건`, body: lines.join('\n'), sound: 'default', data };
}

// Pure planning step: which message each device gets and where its cursor moves.
export function planNotifications(devices: DeviceRow[], watches: WatchRow[], events: EventRow[], now: Date) {
  const maxId = events.reduce((m, e) => Math.max(m, e.id), 0);
  const plans: { device: DeviceRow; events: EventRow[]; cursor: number }[] = [];
  for (const device of devices) {
    if (inQuietHours(device, now) || maxId <= device.last_event_id) continue;
    const mine = watches.filter((w) => w.device_id === device.id);
    const matched = events.filter(
      (e) => e.id > device.last_event_id && !isOfflineEvent(e) && mine.some((w) => matchesWatch(w, e)),
    );
    plans.push({ device, events: matched, cursor: maxId });
  }
  return plans;
}

export async function sendNotifications(db: Db, now = new Date()): Promise<string> {
  const devices = await db.select<DeviceRow>(
    'device',
    'select=id,expo_push_token,quiet_enabled,quiet_from,quiet_to,last_event_id&expo_push_token=not.is.null',
  );
  if (devices.length === 0) return '알림 대상 기기 없음';

  const since = new Date(now.getTime() - EVENT_WINDOW_HOURS * 3600_000).toISOString();
  const minCursor = Math.min(...devices.map((d) => d.last_event_id));
  const events = await db.select<EventRow>(
    'listing_event',
    `select=id,svc_id,kind,old_status,new_status,listing(title,day_type,time_band,period_start,period_end,url,facility_id,court_id,facility(name),court(label))` +
      `&id=gt.${minCursor}&detected_at=gte.${encodeURIComponent(since)}&order=id`,
  );
  const watches = await db.select<WatchRow>(
    'watch',
    'select=device_id,facility_ids,court_ids,day_types,time_bands,events&enabled=is.true',
  );

  const plans = planNotifications(devices, watches, events, now);
  const outgoing = plans
    .filter((p) => p.events.length > 0)
    .map((p) => ({ plan: p, message: buildMessage(p.device.expo_push_token, p.events) }));
  const unregistered = await pushToExpo(outgoing.map((o) => o.message));
  const delivered = outgoing.filter((o) => !unregistered.has(o.message.to));

  await db.insert(
    'notification',
    delivered.map(({ plan, message }) => ({
      device_id: plan.device.id,
      title: message.title,
      body: message.body,
      svc_ids: plan.events.map((e) => e.svc_id),
      url: message.data.url ?? null,
    })),
  );
  await db.upsert(
    'device',
    plans.map((p) => ({ id: p.device.id, last_event_id: p.cursor })),
    'id',
  );
  for (const token of unregistered) await db.delete('device', `expo_push_token=eq.${encodeURIComponent(token)}`);

  return `알림 ${delivered.length}건 발송, 해지된 기기 ${unregistered.size}개 정리`;
}

// Sends in chunks of 100 (Expo limit). Returns tokens Expo reports as no longer registered.
async function pushToExpo(messages: PushMessage[]): Promise<Set<string>> {
  const unregistered = new Set<string>();
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) throw new Error(`Expo Push HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const { data } = (await res.json()) as { data: { status: string; message?: string; details?: { error?: string } }[] };
    data.forEach((ticket, j) => {
      if (ticket.status === 'ok') return;
      if (ticket.details?.error === 'DeviceNotRegistered') unregistered.add(chunk[j].to);
      else console.warn(`알림 실패: ${ticket.message ?? ticket.details?.error}`);
    });
  }
  return unregistered;
}
