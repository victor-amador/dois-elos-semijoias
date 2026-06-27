const checkoutForm = document.querySelector("[data-page-checkout-form]");
const summaryRoot = document.querySelector("[data-checkout-page-summary]");
const deliveryRoot = document.querySelector("[data-delivery-options]");
const checkoutStatus = document.querySelector("[data-page-checkout-status]");
const shippingStatus = document.querySelector("[data-shipping-status]");
const savedAddressesSelect = document.querySelector("[data-saved-addresses]");
const addressStorageKey = "doisElosAddresses";
let serverShippingQuote = null;

function savedAddresses() {
  return JSON.parse(localStorage.getItem(addressStorageKey) || "[]");
}

function saveCheckoutAddress(shipping) {
  const addresses = savedAddresses();
  const normalizedCep = String(shipping.cep || "").replace(/\D/g, "");
  const exists = addresses.some((item) => String(item.cep || "").replace(/\D/g, "") === normalizedCep && item.address === shipping.address);
  if (!exists) {
    addresses.push({
      label: shipping.city || "Endereco de entrega",
      cep: normalizedCep,
      city: shipping.city,
      address: shipping.address,
    });
    localStorage.setItem(addressStorageKey, JSON.stringify(addresses));
  }
}

function renderSavedAddresses() {
  if (!savedAddressesSelect) return;
  const addresses = savedAddresses();
  savedAddressesSelect.innerHTML = `<option value="">Cadastrar novo endereco</option>${addresses
    .map((item, index) => `<option value="${index}">${item.label || item.city || "Endereco"} - ${item.cep}</option>`)
    .join("")}`;
}

async function fetchShippingQuote() {
  const entries = [...cart.values()];
  const summary = getCartSummary(entries);
  const data = new FormData(checkoutForm);
  const cep = data.get("cep");
  const method = data.get("method") || getShippingData().method || "standard";
  if (String(cep || "").replace(/\D/g, "").length !== 8) {
    serverShippingQuote = null;
    if (shippingStatus) shippingStatus.textContent = "Informe um CEP com 8 digitos para calcular o frete.";
    return null;
  }
  const response = await fetch("/api/shipping/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cep, subtotal: summary.subtotal, method }),
  });
  const quote = await response.json();
  if (!response.ok) throw new Error(quote.error || "Nao foi possivel calcular o frete.");
  serverShippingQuote = quote;
  if (shippingStatus) shippingStatus.textContent = `Frete calculado para o CEP ${quote.cep}.`;
  return quote;
}

function checkoutSummaryWithServerShipping(entries) {
  const summary = getCartSummary(entries);
  if (!serverShippingQuote) return summary;
  const shipping = Number(serverShippingQuote.selected.price || 0);
  const freeShippingDiscount = Number(serverShippingQuote.freeShippingDiscount || 0);
  return {
    ...summary,
    shipping,
    freeShippingDiscount,
    total: summary.subtotal + shipping - summary.couponDiscount,
    shippingMethod: serverShippingQuote.selected.method,
  };
}

function renderCheckoutPage() {
  const entries = [...cart.values()];
  if (!entries.length) {
    window.location.href = "carrinho.html";
    return;
  }
  const customer = JSON.parse(localStorage.getItem(customerStorageKey) || "null");
  const shipping = getShippingData();
  const summary = checkoutSummaryWithServerShipping(entries);
  renderSavedAddresses();
  if (customer) {
    checkoutForm.elements.name.value = customer.name || "";
    checkoutForm.elements.email.value = customer.email || "";
    checkoutForm.elements.phone.value = customer.phone || "";
    checkoutForm.elements.taxId.value = customer.taxId || "";
  }
  checkoutForm.elements.cep.value = shipping.cep || "";
  checkoutForm.elements.city.value = shipping.city || "";
  checkoutForm.elements.address.value = shipping.address || "";
  const options = serverShippingQuote?.options || Object.entries(shippingRules).map(([method, option]) => ({ method, ...option, originalPrice: option.price }));
  deliveryRoot.innerHTML = options.map((option) => `<label class="delivery-option ${summary.shippingMethod === option.method ? "selected" : ""}"><input type="radio" name="method" value="${option.method}" ${summary.shippingMethod === option.method ? "checked" : ""} /><span><strong>${option.label}</strong><small>${option.days}</small></span><b>${Number(option.price) ? formatMoney(option.price) : "Gratis"}</b></label>`).join("");
  summaryRoot.innerHTML = `<h2>Seu pedido</h2><p class="secure-summary">Compra segura, garantia de 1 ano e troca conforme politica.</p>${summary.freeShippingRemaining > 0 ? `<p class="shipping-callout">Faltam ${formatMoney(summary.freeShippingRemaining)} para frete gratis.</p>` : `<p class="shipping-callout success">Frete gratis aplicado.</p>`}${entries.map((item) => `<div class="checkout-summary-item"><span>${item.quantity}x ${item.name}</span><strong>${formatMoney(item.price * item.quantity)}</strong></div>`).join("")}<div class="coupon-box"><label>Cupom<input name="coupon" placeholder="Codigo" value="${summary.coupon?.code || ""}" /></label><button type="button" data-page-coupon>Aplicar</button></div><div class="summary-lines"><div><span>Produtos</span><strong>${formatMoney(summary.subtotal)}</strong></div><div><span>Frete</span><strong>${summary.shipping ? formatMoney(summary.shipping) : "Gratis"}</strong></div>${summary.couponDiscount ? `<div><span>Desconto</span><strong>-${formatMoney(summary.couponDiscount)}</strong></div>` : ""}<div class="summary-total"><span>Total</span><strong>${formatMoney(summary.total)}</strong></div></div>`;
}

