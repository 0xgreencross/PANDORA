-- PANDORA GARDENS — per-wallet curated sections. Run in Supabase SQL Editor.
create table if not exists gardens (
  id bigint generated always as identity primary key,
  address text not null,             -- lowercase 0x owner
  card text not null,
  thumb text,
  ts bigint not null,
  unique(address, card)
);
alter table gardens enable row level security;
-- anyone may read every garden
create policy gardens_read on gardens for select using (true);
-- NO insert/update/delete policies for anon: writes happen ONLY through the
-- signed-action edge function (service role), which verifies the wallet signature.
