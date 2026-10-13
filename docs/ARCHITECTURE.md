# 아키텍처

```
[A 오픈API] ──> [수집기: Node, 국내 리전] ──> [Supabase Postgres] ──> [알림: 상품 변화 감지 → Expo Push]
                                                   │                          │
                                                   └── 조회 API ──> [Expo 앱] <┘
                                                                       │
                              [서울시 예약 화면] <── 일반 팝업 웹뷰 ────┘  (사용자가 직접 로그인·시간 확인·예약)
```

- 서버가 부르는 것은 오픈API(openapi.seoul.go.kr) 하나뿐이다. yeyak.seoul.go.kr의 달력·회차 Ajax는 부르지 않는다(2026-10-13 서버 요청이 302 차단됨, CLAUDE.md "확인 사항").
- B(공개 달력)와 C(회차)는 **보류**: 서울시 데이터 제공신청 답을 받은 뒤 서버 데이터로 다시 설계한다.
- 예약 웹뷰에는 JS를 주입하지 않고, 화면 내용을 읽지 않는다.

## 데이터 모델

실제 SQL: `supabase/migrations/20261013000000_init.sql` (제약·인덱스·RLS 포함). 아래는 요약.

```sql
create table facility (            -- 테니스장
  id uuid primary key default gen_random_uuid(),
  key text unique,                 -- 파서 facilityKey (upsert 키)
  name text not null,              -- 장충테니스장
  district text,                   -- 중구
  address text, phone text,
  lat double precision, lng double precision,
  image_url text,
  indoor boolean
);

create table court (               -- 물리적 코트
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references facility(id),
  label text not null              -- '2번'
);

create table listing (             -- 서울시 상품 (rsv_svc_id)
  svc_id text primary key,
  facility_id uuid references facility(id),
  court_id uuid references court(id),  -- 제목에 코트가 없으면 null
  title text not null,             -- 원본 상품명
  period_start date, period_end date,
  day_type text,                   -- 평일/주말
  time_band text,                  -- 주간/야간
  status text,                     -- 접수중/마감/...
  paid boolean, price_note text,
  receipt_start timestamptz, receipt_end timestamptz,
  url text,
  updated_at timestamptz default now()
);

create table watch (               -- 알림 조건 (오픈API 이벤트만)
  id uuid primary key default gen_random_uuid(),
  device_id uuid,
  facility_ids uuid[], court_ids uuid[],
  day_types text[], time_bands text[],  -- 상품 조건(평일/주말, 주간/야간)
  events text[],                   -- 'new_listing' | 'receipt_open' | 'status_change'
  enabled boolean default true
);

create table listing_event (       -- 수집기가 감지한 상품 변화 (알림 원천)
  id bigserial primary key,
  svc_id text references listing(svc_id),
  kind text not null,              -- new_listing / receipt_open / status_change
  old_status text, new_status text,
  detected_at timestamptz default now()
);

create table device (
  id uuid primary key default gen_random_uuid(),
  expo_push_token text unique,
  quiet_from time default '23:00', quiet_to time default '07:00',
  created_at timestamptz default now()
);
```

날짜별 잔여(`availability_day`)와 회차(`availability_slot`) 테이블은 **보류**. 서울시 데이터 제공을 받은 뒤 그 형식에 맞춰 추가한다. 기기에서 회차를 읽는 방식(숨은 웹뷰·세션 요청)은 쓰지 않는다.

`listing`의 day_type·time_band·court는 상품명 파서(`packages/shared/src/parseListingTitle.ts`)로 채운다. 제목에 기간이 없으면 오픈API의 SVCOPNBGNDT/SVCOPNENDDT를 쓴다.

## 수집 흐름

1. 수집기가 오픈API를 주기적으로 1회 호출(1000건 페이지, 순차, 1초에 1건 이하)해 `MINCLASSNM=테니스장`만 남긴다.
2. 상품명을 파싱해 facility·court·listing을 upsert한다.
3. 이전 값과 비교해 새 상품, 접수 시작(RCPTBGNDT 도달·상태가 접수중으로), 상태 변화를 `listing_event`에 쌓는다.
4. 이벤트에 맞는 `watch`를 찾아 Expo Push를 보낸다(방해금지·10분 묶음 규칙 적용). (미구현)

실행: GitHub Actions `.github/workflows/collector.yml`가 10분마다(`*/10 * * * *`, UTC, 공개 저장소라 실행 시간 무제한) 테스트 후 `services/collector`를 실행한다. 비밀값은 저장소 Secrets(SEOUL_OPENAPI_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COLLECTOR_CONTACT_EMAIL). 해외 IP(GitHub 러너)에서도 오픈API 응답 확인(2026-10-13). 첫 수집은 이벤트를 만들지 않는다. 공개 저장소는 60일간 활동이 없으면 예약 실행이 꺼지므로 `.github/workflows/keepalive.yml`이 매월 1일, 마지막 커밋이 20일 넘었을 때만 빈 커밋을 올린다.

## 예약 팝업 흐름

1. 상세 화면에서 코트(상품)를 누른다.
2. 해당 상품의 SVCURL을 일반 웹뷰 팝업으로 연다. 로그인 상태는 웹뷰 쿠키에 그대로 남고, 앱은 쿠키·화면 내용을 읽지 않는다.
3. 사용자가 서울시 화면에서 시간 확인·예약·결제를 직접 한다. 앱은 닫기 버튼만 제공한다.
