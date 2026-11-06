# Permanent employee deletion

Administrators, including Austin and management with Administrator access, use
**Employees → Manage → Account Actions → Permanently Delete Employee**.
Account Actions appears above the permissions list on phones and at the top
of the sidebar on desktop. Permanent deletion has its own separated section
below the ordinary password and activation controls.

The confirmation dialog identifies the employee and requires their email to
be typed. The server verifies that email against the current record. Protected
administrators and the signed-in administrator cannot be deleted.

Deletion removes the employee profile and linked Supabase Auth identity in one
database transaction. Sign-in sessions tied to that identity are removed by
Supabase's Auth foreign keys. Existing row-level access policies also require
a current employee profile. The email and employee ID become available again.
An audit record remains, including who performed the deletion.

Employees with job assignments, time entries, payroll adjustments, messages,
acknowledgements, or other business references cannot be deleted. The database
checks employee foreign keys before deletion, including references that would
otherwise cascade or become null. Employees who own uploaded files are also
blocked. Management receives an explanation directing them to **Deactivate
Employee**, which removes access while preserving the records. Personal
notifications, push subscriptions, channel memberships and message-read state
may be discarded when an otherwise unused employee is deleted.

Deploy migration `202611050001_permanent_employee_deletion.sql` before releasing
the app update. The API calls the RPC with the administrator's own session;
the RPC is unavailable to anonymous callers and rechecks administrator access.
It does not require a new environment variable or grant dispatchers deletion
permission through module overrides. No existing accounts are deleted by the
migration or by deploying this feature.

Verification includes the API and confirmation-dialog tests and
`supabase/tests/employee_deletion.sql`. The SQL suite checks authorization,
protected accounts, typed confirmation, history and storage guards, newly
introduced foreign keys, Auth/profile deletion, reuse of IDs and email,
and complete rollback after a simulated Auth deletion failure.
