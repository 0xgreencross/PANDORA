-- PANDORA PUBLIC VAULT — paste this whole file into Supabase: SQL Editor -> Run
-- One change required: replace CHOOSE_YOUR_SECRET below with your curator passphrase.

create table if not exists vault (
  card  text primary key,
  thumb text,
  ts    bigint not null
);

alter table vault enable row level security;

-- anyone may read the collection
create policy vault_read on vault for select using (true);

-- anyone may store a loop (size-capped; card format sanity-checked)
create policy vault_insert on vault for insert
  with check (length(card) between 20 and 48 and card like 'PNDR-%'
              and length(coalesce(thumb,'')) < 9000);

-- NO delete/update policies exist: the anon key cannot delete. Ever.

-- deletion happens only through this function, guarded by your passphrase,
-- which lives here in the database — never in the app's source.
create or replace function vault_delete(p_card text, p_pass text)
returns void language plpgsql security definer as $$
begin
  if p_pass = 'CHOOSE_YOUR_SECRET' then
    delete from vault where card = p_card;
  else
    raise exception 'curator only';
  end if;
end $$;
