-- 푸시 발송 결과(Expo push receipt). 보낼 때 받은 ticket_id를 저장하고, 15분 뒤 다음 수집에서
-- 결과를 받아 receipt에 'ok' 또는 오류 코드(DeviceNotRegistered 등)를 적는다.
alter table notification
  add column ticket_id text,
  add column receipt text;

create index notification_receipt_pending_idx on notification (sent_at)
  where ticket_id is not null and receipt is null;
