// One collection run: open API -> parse -> upsert facility/court/listing -> record listing_event.
// Usage: npm start            (writes to Supabase)
//        npm start -- --dry-run (fetch + parse only, prints a summary)

import { fetchAllRows } from './openApi.ts';
import { buildSnapshot, diffEvents } from './transform.ts';
import { Db } from './supabase.ts';
import { sendNotifications } from './notify.ts';

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`.env에 ${name} 값이 없습니다`);
  return value;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const rows = await fetchAllRows(requireEnv('SEOUL_OPENAPI_KEY'), requireEnv('COLLECTOR_CONTACT_EMAIL'));
  const snap = buildSnapshot(rows);
  console.log(
    `오픈API ${rows.length}건 → 테니스장 상품 ${snap.listings.length}건, 시설 ${snap.facilities.length}곳, 코트 ${snap.courts.length}개`,
  );
  if (dryRun) return;

  const db = new Db(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));

  const previous = new Map(
    (await db.select<{ svc_id: string; status: string | null }>('listing', 'select=svc_id,status')).map((r) => [
      r.svc_id,
      r.status,
    ]),
  );
  const alreadyGone = new Set(
    (await db.select<{ svc_id: string }>('listing', 'select=svc_id&gone_at=not.is.null')).map((r) => r.svc_id),
  );

  const facilityIds = new Map(
    (await db.upsert<{ id: string; key: string }>('facility', snap.facilities, 'key')).map((f) => [f.key, f.id]),
  );

  const courtRows = snap.courts.map((c) => ({ facility_id: facilityIds.get(c.facilityKey)!, label: c.label }));
  const courtIds = new Map(
    (await db.upsert<{ id: string; facility_id: string; label: string }>('court', courtRows, 'facility_id,label')).map(
      (c) => [`${c.facility_id}\u0000${c.label}`, c.id],
    ),
  );

  const now = new Date().toISOString();
  const listingRows = snap.listings.map(({ facilityKey, courtLabel, ...l }) => {
    const facility_id = facilityIds.get(facilityKey)!;
    const court_id = courtLabel ? (courtIds.get(`${facility_id}\u0000${courtLabel}`) ?? null) : null;
    return { ...l, facility_id, court_id, updated_at: now, gone_at: null };
  });
  await db.upsert('listing', listingRows, 'svc_id');

  const events = diffEvents(previous, snap.listings);
  await db.insert('listing_event', events);

  // Listings the API no longer returns are hidden (gone_at), not deleted, so a listing that
  // briefly drops out and comes back doesn't fire a second new_listing alert.
  const fresh = new Set(snap.listings.map((l) => l.svc_id));
  const gone = [...previous.keys()].filter((id) => !fresh.has(id));
  const newlyGone = gone.filter((id) => !alreadyGone.has(id));
  if (newlyGone.length > previous.size / 2) {
    console.log(`사라진 상품이 ${newlyGone.length}건으로 너무 많아 숨김 처리를 건너뜁니다 (API 일시 오류 가능성)`);
  } else if (newlyGone.length > 0) {
    await db.update('listing', `svc_id=in.(${newlyGone.map(encodeURIComponent).join(',')})`, { gone_at: now });
  }
  console.log(
    previous.size === 0
      ? '첫 수집: 이벤트 없이 저장만 했습니다'
      : `이벤트 ${events.length}건 (${countBy(events.map((e) => e.kind))}), API에서 사라진 상품 ${gone.length}건 (이번에 숨김 ${newlyGone.length}건)`,
  );

  // Runs even without new events: devices leaving quiet hours get what was held.
  console.log(await sendNotifications(db));
}

function countBy(items: string[]): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return [...counts].map(([k, n]) => `${k} ${n}`).join(', ') || '없음';
}

main().catch((err) => {
  console.error(`수집 실패: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
