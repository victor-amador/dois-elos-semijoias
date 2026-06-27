require("./loadEnv");

const crypto = require("crypto");
const http = require("http");
const path = require("path");
const url = require("url");
const fs = require("fs");
const {
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
} = require("./db");
const { createCheckout, extractWebhookPayment, isPagBankConfigured } = require("./services/pagBankService");
const { listNotifications, notifyOrder, orderCode } = require("./services/notificationService");
const { audit } = require("./services/auditLogger");
const { authFromRequest, hashPassword, signJwt, verifyPassword } = require("./services/authService");
const { isTurnstileConfigured, validateTurnstile } = require("./services/turnstileService");
const { validateCheckout, validateCoupon, validateProduct, validateUser } = require("./services/validationService");
const {
  isNuvemshopConfigured,
  syncCategories,
  syncInventory,
  syncOrders,
  syncProducts,
} = require("./services/nuvemshopService");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const publicDir = path.resolve(__dirname, "..");
const uploadsDir = path.join(publicDir, "assets", "uploads");
const freeShippingThreshold = 199.99;
const reservationMinutes = Number(process.env.STOCK_RESERVATION_MINUTES || 20);
const loginAttempts = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(JSON.stringify(data));
}

function sendStatic(request, response) {
  const parsedUrl = url.parse(request.url);
  const requestedPath = decodeURIComponent(parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname);
  const filePath = path.normalize(path.join(publicDir, requestedPath));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Acesso negado");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Arquivo nao encontrado");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(content);
  });
}

function getBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8_000_000) request.destroy();
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function validateCep(value) {
  const cep = onlyDigits(value);
  return cep.length === 8 ? cep : null;
}

function shippingQuote({ cep, subtotal = 0, method = "standard" }) {
  const cleanCep = validateCep(cep);
  if (!cleanCep) {
    return { ok: false, error: "Informe um CEP valido com 8 digitos." };
  }

  const first = Number(cleanCep[0]);
  const localCep = cleanCep.startsWith("70") || cleanCep.startsWith("71") || cleanCep.startsWith("72");
  const baseOptions = {
    pickup: { method: "pickup", label: "Retirada combinada", price: 0, days: "A combinar" },
    local: { method: "local", label: "Entrega local", price: localCep ? 14.9 : 22.9, days: localCep ? "1 a 2 dias uteis" : "3 a 5 dias uteis" },
    standard: { method: "standard", label: "Correios/transportadora", price: 24.9 + Math.max(first - 3, 0) * 2, days: "3 a 8 dias uteis" },
  };
  const selected = baseOptions[method] || baseOptions.standard;
  const freeShippingDiscount = Number(subtotal) >= freeShippingThreshold ? selected.price : 0;
  return {
    ok: true,
    cep: cleanCep,
    options: Object.values(baseOptions).map((option) => ({
      ...option,
      price: Number(subtotal) >= freeShippingThreshold ? 0 : option.price,
      originalPrice: option.price,
      freeShipping: Number(subtotal) >= freeShippingThreshold && option.price > 0,
    })),
    selected: {
      ...selected,
      price: Math.max(selected.price - freeShippingDiscount, 0),
      originalPrice: selected.price,
      freeShipping: freeShippingDiscount > 0,
    },
    freeShippingDiscount,
  };
}

function roleForEmail(email) {
  const admins = String(process.env.ADMIN_EMAILS || "victorrodrigues@admin.local")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(String(email || "").toLowerCase()) ? "admin" : "customer";
}

function clientIp(request) {
  return request.headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.socket.remoteAddress || "local";
}

function isRateLimited(key, limit = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, resetAt: now + windowMs };
  if (entry.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count += 1;
  loginAttempts.set(key, entry);
  return entry.count > limit;
}

function requireAdmin(request, response) {
  const auth = authFromRequest(request);
  if (!auth) {
    sendJson(response, 401, { error: "Login administrativo obrigatorio." });
    return null;
  }
  if (auth.role !== "admin") {
    sendJson(response, 403, { error: "Permissao administrativa obrigatoria." });
    return null;
  }
  return auth;
}

