-- ==========================================================================
-- F3 FIX: rate limit on the AI invoice-parse edge function
-- ==========================================================================
-- Background: docs/SECURITY_REPORT.md F3 — any authenticated non-cashier,
-- active-shop user could call ai-invoice-parse (Gemini-backed OCR)
-- repeatedly with no app-level quota, bounded only by Gemini's own API
-- limits. Cost/DoS risk against the Gemini bill on a compromised or
-- misused account, not a data-security issue — the function already
-- validates auth, role, shop status, mime type, and payload size.
--
-- Fixed hour-bucket counter, not a sliding window — simpler, and the
-- difference doesn't matter at this scale (a legitimate shop scanning a
-- stack of bills in one sitting vs. an abusive script hammering the
-- endpoint look nothing alike even with a coarse bucket). One row per
-- (shop, hour); check-and-increment is a single INSERT ... ON CONFLICT
-- ... RETURNING statement, so it's atomic under concurrent requests from
-- the same shop without needing a separate lock.
--
-- SECURITY DEFINER so the edge function (which calls this as the
-- requesting user's own session, not service_role) can write to it
-- without needing a client-facing INSERT/UPDATE policy. RLS is still
-- enabled on the table with zero policies — nothing should ever read or
-- write this table directly via the REST API, only through this RPC.
-- ==========================================================================

create table if not exists ai_parse_rate_limit (
  shop_id       uuid not null references shops(id) on delete cascade,
  window_start  timestamptz not null,
  request_count int not null default 0,
  primary key (shop_id, window_start)
);

alter table ai_parse_rate_limit enable row level security;
-- No policies: this table is written only by check_ai_rate_limit (below),
-- which runs SECURITY DEFINER and therefore doesn't need one. Deliberately
-- not client-readable either — a shop doesn't need to see its own raw
-- counter rows; the edge function tells the caller their remaining quota
-- in the 429 response body if they're over it.

create or replace function check_ai_rate_limit(p_shop_id uuid, p_limit_per_hour int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count int;
begin
  insert into ai_parse_rate_limit (shop_id, window_start, request_count)
  values (p_shop_id, v_window, 1)
  on conflict (shop_id, window_start)
  do update set request_count = ai_parse_rate_limit.request_count + 1
  returning request_count into v_count;

  return jsonb_build_object(
    'allowed', v_count <= p_limit_per_hour,
    'count', v_count,
    'limit', p_limit_per_hour,
    'window_resets_at', v_window + interval '1 hour'
  );
end;
$$;

grant execute on function check_ai_rate_limit(uuid, int) to authenticated;

-- Old buckets are never read again after their hour passes and are cheap
-- (one row per shop per hour) — not worth a scheduled cleanup job at this
-- table's expected size. Revisit if/when this becomes a real volume.
