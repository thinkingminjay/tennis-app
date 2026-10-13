// Parses Seoul public reservation listing titles (SVCNM) for tennis courts.
// Titles are free text typed by each facility, so every field is best-effort:
// null / empty means "not stated in the title", not "invalid".
// The API's SVCOPNBGNDT/SVCOPNENDDT stay the source of truth for the service period.

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
export type TimeBand = 'dawn' | 'day' | 'night';

export interface MonthDay {
  month: number;
  day: number | null; // null = end of month
}

export interface TimeRange {
  start: string; // "HH:MM"
  end: string;
}

export interface ParsedListingTitle {
  facilityName: string;
  facilityKey: string; // facilityName without spaces, for grouping
  courtLabel: string | null; // "2번", "A코트", "A면", "1면", "야외"
  period: { from: MonthDay; to: MonthDay } | null;
  bookingOpensNote: string | null; // e.g. "예약 10월15일(목) 13시"
  days: Weekday[];
  holidays: boolean | null;
  dayType: '평일' | '주말' | '혼합' | null;
  timeBands: TimeBand[];
  timeRanges: TimeRange[];
  timeBand: '새벽' | '주간' | '야간' | '혼합' | null;
  indoor: boolean | null;
  lighting: boolean;
  residentsOnly: boolean;
  seniorsOnly: boolean;
}

export interface ListingTitleInput {
  title: string; // SVCNM
  place?: string; // PLACENM, used when the title has no facility name
}

const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
const DAY_CHARS: Record<string, Weekday> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const BAND_LABEL: Record<TimeBand, '새벽' | '주간' | '야간'> = { dawn: '새벽', day: '주간', night: '야간' };

const BOOKING_NOTE_RE = /-?\s*(예약\s*\d{1,2}월\s*\d{1,2}일\s*(?:\([^)]*\))?\s*\d{1,2}시)/;
const SLASH_PERIOD_RE = /(\d{1,2})\/(\d{1,2})\s*~\s*(\d{1,2})\/(\d{1,2})/;
const KOREAN_PERIOD_RE = /(\d{1,2})월\s*(\d{1,2})일\s*~\s*(?:(\d{1,2})월\s*)?(\d{1,2})일/;
const MONTH_RE = /(\d{1,2})월(?!\s*\d)(?!요일)/;
const TITLE_PREFIX_RE =
  /^\s*(?:\[[^\]]*\]|\([^)]*\)|\d{1,2}\/\d{1,2}\s*~\s*\d{1,2}\/\d{1,2}|\d{2,4}년_?|\d{1,2}월_?|\d+\.\s)\s*/;

export function parseListingTitle(input: ListingTitleInput): ParsedListingTitle {
  const title = input.title.replace(/\s+/g, ' ').trim();

  let text = title;
  let bookingOpensNote: string | null = null;
  const note = text.match(BOOKING_NOTE_RE);
  if (note) {
    bookingOpensNote = note[1].replace(/\s+/g, ' ');
    text = text.replace(note[0], ' ');
  }

  const { period, rest } = extractPeriod(text);
  text = rest;

  const facilityName = extractFacilityName(title, input.place);
  const days = extractDays(text);
  const holidays = /휴일/.test(text) ? true : null;
  const timeRanges = extractTimeRanges(text);
  // "조명쪽" names the court next to the lights, not a lit night slot.
  const lighting = /조명(?!쪽)|라이트/.test(text);
  const timeBands = extractTimeBands(text, timeRanges, lighting);

  return {
    facilityName,
    facilityKey: facilityName.replace(/\s+/g, ''),
    courtLabel: extractCourtLabel(text),
    period,
    bookingOpensNote,
    days,
    holidays,
    dayType: toDayType(days),
    timeBands,
    timeRanges,
    timeBand: timeBands.length === 0 ? null : timeBands.length === 1 ? BAND_LABEL[timeBands[0]] : '혼합',
    indoor: extractIndoor(title),
    lighting,
    residentsOnly: /주민|동\)?\s*전용/.test(title),
    seniorsOnly: /\d+\s*세\s*이상/.test(title),
  };
}

function extractPeriod(text: string): { period: ParsedListingTitle['period']; rest: string } {
  const slash = text.match(SLASH_PERIOD_RE);
  if (slash) {
    return {
      period: {
        from: { month: Number(slash[1]), day: Number(slash[2]) },
        to: { month: Number(slash[3]), day: Number(slash[4]) },
      },
      rest: text.replace(slash[0], ' '),
    };
  }
  const korean = text.match(KOREAN_PERIOD_RE);
  if (korean) {
    const fromMonth = Number(korean[1]);
    return {
      period: {
        from: { month: fromMonth, day: Number(korean[2]) },
        to: { month: korean[3] ? Number(korean[3]) : fromMonth, day: Number(korean[4]) },
      },
      rest: text.replace(korean[0], ' '),
    };
  }
  const month = text.match(MONTH_RE);
  if (month) {
    const m = Number(month[1]);
    return {
      period: { from: { month: m, day: 1 }, to: { month: m, day: null } },
      rest: text.replace(month[0], ' '),
    };
  }
  return { period: null, rest: text };
}

