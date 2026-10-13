import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseListingTitle } from '../src/parseListingTitle.ts';

interface FixtureRow {
  svcId: string;
  title: string;
  place: string;
  area: string;
}

const fixture: { rows: FixtureRow[] } = JSON.parse(
  readFileSync(new URL('./fixtures/listing-titles-2026-10-13.json', import.meta.url), 'utf8'),
);

const parse = (title: string, place?: string) => parseListingTitle({ title, place });

test('slash period, numbered court, weekday day slot', () => {
  const p = parse('10/16~10/31 장충테니스장 2번코트(평일주간)');
  assert.equal(p.facilityName, '장충테니스장');
  assert.equal(p.courtLabel, '2번');
  assert.deepEqual(p.period, { from: { month: 10, day: 16 }, to: { month: 10, day: 31 } });
  assert.equal(p.dayType, '평일');
  assert.deepEqual(p.days, [1, 2, 3, 4, 5]);
  assert.equal(p.timeBand, '주간');
});

test('weekend and holidays without a space before the facility name', () => {
  const p = parse('10/1~10/15장충테니스장 9번코트(주말 및 공휴일)');
  assert.equal(p.facilityName, '장충테니스장');
  assert.equal(p.courtLabel, '9번');
  assert.equal(p.dayType, '주말');
  assert.equal(p.holidays, true);
});

test('court number before the facility (응봉공원 pattern) falls back to place', () => {
  const p = parse('테니스장1(토/일/공휴일)-2026년 응봉공원(대현산배수지)', '응봉공원');
  assert.equal(p.facilityName, '응봉공원');
  assert.equal(p.courtLabel, '1번');
  assert.deepEqual(p.days, [0, 6]);
  assert.equal(p.holidays, true);
});

test('month prefix and indoor lettered court', () => {
  const p = parse('10월계남테니스실내A코트(평일야간/주말)', '계남근린공원');
  assert.equal(p.facilityName, '계남근린공원');
  assert.equal(p.courtLabel, 'A코트');
  assert.deepEqual(p.period, { from: { month: 10, day: 1 }, to: { month: 10, day: null } });
  assert.equal(p.indoor, true);
  assert.equal(p.dayType, '혼합');
  assert.equal(p.timeBand, '야간');
});

test('explicit time ranges', () => {
  const p = parse('10월계남테니스야외코트(평일 06시~08시, 주말 08시~18시)', '계남근린공원');
  assert.equal(p.courtLabel, '야외');
  assert.equal(p.indoor, false);
  assert.deepEqual(p.timeRanges, [
    { start: '06:00', end: '08:00' },
    { start: '08:00', end: '18:00' },
  ]);
  assert.equal(p.timeBand, '혼합');
});

test('booking-open note is not mistaken for the service period', () => {
  const p = parse('11월 월드컵공원 테니스장 A면 (평일야간) 이용 - 예약 10월15일(목) 13시');
  assert.equal(p.facilityName, '월드컵공원 테니스장');
  assert.equal(p.courtLabel, 'A면');
  assert.deepEqual(p.period, { from: { month: 11, day: 1 }, to: { month: 11, day: null } });
  assert.equal(p.bookingOpensNote, '예약 10월15일(목) 13시');
  assert.equal(p.timeBand, '야간');
});

test('Korean day range with implied month', () => {
  const p = parse('동부 도로사업소 테니스장 A코트 평일야간 10월16일~31일');
  assert.equal(p.facilityName, '동부 도로사업소 테니스장');
  assert.deepEqual(p.period, { from: { month: 10, day: 16 }, to: { month: 10, day: 31 } });
});

