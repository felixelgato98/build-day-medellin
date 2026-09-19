/**
 * Tipos de la base de datos.
 *
 * Escritos a mano para que el equipo arranque sin depender de un Supabase vivo.
 * Cuando la DB esté provisionada se pueden regenerar con:
 *   npm run db:types
 * Si cambiás una migración, actualizá este archivo en el MISMO PR.
 */

export type TransactionKind = 'income' | 'expense'
export type TransactionSource = 'manual' | 'cash' | 'gmail' | 'import'
export type MemberRole = 'owner' | 'member'
export type ChatRole = 'user' | 'assistant' | 'system'

export type Workspace = {
  id: string
  name: string
  created_at: string
}

export type WorkspaceMember = {
  workspace_id: string
  user_id: string
  role: MemberRole
  created_at: string
}

export type Category = {
  id: string
  workspace_id: string
  name: string
  kind: TransactionKind
  icon: string | null
  color: string | null
  created_at: string
}

export type Transaction = {
  id: string
  workspace_id: string
  created_by: string | null
  kind: TransactionKind
  /** SIEMPRE centavos. Usá los helpers de @/lib/money para formatear. */
  amount_cents: number
  currency: string
  description: string
  category_id: string | null
  occurred_at: string
  source: TransactionSource
  /** ID estable del origen (message-id de Gmail). Garantiza idempotencia. */
  source_ref: string | null
  merchant: string | null
  raw: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/** Transacción con su categoría ya resuelta — lo que consumen las vistas. */
export type TransactionWithCategory = Transaction & {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'> | null
}

export type GmailAccount = {
  id: string
  workspace_id: string
  user_id: string
  email: string
  refresh_token: string | null
  last_sync_at: string | null
  created_at: string
}

export type GmailSyncLog = {
  id: string
  workspace_id: string
  account_id: string | null
  started_at: string
  finished_at: string | null
  messages_seen: number
  messages_saved: number
  error: string | null
}

export type ChatConversation = {
  id: string
  workspace_id: string
  user_id: string
  title: string
  created_at: string
}

export type ChatMessage = {
  id: string
  conversation_id: string
  role: ChatRole
  content: string
  parts: Record<string, unknown> | null
  created_at: string
}

type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: Workspace
        Insert: Insert<Workspace, 'id' | 'created_at'>
        Update: Partial<Workspace>
        Relationships: []
      }
      workspace_members: {
        Row: WorkspaceMember
        Insert: Insert<WorkspaceMember, 'role' | 'created_at'>
        Update: Partial<WorkspaceMember>
        Relationships: []
      }
      categories: {
        Row: Category
        Insert: Insert<Category, 'id' | 'icon' | 'color' | 'created_at'>
        Update: Partial<Category>
        Relationships: []
      }
      transactions: {
        Row: Transaction
        Insert: Insert<
          Transaction,
          | 'id' | 'created_by' | 'currency' | 'category_id' | 'occurred_at'
          | 'source' | 'source_ref' | 'merchant' | 'raw'
          | 'created_at' | 'updated_at'
        >
        Update: Partial<Transaction>
        Relationships: []
      }
      gmail_accounts: {
        Row: GmailAccount
        Insert: Insert<GmailAccount, 'id' | 'refresh_token' | 'last_sync_at' | 'created_at'>
        Update: Partial<GmailAccount>
        Relationships: []
      }
      gmail_sync_log: {
        Row: GmailSyncLog
        Insert: Insert<
          GmailSyncLog,
          'id' | 'account_id' | 'started_at' | 'finished_at'
          | 'messages_seen' | 'messages_saved' | 'error'
        >
        Update: Partial<GmailSyncLog>
        Relationships: []
      }
      chat_conversations: {
        Row: ChatConversation
        Insert: Insert<ChatConversation, 'id' | 'title' | 'created_at'>
        Update: Partial<ChatConversation>
        Relationships: []
      }
      chat_messages: {
        Row: ChatMessage
        Insert: Insert<ChatMessage, 'id' | 'parts' | 'created_at'>
        Update: Partial<ChatMessage>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_member: {
        Args: { ws: string }
        Returns: boolean
      }
    }
    Enums: {
      transaction_kind: TransactionKind
      transaction_source: TransactionSource
      member_role: MemberRole
    }
    CompositeTypes: Record<string, never>
  }
}
