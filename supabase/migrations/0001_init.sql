-- ============================================================================
-- Build Day Medellín — schema inicial
-- Espacio compartido (workspace) + log unificado de transacciones.
--
-- REGLA DE ORO: los gastos en efectivo y los de Gmail NO son tablas aparte.
-- Son filas de `transactions` con source='cash' / source='gmail'.
-- Así el Dashboard consulta UNA sola tabla y le sirven los tres orígenes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type transaction_kind   as enum ('income', 'expense');
create type transaction_source as enum ('manual', 'cash', 'gmail', 'import');
create type member_role        as enum ('owner', 'member');

-- ---------------------------------------------------------------------------
-- Workspaces (el "hogar" compartido)
-- ---------------------------------------------------------------------------
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

create table workspace_members (
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         member_role not null default 'member',
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- Helper SECURITY DEFINER: evita la recursión infinita de RLS que se da
-- cuando una policy sobre workspace_members consulta workspace_members.
create or replace function public.is_member (ws uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members m
    where m.workspace_id = ws
      and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
create table categories (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  name         text not null,
  kind         transaction_kind not null,
  icon         text,
  color        text,
  created_at   timestamptz not null default now(),
  unique (workspace_id, name, kind)
);

-- ---------------------------------------------------------------------------
-- Transacciones — el núcleo del que dependen los 4 módulos
-- ---------------------------------------------------------------------------
create table transactions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  created_by   uuid references auth.users (id) on delete set null,

  kind         transaction_kind not null,
  -- Plata SIEMPRE en centavos y en BIGINT. Nunca float: los floats pierden
  -- precisión sumando y un dashboard de finanzas que no cuadra no sirve.
  amount_cents bigint not null check (amount_cents > 0),
  currency     text not null default 'COP',

  description  text not null,
  category_id  uuid references categories (id) on delete set null,
  occurred_at  timestamptz not null default now(),

  -- De dónde salió: manual | cash (efectivo) | gmail (Bancolombia) | import
  source       transaction_source not null default 'manual',
  -- ID estable del origen. Para Gmail = el message-id del correo.
  source_ref   text,
  merchant     text,
  -- Payload crudo del origen (correo parseado, etc.) para depurar
  raw          jsonb,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- IDEMPOTENCIA: reprocesar el buzón de Gmail no puede duplicar gastos.
-- Si el mismo message-id llega dos veces, el insert falla y se ignora.
create unique index transactions_source_ref_uniq
  on transactions (workspace_id, source, source_ref)
  where source_ref is not null;

create index transactions_ws_occurred_idx on transactions (workspace_id, occurred_at desc);
create index transactions_ws_kind_idx     on transactions (workspace_id, kind);
create index transactions_ws_category_idx on transactions (workspace_id, category_id);

-- ---------------------------------------------------------------------------
-- Gmail  (MÓDULO 3)
-- ---------------------------------------------------------------------------
create table gmail_accounts (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references workspaces (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  email         text not null,
  -- OJO: nunca guardar el refresh token en texto plano en producción.
  refresh_token text,
  last_sync_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (workspace_id, email)
);

create table gmail_sync_log (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces (id) on delete cascade,
  account_id     uuid references gmail_accounts (id) on delete cascade,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  messages_seen  int not null default 0,
  messages_saved int not null default 0,
  error          text
);

-- ---------------------------------------------------------------------------
-- Chat IA  (MÓDULO 4)
-- ---------------------------------------------------------------------------
create table chat_conversations (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null default 'Nueva conversación',
  created_at   timestamptz not null default now()
);

create table chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  -- tool calls / partes del mensaje del AI SDK
  parts           jsonb,
  created_at      timestamptz not null default now()
);

create index chat_messages_conv_idx on chat_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger transactions_touch_updated_at
  before update on transactions
  for each row execute function public.touch_updated_at ();
