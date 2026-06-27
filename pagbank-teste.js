const mockParams = new URLSearchParams(window.location.search);
const mockOrderId = mockParams.get("pedido");
const mockStatus = document.querySelector("[data-mock-status]");
const orderRoot = document.querySelector("[data-mock-order]");
const methodButtons = document.querySelectorAll("[data-method]");
const forms = {
  credit_card: document.querySelector("[data-card-form]"),
  pix: document.querySelector("[data-pix-form]"),
  boleto: document.querySelector("[data-boleto-form]"),
};
let activeMethod = "credit_card";
let currentOrder = null;

const formatMoney = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function paymentLabel(method) {
  return {
    credit_card: "Cartao de credito",
    pix: "Pix",
    boleto: "Boleto",
  }[method] || method;
}

async function loadOrder() {
  if (!mockOrderId) {
    orderRoot.innerHTML = "<p>Pedido nao informado.</p>";
    return;
  }
  const response = await fetch(`/api/orders/${mockOrderId}/summary`);
  const result = await response.json();
  if (!response.ok) {
    orderRoot.innerHTML = `<p>${result.error || "Pedido nao encontrado."}</p>`;
    return;
  }
  currentOrder = result;
  renderOrder();
}

function renderOrder() {
  const shipping = currentOrder.shipping || {};
  orderRoot.innerHTML = `
    <span class="product-badge">${currentOrder.orderCode}</span>
    <h2>Resumo do pedido</h2>
    <p><strong>${currentOrder.customer?.name || "Cliente"}</strong></p>
    <p>${currentOrder.customer?.email || ""}</p>
    <p>${shipping.address || ""} ${shipping.city ? `- ${shipping.city}` : ""}</p>
    <div class="order-products">
      ${(currentOrder.items || []).map((item) => `<div><span>${item.quantity}x ${item.name}</span><strong>${formatMoney(item.price * item.quantity)}</strong></div>`).join("")}
    </div>
    <div class="summary-lines">
      <div><span>Produtos</span><strong>${formatMoney(currentOrder.subtotal)}</strong></div>
      <div><span>Frete</span><strong>${formatMoney(currentOrder.shippingCost)}</strong></div>
      ${currentOrder.couponDiscount ? `<div><span>Desconto</span><strong>-${formatMoney(currentOrder.couponDiscount)}</strong></div>` : ""}
      <div class="summary-total"><span>Total</span><strong>${formatMoney(currentOrder.total)}</strong></div>
    </div>
    <div class="checkout-trust mock-trust">
      <span>SSL ativo</span>
      <span>Pagamento protegido</span>
      <span>Garantia de 1 ano</span>
      <span>Pedido registrado</span>
    </div>
  `;
}

function setMethod(method) {
  activeMethod = method;
  methodButtons.forEach((button) => button.classList.toggle("active", button.dataset.method === method));
  Object.entries(forms).forEach(([key, form]) => form.classList.toggle("hidden", key !== method));
}

async function finishPayment(status, paymentDetails = {}) {
  if (!mockOrderId) {
    mockStatus.textContent = "Pedido nao informado.";
    return;
  }
  mockStatus.textContent = "Processando pagamento seguro...";
  const response = await fetch("/api/payments/pagbank/mock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: mockOrderId, status, paymentDetails }),
  });
  const result = await response.json();
  if (!response.ok) {
    mockStatus.textContent = result.error || "Nao foi possivel simular o pagamento.";
    return;
  }
  if (status === "paid") window.location.href = `pagamento-sucesso.html?pedido=${mockOrderId}`;
  else if (status === "cancelled") window.location.href = `pagamento-recusado.html?pedido=${mockOrderId}`;
  else window.location.href = `pagamento-pendente.html?pedido=${mockOrderId}`;
}

methodButtons.forEach((button) => {
  button.addEventListener("click", () => setMethod(button.dataset.method));
});

forms.credit_card?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(forms.credit_card);
  const cardNumber = String(data.get("cardNumber") || "").replace(/\D/g, "");
  if (cardNumber.length < 13) {
    mockStatus.textContent = "Informe um numero de cartao valido para a simulacao.";
    return;
  }
  finishPayment("paid", {
    method: paymentLabel(activeMethod),
    installments: data.get("installments"),
    cardLast4: cardNumber.slice(-4),
    holder: data.get("cardName"),
  });
});

forms.pix?.addEventListener("submit", (event) => {
  event.preventDefault();
  finishPayment("paid", { method: paymentLabel(activeMethod), pixCode: document.querySelector("[data-pix-code]")?.textContent });
});

forms.boleto?.addEventListener("submit", (event) => {
  event.preventDefault();
  finishPayment("paid", { method: paymentLabel(activeMethod), boleto: "34191.79001 01043.510047 91020.150008 8 98760000000000" });
});

document.querySelector("[data-refuse-payment]")?.addEventListener("click", () => {
  finishPayment("cancelled", { method: paymentLabel(activeMethod), reason: "Simulacao de recusa" });
});

loadOrder();
