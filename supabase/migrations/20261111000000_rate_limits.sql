-- Fixed-window rate limiting for POST /api/generate.
-- Counts are keyed by "anon:<ip>" or "user:<uuid>" so anonymous traffic is
-- limited per IP while signed-in traffic is limited per account.

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0 check (count >= 0),
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

-- Intentionally no policies: clients cannot read or write this table directly.
-- The only supported path is the function below, which the server calls.

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, current_count integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_count integer;
  v_window_start timestamptz;
begin
  -- A single upsert is atomic, so concurrent requests cannot lose increments.
  insert into public.rate_limits as rl (key, count, window_start)
  values (p_key, 1, v_now)
  on conflict (key) do update
    set count = case
          when rl.window_start + make_interval(secs => p_window_seconds) <= v_now then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start + make_interval(secs => p_window_seconds) <= v_now then v_now
          else rl.window_start
        end
  returning rl.count, rl.window_start into v_count, v_window_start;

  return query
    select
      v_count <= p_limit,
      v_count,
      v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, integer, integer) to anon, authenticated;
