const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "data", "db.json");
const productsPath = path.join(__dirname, "data", "products.json");
let pgPool = null;
let schemaReady = false;
const isProduction = process.env.NODE_ENV === "production";

function hasPostgres() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  if (!hasPostgres()) {
    if (isProduction) throw new Error("DATABASE_URL e obrigatoria em producao.");
    return null;
  }
  if (pgPool) return pgPool;

  try {
    const { Pool } = require("pg");
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
    });
    return pgPool;
  } catch (error) {
    if (isProduction) throw error;
    console.warn("Pacote pg nao instalado. Usando JSON local como fallback.");
    return null;
  }
}

async function ensureSchema() {
  const pool = getPool();
  if (!pool || schemaReady) return;
  await pool.query(`
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
      created_at timestamptz not null default now()
    );

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

    alter table orders add column if not exists payment_provider text;
    alter table orders add column if not exists payment_id text;
    alter table orders add column if not exists payment_url text;
    alter table orders add column if not exists paid_at timestamptz;
    alter table orders add column if not exists cancelled_at timestamptz;
    alter table orders add column if not exists carrier text;
    alter table orders add column if not exists tracking_code text;
    alter table orders add column if not exists shipped_at timestamptz;
    alter table orders add column if not exists delivered_at timestamptz;
    alter table orders add column if not exists coupon jsonb;
    alter table orders add column if not exists coupon_discount numeric(10, 2) not null default 0;
    alter table orders add column if not exists stock_reserved_until timestamptz;
    alter table orders add column if not exists stock_released_at timestamptz;
    alter table orders add column if not exists stock_captured_at timestamptz;
    alter table customers add column if not exists role text not null default 'customer';
    alter table reviews add column if not exists customer_email text;
    alter table reviews add column if not exists order_id text;
    alter table reviews add column if not exists verified_purchase boolean not null default false;

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
  `);
  schemaReady = true;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function isConnectionError(error) {
  return ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].includes(error?.code) || error?.errors?.some?.((item) => isConnectionError(item));
}

function warnPostgresFallback(error) {
  if (isProduction) return false;
  if (isConnectionError(error)) {
    console.warn("PostgreSQL indisponivel. Usando JSON local como fallback para esta operacao.");
    return true;
  }
  return false;
}

async function listProducts() {
  const pool = getPool();
  if (!pool) return readJson(productsPath);
  await ensureSchema();
  const result = await pool.query("select * from products order by created_at desc, name asc");
  if (!result.rows.length) {
    await seedProductsFromJson(pool);
    const seeded = await pool.query("select * from products order by created_at desc, name asc");
    return seeded.rows.map(fromDbProduct);
  }
  return result.rows.map(fromDbProduct);
}

async function seedProductsFromJson(pool) {
  const products = readJson(productsPath);
  for (const product of products) {
    const payload = normalizeProduct(product);
    await pool.query(
      `insert into products
        (id, name, category, price, old_price, badge, collection, description, details, image, gallery, is_new, is_best_seller, stock)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       on conflict (id) do nothing`,
      [
        payload.id,
        payload.name,
        payload.category,
        payload.price,
        payload.oldPrice,
        payload.badge,
        payload.collection,
        payload.description,
        payload.details,
        payload.image,
        JSON.stringify(payload.gallery),
        payload.isNew,
        payload.isBestSeller,
        payload.stock,
      ]
    );
  }
}

async function getProduct(productId) {
  const pool = getPool();
  if (!pool) return readJson(productsPath).find((item) => item.id === productId);
  await ensureSchema();
  const result = await pool.query("select * from products where id = $1", [productId]);
  return result.rows[0] ? fromDbProduct(result.rows[0]) : null;
}

async function createProduct(product) {
  const pool = getPool();
  const payload = normalizeProduct(product);
  if (!pool) {
    const products = readJson(productsPath);
    products.unshift(payload);
    writeJson(productsPath, products);
    return payload;
  }
  await ensureSchema();

  const result = await pool.query(
    `insert into products
      (id, name, category, price, old_price, badge, collection, description, details, image, gallery, is_new, is_best_seller, stock)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning *`,
    [
      payload.id,
      payload.name,
      payload.category,
      payload.price,
      payload.oldPrice,
      payload.badge,
      payload.collection,
      payload.description,
      payload.details,
      payload.image,
      JSON.stringify(payload.gallery),
      payload.isNew,
      payload.isBestSeller,
      payload.stock,
    ]
  );
  return fromDbProduct(result.rows[0]);
}