test('slash-separated 동작 titles with year and order prefixes', () => {
  const p = parse('26년_4. 동작테니스장 / 평일 / 저녁할증 (18시~22시)  / 6번코트');
  assert.equal(p.facilityName, '동작테니스장');
  assert.equal(p.courtLabel, '6번');
  assert.equal(p.dayType, '평일');
  assert.equal(p.timeBand, '야간');
  assert.deepEqual(p.timeRanges, [{ start: '18:00', end: '22:00' }]);

  const weekend = parse('26년_동작테니스장 / 주말할증 / 4번코트');
  assert.equal(weekend.dayType, '주말');
});

test('specific weekdays', () => {
  assert.deepEqual(parse('한남테니스장 5번코트 야간 월요일 및 주말').days, [0, 1, 6]);
  assert.deepEqual(parse('한남테니스장 2번코트 금요일 야간 및 일요일').days, [0, 5]);
  assert.deepEqual(parse('(일)독산테니스장-1번코트').days, [0]);
  assert.deepEqual(parse('10월 정릉테니스장 C코트 주말(토)').days, [6]);
});

test('"15일" and "공휴일" are not read as Sunday', () => {
  const p = parse('가좌테니스장 평일 주간 B코트 10월1일~15일');
  assert.deepEqual(p.days, [1, 2, 3, 4, 5]);
  assert.equal(parse('서울에너지공사 목동 테니스장 1면 (공휴일) 08:00~18:00').days.length, 0);
});

test('lighting vs. court next to the lights', () => {
  assert.equal(parse('마루공원 테니스장 1면 (조명)').lighting, true);
  assert.equal(parse('10월_월곡테니스장 4번 코트(라이트)').lighting, true);
  const side = parse('탄천센터 테니스장 1면 조명쪽 (일원1,개포3동 주민 전용 시설)');
  assert.equal(side.lighting, false);
  assert.equal(side.residentsOnly, true);
});

test('eligibility flags', () => {
  const p = parse('서남센터 테니스장1번 65세이상(가양1동,방화1동3동) 전용코트');
  assert.equal(p.courtLabel, '1번');
  assert.equal(p.seniorsOnly, true);
  assert.equal(p.residentsOnly, true);
});

test('prefixed brackets and place fallback', () => {
  const p = parse('[주말-공휴일]10월 망원나들목  2번 코트', '망원나들목 테니스장');
  assert.equal(p.facilityName, '망원나들목 테니스장');
  assert.equal(p.courtLabel, '2번');
  assert.equal(p.dayType, '주말');

  const test = parse('서울숲 테니스장 주말', '서울숲>서울숲 테니스장 테스트');
  assert.equal(test.facilityName, '서울숲 테니스장');
});

test('all 333 real titles parse with sane output', () => {
  assert.ok(fixture.rows.length >= 300);
  let withCourt = 0;
  let withDays = 0;
  for (const row of fixture.rows) {
    const p = parseListingTitle(row);
    const ctx = `${row.svcId} ${row.title}`;
    assert.ok(p.facilityName.length > 0, ctx);
    assert.notEqual(p.facilityKey, '테니스장', ctx);
    assert.doesNotMatch(p.facilityName, /^\s*(\d|\[|\()/, ctx);
    if (p.period) {
      for (const md of [p.period.from, p.period.to]) {
        assert.ok(md.month >= 1 && md.month <= 12, ctx);
        assert.ok(md.day === null || (md.day >= 1 && md.day <= 31), ctx);
      }
    }
    for (const r of p.timeRanges) assert.match(`${r.start}-${r.end}`, /^\d{2}:\d{2}-\d{2}:\d{2}$/, ctx);
    if (p.courtLabel) withCourt++;
    if (p.days.length > 0 || p.holidays) withDays++;
  }
  // Snapshot of 2026-10-13 coverage (court 280/333, days 265/333; e.g. "저녁"-only titles state no days).
  // Titles without these fields simply don't state them.
  assert.ok(withCourt / fixture.rows.length > 0.8, `court coverage ${withCourt}`);
  assert.ok(withDays / fixture.rows.length > 0.75, `day coverage ${withDays}`);
});
