-- ============================================================
-- Billing tables: subscriptions + payments (Asaas integration)
-- ============================================================

-- Subscriptions table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asaas_customer_id text,
  asaas_subscription_id text,
  plan text not null default 'starter' check (plan in ('starter', 'professional', 'business')),
  status text not null default 'active' check (status in ('active', 'overdue', 'canceled', 'trial')),
  billing_type text check (billing_type in ('PIX', 'BOLETO', 'CREDIT_CARD')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active subscription per workspace
create unique index if not exists subscriptions_workspace_active_idx
  on public.subscriptions (workspace_id)
  where status in ('active', 'overdue', 'trial');

-- Payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  asaas_payment_id text,
  amount numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'overdue', 'refunded')),
  billing_type text check (billing_type in ('PIX', 'BOLETO', 'CREDIT_CARD')),
  paid_at timestamptz,
  due_date date,
  invoice_url text,
  created_at timestamptz not null default now()
);

create index if not exists payments_workspace_idx on public.payments (workspace_id);
create index if not exists payments_subscription_idx on public.payments (subscription_id);

-- Update workspaces.plan default to 'free'
alter table public.workspaces alter column plan set default 'free';

-- Enable RLS
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- RLS policies for subscriptions
create policy "Members can view own workspace subscriptions"
  on public.subscriptions for select
  using (public.is_workspace_member(workspace_id));

create policy "Members can insert own workspace subscriptions"
  on public.subscriptions for insert
  with check (public.is_workspace_member(workspace_id));

create policy "Members can update own workspace subscriptions"
  on public.subscriptions for update
  using (public.is_workspace_member(workspace_id));

-- RLS policies for payments
create policy "Members can view own workspace payments"
  on public.payments for select
  using (public.is_workspace_member(workspace_id));

create policy "Members can insert own workspace payments"
  on public.payments for insert
  with check (public.is_workspace_member(workspace_id));

-- Updated_at trigger for subscriptions
create or replace function public.update_subscriptions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.update_subscriptions_updated_at();
