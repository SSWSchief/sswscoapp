create trigger jobs_audit after insert or update or delete on public.jobs for each row execute function public.audit_row_change();
create trigger time_requests_audit after insert or update or delete on public.time_requests for each row execute function public.audit_row_change();
