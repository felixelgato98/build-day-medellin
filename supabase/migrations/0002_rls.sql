-- ============================================================================
-- Row Level Security
-- Todo se ancla en una sola pregunta: ¿el usuario es miembro del workspace?
-- Si alguien agrega una tabla nueva, DEBE habilitar RLS y seguir este patrón.
-- ============================================================================

alter table workspaces         enable row level security;
alter table workspace_members  enable row level security;
alter table categories         enable row level security;
alter table transactions       enable row level security;
alter table gmail_accounts     enable row level security;
alter table gmail_sync_log     enable row level security;
alter table chat_conversations enable row level security;
alter table chat_messages      enable row level security;

-- --------------------------- workspaces ------------------------------------
create policy "miembros ven su workspace"
  on workspaces for select
  using (public.is_member (id));

-- ------------------------ workspace_members --------------------------------
-- Usa is_member() (SECURITY DEFINER) para no recursar sobre esta misma tabla.
create policy "miembros ven a sus compañeros"
  on workspace_members for select
  using (public.is_member (workspace_id));

-- ---------------------------- categories -----------------------------------
create policy "miembros leen categorías"
  on categories for select
  using (public.is_member (workspace_id));

create policy "miembros escriben categorías"
  on categories for all
  using (public.is_member (workspace_id))
  with check (public.is_member (workspace_id));

-- --------------------------- transactions ----------------------------------
create policy "miembros leen transacciones"
  on transactions for select
  using (public.is_member (workspace_id));

create policy "miembros crean transacciones"
  on transactions for insert
  with check (public.is_member (workspace_id));

create policy "miembros editan transacciones"
  on transactions for update
  using (public.is_member (workspace_id))
  with check (public.is_member (workspace_id));

create policy "miembros borran transacciones"
  on transactions for delete
  using (public.is_member (workspace_id));

-- -------------------------- gmail (módulo 3) -------------------------------
-- La cuenta de Gmail es PERSONAL: solo su dueño la ve, aunque el workspace
-- sea compartido. Las transacciones que genera sí son de todos.
create policy "dueño gestiona su cuenta de gmail"
  on gmail_accounts for all
  using (user_id = auth.uid () and public.is_member (workspace_id))
  with check (user_id = auth.uid () and public.is_member (workspace_id));

create policy "miembros leen el log de sync"
  on gmail_sync_log for select
  using (public.is_member (workspace_id));

create policy "miembros escriben el log de sync"
  on gmail_sync_log for all
  using (public.is_member (workspace_id))
  with check (public.is_member (workspace_id));

-- --------------------------- chat (módulo 4) -------------------------------
-- Las conversaciones con la IA son privadas de cada usuario.
create policy "dueño gestiona sus conversaciones"
  on chat_conversations for all
  using (user_id = auth.uid () and public.is_member (workspace_id))
  with check (user_id = auth.uid () and public.is_member (workspace_id));

create policy "dueño gestiona los mensajes de sus conversaciones"
  on chat_messages for all
  using (
    exists (
      select 1 from chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.user_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.user_id = auth.uid ()
    )
  );
