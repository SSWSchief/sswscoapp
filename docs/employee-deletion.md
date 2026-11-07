# Employee deletion

Administrators use **Employees → Manage → Account Actions → Permanently Delete
Employee**. One confirmation ("Delete Test Driver?"), then the employee is gone.
No email typing. Protected administrators, the last active administrator and
the signed-in administrator cannot be deleted.

What happens depends on whether the employee has done any work
(`202611060001_one_tap_advance_and_delete_with_history.sql`):

- **No history:** the profile and the Supabase Auth identity are deleted
  outright, as before.
- **Job, time, payroll, message or file history:** the sign-in identity is
  deleted, and the profile row is kept but marked removed (`deleted_at`,
  status inactive, no Auth link). Their email is released, so the same person
  can be added again. The row exists only so past jobs, time entries and pay
  records still show who did the work. The app loads removed profiles for name
  lookups and keeps them out of the employee list, command palette and every
  picker.

Both paths run in one database transaction and write an
`employee_permanently_deleted` audit row with the original name, employee ID
and email, attributed to the administrator.

Verification: `supabase/tests/employee_deletion.sql` and the API and dialog
tests.
