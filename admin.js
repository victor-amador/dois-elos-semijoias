const productForm = document.querySelector("[data-product-form]");
const statusBox = document.querySelector("[data-admin-status]");
const ordersBox = document.querySelector("[data-admin-orders]");
const customersBox = document.querySelector("[data-admin-customers]");
const statsBox = document.querySelector("[data-dashboard-stats]");
const reportsBox = document.querySelector("[data-admin-reports]");
const orderDetailBox = document.querySelector("[data-order-detail]");
const stockBox = document.querySelector("[data-admin-stock]");
const couponsBox = document.querySelector("[data-admin-coupons]");
const couponForm = document.querySelector("[data-coupon-form]");
const notificationsBox = document.querySelector("[data-admin-notifications]");
const orderStatusLabels = {
  payment_pending: "Aguardando pagamento",
  paid: "Pago",
  preparing: "Em separacao",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
  expired: "Expirado",
  refunded: "Reembolsado",
};
let adminOrders = [];

function adminFetch(url, options = {}) {
  const token = localStorage.getItem("doisElosToken");
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function renderAdminPermissionNotice() {
  const customer = JSON.parse(localStorage.getItem(customerStorageKey) || "null");
  const notice = document.createElement("div");
  notice.className = `admin-permission ${customer?.role === "admin" ? "admin" : "limited"}`;
  notice.textContent = customer?.role === "admin"
    ? `Acesso administrativo: ${customer.name || customer.email}`
    : "Acesso sem permissao administrativa confirmada. Em producao, esta area deve exigir login de admin.";
  document.querySelector(".admin-page")?.prepend(notice);
}

async function loadAdminData() {
  try {
    const [ordersResponse, customersResponse, dashboardResponse, couponsResponse, notificationsResponse] = await Promise.all([
      adminFetch("/api/admin/orders"),
      adminFetch("/api/admin/customers"),
      adminFetch("/api/admin/dashboard"),
      adminFetch("/api/admin/coupons"),
      adminFetch("/api/admin/notifications"),
    ]);
    const orders = await ordersResponse.json();
    const customers = await customersResponse.json();
    const dashboard = await dashboardResponse.json();
    const coupons = await couponsResponse.json();
    const notifications = await notificationsResponse.json();

    adminOrders = orders;

    statsBox.innerHTML = `
      <article><span>Faturamento</span><strong>${formatMoney(dashboard.revenue)}</strong></article>
      <article><span>Pedidos</span><strong>${dashboard.recentOrders.length}</strong></article>
      <article><span>Clientes</span><strong>${dashboard.customersCount}</strong></article>
      <article><span>Produtos</span><strong>${dashboard.productsCount}</strong></article>
    `;

    reportsBox.innerHTML = `
      <article><h3>Faturamento por mes</h3>${reportRows(dashboard.revenueByMonth, (item) => `${monthLabel(item.month)} - ${formatMoney(item.total)}`)}</article>
      <article><h3>Produtos mais vendidos</h3>${reportRows(dashboard.bestSellers, (item) => `${item.name} - ${item.quantity} un.`)}</article>
      <article><h3>Clientes que mais compram</h3>${reportRows(dashboard.topCustomers, (item) => `${item.name} - ${formatMoney(item.total)} (${item.orders} pedido${item.orders === 1 ? "" : "s"})`)}</article>
      <article><h3>Cupons mais usados</h3>${reportRows(dashboard.topCoupons, (item) => `${item.code} - ${item.uses} uso${item.uses === 1 ? "" : "s"} (${formatMoney(item.discount)} desc.)`)}</article>
    `;

    ordersBox.innerHTML = orders.length
      ? orders
          .map(
            (order) => `
              <article>
                <strong>Pedido ${order.id.slice(0, 8)}</strong>
                <span>${formatMoney(order.total)} - ${orderStatusLabels[order.status] || order.status}</span>
                <span>${order.customer?.name || "Cliente nao informado"} - ${order.customer?.email || "sem e-mail"}</span>
                <small>${new Date(order.createdAt).toLocaleString("pt-BR")}</small>
                ${order.stockReservedUntil && order.status === "payment_pending" ? `<small>Reserva ate ${new Date(order.stockReservedUntil).toLocaleString("pt-BR")}</small>` : ""}
                ${order.trackingCode ? `<small>Rastreio: ${order.trackingCode}</small>` : ""}
                <button class="button ghost compact-button" type="button" data-view-order="${order.id}">Ver detalhes</button>
              </article>
            `
          )
          .join("")
      : "<p>Nenhum pedido registrado ainda.</p>";

    customersBox.innerHTML = customers.length
      ? customers
          .map(
            (customer) => `
              <article>
                <strong>${customer.name}</strong>
                <span>${customer.email}</span>
                <small>Permissao: ${customer.role === "admin" ? "Admin" : "Cliente comum"}</small>
              </article>
            `
          )
          .join("")
      : "<p>Nenhuma cliente cadastrada ainda.</p>";

    stockBox.innerHTML = dashboard.lowStock.length
      ? dashboard.lowStock.map((product) => `<article><strong>${product.name}</strong><span>${Number(product.stock) <= 0 ? "Esgotado" : `${product.stock} unidade(s)`}</span></article>`).join("")
      : "<p>Nenhum produto com estoque baixo.</p>";

    couponsBox.innerHTML = coupons.length
      ? coupons.map((coupon) => `<article><strong>${coupon.code}</strong><span>${coupon.type === "percent" ? `${coupon.value}%` : formatMoney(coupon.value)} - minimo ${formatMoney(coupon.minSubtotal)}</span><button type="button" data-delete-coupon="${coupon.id}">Excluir</button></article>`).join("")
      : "<p>Nenhum cupom cadastrado.</p>";

    notificationsBox.innerHTML = notifications.length
      ? notifications.slice(0, 8).map((item) => `<article><strong>${item.subject}</strong><span>${item.to}</span><small>${new Date(item.createdAt).toLocaleString("pt-BR")}</small><p>${String(item.message || "").replace(/\n/g, "<br>")}</p></article>`).join("")
      : "<p>Nenhuma notificacao gerada ainda.</p>";
  } catch (error) {
    ordersBox.innerHTML = "<p>Rode o backend para visualizar pedidos.</p>";
    customersBox.innerHTML = "<p>Rode o backend para visualizar clientes.</p>";
    if (notificationsBox) notificationsBox.innerHTML = "<p>Rode o backend para visualizar notificacoes.</p>";
  }
}

function reportRows(items = [], render) {
  return items.length ? `<ul>${items.map((item) => `<li>${render(item)}</li>`).join("")}</ul>` : "<p>Nenhum dado ainda.</p>";
}

function monthLabel(month) {
  const [year, monthNumber] = String(month).split("-");
  return new Date(Number(year), Number(monthNumber) - 1).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function dateValue(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function renderOrderDetail(order) {
  if (!orderDetailBox) return;
  const shipping = order.shipping || {};
  const quote = shipping.quote || {};
  orderDetailBox.innerHTML = `
    <h2>Pedido ${order.id.slice(0, 8)}</h2>
    <div class="order-detail-grid">
      <article>
        <h3>Cliente</h3>
        <p><strong>${order.customer?.name || "Nao informado"}</strong></p>
        <p>${order.customer?.email || "Sem e-mail"}</p>
        <p>${order.customer?.phone || ""}</p>
      </article>
      <article>
        <h3>Endereco</h3>
        <p>${shipping.address || "Nao informado"}</p>
        <p>${shipping.city || ""} ${shipping.cep ? `- CEP ${shipping.cep}` : ""}</p>
        <p>${quote.label || shipping.method || "Entrega nao informada"}</p>
      </article>
      <article>
        <h3>Pagamento</h3>
        <p>${paymentLabel(order.paymentMethod)}</p>
        <p>${order.paymentProvider || "PagBank"}</p>
        <p>Status: ${orderStatusLabels[order.status] || order.status}</p>
      </article>
    </div>
    <h3>Produtos comprados</h3>
    <div class="order-products">
      ${(order.items || []).map((item) => `<div><span>${item.quantity}x ${item.name}</span><strong>${formatMoney(Number(item.price) * Number(item.quantity))}</strong></div>`).join("")}
    </div>
    <div class="summary-lines admin-summary-lines">
      <div><span>Produtos</span><strong>${formatMoney(order.subtotal)}</strong></div>
      <div><span>Frete</span><strong>${formatMoney(order.shippingCost)}</strong></div>
      ${order.couponDiscount ? `<div><span>Cupom ${order.coupon?.code || ""}</span><strong>-${formatMoney(order.couponDiscount)}</strong></div>` : ""}
      <div class="summary-total"><span>Total</span><strong>${formatMoney(order.total)}</strong></div>
    </div>
    <form class="admin-order-update" data-order-update="${order.id}">
      <label>Status<select name="status">${Object.entries(orderStatusLabels).map(([value, label]) => `<option value="${value}" ${order.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label>Transportadora<input name="carrier" value="${order.carrier || ""}" placeholder="Correios, Jadlog, Motoboy..." /></label>
      <label>Codigo de rastreio<input name="trackingCode" value="${order.trackingCode || ""}" /></label>
      <label>Data de envio<input name="shippedAt" type="date" value="${dateValue(order.shippedAt)}" /></label>
      <label>Data de entrega<input name="deliveredAt" type="date" value="${dateValue(order.deliveredAt)}" /></label>
      <button class="button primary full" type="submit">Salvar status e envio</button>
    </form>
  `;
}

function paymentLabel(method) {
  return {
    pix: "Pix",
    credit_card: "Cartao de credito",
    debit_card: "Cartao de debito",
    boleto: "Boleto",
  }[method] || method || "Nao informado";
}

productForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(productForm);
  let imagePath = String(data.get("image") || "").trim();
  const imageFile = data.get("imageFile");

  try {
    if (imageFile?.size) {
      if (imageFile.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no maximo 5 MB.");
      const dataUrl = await readFileAsDataUrl(imageFile);
      const uploadResponse = await adminFetch("/api/admin/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const upload = await uploadResponse.json();
      if (!uploadResponse.ok) throw new Error(upload.error || "Nao foi possivel enviar a imagem.");
      imagePath = upload.imagePath;
    }

    const product = {
      name: data.get("name"),
      category: data.get("category"),
      price: data.get("price"),
      stock: data.get("stock"),
      image: imagePath,
      description: data.get("description"),
      details: data.get("details"),
      isNew: data.get("isNew") === "on",
      isBestSeller: data.get("isBestSeller") === "on",
    };
    const response = await adminFetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Nao foi possivel salvar.");
    statusBox.textContent = "Produto cadastrado com sucesso.";
    productForm.reset();
  } catch (error) {
    statusBox.textContent = error.message;
  }
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Nao foi possivel ler a imagem."));
    reader.readAsDataURL(file);
  });
}

couponForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = Object.fromEntries(new FormData(couponForm));
  const response = await adminFetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (response.ok) {
    couponForm.reset();
    loadAdminData();
  }
});

couponsBox?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-coupon]");
  if (!button) return;
  await adminFetch(`/api/admin/coupons/${button.dataset.deleteCoupon}`, { method: "DELETE" });
  loadAdminData();
});

ordersBox?.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-view-order]");
  if (!button) return;
  const order = adminOrders.find((item) => item.id === button.dataset.viewOrder);
  if (order) renderOrderDetail(order);
});

orderDetailBox?.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-order-update]");
  if (!form) return;
  event.preventDefault();
  const orderId = form.dataset.orderUpdate;
  const data = new FormData(form);
  const response = await adminFetch(`/api/admin/orders/${orderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      status: data.get("status"),
      carrier: data.get("carrier"),
      trackingCode: data.get("trackingCode"),
      shippedAt: data.get("shippedAt"),
      deliveredAt: data.get("deliveredAt"),
    }),
  });
  if (!response.ok) {
    const result = await response.json();
    statusBox.textContent = result.error || "Nao foi possivel atualizar o pedido.";
    return;
  }
  statusBox.textContent = "Pedido atualizado.";
  const updatedOrder = await response.json();
  await loadAdminData();
  renderOrderDetail(updatedOrder);
});

document.addEventListener("shop:ready", () => {
  renderAdminPermissionNotice();
  loadAdminData();
});
