-- Listings the open API stops returning are hidden instead of deleted (a listing that
-- briefly drops out and returns must not re-alert as new_listing).
alter table listing add column gone_at timestamptz;
create index listing_active_idx on listing (facility_id) where gone_at is null;
