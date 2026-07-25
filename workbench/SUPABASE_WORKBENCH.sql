-- WORKBENCH VERDICTS — the curation pipeline's memory.
-- Run once in Supabase Studio → SQL editor (project llirnynoyarbvtxcekwy).
-- The anon key can only INSERT and SELECT; nothing can be edited or deleted
-- from the client. Your taste history is append-only by design.

create table if not exists public.workbench_verdicts (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  verdict    text not null check (verdict in ('KEEP','KILL')),
  tag        text check (tag in ('EMPTY','ORNAMENT','MUDDY','FLAT','DULL') or tag is null),
  card       text not null,          -- WB1- DNA card, resurrectable in the workbench
  snapshot   jsonb,                  -- full parameter genome at verdict time
  ua         text
);

alter table public.workbench_verdicts enable row level security;

create policy wb_verdicts_insert on public.workbench_verdicts
  for insert to anon with check (true);

create policy wb_verdicts_select on public.workbench_verdicts
  for select to anon using (true);
