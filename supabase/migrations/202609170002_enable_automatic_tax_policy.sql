alter table public.company_settings
  drop constraint if exists company_settings_tax_policy_status_check;

alter table public.company_settings
  add constraint company_settings_tax_policy_status_check
  check (tax_policy_status in (
    'pending',
    'automatic_tax_approved',
    'non_taxable_approved',
    'follow_up_required'
  ));