async function listCustomers() {
  const pool = getPool();
  if (!pool) return readJson(dbPath).customers.map(publicCustomer);
  try {
    await ensureSchema();
    const result = await pool.query("select id, name, email, role, created_at from customers order by created_at desc");
    return result.rows.map((customer) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      role: customer.role || "customer",
      createdAt: customer.created_at,
    }));
  } catch (error) {
    if (warnPostgresFallback(error)) return readJson(dbPath).customers.map(publicCustomer);
    throw error;
  }
}

async function findCustomerByEmail(email) {
  const pool = getPool();
  if (!pool) return readJson(dbPath).customers.find((customer) => customer.email === email);
  try {
    await ensureSchema();
    const result = await pool.query("select * from customers where email = $1", [email]);
    return result.rows[0] ? fromDbCustomer(result.rows[0]) : null;
  } catch (error) {
    if (warnPostgresFallback(error)) return readJson(dbPath).customers.find((customer) => customer.email === email);
    throw error;
  }
}

async function createCustomer(customer) {
  const pool = getPool();
  if (!pool) {
    const db = readJson(dbPath);
    db.customers.push(customer);
    writeJson(dbPath, db);
    return customer;
  }
  try {
    await ensureSchema();
    const result = await pool.query(
      "insert into customers (id, name, email, salt, password_hash, role, created_at) values ($1,$2,$3,$4,$5,$6,$7) returning *",
      [customer.id, customer.name, customer.email, customer.salt, customer.passwordHash, customer.role || "customer", customer.createdAt]
    );
    return fromDbCustomer(result.rows[0]);
  } catch (error) {
    if (!warnPostgresFallback(error)) throw error;
    const db = readJson(dbPath);
    db.customers.push(customer);
    writeJson(dbPath, db);
    return customer;
  }
}

async function createOrder(order) {
  const pool = getPool();
  if (!pool) {
    const db = readJson(dbPath);
    db.orders.push(order);
    writeJson(dbPath, db);
    return order;
  }
  await ensureSchema();

  const result = await pool.query(
    `insert into orders
      (id, customer, shipping, items, subtotal, shipping_cost, free_shipping_discount, total, payment_method, status, payment_provider, payment_id, payment_url, coupon, coupon_discount, stock_reserved_until, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     returning *`,
    [
      order.id,
      order.customer,
      order.shipping,
      JSON.stringify(order.items),
      order.subtotal,
      order.shippingCost,
      order.freeShippingDiscount,
      order.total,
      order.paymentMethod,
      order.status,
      order.paymentProvider || null,
      order.paymentId || null,
      order.paymentUrl || null,
      order.coupon || null,
      order.couponDiscount || 0,
      order.stockReservedUntil || null,
      order.createdAt,
    ]
  );
  return fromDbOrder(result.rows[0]);
}

async function updateOrderPayment(orderId, payment) {
  const pool = getPool();
  if (!pool) {
    const db = readJson(dbPath);
    const order = db.orders.find((item) => item.id === orderId);
    if (!order) return null;
    Object.assign(order, {
      paymentProvider: payment.provider || order.paymentProvider,
      paymentId: payment.paymentId || payment.checkoutId || order.paymentId,
      paymentUrl: payment.redirectUrl || order.paymentUrl,
    });
    writeJson(dbPath, db);
    return order;
  }
  await ensureSchema();
  const result = await pool.query(
    `update orders
       set payment_provider = $2, payment_id = $3, payment_url = $4
     where id = $1
     returning *`,
    [orderId, payment.provider || "pagbank", payment.paymentId || payment.checkoutId || null, payment.redirectUrl || null]
  );
  return result.rows[0] ? fromDbOrder(result.rows[0]) : null;
}

