const fs = require("fs");
const path = require("path");

const outboxPath = path.join(__dirname, "..", "data", "notifications.json");

function ensureOutbox() {
  if (!fs.existsSync(outboxPath)) {
    fs.writeFileSync(outboxPath, "[]");
  }
}

function readOutbox() {
  ensureOutbox();
  return JSON.parse(fs.readFileSync(outboxPath, "utf8"));
}

function writeOutbox(items) {
  fs.writeFileSync(outboxPath, JSON.stringify(items, null, 2));
}

function orderCode(order) {
  return `DE-${String(order.id || "").slice(0, 8).toUpperCase()}`;
}

function paymentLabel(method) {
  return {
    pix: "Pix",
    credit_card: "Cartao de credito",
    debit_card: "Cartao de debito",
    boleto: "Boleto",
  }[method] || method || "Nao informado";
}

function shippingLabel(order) {
  return order.shipping?.quote?.label || order.shipping?.method || "Entrega nao informada";
}

function notificationContent(event, order, extra = {}) {
  const code = orderCode(order);
  const customerName = order.customer?.name || "Cliente";
  const subjects = {
    created: `Pedido ${code} criado - Dois Elos Semijoias`,
    paid: `Pagamento aprovado do pedido ${code}`,
    shipped: `Pedido ${code} enviado`,
  };
  const intros = {
    created: `Ola, ${customerName}. Recebemos seu pedido ${code}.`,
    paid: `Ola, ${customerName}. Seu pagamento do pedido ${code} foi aprovado.`,
    shipped: `Ola, ${customerName}. Seu pedido ${code} foi enviado.`,
  };
  const lines = [
    intros[event] || `Atualizacao do pedido ${code}.`,
    `Total: ${formatMoney(order.total)}`,
    `Pagamento: ${paymentLabel(order.paymentMethod)}`,
    `Entrega: ${shippingLabel(order)}`,
    `Endereco: ${order.shipping?.address || "Nao informado"} ${order.shipping?.city ? `- ${order.shipping.city}` : ""}`,
    `Produtos: ${(order.items || []).map((item) => `${item.quantity}x ${item.name}`).join(", ")}`,
  ];

  if (order.trackingCode || extra.trackingCode) {
    lines.push(`Rastreio: ${order.trackingCode || extra.trackingCode}`);
  }
  if (order.carrier || extra.carrier) {
    lines.push(`Transportadora: ${order.carrier || extra.carrier}`);
  }

  return {
    subject: subjects[event] || `Pedido ${code} - Dois Elos Semijoias`,
    message: lines.join("\n"),
  };
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function notifyOrder(event, order, extra = {}) {
  const email = order.customer?.email;
  const phone = order.customer?.phone;
  const content = notificationContent(event, order, extra);
  const notification = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    event,
    orderId: order.id,
    orderCode: orderCode(order),
    to: email || phone || "cliente-nao-informado",
    channels: {
      email: Boolean(email),
      whatsapp: Boolean(phone),
    },
    subject: content.subject,
    message: content.message,
    status: process.env.NOTIFICATION_PROVIDER ? "ready_to_send" : "local_outbox",
    createdAt: new Date().toISOString(),
  };

  const outbox = readOutbox();
  outbox.unshift(notification);
  writeOutbox(outbox.slice(0, 200));
  console.log(`[NOTIFY] ${notification.subject} -> ${notification.to}`);
  return notification;
}

function listNotifications() {
  return readOutbox();
}

module.exports = {
  listNotifications,
  notifyOrder,
  orderCode,
};
