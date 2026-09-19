-- BRAMUlab — Bloque 3 follow-up: backfill de level_states para cuentas ya confirmadas.
--
-- Bloque 2 dejó al menos una cuenta real confirmada antes de que existiera level_states.
-- El trigger handle_email_confirmed solo actúa en nuevas confirmaciones, por lo que esas
-- identidades preexistentes necesitan una fila PENDIENTE para poder oficializar su Nivel.
-- Es idempotente y no toca cuentas que ya tengan estado.

insert into public.level_states (player_id, status)
select p.player_id, 'PENDIENTE'
from public.players p
where p.type = 'registered'
  and p.auth_user_id is not null
  and not exists (
    select 1
    from public.level_states ls
    where ls.player_id = p.player_id
  )
on conflict (player_id) do nothing;
