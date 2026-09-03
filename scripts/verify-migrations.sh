#!/usr/bin/env bash
#
# Rehearse the migration chain against a throwaway PostgreSQL database.
#
# Until this existed, "does the migration apply?" could only be answered by
# running it against the hosted project — which for a chain that drops a column,
# drops a type, and revokes table privileges is an expensive way to find a typo.
# This applies the Supabase shim, then every migration in order, then the pgTAP
# suites, and finally proves the data conversion against rows in the old shape.
#
# Requires a running PostgreSQL 17 with pgTAP available. Point PGHOST/PGPORT/
# PGUSER at it, or accept the defaults below.
#
#   ./scripts/verify-migrations.sh
#
set -euo pipefail

# `drop ... if exists` is used throughout the chain, so a clean run is full of
# "does not exist, skipping". Only warnings and errors are signal here.
export PGOPTIONS="${PGOPTIONS:--c client_min_messages=warning}"
export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-55432}"
export PGUSER="${PGUSER:-postgres}"
DB="${DB:-migration_rehearsal}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

step() { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

if ! psql -d postgres -tAc 'select 1' >/dev/null 2>&1; then
  cat >&2 <<EOF
No PostgreSQL server at $PGHOST:$PGPORT.

Start a throwaway one (Homebrew postgresql@17, plus pgTAP built from
https://github.com/theory/pgtap with 'make && make install'):

  export PATH="\$(brew --prefix postgresql@17)/bin:\$PATH" LC_ALL=C
  initdb -D /tmp/sswsco-pg -U postgres --auth=trust
  pg_ctl -D /tmp/sswsco-pg -o "-p $PGPORT -k ''" -l /tmp/sswsco-pg.log start

LC_ALL matters: without it the postmaster refuses to start on macOS, and the
socket directory is emptied because a long path exceeds the 103-byte limit.
EOF
  exit 1
fi

step "Recreating $DB"
dropdb --if-exists "$DB"
createdb "$DB"

step "Applying the Supabase compatibility shim"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/sql/supabase-bootstrap.sql" >/dev/null

step "Applying the migration chain"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  name="$(basename "$migration")"
  if output="$(psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$migration" 2>&1)"; then
    printf '  ok  %s\n' "$name"
  else
    printf '  \033[31mFAILED\033[0m %s\n' "$name"
    printf '%s\n' "$output" | grep -i 'error' | head -5
    exit 1
  fi
done

step "Running the pgTAP suites"
psql -q -d "$DB" -c 'create extension if not exists pgtap;' >/dev/null
for suite in "$ROOT"/supabase/tests/rls.sql "$ROOT"/supabase/tests/rls_behavior.sql; do
  name="$(basename "$suite")"
  results="$(psql -d "$DB" -tA -f "$suite" 2>&1)"
  if printf '%s' "$results" | grep -qE '^not ok|ERROR'; then
    printf '  \033[31mFAILED\033[0m %s\n' "$name"
    printf '%s\n' "$results" | grep -E '^not ok|ERROR' | head -10
    exit 1
  fi
  printf '  ok  %s (%s assertions)\n' "$name" "$(printf '%s' "$results" | grep -cE '^ok ')"
done

# The chain applying to an empty database says nothing about the client's rows.
# The Stripe migration rewrites every invoice's status and derives a balance
# from it, so the conversion is rehearsed here against one row per legacy state.
step "Rehearsing the data conversion on legacy-shape rows"
DATA_DB="${DB}_data"
dropdb --if-exists "$DATA_DB"
createdb "$DATA_DB"
psql -q -d "$DATA_DB" -v ON_ERROR_STOP=1 -f "$ROOT/scripts/sql/supabase-bootstrap.sql" >/dev/null
# Applied in two halves, split at the Stripe migration: everything before it,
# then the legacy rows, then it and everything after. Migrations that follow it
# build on the tables it creates, so they cannot simply be skipped.
STRIPE_MIGRATION=""
BEFORE=(); AFTER=()
for migration in "$ROOT"/supabase/migrations/*.sql; do
  case "$migration" in
    *stripe_invoice_readiness*) STRIPE_MIGRATION="$migration"; continue;;
  esac
  if [ -z "$STRIPE_MIGRATION" ]; then BEFORE+=("$migration"); else AFTER+=("$migration"); fi
done
[ -n "$STRIPE_MIGRATION" ] || fail "the Stripe readiness migration is missing"
for migration in "${BEFORE[@]}"; do
  psql -q -d "$DATA_DB" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

psql -q -d "$DATA_DB" -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
insert into public.customers(id,name,address,email,is_active)
  values ('cust-legacy','Legacy Hauling Co','9 Old Road','ap@legacy.invalid',true);
insert into public.invoices(id,invoice_number,customer_id,amount_cents,amount_paid_cents,status,due_date,notes,po_number)
values
 ('inv-draft','L-000001','cust-legacy',10000,0,'draft',current_date,'',''),
 ('inv-sent','L-000002','cust-legacy',20000,0,'sent',current_date,'',''),
 ('inv-paid','L-000003','cust-legacy',30000,30000,'paid',current_date,'',''),
 ('inv-overdue','L-000004','cust-legacy',40000,5000,'overdue',current_date,'',''),
 ('inv-closed','L-000005','cust-legacy',50000,0,'closed',current_date,'',''),
 ('inv-void','L-000006','cust-legacy',60000,0,'void',current_date,'','');
SQL

psql -q -d "$DATA_DB" -v ON_ERROR_STOP=1 -f "$STRIPE_MIGRATION" >/dev/null
for migration in "${AFTER[@]}"; do
  psql -q -d "$DATA_DB" -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

expected='inv-closed=uncollectible/50000
inv-draft=draft/10000
inv-overdue=open/35000
inv-paid=paid/0
inv-sent=open/20000
inv-void=void/0'
actual="$(psql -d "$DATA_DB" -tAc \
  "select id||'='||status||'/'||amount_remaining_cents from public.invoices order by id;")"
if [ "$actual" != "$expected" ]; then
  printf '  \033[31mFAILED\033[0m legacy status conversion\n  expected:\n%s\n  actual:\n%s\n' \
    "$expected" "$actual" >&2
  exit 1
fi
printf '  ok  every legacy status converted with the right balance\n'

# The API roles begin with no table privileges here, so this asserts the
# positive half too: the office must still be able to READ invoices. A chain
# that revokes the writes and forgets the read leaves the invoice list empty
# with no policy to explain it, which is the bug this check exists to catch.
step "Confirming the browser role can read invoices but not write them"
readable="$(psql -d "$DB" -tAc "select count(*) from information_schema.role_table_grants where table_name='invoices' and grantee='authenticated' and privilege_type='SELECT';")"
[ "$readable" = "1" ] || fail "authenticated cannot read invoices; the office would see an empty list"
writable="$(psql -d "$DB" -tAc "select count(*) from information_schema.role_table_grants where table_name='invoices' and grantee='authenticated' and privilege_type in ('INSERT','UPDATE','DELETE');")"
[ "$writable" = "0" ] || fail "authenticated can still write to invoices directly"
printf '  ok  invoices are readable and write-protected for the browser role\n'

printf '\n\033[32mMigration chain verified.\033[0m\n'
