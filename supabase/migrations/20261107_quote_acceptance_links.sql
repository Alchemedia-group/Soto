-- Applied as migrations `quote_acceptance_links` + `quote_acceptance_strip_line_ids` (merged here).
-- Quote acceptance by link. A quote gets an unguessable `share_token`; the client (no account) opens a public page that
-- reads/answers the quote ONLY through the two functions below. Nothing else is exposed to anonymous users.
alter table public.docs add column if not exists share_token text;
alter table public.docs add column if not exists response jsonb;
create unique index if not exists docs_share_token_key on public.docs (share_token) where share_token is not null;

create or replace function public.get_quote_for_client(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.docs;
  s jsonb;
  cname text;
begin
  if p_token is null or length(p_token) < 32 then return null; end if;
  select * into d from public.docs where share_token = p_token and type = 'quote' and deleted_at is null;
  if not found then return null; end if;
  select data into s from public.settings where owner = d.owner;
  select name into cname from public.clients where id = d.client_id and owner = d.owner;
  return jsonb_build_object(
    'number', d.number, 'date', d.date, 'status', d.status,
    'lines', coalesce((select jsonb_agg(l - 'id') from jsonb_array_elements(d.lines) as l), '[]'::jsonb),
    'irpf', d.irpf, 'notes', d.notes,
    'client_name', cname, 'response', d.response,
    'company', jsonb_build_object('name', s->>'companyName', 'nif', s->>'nif', 'address', s->>'address', 'phone', s->>'phone', 'email', s->>'email')
  );
end;
$$;

create or replace function public.respond_to_quote(p_token text, p_decision text, p_name text, p_comment text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.docs;
  resp jsonb;
begin
  if p_token is null or length(p_token) < 32 or p_decision not in ('accepted', 'rejected') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into d from public.docs where share_token = p_token and type = 'quote' and deleted_at is null for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if d.status not in ('draft', 'sent') then
    return jsonb_build_object('ok', false, 'error', 'already', 'status', d.status);
  end if;
  resp := jsonb_build_object('decision', p_decision, 'name', left(coalesce(trim(p_name), ''), 120), 'comment', left(coalesce(trim(p_comment), ''), 1000), 'at', now());
  update public.docs set status = p_decision, response = resp where id = d.id;
  return jsonb_build_object('ok', true, 'status', p_decision);
end;
$$;

revoke all on function public.get_quote_for_client(text) from public;
revoke all on function public.respond_to_quote(text, text, text, text) from public;
grant execute on function public.get_quote_for_client(text) to anon, authenticated;
grant execute on function public.respond_to_quote(text, text, text, text) to anon, authenticated;