async function updateOrderStatus(orderId, status, metadata = {}) {
  const pool = getPool();
  if (!pool) {
    const db = readJson(dbPath);
    const order = db.orders.find((item) => item.id === orderId);
    if (!order) return null;
    order.status = status;
    order.carrier = metadata.carrier || order.carrier;
    if (metadata.trackingCode) order.trackingCode = metadata.trackingCode;
    if (status === "paid") order.paidAt = new Date().toISOString();
    if (status === "shipped") order.shippedAt = metadata.shippedAt || new Date().toISOString();
    if (status === "delivered") order.deliveredAt = metadata.deliveredAt || new Date().toISOString();
    if (["cancelled", "expired", "refunded"].includes(status)) order.cancelledAt = new Date().toISOString();
    writeJson(dbPath, db);
    return order;
  }
  await ensureSchema();
  const result = await pool.query(
    `update orders
       set status = $2,
           paid_at = case when $2 = 'paid' and paid_at is null then now() else paid_at end,
           cancelled_at = case when $2 in ('cancelled', 'expired', 'refunded') and cancelled_at is null then now() else cancelled_at end,
           carrier = coalesce($3, carrier),
           tracking_code = coalesce($4, tracking_code),
           shipped_at = case when $2 = 'shipped' then coalesce($5::timestamptz, shipped_at, now()) else shipped_at end,
           delivered_at = case when $2 = 'delivered' then coalesce($6::timestamptz, delivered_at, now()) else delivered_at end
     where id = $1
     returning *`,
    [orderId, status, metadata.carrier || null, metadata.trackingCode || null, metadata.shippedAt || null, metadata.deliveredAt || null]
  );
  return result.rows[0] ? fromDbOrder(result.rows[0]) : null;
}

async function createReview(review) {
  const pool = getPool();
  if (!pool) {
    const db = readJson(dbPath);
    db.reviews = db.reviews || [];
    db.reviews.unshift(review);
    writeJson(dbPath, db);
    return review;
  }

  const result = await pool.query(
    "insert into reviews (id, product_id, customer_name, customer_email, order_id, rating, comment, verified_purchase, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *",
    [review.id, review.productId, review.customerName, review.customerEmail, review.orderId, review.rating, review.comment, review.verifiedPurchase, review.createdAt]
  );
  return fromDbReview(result.rows[0]);
}

async function listReviews(productId) {
  const pool = getPool();
  if (!pool) {
    const db = readJson(dbPath);
    return (db.reviews || []).filter((review) => !productId || review.productId === productId);
  }

  const result = productId
    ? await pool.query("select * from reviews where product_id = $1 order by created_at desc", [productId])
    : await pool.query("select * from reviews order by created_at desc");
  return result.rows.map(fromDbReview);
}

async function findVerifiedPurchase(email, productId) {
  const eligibleStatuses = new Set(["paid", "preparing", "shipped", "delivered"]);
  const orders = await listOrders();
  return orders.find((order) => {
    if (String(order.customer?.email || "").toLowerCase() !== String(email || "").toLowerCase()) return false;
    if (!eligibleStatuses.has(order.status)) return false;
    return (order.items || []).some((item) => item.id === productId);
  }) || null;
}

async function findOrderForTracking(codeOrId, email) {
  const value = String(codeOrId || "").trim().toLowerCase();
  const emailValue = String(email || "").trim().toLowerCase();
  if (!value) return null;
  const orders = await listOrders();
  return orders.find((order) => {
    const matchesCode = String(order.id || "").toLowerCase().startsWith(value) || String(order.trackingCode || "").toLowerCase() === value;
    const matchesEmail = !emailValue || String(order.customer?.email || "").toLowerCase() === emailValue;
    return matchesCode && matchesEmail;
  }) || null;
}

