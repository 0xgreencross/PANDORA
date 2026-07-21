-- DITHERVOID // PANDORA — production tables. Run once in SQL Editor.

-- 1. the machine's senses (E8.0)
create table if not exists events (
  id bigint generated always as identity primary key,
  ts bigint not null, type text not null, card text not null,
  reason text, rev text
);
alter table events enable row level security;
create policy "anon insert events" on events for insert to anon with check (true);
create policy "anon read events"   on events for select to anon using (true);

-- 2. era stamp on the vault
alter table vault add column if not exists rev text;

-- 3. gardens: per-wallet saved loops (free, no gas)
create table if not exists garden_items (
  id bigint generated always as identity primary key,
  ts bigint not null, wallet text not null, card text not null,
  thumb text, rev text,
  unique (wallet, card)
);
alter table garden_items enable row level security;
create policy "anon insert garden" on garden_items for insert to anon with check (true);
create policy "anon read garden"   on garden_items for select to anon using (true);

-- 4. likes: one per wallet per loop
create table if not exists likes (
  id bigint generated always as identity primary key,
  ts bigint not null, wallet text not null, card text not null,
  unique (wallet, card)
);
alter table likes enable row level security;
create policy "anon insert likes" on likes for insert to anon with check (true);
create policy "anon read likes"   on likes for select to anon using (true);

-- 5. showcase: artworks made with the loops (auto-published; hide via flag)
create table if not exists showcase (
  id bigint generated always as identity primary key,
  ts bigint not null, artist text not null, xhandle text,
  url text not null, image text, dna text, statement text,
  hidden boolean default false
);
alter table showcase enable row level security;
create policy "anon insert showcase" on showcase for insert to anon with check (true);
create policy "anon read showcase"   on showcase for select to anon using (true);

-- 6. STORAGE: dashboard → Storage → New bucket → name: posters → PUBLIC bucket.
--    Then Policies → allow anon INSERT on bucket posters.
--    Your public base URL (for the contract constructor) is:
--    https://<project-ref>.supabase.co/storage/v1/object/public/posters/
