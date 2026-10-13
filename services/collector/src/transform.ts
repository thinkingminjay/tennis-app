// Pure mapping from open API rows to DB rows, and change detection between runs.

import { parseListingTitle } from '../../../packages/shared/src/parseListingTitle.ts';
import type { OpenApiRow } from './openApi.ts';

export interface FacilityRow {
  key: string;
  name: string;
  district: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  image_url: string | null;
  indoor: boolean | null;
}

export interface ListingDraft {
  svc_id: string;
  facilityKey: string;
  courtLabel: string | null;
  title: string;
  period_start: string | null;
  period_end: string | null;
  day_type: string | null;
  time_band: string | null;
  status: string | null;
  paid: boolean | null;
  price_note: string | null;
  receipt_start: string | null;
  receipt_end: string | null;
  url: string | null;
}

export interface Snapshot {
  facilities: FacilityRow[];
  courts: { facilityKey: string; label: string }[];
  listings: ListingDraft[];
}

export type EventKind = 'new_listing' | 'receipt_open' | 'status_change';

export interface ListingEventRow {
  svc_id: string;
  kind: EventKind;
  old_status: string | null;
  new_status: string | null;
}

const RECEIVING = '접수중';

const blank = (s: string | undefined | null) => (s == null || s.trim() === '' ? null : s.trim());

// "2026-09-30 09:00:00.0" (KST) -> "2026-09-30T09:00:00+09:00"
export function toKstTimestamp(s: string | undefined): string | null {
  const m = blank(s)?.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}+09:00` : null;
}

export function toDate(s: string | undefined): string | null {
  return blank(s)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function toNumber(s: string | undefined): number | null {
  const n = Number(blank(s));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export function buildSnapshot(allRows: OpenApiRow[]): Snapshot {
  const facilities = new Map<string, FacilityRow>();
  const indoorFlags = new Map<string, Set<boolean | null>>();
  const courts = new Map<string, { facilityKey: string; label: string }>();
  const listings: ListingDraft[] = [];

  for (const row of allRows) {
    if (row.MINCLASSNM !== '테니스장') continue;
    const parsed = parseListingTitle({ title: row.SVCNM, place: row.PLACENM });
    const key = parsed.facilityKey;

    const existing = facilities.get(key);
    facilities.set(key, {
      key,
      name: existing?.name ?? parsed.facilityName,
      district: existing?.district ?? blank(row.AREANM),
      phone: existing?.phone ?? blank(row.TELNO),
      lat: existing?.lat ?? toNumber(row.Y),
      lng: existing?.lng ?? toNumber(row.X),
      image_url: existing?.image_url ?? blank(row.IMGURL),
      indoor: null,
    });
    if (!indoorFlags.has(key)) indoorFlags.set(key, new Set());
    indoorFlags.get(key)!.add(parsed.indoor);

    if (parsed.courtLabel) courts.set(`${key}\u0000${parsed.courtLabel}`, { facilityKey: key, label: parsed.courtLabel });

    const pay = blank(row.PAYATNM);
    listings.push({
      svc_id: row.SVCID,
      facilityKey: key,
      courtLabel: parsed.courtLabel,
      title: row.SVCNM.trim(),
      // The API's service dates are the source of truth; titles only repeat them.
      period_start: toDate(row.SVCOPNBGNDT),
      period_end: toDate(row.SVCOPNENDDT),
      day_type: parsed.dayType,
      time_band: parsed.timeBand,
      status: blank(row.SVCSTATNM),
      paid: pay == null ? null : !pay.startsWith('무료'),
      price_note: pay,
      receipt_start: toKstTimestamp(row.RCPTBGNDT),
      receipt_end: toKstTimestamp(row.RCPTENDDT),
      url: blank(row.SVCURL),
    });
  }

  // A facility is indoor/outdoor only when every listing's title agrees (계남 has both).
  for (const [key, flags] of indoorFlags) {
    if (flags.size === 1) facilities.get(key)!.indoor = [...flags][0];
  }

  return { facilities: [...facilities.values()], courts: [...courts.values()], listings };
}

// Compares the stored status with the fresh one. A listing turning to 접수중 is a
// receipt_open (the alert users care about); any other status move is a status_change.
// On the very first run (nothing stored) no events are emitted, so 333 listings don't alert at once.
export function diffEvents(
  previous: Map<string, string | null>,
  listings: ListingDraft[],
): ListingEventRow[] {
  if (previous.size === 0) return [];
  const events: ListingEventRow[] = [];
  for (const l of listings) {
    if (!previous.has(l.svc_id)) {
      events.push({ svc_id: l.svc_id, kind: 'new_listing', old_status: null, new_status: l.status });
      continue;
    }
    const old = previous.get(l.svc_id) ?? null;
    if (old === l.status) continue;
    const kind: EventKind = l.status === RECEIVING ? 'receipt_open' : 'status_change';
    events.push({ svc_id: l.svc_id, kind, old_status: old, new_status: l.status });
  }
  return events;
}
