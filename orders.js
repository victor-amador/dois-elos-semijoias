const ordersList = document.querySelector("[data-orders-list]");
const statusLabels = {
  payment_pending: "Aguardando Pagamento",
  paid: "Pago",
  preparing: "Em Separacao",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
};

async function loadOrders() {
  const customer = JSON.parse(localStorage.getItem(customerStorageKey) || "null");
  if (!customer?.email) {
    ordersList.innerHTML = "<p>Entre na sua conta para ver suas compras.</p>";
    return;
  }

  try {
    const response = await fetch(`/api/customer/orders?email=${encodeURIComponent(customer.email)}`);
    const orders = await response.json();
    ordersList.innerHTML = orders.length
      ? orders.map((order) => `<article><strong>Pedido ${order.id.slice(0, 8)}</strong><span>${new Date(order.createdAt).toLocaleDateString("pt-BR")}</span><span>${order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}</span><span>${formatMoney(order.total)}</span><span>${statusLabels[order.status] || order.status}</span>${order.trackingCode ? `<small>Rastreio: ${order.trackingCode}</small>` : ""}</article>`).join("")
      : "<p>Voce ainda nao tem compras registradas.</p>";
  } catch (error) {
    ordersList.innerHTML = "<p>Nao foi possivel carregar as compras agora.</p>";
  }
}

document.addEventListener("shop:ready", loadOrders);
