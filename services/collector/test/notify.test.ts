import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessage, inQuietHours, matchesWatch, planNotifications } from '../src/notify.ts';
import type { DeviceRow, EventRow, WatchRow } from '../src/notify.ts';

function event(id: number, over: Partial<EventRow['listing']> = {}, kind: EventRow['kind'] = 'receipt_open'): EventRow {
  return {
    id,
    svc_id: `S${id}`,
    kind,
    old_status: '안내중',
    new_status: '접수중',
    listing: {
      title: 't',
      day_type: '주말',
      time_band: '주간',
      period_start: '2026-11-01',
      period_end: '2026-11-30',
      url: `https://example.test/${id}`,
      facility_id: 'F1',
      court_id: 'C1',
      facility: { name: '장충테니스장' },
      court: { label: '1번' },
      ...over,
    },
  };
}

const watch = (over: Partial<WatchRow> = {}): WatchRow => ({
  device_id: 'D1',
  facility_ids: ['F1'],
  court_ids: null,
  day_types: null,
  time_bands: null,
  events: ['new_listing', 'receipt_open', 'status_change'],
  ...over,
});

const device = (over: Partial<DeviceRow> = {}): DeviceRow => ({
  id: 'D1',
  expo_push_token: 'ExponentPushToken[a]',
  quiet_enabled: true,
  quiet_from: '23:00:00',
  quiet_to: '07:00:00',
  last_event_id: 0,
  ...over,
});

test('matchesWatch: facility, court, event kind and band filters', () => {
  assert.equal(matchesWatch(watch(), event(1)), true);
  assert.equal(matchesWatch(watch({ facility_ids: ['F2'] }), event(1)), false);
  assert.equal(matchesWatch(watch({ court_ids: ['C2'] }), event(1)), false);
  assert.equal(matchesWatch(watch({ events: ['new_listing'] }), event(1)), false);
  assert.equal(matchesWatch(watch({ day_types: ['평일'] }), event(1)), false);
  // Mixed or unparsed values match any band filter.
  assert.equal(matchesWatch(watch({ day_types: ['평일'] }), event(1, { day_type: '혼합' })), true);
  assert.equal(matchesWatch(watch({ time_bands: ['야간'] }), event(1, { time_band: null })), true);
});

test('inQuietHours: KST window across midnight, can be turned off', () => {
  // 15:30 UTC = 00:30 KST
  assert.equal(inQuietHours(device(), new Date('2026-10-13T15:30:00Z')), true);
  // 03:00 UTC = 12:00 KST
  assert.equal(inQuietHours(device(), new Date('2026-10-13T03:00:00Z')), false);
  // 22:00 UTC = 07:00 KST (end is exclusive)
  assert.equal(inQuietHours(device(), new Date('2026-10-13T22:00:00Z')), false);
  assert.equal(inQuietHours(device({ quiet_enabled: false }), new Date('2026-10-13T15:30:00Z')), false);
});

test('planNotifications: bundles per device, holds during quiet hours, skips seen events', () => {
  const noon = new Date('2026-10-13T03:00:00Z');
  const events = [event(5), event(6, { facility_id: 'F2' }), event(7)];
  const [plan] = planNotifications([device({ last_event_id: 5 })], [watch()], events, noon);
  assert.deepEqual(plan.events.map((e) => e.id), [7]);
  assert.equal(plan.cursor, 7);

  const night = new Date('2026-10-13T15:30:00Z');
  assert.deepEqual(planNotifications([device()], [watch()], events, night), []);
  // Nothing new since the cursor: no plan, no cursor write.
  assert.deepEqual(planNotifications([device({ last_event_id: 7 })], [watch()], events, noon), []);
});

test('buildMessage: single event links to the booking page, bundles summarize', () => {
  const one = buildMessage('T', [event(1)]);
  assert.equal(one.title, '장충테니스장 1번');
  assert.equal(one.body, '접수 시작 · 주말 주간 · 11-01~11-30');
  assert.equal(one.data.url, 'https://example.test/1');

  const many = buildMessage('T', [event(1), event(2, {}, 'new_listing'), event(3), event(4)]);
  assert.equal(many.title, '관심 테니스장 소식 4건');
  assert.equal(many.body.split('\n').length, 4);
  assert.match(many.body, /외 1건$/);
  assert.deepEqual(many.data, {});
});
