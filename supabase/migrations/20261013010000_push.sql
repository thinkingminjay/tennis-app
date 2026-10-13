-- Push notifications (docs/PRD.md "알림 규칙").
-- The app has no login: it identifies itself with its Expo push token and only touches
-- device/watch/notification through the security definer functions below (tables stay RLS-locked).

alter table device
  add column platform text check (platform in ('ios', 'android')),
  add column quiet_enabled boolean not null default true,   -- 방해금지(quiet_from~quiet_to, KST) 켜짐
  add column last_event_id bigint not null default 0,       -- 이 기기에 반영한 마지막 listing_event.id
  add column updated_at timestamptz not null default now();

create table notification (        -- 보낸 알림 기록 (알림 탭)
  id bigserial primary key,
  device_id uuid not null references device(id) on delete cascade,
  title text not null,
  body text not null,
  svc_ids text[] not null,
  url text,
  sent_at timestamptz not null default now()
);
create index notification_device_sent_idx on notification (device_id, sent_at desc);
alter table notification enable row level security;

create function device_id_for(p_token text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from device where expo_push_token = p_token
$$;

create function register_device(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_token !~ '^Expo(nent)?PushToken\[[^\]]+\]$' then
    raise exception 'invalid push token' using errcode = '22023';
  end if;
  -- A new device starts after the latest event so it never gets a backlog.
  insert into device (expo_push_token, platform, last_event_id)
  values (p_token, p_platform, coalesce((select max(id) from listing_event), 0))
  on conflict (expo_push_token) do update set platform = excluded.platform, updated_at = now();
end $$;

create function set_quiet(p_token text, p_enabled boolean) returns void
language sql security definer set search_path = public as $$
  update device set quiet_enabled = p_enabled, updated_at = now() where expo_push_token = p_token
$$;

create function my_settings(p_token text) returns table (quiet_enabled boolean, quiet_from time, quiet_to time)
language sql stable security definer set search_path = public as $$
  select quiet_enabled, quiet_from, quiet_to from device where expo_push_token = p_token
$$;

create function my_watches(p_token text) returns setof watch
language sql stable security definer set search_path = public as $$
  select * from watch where device_id = device_id_for(p_token)
$$;

-- Insert when p_id is null, otherwise update the device's own watch. Returns the watch id.
create function save_watch(
  p_token text, p_id uuid,
  p_facility_ids uuid[], p_court_ids uuid[], p_day_types text[], p_time_bands text[],
  p_events text[], p_enabled boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_device uuid := device_id_for(p_token);
  v_id uuid;
begin
  if v_device is null then
    raise exception 'unknown device' using errcode = '28000';
  end if;
  if p_id is null then
    if (select count(*) from watch where device_id = v_device) >= 20 then
      raise exception 'too many watches' using errcode = '54000';
    end if;
    insert into watch (device_id, facility_ids, court_ids, day_types, time_bands, events, enabled)
    values (v_device, p_facility_ids, p_court_ids, p_day_types, p_time_bands,
            coalesce(p_events, array['new_listing', 'receipt_open', 'status_change']), coalesce(p_enabled, true))
    returning id into v_id;
  else
    update watch set facility_ids = p_facility_ids, court_ids = p_court_ids, day_types = p_day_types,
      time_bands = p_time_bands, events = coalesce(p_events, events), enabled = coalesce(p_enabled, enabled)
    where id = p_id and device_id = v_device
    returning id into v_id;
  end if;
  return v_id;
end $$;

create function delete_watch(p_token text, p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from watch where id = p_id and device_id = device_id_for(p_token)
$$;

create function my_notifications(p_token text) returns setof notification
language sql stable security definer set search_path = public as $$
  select * from notification where device_id = device_id_for(p_token) order by sent_at desc limit 50
$$;

revoke execute on function device_id_for(text) from public;
revoke execute on function register_device(text, text), set_quiet(text, boolean), my_settings(text),
  my_watches(text), save_watch(text, uuid, uuid[], uuid[], text[], text[], text[], boolean),
  delete_watch(text, uuid), my_notifications(text) from public;
grant execute on function register_device(text, text), set_quiet(text, boolean), my_settings(text),
  my_watches(text), save_watch(text, uuid, uuid[], uuid[], text[], text[], text[], boolean),
  delete_watch(text, uuid), my_notifications(text) to anon, authenticated;
