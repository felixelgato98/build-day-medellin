-- ============================================================================
-- Todo usuario nuevo entra automáticamente al workspace del Build Day.
--
-- Esto es lo que hace que la app "simplemente funcione" en el evento: cualquiera
-- se registra y ya ve la misma data que los demás, sin invitaciones.
-- Para producción real esto se reemplaza por un flujo de invitación.
-- ============================================================================

-- UUID fijo y conocido para poder referenciarlo desde el seed y desde el código.
insert into workspaces (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Build Day Medellín')
on conflict (id) do nothing;

create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values ('00000000-0000-0000-0000-000000000001', new.id, 'member')
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user ();
