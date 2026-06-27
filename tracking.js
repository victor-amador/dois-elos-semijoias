const trackingForm = document.querySelector("[data-tracking-form]");
const trackingStatus = document.querySelector("[data-tracking-status]");
const trackingResult = document.querySelector("[data-tracking-result]");

const trackingLabels = {
  payment_pending: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em separacao",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
};

function renderTracking(order) {
  trackingResult.innerHTML = `
    <article class="tracking-card">
      <span class="product-badge">${trackingLabels[order.status] || order.status}</span>
      <h2>Pedido ${order.id.slice(0, 8)}</h2>
      <p>${order.carrier ? `Transportadora: ${order.carrier}` : "Envio em preparacao."}</p>
      ${order.trackingCode ? `<p>Codigo de rastreio: <strong>${order.trackingCode}</strong></p>` : ""}
      <div class="tracking-steps">
        ${["payment_pending", "paid", "preparing", "shipped", "delivered"].map((status) => `<span class="${stepActive(order.status, status) ? "active" : ""}">${trackingLabels[status]}</span>`).join("")}
      </div>
      <div class="order-products">
        ${(order.items || []).map((item) => `<div><span>${item.quantity}x ${item.name}</span></div>`).join("")}
      </div>
    </article>
  `;
}

function stepActive(current, step) {
  const order = ["payment_pending", "paid", "preparing", "shipped", "delivered"];
  return order.indexOf(current) >= order.indexOf(step);
}

trackingForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(trackingForm);
  trackingStatus.textContent = "Buscando pedido...";
  trackingResult.innerHTML = "";
  try {
    const response = await fetch("/api/tracking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: data.get("code"), email: data.get("email") }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Nao foi possivel rastrear.");
    trackingStatus.textContent = "";
    renderTracking(result);
  } catch (error) {
    trackingStatus.textContent = error.message;
  }
});