function extractFacilityName(title: string, place?: string): string {
  let head = title;
  for (let prev = ''; prev !== head; ) {
    prev = head;
    head = head.replace(TITLE_PREFIX_RE, '');
  }
  const match = head.match(/^(.*?테니스장)/);
  if (match) {
    const name = match[1]
      .replace(/실내실외|실내|실외/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.replace(/\s/g, '') !== '테니스장') return name;
  }
  return cleanPlaceName(place) ?? head.trim();
}

function cleanPlaceName(place?: string): string | null {
  if (!place) return null;
  const last = place.split('>').pop()!.replace(/\s*테스트\s*$/, '').trim();
  return last || null;
}

function extractCourtLabel(text: string): string | null {
  let m = text.match(/(\d{1,2})\s*번\s*(?:코트)?/);
  if (m) return `${Number(m[1])}번`;
  m = text.match(/([A-Z])\s*(코트|면)/);
  if (m) return `${m[1]}${m[2]}`;
  m = text.match(/(\d{1,2})\s*면/);
  if (m) return `${Number(m[1])}면`;
  m = text.match(/테니스장\s*(\d{1,2})(?=\s*\()/);
  if (m) return `${Number(m[1])}번`;
  m = text.match(/테니스장\s+([A-Z])(?![A-Za-z])/);
  if (m) return `${m[1]}코트`;
  if (/야외\s*코트/.test(text)) return '야외';
  return null;
}

function extractDays(text: string): Weekday[] {
  const set = new Set<Weekday>();
  if (/평일|주중/.test(text)) WEEKDAYS.forEach((d) => set.add(d));

  const weekend = text.match(/주말(?:\s*\(([토일])\))?/);
  if (weekend) {
    if (weekend[1]) set.add(DAY_CHARS[weekend[1]]);
    else {
      set.add(0);
      set.add(6);
    }
  }
  for (const m of text.matchAll(/([월화수목금토일])요일/g)) set.add(DAY_CHARS[m[1]]);
  // Standalone 토 / 일, e.g. "토/일/공휴일", "(일)독산"; "15일" and "공휴일" are excluded.
  for (const m of text.matchAll(/(?:^|[\s(\/,\[\-])([토일])(?=$|[\s)\/,\]])/g)) set.add(DAY_CHARS[m[1]]);

  return [...set].sort((a, b) => a - b);
}

function extractTimeRanges(text: string): TimeRange[] {
  const ranges: TimeRange[] = [];
  const re = /(\d{1,2})(?::(\d{2}))?\s*(시)?\s*~\s*(\d{1,2})(?::(\d{2}))?\s*(시)?/g;
  for (const m of text.matchAll(re)) {
    const hasUnit = m[2] !== undefined || m[3] !== undefined || m[5] !== undefined || m[6] !== undefined;
    if (!hasUnit) continue;
    ranges.push({ start: hhmm(m[1], m[2]), end: hhmm(m[4], m[5]) });
  }
  return ranges;
}

function hhmm(h: string, m?: string): string {
  return `${h.padStart(2, '0')}:${m ?? '00'}`;
}

function extractTimeBands(text: string, ranges: TimeRange[], lighting: boolean): TimeBand[] {
  const set = new Set<TimeBand>();
  if (/새벽/.test(text)) set.add('dawn');
  if (/주간|낮/.test(text)) set.add('day');
  if (/야간|저녁/.test(text) || lighting) set.add('night');
  if (set.size === 0) {
    for (const r of ranges) {
      const start = Number(r.start.slice(0, 2));
      set.add(start < 8 ? 'dawn' : start >= 17 ? 'night' : 'day');
    }
  }
  const order: TimeBand[] = ['dawn', 'day', 'night'];
  return order.filter((b) => set.has(b));
}

function toDayType(days: Weekday[]): ParsedListingTitle['dayType'] {
  if (days.length === 0) return null;
  const key = days.join(',');
  if (key === WEEKDAYS.join(',')) return '평일';
  if (days.every((d) => d === 0 || d === 6)) return '주말';
  return '혼합';
}

function extractIndoor(title: string): boolean | null {
  const indoor = /실내/.test(title);
  const outdoor = /야외|실외/.test(title);
  if (indoor && !outdoor) return true;
  if (outdoor && !indoor) return false;
  return null;
}
