#!/usr/bin/env bash
# ==============================================================================
# BILLNAW — RPC/RLS test database setup
#
# Spins up a throwaway local PostgreSQL cluster, applies every migration in
# supabase/migrations/ exactly as Supabase would, adds a minimal stand-in for
# Supabase's `auth` schema (auth.users + auth.uid()), and creates a
# non-superuser `app_user` role so RLS policies are genuinely enforced when
# tests run as that role — running tests as the Postgres superuser or table
# owner would make every RLS check a false positive, since both bypass RLS
# entirely regardless of policy.
#
# Usage:
#   tests/rpc-rls-setup.sh              # set up (idempotent-ish: safe to
#                                         # re-run, drops and recreates the DB)
#   tests/rpc-rls-setup.sh teardown     # stop and remove the throwaway cluster
#
# Requires: PostgreSQL 16 client+server binaries on PATH (or adjust PG_BIN
# below), and a `postgres` OS user to run the cluster as (initdb/postgres
# refuse to run as root). On Debian/Ubuntu this exists once the `postgresql`
# package is installed; create one yourself if it's missing:
#   useradd -m -s /bin/bash postgres
#
# After setup, run: node tests/rpc-rls-tests.js
# (or `npm run test:rpc`, which runs setup + tests + teardown together)
# ==============================================================================
set -euo pipefail

PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PGDATA_DIR="${PGDATA_DIR:-/tmp/billnaw_pgtest}"
SOCK_DIR="$PGDATA_DIR/sock"
DB_NAME="billnaw_test"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$(cd "$SCRIPT_DIR/../supabase/migrations" && pwd)"

if [ "${1:-}" = "teardown" ]; then
  if [ -d "$PGDATA_DIR/data" ]; then
    su postgres -c "$PG_BIN/pg_ctl -D $PGDATA_DIR/data stop -m fast" 2>/dev/null || true
  fi
  rm -rf "$PGDATA_DIR"
  echo "Torn down $PGDATA_DIR"
  exit 0
fi

mkdir -p "$PGDATA_DIR" "$SOCK_DIR"
chown -R postgres:postgres "$PGDATA_DIR"

if [ ! -d "$PGDATA_DIR/data" ]; then
  su postgres -c "$PG_BIN/initdb -D $PGDATA_DIR/data --auth=trust -U postgres" >/dev/null
fi

if ! su postgres -c "$PG_BIN/pg_isready -h $SOCK_DIR" >/dev/null 2>&1; then
  su postgres -c "$PG_BIN/pg_ctl -D $PGDATA_DIR/data -l $PGDATA_DIR/log.txt -o \"-c listen_addresses='' -c unix_socket_directories=$SOCK_DIR\" start"
  for i in $(seq 1 20); do
    su postgres -c "$PG_BIN/pg_isready -h $SOCK_DIR" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

su postgres -c "$PG_BIN/dropdb -h $SOCK_DIR --if-exists $DB_NAME"
su postgres -c "$PG_BIN/createdb -h $SOCK_DIR $DB_NAME"

cat > "$PGDATA_DIR/00_auth_stub.sql" << 'SQL'
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user with login;
  end if;
end
$$;
SQL
chown postgres:postgres "$PGDATA_DIR/00_auth_stub.sql"

su postgres -c "$PG_BIN/psql -h $SOCK_DIR -d $DB_NAME -v ON_ERROR_STOP=1 -q -f $PGDATA_DIR/00_auth_stub.sql"

for f in 0001_init.sql 0002_stock_rpc.sql 0003_atomic_invoice.sql \
         0004_role_cost_visibility.sql 0005_sales_returns.sql \
         0006_alerts_logo_composition.sql 0007_purchases_vendors.sql \
         0008_subscription_plans.sql 0009_customer_lifecycle_b2b.sql \
         0010_shop_signup_atomic.sql; do
  su postgres -c "$PG_BIN/psql -h $SOCK_DIR -d $DB_NAME -v ON_ERROR_STOP=1 -q -f $MIGRATIONS_DIR/$f"
done

su postgres -c "$PG_BIN/psql -h $SOCK_DIR -d $DB_NAME -q -c \"
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;
\""

echo "RPC/RLS test database ready at socket $SOCK_DIR, database $DB_NAME"
echo "  admin connection (bypasses RLS, for fixtures): postgresql://postgres@/$DB_NAME?host=$SOCK_DIR"
echo "  app_user connection (RLS enforced):            postgresql://app_user@/$DB_NAME?host=$SOCK_DIR"
