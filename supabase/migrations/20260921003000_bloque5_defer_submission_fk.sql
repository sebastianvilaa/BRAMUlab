-- BRAMUlab — Backend Bloque 5 hotfix: defer match_revisions -> match_submissions FK
--
-- create_or_attach_match intentionally writes the revision before persisting the final
-- match_submissions result payload. The FK therefore must be checked at transaction end,
-- not statement-by-statement. This keeps the audit link without forcing placeholder
-- submissions or weakening idempotency.
alter table public.match_revisions
  drop constraint if exists match_revisions_input_submission_id_fkey;

alter table public.match_revisions
  add constraint match_revisions_input_submission_id_fkey
  foreign key (input_submission_id)
  references public.match_submissions (idempotency_key)
  deferrable initially deferred;