async function applyPageCoupon() {
  const input = summaryRoot.querySelector("[name=coupon]");
  try {
    const response = await fetch("/api/admin/coupons");
    const coupons = await response.json();
    const coupon = coupons.find((item) => item.code === input.value.trim().toUpperCase() && item.active);
    if (!coupon) throw new Error("Cupom invalido.");
    if (getCartSummary().subtotal < Number(coupon.minSubtotal || 0)) throw new Error(`Compra minima: ${formatMoney(Number(coupon.minSubtotal || 0))}.`);
    localStorage.setItem(couponStorageKey, JSON.stringify(coupon));
    renderCheckoutPage();
  } catch (error) { checkoutStatus.textContent = error.message; }
}

document.addEventListener("shop:ready", async () => {
  renderCheckoutPage();
  try {
    if (checkoutForm.elements.cep.value) {
      await fetchShippingQuote();
      renderCheckoutPage();
    }
  } catch (error) {
    if (shippingStatus) shippingStatus.textContent = error.message;
  }
});
deliveryRoot?.addEventListener("change", async () => {
  const data = new FormData(checkoutForm);
  saveShippingData({ ...getShippingData(), method: data.get("method") });
  try { await fetchShippingQuote(); } catch (error) { if (shippingStatus) shippingStatus.textContent = error.message; }
  renderCheckoutPage();
});
summaryRoot?.addEventListener("click", (event) => { if (event.target.closest("[data-page-coupon]")) applyPageCoupon(); });
savedAddressesSelect?.addEventListener("change", () => {
  const selected = savedAddresses()[Number(savedAddressesSelect.value)];
  if (!selected) return;
  checkoutForm.elements.cep.value = selected.cep || "";
  checkoutForm.elements.city.value = selected.city || selected.label || "";
  checkoutForm.elements.address.value = selected.address || "";
  saveShippingData({ ...getShippingData(), cep: selected.cep, city: selected.city || selected.label, address: selected.address });
});
checkoutForm?.elements.cep?.addEventListener("blur", async () => {
  try {
    await fetchShippingQuote();
    const data = new FormData(checkoutForm);
    saveShippingData({ ...getShippingData(), cep: data.get("cep"), city: data.get("city"), address: data.get("address"), method: data.get("method") });
    renderCheckoutPage();
  } catch (error) {
    if (shippingStatus) shippingStatus.textContent = error.message;
  }
});
checkoutForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(checkoutForm);
  const shipping = { cep: data.get("cep"), city: data.get("city"), address: data.get("address"), method: data.get("method"), paymentMethod: data.get("paymentMethod") };
  saveShippingData(shipping);
  const customer = { name: data.get("name"), email: data.get("email"), phone: data.get("phone"), taxId: data.get("taxId") };
  localStorage.setItem(customerStorageKey, JSON.stringify(customer));
  if (data.get("saveAddress")) saveCheckoutAddress(shipping);
  checkoutStatus.textContent = "Criando seu pagamento seguro...";
  try {
    await fetchShippingQuote();
    const result = await registerOrder([...cart.values()]);
    cart.clear(); saveCart();
    window.location.href = result.payment.redirectUrl;
  } catch (error) { checkoutStatus.textContent = error.message || "Nao foi possivel iniciar o pagamento."; }
});