async function createCoupon(coupon) {
  const pool = getPool();
  if (!pool) {
    const db = readJson(dbPath);
    db.coupons = db.coupons || [];
    db.coupons.unshift(coupon);
    writeJson(dbPath, db);
    return coupon;
  }

  const result = await pool.query(
    `insert into coupons
      (id, code, type, value, expires_at, max_uses, min_subtotal, used_count, active, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     returning *`,
    [
      coupon.id,
      coupon.code,
      coupon.type,
      coupon.value,
      coupon.expiresAt,
      coupon.maxUses,
      coupon.minSubtotal,
      coupon.usedCount,
      coupon.active,
      coupon.createdAt,
    ]
  );
  return fromDbCoupon(result.rows[0]);
}

async function listCoupons() {
  const pool = getPool();
  if (!pool) return readJson(dbPath).coupons || [];
  const result = await pool.query("select * from coupons order by created_at desc");
  return result.rows.map(fromDbCoupon);
}

async function deleteCoupon(couponId) {
  const pool = getPool();
  if (!pool) {
    const db = readJson(dbPath);
    db.coupons = (db.coupons || []).filter((coupon) => coupon.id !== couponId);
    writeJson(dbPath, db);
    return true;
  }

  await pool.query("delete from coupons where id = $1", [couponId]);
  return true;
}

async function listOrders() {
  const pool = getPool();
  if (!pool) return readJson(dbPath).orders;
  await ensureSchema();
  const result = await pool.query("select * from orders order by created_at desc");
  return result.rows.map(fromDbOrder);
}

async function getOrder(orderId) {
  const orders = await listOrders();
  return orders.find((order) => order.id === orderId) || null;
}

async function getDashboardMetrics() {
  const [orders, customers, products] = await Promise.all([listOrders(), listCustomers(), listProducts()]);
  const revenueStatuses = new Set(["paid", "preparing", "shipped", "delivered"]);
  const revenueOrders = orders.filter((order) => revenueStatuses.has(order.status));
  const revenue = orders
    .filter((order) => !["cancelled", "expired", "refunded"].includes(order.status))
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const soldByProduct = new Map();
  const customersByRevenue = new Map();
  const couponsByUse = new Map();
  const revenueByMonth = new Map();

  revenueOrders.forEach((order) => {
    const monthKey = new Date(order.createdAt).toISOString().slice(0, 7);
    revenueByMonth.set(monthKey, (revenueByMonth.get(monthKey) || 0) + Number(order.total || 0));
    const customerEmail = order.customer?.email || "Visitante";
    const customerName = order.customer?.name || customerEmail;
    const currentCustomer = customersByRevenue.get(customerEmail) || { name: customerName, email: customerEmail, orders: 0, total: 0 };
    currentCustomer.orders += 1;
    currentCustomer.total += Number(order.total || 0);
    customersByRevenue.set(customerEmail, currentCustomer);
    (order.items || []).forEach((item) => {
      soldByProduct.set(item.name, (soldByProduct.get(item.name) || 0) + Number(item.quantity || 0));
    });
    if (order.coupon?.code) {
      const code = order.coupon.code;
      const currentCoupon = couponsByUse.get(code) || { code, uses: 0, discount: 0 };
      currentCoupon.uses += 1;
      currentCoupon.discount += Number(order.couponDiscount || 0);
      couponsByUse.set(code, currentCoupon);
    }
  });

  return {
    recentOrders: orders.slice(0, 6),
    revenue,
    customersCount: customers.length,
    productsCount: products.length,
    bestSellers: [...soldByProduct.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity })),
    revenueByMonth: [...revenueByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, total]) => ({ month, total })),
    topCustomers: [...customersByRevenue.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
    topCoupons: [...couponsByUse.values()]
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 5),
    lowStock: products.filter((product) => Number(product.stock || 0) <= 3),
  };
}

