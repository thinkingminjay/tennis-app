-- Stage 1 schema: open API listings only (see docs/ARCHITECTURE.md).
-- Per-date/per-slot availability tables are on hold until Seoul answers the data request.

create table facility (            -- 테니스장
  id uuid primary key default gen_random_uuid(),
  key text not null unique,        -- parser facilityKey (name without spaces), upsert key
  name text not null,              -- 장충테니스장
  district text,                   -- 중구 (AREANM)
  address text, phone text,
  lat double precision, lng double precision,
  image_url text,
  indoor boolean
);

create table court (               -- 물리적 코트
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facility(id) on delete cascade,
  label text not null,             -- '2번', 'A코트', '1면'
  unique (facility_id, label)
);

create table listing (             -- 서울시 상품 (rsv_svc_id)
  svc_id text primary key,
  facility_id uuid not null references facility(id) on delete cascade,
  court_id uuid references court(id) on delete set null,  -- null when the title names no court
  title text not null,             -- 원본 상품명
  period_start date, period_end date,
  day_type text check (day_type in ('평일', '주말', '혼합')),
  time_band text check (time_band in ('새벽', '주간', '야간', '혼합')),
  status text,                     -- SVCSTATNM: 접수중/예약마감/...
  paid boolean, price_note text,
  receipt_start timestamptz, receipt_end timestamptz,
  url text,
  updated_at timestamptz not null default now()
);

create index listing_facility_idx on listing (facility_id);
create index listing_court_idx on listing (court_id);
create index listing_status_idx on listing (status);

create table device (
  id uuid primary key default gen_random_uuid(),
  expo_push_token text unique,
  quiet_from time default '23:00', quiet_to time default '07:00',
  created_at timestamptz not null default now()
);

create table watch (               -- 알림 조건 (오픈API 이벤트만)
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references device(id) on delete cascade,
  facility_ids uuid[], court_ids uuid[],
  day_types text[], time_bands text[],  -- 상품 조건(평일/주말, 주간/야간)
  events text[] not null default array['new_listing', 'receipt_open', 'status_change']
    check (events <@ array['new_listing', 'receipt_open', 'status_change']),
  enabled boolean not null default true
);

create index watch_device_idx on watch (device_id);

create table listing_event (       -- 수집기가 감지한 상품 변화 (알림 원천)
  id bigserial primary key,
  svc_id text not null references listing(svc_id) on delete cascade,
  kind text not null check (kind in ('new_listing', 'receipt_open', 'status_change')),
  old_status text, new_status text,
  detected_at timestamptz not null default now()
);

create index listing_event_detected_idx on listing_event (detected_at);

-- Listing data is public (open API, 공공누리 1유형): anyone may read it.
-- Writes go through the collector's service role, which bypasses RLS.
-- device/watch/listing_event have no policies yet: the app will reach them through
-- an Edge Function, so anon/authenticated cannot read or write them directly.
alter table facility enable row level security;
alter table court enable row level security;
alter table listing enable row level security;
alter table device enable row level security;
alter table watch enable row level security;
alter table listing_event enable row level security;

create policy "public read" on facility for select to anon, authenticated using (true);
create policy "public read" on court for select to anon, authenticated using (true);
create policy "public read" on listing for select to anon, authenticated using (true);
