create table if not exists products (
  id text primary key,
  name text not null,
  category text not null,
  price numeric(10, 2) not null,
  old_price numeric(10, 2),
  badge text not null default 'Novo',
  collection text not null default 'Dois Elos',
  description text not null default '',
  details text not null default '',
  image text not null default 'assets/colar-elos.png',
  gallery jsonb not null default '[]'::jsonb,
  is_new boolean not null default false,
  is_best_seller boolean not null default false,
  stock integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id text primary key,
  name text not null,
  email text not null unique,
  salt text not null,
  password_hash text not null,
  role text not null default 'customer',
  created_at timestamptz not null default now()
);

create table if not exists orders (
  id text primary key,
  customer jsonb,
  shipping jsonb,
  items jsonb not null,
  subtotal numeric(10, 2) not null default 0,
  shipping_cost numeric(10, 2) not null default 0,
  free_shipping_discount numeric(10, 2) not null default 0,
  total numeric(10, 2) not null,
  payment_method text not null default 'pix',
  status text not null default 'payment_pending',
  payment_provider text,
  payment_id text,
  payment_url text,
  paid_at timestamptz,
  cancelled_at timestamptz,
  carrier text,
  tracking_code text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  coupon jsonb,
  coupon_discount numeric(10, 2) not null default 0,
  stock_reserved_until timestamptz,
  stock_released_at timestamptz,
  stock_captured_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists stock_reservations (
  id text primary key,
  order_id text not null,
  product_id text not null,
  quantity integer not null,
  status text not null default 'reserved',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists stock_reservations_product_status_idx
  on stock_reservations (product_id, status, expires_at);

create table if not exists reviews (
  id text primary key,
  product_id text not null,
  customer_name text not null,
  customer_email text,
  order_id text,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id text primary key,
  code text not null unique,
  type text not null check (type in ('percent', 'fixed')),
  value numeric(10, 2) not null,
  expires_at timestamptz,
  max_uses integer,
  min_subtotal numeric(10, 2) not null default 0,
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
