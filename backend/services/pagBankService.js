const pagBankConfig = {
  token: String(process.env.PAGBANK_TOKEN || "").replace(/^Bearer\s+/i, "").trim(),
  environment: process.env.PAGBANK_ENV || "sandbox",
  webhookUrl: process.env.PAGBANK_WEBHOOK_URL || "",
  returnUrl: process.env.PAGBANK_RETURN_URL || "",
  mock: String(process.env.PAGBANK_MOCK || "").toLowerCase() === "true",
};

function isPagBankConfigured() {
  return pagBankConfig.mock || Boolean(pagBankConfig.token);
}

function baseUrl() {
  return pagBankConfig.environment === "production"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";
}

function checkoutReturnUrl(order) {
  if (pagBankConfig.returnUrl) {
    const url = new URL(pagBankConfig.returnUrl);
    url.searchParams.set("pedido", order.id);
    return url.toString();
  }
  return `/pagamento-pendente.html?pedido=${order.id}`;
}

function isPublicHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch (error) {
    return false;
  }
}

function paymentRedirect(response) {
  const links = response.links || [];
  const paymentLink = links.find((link) => ["PAY", "SELF"].includes(String(link.rel).toUpperCase()));
  return response.payment_url || response.checkout_url || paymentLink?.href || null;
}

function pagBankPaymentType(paymentMethod) {
  const method = String(paymentMethod || "pix").toLowerCase();
  if (method === "credit_card") return "CREDIT_CARD";
  if (method === "debit_card") return "DEBIT_CARD";
  if (method === "boleto") return "BOLETO";
  return "PIX";
}

function normalizeTaxId(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

async function requestPagBank(path, options = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${pagBankConfig.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message =
      data.error_messages?.[0]?.description ||
      data.error_messages?.[0]?.error ||
      data.message ||
      "PagBank recusou a operacao.";
    const error = new Error(message);
    error.details = data;
    throw error;
  }
  return data;
}

async function createCheckout(order) {
  if (pagBankConfig.mock) {
    return {
      provider: "pagbank",
      mode: "local_mock",
      status: "pending",
      checkoutId: `mock-${order.id}`,
      paymentId: `mock-${order.id}`,
      redirectUrl: `/pagbank-teste.html?pedido=${order.id}`,
      message: "Modo teste local PagBank ativo.",
    };
  }

  if (!isPagBankConfigured()) {
    return {
      provider: "pagbank",
      mode: "sandbox_placeholder",
      status: "pending",
      redirectUrl: checkoutReturnUrl(order),
      message: "PagBank ainda nao configurado. Adicione PAGBANK_TOKEN para ativar cobrancas.",
    };
  }

  const customer = order.customer || {};
  const payload = {
    reference_id: order.id,
    items: order.items.map((item) => ({
      reference_id: item.id,
      name: item.name,
      quantity: Number(item.quantity),
      unit_amount: Math.round(Number(item.price) * 100),
    })),
    payment_methods: [{ type: pagBankPaymentType(order.paymentMethod) }],
  };

  if (customer.name && customer.email) {
    payload.customer = { name: customer.name, email: customer.email };
    const taxId = normalizeTaxId(customer.taxId);
    const phone = normalizePhone(customer.phone);
    if (taxId.length === 11 || taxId.length === 14) payload.customer.tax_id = taxId;
    if (phone.length >= 10) {
      payload.customer.phones = [
        {
          country: "55",
          area: phone.slice(0, 2),
          number: phone.slice(2),
          type: "MOBILE",
        },
      ];
    }
  }

  if (Number(order.shippingCost) > 0) {
    payload.additional_amount = Math.round(Number(order.shippingCost) * 100);
  }

  const discountAmount = Number(order.freeShippingDiscount || 0) + Number(order.couponDiscount || 0);
  if (discountAmount > 0) {
    payload.discount_amount = Math.round(discountAmount * 100);
  }

  const returnUrl = checkoutReturnUrl(order);
  if (isPublicHttpsUrl(returnUrl)) {
    payload.redirect_url = returnUrl;
    payload.return_url = returnUrl;
  }

  if (isPublicHttpsUrl(pagBankConfig.webhookUrl)) {
    payload.notification_urls = [pagBankConfig.webhookUrl];
    payload.payment_notification_urls = [pagBankConfig.webhookUrl];
  }

  const data = await requestPagBank("/checkouts", {
    method: "POST",
    headers: {
      "x-idempotency-key": order.id,
    },
    body: JSON.stringify(payload),
  });

  const redirectUrl = paymentRedirect(data);
  if (!redirectUrl) {
    throw new Error("PagBank nao retornou o link de pagamento esperado.");
  }

  return {
    provider: "pagbank",
    mode: pagBankConfig.environment,
    status: "pending",
    checkoutId: data.id,
    paymentId: data.id,
    redirectUrl,
  };
}

function mapPagBankStatus(status) {
  const normalized = String(status || "").toUpperCase();
  const statuses = {
    PAID: "paid",
    AUTHORIZED: "paid",
    IN_ANALYSIS: "payment_pending",
    WAITING: "payment_pending",
    PENDING: "payment_pending",
    DECLINED: "cancelled",
    CANCELED: "cancelled",
    CANCELLED: "cancelled",
    EXPIRED: "expired",
    REFUNDED: "refunded",
  };
  return statuses[normalized] || "payment_pending";
}

function extractWebhookPayment(event) {
  const charges = event.charges || event.data?.charges || [];
  const charge = charges[0] || event.charge || event.data?.charge || {};
  const checkout = event.checkout || event.data?.checkout || {};
  const referenceId = event.reference_id || event.data?.reference_id || charge.reference_id || checkout.reference_id;
  const status = charge.status || event.status || event.data?.status || checkout.status;
  const paymentId = charge.id || event.id || event.data?.id || checkout.id;
  return {
    referenceId,
    paymentId,
    rawStatus: status,
    status: mapPagBankStatus(status),
  };
}

module.exports = {
  createCheckout,
  extractWebhookPayment,
  isPagBankConfigured,
  mapPagBankStatus,
};
