-- Record password-only administrator access as the shipped policy, not a
-- temporary state.
--
-- Migration 202608070001 disabled AAL2 enforcement for acceptance testing and
-- described itself as temporary. The project shipped that way and the client
-- accepted it as a documented residual risk, so the "temporary" and
-- "acceptance-testing" wording is now simply untrue — and reads as an
-- oversight to anyone auditing the schema later.
--
-- The function body is deliberately unchanged: this migration corrects the
-- description only. Restoring MFA is a separate, deliberate change that
-- requires administrators to enrol factors before enforcement lands, or every
-- administrator is locked out of production.
comment on function public.admin_mfa_verified() is
  'Accepted-risk policy: administrator access is password-only. Confirms an '
  'active administrator profile without requiring AAL2. Compensating controls '
  'are strong unique passwords, short administrator sessions, Auth and '
  'application rate limits, immutable owner profiles, active-profile '
  'enforcement, and audited administrator actions. Reapprove at each release.';