async function reserveStock(orderId, items, expiresAt) {
  const pool = getPool();
  if (!pool) {
    const products = readJson(productsPath);
    for (const item of items) {
      const product = products.find((candidate) => candidate.id === item.id);
      if (!product || Number(product.stock || 0) < Number(item.quantity)) {
        return { ok: false, product: product?.name || item.id };
      }
    }
    return { ok: true };
  }
  await ensureSchema();

  const client = await pool.connect();
  try {
    await client.query("begin");
    for (const item of items) {
      const result = await client.query(
        `select p.name, p.stock,
          coalesce(sum(case when r.status = 'reserved' and r.expires_at > now() then r.quantity else 0 end), 0) as reserved
         from products p
         left join stock_reservations r on r.product_id = p.id
         where p.id = $1
         group by p.id`,
        [item.id]
      );
      const product = result.rows[0];
      const available = Number(product?.stock || 0) - Number(product?.reserved || 0);
      if (!product || available < Number(item.quantity)) {
        await client.query("rollback");
        return { ok: false, product: product?.name || item.name || item.id };
      }
      await client.query(
        "insert into stock_reservations (id, order_id, product_id, quantity, status, expires_at) values ($1,$2,$3,$4,'reserved',$5)",
        [`${orderId}:${item.id}`, orderId, item.id, Number(item.quantity), expiresAt]
      );
    }
    await client.query("update orders set stock_reserved_until = $2 where id = $1", [orderId, expiresAt]);
    await client.query("commit");
    return { ok: true };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function checkStock(items) {
  const pool = getPool();
  if (!pool) {
    const products = readJson(productsPath);
    for (const item of items) {
      const product = products.find((candidate) => candidate.id === item.id);
      if (!product || Number(product.stock || 0) < Number(item.quantity)) {
        return { ok: false, product: product?.name || item.id };
      }
    }
    return { ok: true };
  }
  await ensureSchema();

  for (const item of items) {
    const result = await pool.query(
      `select p.name, p.stock,
        coalesce(sum(case when r.status = 'reserved' and r.expires_at > now() then r.quantity else 0 end), 0) as reserved
       from products p
       left join stock_reservations r on r.product_id = p.id
       where p.id = $1
       group by p.id`,
      [item.id]
    );
    const product = result.rows[0];
    const available = Number(product?.stock || 0) - Number(product?.reserved || 0);
    if (!product || available < Number(item.quantity)) {
      return { ok: false, product: product?.name || item.id };
    }
  }
  return { ok: true };
}

async function captureReservedStock(orderId) {
  const pool = getPool();
  if (!pool) {
    const db = readJson(dbPath);
    const order = db.orders.find((item) => item.id === orderId);
    if (!order || order.stockCapturedAt) return { ok: true };
    const products = readJson(productsPath);
    for (const item of order.items || []) {
      const product = products.find((candidate) => candidate.id === item.id);
      if (!product || Number(product.stock || 0) < Number(item.quantity)) {
        return { ok: false, product: product?.name || item.id };
      }
    }
    (order.items || []).forEach((item) => {
      const product = products.find((candidate) => candidate.id === item.id);
      product.stock -= Number(item.quantity);
    });
    order.stockCapturedAt = new Date().toISOString();
    writeJson(productsPath, products);
    writeJson(dbPath, db);
    return { ok: true };
  }
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const orderResult = await client.query("select stock_captured_at from orders where id = $1 for update", [orderId]);
    if (!orderResult.rows[0] || orderResult.rows[0].stock_captured_at) {
      await client.query("commit");
      return { ok: true };
    }
    const reservations = await client.query(
      "select r.product_id, r.quantity, p.name from stock_reservations r join products p on p.id = r.product_id where r.order_id = $1 and r.status = 'reserved'",
      [orderId]
    );
    for (const reservation of reservations.rows) {
      const result = await client.query(
        "update products set stock = stock - $1 where id = $2 and stock >= $1 returning name",
        [Number(reservation.quantity), reservation.product_id]
      );
      if (!result.rowCount) {
        await client.query("rollback");
        return { ok: false, product: reservation.name || reservation.product_id };
      }
    }
    await client.query("update stock_reservations set status = 'captured' where order_id = $1 and status = 'reserved'", [orderId]);
    await client.query("update orders set stock_captured_at = now() where id = $1", [orderId]);
    await client.query("commit");
    return { ok: true };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function releaseReservedStock(orderId, status = "released") {
  const pool = getPool();
  if (!pool) return { ok: true };
  await ensureSchema();
  await pool.query(
    `update stock_reservations set status = $2 where order_id = $1 and status = 'reserved';
     update orders set stock_released_at = now() where id = $1 and stock_released_at is null;`,
    [orderId, status]
  );
  return { ok: true };
}

async function expireStockReservations() {
  const pool = getPool();
  if (!pool) return { ok: true, count: 0 };
  await ensureSchema();
  const expired = await pool.query(
    `update stock_reservations
      set status = 'expired'
     where status = 'reserved' and expires_at <= now()
     returning order_id`
  );
  const orderIds = [...new Set(expired.rows.map((row) => row.order_id))];
  for (const orderId of orderIds) {
    await updateOrderStatus(orderId, "expired");
  }
  return { ok: true, count: orderIds.length };
}

function normalizeProduct(product) {
  const slug = String(product.name || "produto")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const gallery = Array.isArray(product.gallery)
    ? product.gallery
    : String(product.gallery || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const image = product.image || "assets/colar-elos.png";

  return {
    id: product.id || `${slug}-${Date.now()}`,
    name: product.name,
    category: product.category || "semijoias",
    price: Number(product.price),
    oldPrice: product.oldPrice ? Number(product.oldPrice) : null,
    badge: product.badge || "Novo",
    collection: product.collection || "Dois Elos",
    description: product.description || "",
    details: product.details || "",
    image,
    gallery: gallery.length ? gallery : [image],
    isNew: Boolean(product.isNew),
    isBestSeller: Boolean(product.isBestSeller),
    stock: Number(product.stock || 0),
  };
}

function publicCustomer(customer) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    role: customer.role || "customer",
    createdAt: customer.createdAt,
  };
}

function fromDbProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    oldPrice: row.old_price === null ? null : Number(row.old_price),
    badge: row.badge,
    collection: row.collection,
    description: row.description,
    details: row.details,
    image: row.image,
    gallery: row.gallery || [],
    isNew: row.is_new,
    isBestSeller: row.is_best_seller,
    stock: row.stock,
  };
}

function fromDbCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    salt: row.salt,
    passwordHash: row.password_hash,
    role: row.role || "customer",
    createdAt: row.created_at,
  };
}

function fromDbOrder(row) {
  return {
    id: row.id,
    customer: row.customer,
    shipping: row.shipping,
    items: row.items,
    subtotal: Number(row.subtotal),
    shippingCost: Number(row.shipping_cost),
    freeShippingDiscount: Number(row.free_shipping_discount),
    total: Number(row.total),
    paymentMethod: row.payment_method,
    status: row.status,
    paymentProvider: row.payment_provider,
    paymentId: row.payment_id,
    paymentUrl: row.payment_url,
    paidAt: row.paid_at,
    cancelledAt: row.cancelled_at,
    carrier: row.carrier,
    trackingCode: row.tracking_code,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    coupon: row.coupon,
    couponDiscount: Number(row.coupon_discount || 0),
    stockReservedUntil: row.stock_reserved_until,
    stockReleasedAt: row.stock_released_at,
    stockCapturedAt: row.stock_captured_at,
    createdAt: row.created_at,
  };
}

function fromDbReview(row) {
  return {
    id: row.id,
    productId: row.product_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    orderId: row.order_id,
    rating: Number(row.rating),
    comment: row.comment,
    verifiedPurchase: row.verified_purchase,
    createdAt: row.created_at,
  };
}

function fromDbCoupon(row) {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: Number(row.value),
    expiresAt: row.expires_at,
    maxUses: row.max_uses,
    minSubtotal: Number(row.min_subtotal),
    usedCount: row.used_count,
    active: row.active,
    createdAt: row.created_at,
  };
}

module.exports = {
  createCustomer,
  createCoupon,
  createOrder,
  createProduct,
  createReview,
  deleteCoupon,
  findCustomerByEmail,
  findOrderForTracking,
  findVerifiedPurchase,
  getDashboardMetrics,
  getOrder,
  getProduct,
  listCoupons,
  listCustomers,
  listOrders,
  listProducts,
  listReviews,
  publicCustomer,
  reserveStock,
  checkStock,
  captureReservedStock,
  expireStockReservations,
  releaseReservedStock,
  updateOrderPayment,
  updateOrderStatus,
};
