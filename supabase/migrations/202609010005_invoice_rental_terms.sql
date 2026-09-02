-- Rental terms on every invoice.
--
-- The client asked that an invoice go out carrying the contract and the
-- prohibited materials list -- the terms of the rental -- rather than the
-- customer having to be sent them separately. A dumpster left with the wrong
-- material in it is a $250 charge on the rate sheet, and charging for it is
-- hard to defend if the terms never travelled with the bill.
--
-- The text is one company-wide setting rather than something typed per
-- invoice, because it is boilerplate that must not vary between customers,
-- and Stripe carries it in the invoice footer, where it lands on the hosted
-- payment page and the PDF. Finalising an invoice freezes it, so an invoice
-- already issued keeps the terms it was issued under even after this is
-- edited -- the same rule the rate card will follow.
--
-- 5000 characters is Stripe's own limit on that field, verified against the
-- API. It is enforced here so over-long terms are refused when they are saved
-- rather than when someone later tries to send an invoice.

alter table public.company_settings
  add column if not exists invoice_terms text not null default '';

alter table public.company_settings
  drop constraint if exists company_settings_invoice_terms_check;
alter table public.company_settings
  add constraint company_settings_invoice_terms_check
  check (length(invoice_terms) <= 5000);

comment on column public.company_settings.invoice_terms is
  'Rental terms and prohibited materials, printed on every invoice via the Stripe invoice footer. Capped at 5000 characters to match Stripe''s own limit on that field.';

drop function if exists public.save_company_settings(text,text,text,text,text,text,integer,text);

create function public.save_company_settings(
  company_name text,
  company_address text,
  company_phone text,
  company_email text,
  company_time_zone text,
  company_date_format text,
  retention_days integer,
  invoice_prefix text,
  invoice_terms text default ''
) returns public.company_settings language plpgsql security definer set search_path='' as $$
declare changed public.company_settings;
begin
  if not public.admin_mfa_verified() then raise exception 'Administrator access required'; end if;
  if length(trim(coalesce($1,''))) < 2 then raise exception 'Company name is required'; end if;
  if nullif(trim(coalesce($4,'')),'') is not null and trim($4) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then raise exception 'Enter a valid company email'; end if;
  if $5 <> 'America/Los_Angeles' then raise exception 'Unsupported time zone'; end if;
  if $6 not in('MM/DD/YYYY','DD/MM/YYYY') then raise exception 'Unsupported date format'; end if;
  if $7 < 30 or $7 > 3650 then raise exception 'Message retention must be between 30 and 3650 days'; end if;
  if upper(trim(coalesce($8,''))) !~ '^[A-Z0-9]{2,12}$' then raise exception 'Invoice prefix must be 2 to 12 letters or numbers'; end if;
  if length(coalesce($9,'')) > 5000 then raise exception 'Invoice terms must be 5000 characters or fewer'; end if;
  update public.company_settings as settings set
    company_name=trim($1),
    address=trim(coalesce($2,'')),
    phone=trim(coalesce($3,'')),
    email=lower(trim(coalesce($4,''))),
    time_zone=$5,
    date_format=$6,
    message_retention_days=$7,
    invoice_prefix=upper(trim($8)),
    invoice_terms=trim(coalesce($9,'')),
    updated_at=now()
  where settings.id=true returning settings.* into changed;
  if changed.id is null then raise exception 'Company settings row is missing'; end if;
  return changed;
end;
$$;

grant execute on function public.save_company_settings(text,text,text,text,text,text,integer,text,text) to authenticated;
