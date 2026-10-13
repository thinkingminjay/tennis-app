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
  surfaces: Surface[] | null;
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

// TELNO mixes masked names and notes ("***(사무장) / 02-2627-1428(담당자)"); keep only real numbers.
export function cleanPhone(s: string | undefined): string | null {
  const numbers = blank(s)?.match(/0\d{1,2}-\d{3,4}-\d{4}/g);
  return numbers ? [...new Set(numbers)].join(', ') : null;
}

// The open API has no coordinates for these places (no other row of the same place has them either).
// Approximate positions entered by hand from the facility's road address.
const COORDINATE_OVERRIDES: Record<string, { lat: number; lng: number }> = {
  손기정문화체육센터테니스장: { lat: 37.5557, lng: 126.9664 }, // 중구 손기정로 101
};

// Court surfaces guessed from the notice HTML and title ("코트종류 인조잔디 하드", "클레이코트 1면").
// Bare "잔디" is skipped because notices also mention lawns ("소프트테니스장 잔디 및 시설물").
export type Surface = 'hard' | 'clay' | 'grass';
const SURFACE_PATTERNS: [Surface, RegExp][] = [
  ['hard', /하드|우레탄|아크릴/],
  ['clay', /클레이|앙투카|마사토/],
  ['grass', /인조\s*잔디|잔디\s*코트|코트\s*\(\s*잔디/],
];

export function extractSurfaces(text: string): Surface[] {
  const plain = text.replace(/<[^>]*>|&nbsp;/g, ' ');
  return SURFACE_PATTERNS.filter(([, re]) => re.test(plain)).map(([s]) => s);
}

// Surfaces looked up by hand (2026-10-21) for places whose notices say nothing. Used only when the
// notice text gives no surface, so a notice that names one always wins. Source per line.
const SURFACE_OVERRIDES: Record<string, Surface[]> = {
  장충테니스장: ['hard'], // 서울시 생활체육포털: 하드코트 9면
  한남테니스장: ['clay', 'grass'], // 생활체육포털: 실외 클레이 6면, 인조잔디 6면
  선우공원테니스장: ['clay', 'grass'], // 생활체육포털: 3면 (인조잔디/클레이)
  월드컵공원테니스장: ['clay'], // 생활체육포털: 클레이 코트 2면
  뚝섬한강공원테니스장: ['clay'], // 생활체육포털, 한강공원 안내: 4면 (클레이)
  광나루한강공원테니스장: ['clay'], // 한강공원 안내: 8면 (클레이)
  이촌한강공원테니스장: ['clay'], // 한강공원 안내: 8면 (클레이)
  잠원한강공원테니스장: ['clay'], // 한강공원 안내: 6면 (클레이)
  망원한강공원테니스장: ['clay'], // 한강공원 안내: 6면 (클레이)
  동작테니스장: ['clay'], // 동작구시설관리공단: 클레이코트 6면
  서남센터테니스장: ['hard', 'grass'], // 서울물재생시설공단: 인조잔디 10면, 하드코트 4면
  탄천센터테니스장: ['grass'], // 시공사 사례(2021): 인조잔디 3면
  신도림테니스장: ['hard'], // 이용 후기: 4면 모두 하드코트
  어린이대공원테니스장: ['grass'], // 예약 안내 사이트: 인조잔디
  망원유수지소프트테니스장: ['grass'], // 마포구 테니스장 정리 글: 인조잔디 1면
  망원나들목테니스장: ['grass'], // 마포구 테니스장 정리 글: 인조잔디 4면
};

function toNumber(s: string | undefined): number | null {
  const n = Number(blank(s));
  return Number.isFinite(n) && n !== 0 ? n : null;
}

export function buildSnapshot(allRows: OpenApiRow[]): Snapshot {
  const facilities = new Map<string, FacilityRow>();
  const indoorFlags = new Map<string, Set<boolean | null>>();
  const surfaces = new Map<string, Set<Surface>>();
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
      phone: existing?.phone ?? cleanPhone(row.TELNO),
      lat: existing?.lat ?? toNumber(row.Y) ?? COORDINATE_OVERRIDES[key]?.lat ?? null,
      lng: existing?.lng ?? toNumber(row.X) ?? COORDINATE_OVERRIDES[key]?.lng ?? null,
      image_url: existing?.image_url ?? blank(row.IMGURL),
      indoor: null,
      surfaces: null,
    });
    if (!indoorFlags.has(key)) indoorFlags.set(key, new Set());
    indoorFlags.get(key)!.add(parsed.indoor);
    if (!surfaces.has(key)) surfaces.set(key, new Set());
    for (const s of extractSurfaces(`${row.SVCNM} ${row.DTLCONT ?? ''}`)) surfaces.get(key)!.add(s);

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

  // Fixed order (hard, clay, grass) so split icons always read the same way.
  for (const [key, found] of surfaces) {
    if (found.size) facilities.get(key)!.surfaces = SURFACE_PATTERNS.map(([s]) => s).filter((s) => found.has(s));
    else facilities.get(key)!.surfaces = SURFACE_OVERRIDES[key] ?? null;
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
