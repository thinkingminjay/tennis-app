import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSnapshot, cleanPhone, diffEvents, toKstTimestamp } from '../src/transform.ts';
import type { OpenApiRow } from '../src/openApi.ts';

const row = (over: Partial<OpenApiRow>): OpenApiRow => ({
  SVCID: 'S1',
  MINCLASSNM: '테니스장',
  SVCSTATNM: '접수중',
  SVCNM: '10/1~10/15 장충테니스장 2번코트(평일주간)',
  PAYATNM: '유료',
  PLACENM: '장충테니스장',
  SVCURL: 'https://example.invalid/S1',
  X: '127.0',
  Y: '37.5',
  SVCOPNBGNDT: '2026-10-01 00:00:00.0',
  SVCOPNENDDT: '2026-10-15 00:00:00.0',
  RCPTBGNDT: '2026-09-25 09:00:00.0',
  RCPTENDDT: '2026-10-14 18:00:00.0',
  AREANM: '중구',
  IMGURL: '',
  TELNO: '02-000-0000',
  ...over,
});

test('KST timestamps', () => {
  assert.equal(toKstTimestamp('2026-09-25 09:00:00.0'), '2026-09-25T09:00:00+09:00');
  assert.equal(toKstTimestamp(''), null);
});

test('snapshot groups listings by facility and court, skips other sports', () => {
  const snap = buildSnapshot([
    row({}),
    row({ SVCID: 'S2', SVCNM: '10/1~10/15장충테니스장 2번코트(주말 및 공휴일)' }),
    row({ SVCID: 'S3', SVCNM: '삼청테니스장 코트이용(평일)', PLACENM: '삼청테니스장', PAYATNM: '무료' }),
    row({ SVCID: 'S4', MINCLASSNM: '축구장', SVCNM: '축구장' }),
  ]);
  assert.equal(snap.listings.length, 3);
  assert.deepEqual(snap.facilities.map((f) => f.key).sort(), ['삼청테니스장', '장충테니스장']);
  assert.deepEqual(snap.courts, [{ facilityKey: '장충테니스장', label: '2번' }]);

  const s1 = snap.listings.find((l) => l.svc_id === 'S1')!;
  assert.equal(s1.period_start, '2026-10-01');
  assert.equal(s1.day_type, '평일');
  assert.equal(s1.time_band, '주간');
  assert.equal(s1.paid, true);
  assert.equal(s1.receipt_end, '2026-10-14T18:00:00+09:00');

  const s3 = snap.listings.find((l) => l.svc_id === 'S3')!;
  assert.equal(s3.courtLabel, null);
  assert.equal(s3.paid, false);
});

test('facility indoor only when all titles agree', () => {
  const snap = buildSnapshot([
    row({ SVCID: 'A', SVCNM: '10월계남테니스실내A코트(평일주간)', PLACENM: '계남근린공원' }),
    row({ SVCID: 'B', SVCNM: '10월계남테니스야외코트(주말 06시~08시)', PLACENM: '계남근린공원' }),
  ]);
  assert.equal(snap.facilities[0].indoor, null);
});

test('first run emits no events', () => {
  const { listings } = buildSnapshot([row({})]);
  assert.deepEqual(diffEvents(new Map(), listings), []);
});

test('new listing, receipt open and status change', () => {
  const { listings } = buildSnapshot([
    row({ SVCID: 'S1', SVCSTATNM: '접수중' }),
    row({ SVCID: 'S2', SVCSTATNM: '예약마감' }),
    row({ SVCID: 'S3', SVCSTATNM: '안내중' }),
    row({ SVCID: 'S4', SVCSTATNM: '접수중' }),
  ]);
  const previous = new Map<string, string | null>([
    ['S1', '안내중'],
    ['S2', '접수중'],
    ['S3', '안내중'],
  ]);
  assert.deepEqual(diffEvents(previous, listings), [
    { svc_id: 'S1', kind: 'receipt_open', old_status: '안내중', new_status: '접수중' },
    { svc_id: 'S2', kind: 'status_change', old_status: '접수중', new_status: '예약마감' },
    { svc_id: 'S4', kind: 'new_listing', old_status: null, new_status: '접수중' },
  ]);
});

test('phone keeps only real numbers', () => {
  assert.equal(cleanPhone('02-611-9007'), '02-611-9007');
  assert.equal(cleanPhone('***(금천구테니스협회 사무장) / 02-2627-1428(문화체육과 담당자)'), '02-2627-1428');
  assert.equal(cleanPhone('02-460-2983 // 주말 및 공휴일 02-460-2998'), '02-460-2983, 02-460-2998');
  assert.equal(cleanPhone('***, ***'), null);
  assert.equal(cleanPhone(' '), null);
});
