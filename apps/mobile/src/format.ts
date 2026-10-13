import type { Listing, Watch, EventKind, Facility } from './api';

export const RECEIVING = '접수중';
export const UPCOMING = '안내중';

export type Tone = 'open' | 'soon' | 'off';

export function tone(status: string | null): Tone {
  if (status === RECEIVING) return 'open';
  if (status === UPCOMING) return 'soon';
  return 'off';
}

export function minutesAgo(iso: string | undefined): string {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}분 전 갱신`;
  if (m < 60 * 24) return `${Math.round(m / 60)}시간 전 갱신`;
  return `${Math.round(m / 1440)}일 전 갱신`;
}

export function timeAgo(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.round(m / 60)}시간 전`;
  return `${Math.round(m / 1440)}일 전`;
}

const mmdd = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)}`;

export function period(l: Listing): string {
  if (!l.period_start || !l.period_end) return '';
  return `${mmdd(l.period_start)}~${mmdd(l.period_end)}`;
}

// "10/20 10:00" in KST.
export function kst(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hh}:${mi}`;
}

export function receiptNote(l: Listing): string | null {
  if (l.status === UPCOMING && l.receipt_start) return `접수 ${kst(l.receipt_start)}부터`;
  if (l.status === RECEIVING && l.receipt_end) return `접수 ${kst(l.receipt_end)}까지`;
  return null;
}

export function bandLabel(l: Listing): string {
  const parts = [l.day_type, l.time_band].filter((x) => x && x !== '혼합');
  return parts.length ? parts.join(' ') : '전체 시간';
}

export interface Filter {
  open: boolean;
  day: '평일' | '주말' | null;
  band: '주간' | '야간' | null;
  free: boolean;
  districts: string[];
}

export const EMPTY_FILTER: Filter = { open: false, day: null, band: null, free: false, districts: [] };

export const isFiltered = (f: Filter) => f.open || !!f.day || !!f.band || f.free || f.districts.length > 0;

// Listings without a parsed day/band (null or 혼합) match any day/band filter, like the collector's matchesWatch.
export function listingMatches(l: Listing, f: Filter): boolean {
  if (f.open && l.status !== RECEIVING) return false;
  if (f.free && l.paid !== false) return false;
  if (f.day && l.day_type && l.day_type !== '혼합' && l.day_type !== f.day) return false;
  if (f.band && l.time_band && l.time_band !== '혼합' && l.time_band !== f.band) return false;
  return true;
}

// "2번" < "10번" < "A코트".
export const courtOrder = (a: string, b: string) => a.localeCompare(b, 'ko', { numeric: true });

export const EVENT_LABEL: Record<EventKind, string> = {
  new_listing: '새 상품',
  receipt_open: '접수 시작',
  status_change: '상태 변화',
};

export const ALL_EVENTS: EventKind[] = ['new_listing', 'receipt_open', 'status_change'];

export function watchTitle(w: Watch, facilities: Map<string, Facility>): string {
  const names = (w.facility_ids ?? []).map((id) => facilities.get(id)?.name ?? '삭제된 테니스장');
  if (names.length === 0) return '전체 테니스장';
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} 외 ${names.length - 2}곳` : names.join(', ');
}

export function watchSummary(w: Watch): string {
  const parts = [
    w.court_ids?.length ? `코트 ${w.court_ids.length}개` : '모든 코트',
    w.day_types?.length ? w.day_types.join('·') : null,
    w.time_bands?.length ? w.time_bands.join('·') : null,
    w.events.length === ALL_EVENTS.length ? '모든 소식' : w.events.map((e) => EVENT_LABEL[e]).join('·'),
  ];
  return parts.filter(Boolean).join(' · ');
}

// The one-tap "알림 받기" watch: one facility, everything else open.
export const isSimpleWatch = (w: Watch, facilityId: string) =>
  w.facility_ids?.length === 1 &&
  w.facility_ids[0] === facilityId &&
  !w.court_ids?.length &&
  !w.day_types?.length &&
  !w.time_bands?.length &&
  w.events.length === ALL_EVENTS.length;
