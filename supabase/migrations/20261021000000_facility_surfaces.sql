-- 코트 바닥 재질: 수집기가 오픈API 안내문(DTLCONT)·상품명에서 단어로 추정한 값. 모르면 null.
alter table facility add column surfaces text[]
  check (surfaces <@ array['hard', 'clay', 'grass']);