function authPayload(customer) {
  const publicData = publicCustomer(customer);
  if (roleForEmail(publicData.email) === "admin") publicData.role = "admin";
  return publicData;
}

async function handleApi(request, response) {
  const parsedUrl = url.parse(request.url, true);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    response.end();
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/products") {
    await expireStockReservations();
    sendJson(response, 200, await listProducts());
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/shipping/quote") {
    const body = await getBody(request);
    const quote = shippingQuote({
      cep: body.cep,
      subtotal: Number(body.subtotal || 0),
      method: body.method || "standard",
    });
    sendJson(response, quote.ok ? 200 : 400, quote.ok ? quote : { error: quote.error });
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/cep/validate") {
    const body = await getBody(request);
    const cep = validateCep(body.cep);
    sendJson(response, cep ? 200 : 400, cep ? { cep, valid: true } : { error: "CEP invalido." });
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/tracking") {
    const body = await getBody(request);
    const order = await findOrderForTracking(body.code, body.email);
    if (!order) {
      sendJson(response, 404, { error: "Pedido nao encontrado. Confira o codigo e o e-mail." });
      return;
    }
    sendJson(response, 200, {
      id: order.id,
      status: order.status,
      carrier: order.carrier,
      trackingCode: order.trackingCode,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      createdAt: order.createdAt,
      customer: { name: order.customer?.name, email: order.customer?.email },
      items: order.items,
    });
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname.startsWith("/api/orders/") && parsedUrl.pathname.endsWith("/summary")) {
    const orderId = parsedUrl.pathname.split("/")[3];
    const order = await getOrder(orderId);
    if (!order) {
      sendJson(response, 404, { error: "Pedido nao encontrado." });
      return;
    }
    sendJson(response, 200, {
      ...order,
      orderCode: orderCode(order),
    });
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/public-config") {
    sendJson(response, 200, { turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || "" });
    return;
  }

  if (
    request.method === "GET" &&
    parsedUrl.pathname.startsWith("/api/products/") &&
    !parsedUrl.pathname.endsWith("/reviews")
  ) {
    const productId = parsedUrl.pathname.split("/").pop();
    const product = await getProduct(productId);
    sendJson(response, product ? 200 : 404, product || { error: "Produto nao encontrado" });
    return;
  }

  if (parsedUrl.pathname.startsWith("/api/admin/")) {
    const admin = requireAdmin(request, response);
    if (!admin) return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/admin/orders") {
    sendJson(response, 200, await listOrders());
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname.startsWith("/api/admin/orders/")) {
    const orderId = parsedUrl.pathname.split("/")[4];
    const order = await getOrder(orderId);
    sendJson(response, order ? 200 : 404, order || { error: "Pedido nao encontrado." });
    return;
  }

  if (request.method === "PATCH" && parsedUrl.pathname.startsWith("/api/admin/orders/")) {
    const orderId = parsedUrl.pathname.split("/")[4];
    const body = await getBody(request);
    const allowed = ["payment_pending", "paid", "preparing", "shipped", "delivered", "cancelled", "refunded", "expired"];
    if (!allowed.includes(body.status)) {
      sendJson(response, 400, { error: "Status invalido." });
      return;
    }
    const order = await updateOrderStatus(orderId, body.status, {
      carrier: body.carrier,
      trackingCode: body.trackingCode,
      shippedAt: body.shippedAt || null,
      deliveredAt: body.deliveredAt || null,
    });
    if (body.status === "paid") await captureReservedStock(orderId);
    if (["cancelled", "refunded", "expired"].includes(body.status)) await releaseReservedStock(orderId, body.status);
    if (body.status === "shipped") await notifyOrder("shipped", order, { carrier: body.carrier, trackingCode: body.trackingCode });
    sendJson(response, order ? 200 : 404, order || { error: "Pedido nao encontrado." });
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/admin/customers") {
    sendJson(response, 200, await listCustomers());
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/admin/dashboard") {
    sendJson(response, 200, await getDashboardMetrics());
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/admin/notifications") {
    sendJson(response, 200, listNotifications());
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/admin/coupons") {
    sendJson(response, 200, await listCoupons());
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/admin/coupons") {
    const body = await getBody(request);
    const validation = validateCoupon(body);
    if (!validation.ok) {
      sendJson(response, 400, { error: validation.error });
      return;
    }
    const coupon = await createCoupon({
      id: crypto.randomUUID(),
      code: validation.code,
      type: validation.type,
      value: validation.value,
      expiresAt: validation.expiresAt || null,
      maxUses: validation.maxUses ? Number(validation.maxUses) : null,
      minSubtotal: validation.minSubtotal,
      usedCount: 0,
      active: true,
      createdAt: new Date().toISOString(),
    });
    sendJson(response, 201, { coupon });
    return;
  }

  if (request.method === "DELETE" && parsedUrl.pathname.startsWith("/api/admin/coupons/")) {
    await deleteCoupon(parsedUrl.pathname.split("/").pop());
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname.startsWith("/api/products/") && parsedUrl.pathname.endsWith("/reviews")) {
    const productId = parsedUrl.pathname.split("/")[3];
    sendJson(response, 200, await listReviews(productId));
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/reviews") {
    sendJson(response, 200, await listReviews());
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname.startsWith("/api/products/") && parsedUrl.pathname.endsWith("/reviews")) {
    const body = await getBody(request);
    const productId = parsedUrl.pathname.split("/")[3];
    const rating = Number(body.rating);
    if (!body.customerName || !body.customerEmail || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      sendJson(response, 400, { error: "Nome, e-mail e nota de 1 a 5 sao obrigatorios." });
      return;
    }
    const verifiedOrder = await findVerifiedPurchase(body.customerEmail, productId);
    if (!verifiedOrder) {
      sendJson(response, 403, { error: "Somente clientes que compraram esta peca podem avaliar." });
      return;
    }
    const review = await createReview({
      id: crypto.randomUUID(),
      productId,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      orderId: verifiedOrder.id,
      rating,
      comment: body.comment || "",
      verifiedPurchase: true,
      createdAt: new Date().toISOString(),
    });
    sendJson(response, 201, { review });
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/customer/orders") {
    const email = parsedUrl.query.email;
    const orders = await listOrders();
    sendJson(
      response,
      200,
      email ? orders.filter((order) => order.customer?.email === email) : []
    );
    return;
  }

  if (request.method === "GET" && parsedUrl.pathname === "/api/integrations/status") {
    sendJson(response, 200, {
      pagBank: {
        configured: isPagBankConfigured(),
        env: ["PAGBANK_ENV", "PAGBANK_TOKEN", "PAGBANK_RETURN_URL", "PAGBANK_WEBHOOK_URL"],
      },
      nuvemshop: {
        configured: isNuvemshopConfigured(),
        env: ["NUVEMSHOP_ACCESS_TOKEN", "NUVEMSHOP_STORE_ID"],
      },
    });
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/integrations/nuvemshop/sync") {
    const products = await listProducts();
    const orders = await listOrders();
    const categories = [...new Set(products.map((product) => product.category))];
    sendJson(response, 200, {
      products: await syncProducts(products),
      categories: await syncCategories(categories),
      inventory: await syncInventory(products),
      orders: await syncOrders(orders),
    });
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/admin/products") {
    const body = await getBody(request);
    const validation = validateProduct(body);
    if (!validation.ok) {
      sendJson(response, 400, { error: validation.error });
      return;
    }
    const product = await createProduct(validation);
    sendJson(response, 201, { product, message: "Produto cadastrado." });
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/admin/uploads") {
    const body = await getBody(request);
    const match = String(body.dataUrl || "").match(/^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) {
      sendJson(response, 400, { error: "Envie uma imagem JPEG, PNG ou WebP valida." });
      return;
    }

    const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[match[1]];
    const bytes = Buffer.from(match[3], "base64");
    if (bytes.length > 5 * 1024 * 1024) {
      sendJson(response, 413, { error: "A imagem deve ter no maximo 5 MB." });
      return;
    }

    fs.mkdirSync(uploadsDir, { recursive: true });
    const fileName = `${crypto.randomUUID()}.${extension}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), bytes);
    sendJson(response, 201, { imagePath: `assets/uploads/${fileName}` });
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/register") {
    const body = await getBody(request);
    const turnstile = await validateTurnstile(body.turnstileToken, request.socket.remoteAddress);
    if (!turnstile.success) {
      sendJson(response, 400, { error: turnstile.error });
      return;
    }
    const validation = validateUser(body, "register");
    if (!validation.ok) {
      sendJson(response, 400, { error: validation.error });
      return;
    }

    const existingCustomer = await findCustomerByEmail(validation.email);
    if (existingCustomer) {
      const customerData = authPayload(existingCustomer);
      sendJson(response, 200, { customer: customerData, token: signJwt(customerData), message: "Cliente ja cadastrado." });
      return;
    }

    const credentials = await hashPassword(validation.password);
    const customer = {
      id: crypto.randomUUID(),
      name: validation.name || "Cliente Dois Elos",
      email: validation.email,
      salt: credentials.salt,
      passwordHash: credentials.passwordHash,
      role: roleForEmail(validation.email),
      createdAt: new Date().toISOString(),
    };

    await createCustomer(customer);
    const customerData = authPayload(customer);
    sendJson(response, 201, { customer: customerData, token: signJwt(customerData), message: "Cadastro criado com sucesso." });
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/login") {
    const body = await getBody(request);
    const rateKey = `${clientIp(request)}:${String(body.email || "").toLowerCase()}`;
    if (isRateLimited(rateKey)) {
      sendJson(response, 429, { error: "Muitas tentativas de login. Tente novamente em alguns minutos." });
      return;
    }
    const turnstile = await validateTurnstile(body.turnstileToken, request.socket.remoteAddress);
    if (!turnstile.success) {
      sendJson(response, 400, { error: turnstile.error });
      return;
    }
    const validation = validateUser(body, "login");
    if (!validation.ok) {
      sendJson(response, 400, { error: validation.error });
      return;
    }
    const customer = await findCustomerByEmail(validation.email);
    if (!customer) {
      sendJson(response, 401, { error: "Cliente nao encontrado." });
      return;
    }

    if (!(await verifyPassword(validation.password, customer))) {
      sendJson(response, 401, { error: "Senha invalida." });
      return;
    }

    const loggedCustomer = authPayload(customer);
    sendJson(response, 200, { customer: loggedCustomer, token: signJwt(loggedCustomer), message: "Login realizado." });
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/orders") {
    await expireStockReservations();
    const body = await getBody(request);
    const validation = validateCheckout(body);
    if (!validation.ok) {
      audit("checkout_validation_error", { error: validation.error, email: body.customer?.email });
      sendJson(response, 400, { error: validation.error });
      return;
    }
    const products = await listProducts();
    const items = (body.items || [])
      .map((item) => {
        const product = products.find((productItem) => productItem.id === item.id);
        if (!product) return null;
        return {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: Number(item.quantity) || 1,
        };
      })
      .filter(Boolean);

    if (!items.length) {
      sendJson(response, 400, { error: "Pedido sem produtos." });
      return;
    }

    const stockAvailability = await checkStock(items);
    if (!stockAvailability.ok) {
      sendJson(response, 409, { error: `Estoque indisponivel para ${stockAvailability.product}.` });
      return;
    }

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const quote = shippingQuote({
      cep: body.shipping?.cep,
      subtotal,
      method: body.shipping?.method || "standard",
    });
    if (!quote.ok) {
      sendJson(response, 400, { error: quote.error });
      return;
    }
    const shipping = quote.selected.price;
    const requestedCouponDiscount = Math.max(Number(body.totals?.couponDiscount || 0), 0);
    const couponDiscount = Math.min(requestedCouponDiscount, subtotal);
    const total = subtotal + shipping - couponDiscount;
    const stockReservedUntil = new Date(Date.now() + reservationMinutes * 60_000).toISOString();
    const order = {
      id: crypto.randomUUID(),
      customer: body.customer || null,
      shipping: { ...(body.shipping || {}), cep: quote.cep, method: quote.selected.method, quote: quote.selected },
      items,
      subtotal,
      shippingCost: shipping,
      freeShippingDiscount: quote.freeShippingDiscount,
      total,
      paymentMethod: body.shipping?.paymentMethod || "pix",
      status: "payment_pending",
      coupon: body.coupon || null,
      couponDiscount,
      stockReservedUntil,
      createdAt: new Date().toISOString(),
    };

    await createOrder(order);
    audit("order_created", { orderId: order.id, email: order.customer?.email, total: order.total });
    const stockReservation = await reserveStock(order.id, items, stockReservedUntil);
    if (!stockReservation.ok) {
      await updateOrderStatus(order.id, "cancelled");
      sendJson(response, 409, { error: `Estoque indisponivel para ${stockReservation.product}.` });
      return;
    }
    try {
      const payment = await createCheckout(order);
      const updatedOrder = await updateOrderPayment(order.id, payment);
      audit("payment_created", { orderId: order.id, provider: payment.provider, mode: payment.mode });
      await notifyOrder("created", updatedOrder || order);
      sendJson(response, 201, { order: updatedOrder || order, payment, message: "Pedido registrado. Continue para o pagamento." });
    } catch (error) {
      audit("checkout_error", { orderId: order.id, error: error.message });
      await releaseReservedStock(order.id, "released");
      await updateOrderStatus(order.id, "cancelled");
      throw error;
    }
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/payments/pagbank/mock") {
    if (String(process.env.PAGBANK_MOCK || "").toLowerCase() !== "true") {
      sendJson(response, 403, { error: "Modo teste PagBank desativado." });
      return;
    }
    const body = await getBody(request);
    const allowed = ["payment_pending", "paid", "cancelled"];
    if (!body.orderId || !allowed.includes(body.status)) {
      sendJson(response, 400, { error: "Pedido e status valido sao obrigatorios." });
      return;
    }
    const order = await updateOrderStatus(body.orderId, body.status);
    if (body.status === "paid") {
      const stock = await captureReservedStock(body.orderId);
      if (!stock.ok) {
        sendJson(response, 409, { error: `Estoque indisponivel para ${stock.product}.` });
        return;
      }
      await notifyOrder("paid", order || { id: body.orderId, customer: null }, { paymentDetails: body.paymentDetails });
      audit("payment_paid", { orderId: body.orderId, provider: "pagbank_mock" });
    }
    if (body.status === "cancelled") {
      await releaseReservedStock(body.orderId, "cancelled");
      audit("payment_cancelled", { orderId: body.orderId, provider: "pagbank_mock" });
    }
    sendJson(response, order ? 200 : 404, order || { error: "Pedido nao encontrado." });
    return;
  }

  if (request.method === "POST" && parsedUrl.pathname === "/api/webhooks/pagbank") {
    const event = await getBody(request);
    const payment = extractWebhookPayment(event);
    if (!payment.referenceId) {
      sendJson(response, 202, { received: true, message: "Webhook sem reference_id." });
      return;
    }
    const order = await updateOrderStatus(payment.referenceId, payment.status);
    audit("payment_webhook", { orderId: payment.referenceId, status: payment.status, rawStatus: payment.rawStatus });
    if (payment.status === "paid") {
      const stock = await captureReservedStock(payment.referenceId);
      if (!stock.ok) {
        console.error(`[STOCK] Falha ao baixar estoque do pedido ${payment.referenceId}: ${stock.product}`);
      }
      notifyOrder("paid", order || { id: payment.referenceId, customer: null });
    }
    if (["cancelled", "expired", "refunded"].includes(payment.status)) {
      await releaseReservedStock(payment.referenceId, payment.status);
    }
    sendJson(response, 200, { received: true, status: payment.status, orderId: payment.referenceId });
    return;
  }

  sendJson(response, 404, { error: "Rota nao encontrada." });
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/")) {
    handleApi(request, response).catch((error) => {
      const isProduction = process.env.NODE_ENV === "production";
      console.error(`[API] ${request.method} ${request.url}`, error.stack || error.message);
      sendJson(response, 500, {
        error: isProduction ? "Nao foi possivel concluir a operacao." : error.message || "Erro interno.",
        detail: isProduction ? undefined : error.stack,
      });
    });
    return;
  }

  sendStatic(request, response);
});

server.listen(PORT, HOST, () => {
  console.log(`Dois Elos rodando em http://${HOST}:${PORT}`);
});
