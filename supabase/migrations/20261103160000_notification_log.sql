-- Avisos programados sin repetirse (MODELO-DATOS §3.7): qué se ha enviado a quién y por qué canal.
-- El cron diario (Vercel Cron → /api/cron/daily) lo consulta antes de enviar. Decisión D-061.

create type public.notification_kind as enum (
  'unread_messages', 'listing_expiring', 'listing_expired',
  'premium_expiring', 'premium_activated', 'listing_blocked'
);

create table public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.notification_kind not null,
  -- A qué se refiere el aviso: el anuncio, o la fecha de fin del periodo Premium (aaaa-mm-dd).
  ref text not null check (char_length(ref) between 1 and 80),
  channel text not null check (channel in ('push', 'email')),
  sent_at timestamptz not null default now(),
  constraint notification_log_once unique (user_id, kind, ref, channel)
);

-- Solo el servidor (service_role): RLS sin políticas.
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;
