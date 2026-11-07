-- Applied as migration `docs_cancelled_status`.
-- Invoices can be cancelled ("anulada"). `cancelled` records when, the former number and whether the number was released for reuse.
alter table public.docs drop constraint if exists docs_status_check;
alter table public.docs add constraint docs_status_check
  check (status in ('draft', 'sent', 'accepted', 'rejected', 'paid', 'cancelled'));
alter table public.docs add column if not exists cancelled jsonb;
