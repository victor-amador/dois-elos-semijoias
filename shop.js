const whatsappNumber = "5561992656158";
const cartStorageKey = "doisElosCart";
const favoritesStorageKey = "doisElosFavorites";
const customerStorageKey = "doisElosCustomer";
const couponStorageKey = "doisElosCoupon";
const shippingStorageKey = "doisElosShipping";
const freeShippingThreshold = 199.99;
const shippingRules = {
  pickup: { label: "Retirada combinada", price: 0, days: "A combinar" },
  local: { label: "Entrega local", price: 14.9, days: "1 a 2 dias uteis" },
  standard: { label: "Correios/transportadora", price: 24.9, days: "3 a 8 dias uteis" },
};

const cart = new Map();
function cartKey() {
  const customer = JSON.parse(localStorage.getItem(customerStorageKey) || "null");
  return customer?.email ? `${cartStorageKey}:${customer.email}` : cartStorageKey;
}

function favoritesKey() {
  const customer = JSON.parse(localStorage.getItem(customerStorageKey) || "null");
  return customer?.email ? `${favoritesStorageKey}:${customer.email}` : favoritesStorageKey;
}

const favorites = new Set(JSON.parse(localStorage.getItem(favoritesKey()) || "[]"));
let toastTimer;

const formatMoney = (value) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function loadCart() {
  const savedCart = JSON.parse(localStorage.getItem(cartKey()) || localStorage.getItem(cartStorageKey) || "[]");
  savedCart.forEach((item) => {
    const product = products.find((productItem) => productItem.id === item.id);
    if (product) cart.set(product.id, { ...product, quantity: item.quantity });
  });
}

function saveCart() {
  localStorage.setItem(
    cartKey(),
    JSON.stringify([...cart.values()].map((item) => ({ id: item.id, quantity: item.quantity })))
  );
}

function saveFavorites() {
  localStorage.setItem(favoritesKey(), JSON.stringify([...favorites]));
}

function getCartSummary(entries = [...cart.values()]) {
  const subtotal = entries.reduce((sum, item) => sum + item.quantity * item.price, 0);
  const totalItems = entries.reduce((sum, item) => sum + item.quantity, 0);
  const shippingData = getShippingData();
  const shippingMethod = shippingData.method || "standard";
  const baseShipping = shippingRules[shippingMethod]?.price ?? shippingRules.standard.price;
  const freeShippingDiscount = subtotal >= freeShippingThreshold ? baseShipping : 0;
  const shipping = subtotal > 0 ? Math.max(baseShipping - freeShippingDiscount, 0) : 0;
  const coupon = JSON.parse(localStorage.getItem(couponStorageKey) || "null");
  const couponDiscount = coupon && subtotal >= Number(coupon.minSubtotal || 0)
    ? Math.min(coupon.type === "percent" ? subtotal * (Number(coupon.value) / 100) : Number(coupon.value), subtotal)
    : 0;
  const total = subtotal + shipping - couponDiscount;

  return {
    subtotal,
    totalItems,
    shipping,
    total,
    freeShippingDiscount,
    freeShippingRemaining: Math.max(freeShippingThreshold - subtotal, 0),
    coupon,
    couponDiscount,
    shippingMethod,
    shippingData,
  };
}

function getShippingData() {
  return JSON.parse(localStorage.getItem(shippingStorageKey) || "{}");
}

function saveShippingData(data) {
  localStorage.setItem(shippingStorageKey, JSON.stringify(data));
}

function addToCart(productId, quantity = 1) {
  const product = products.find((item) => item.id === productId);
  if (!product) return;
  if (Number(product.stock) <= 0) {
    showToast("Esta peca esta esgotada no momento.");
    return;
  }
  const current = cart.get(productId);
  if ((current?.quantity || 0) + quantity > Number(product.stock)) {
    showToast("Quantidade maxima disponivel em estoque atingida.");
    return;
  }
  cart.set(productId, { ...product, quantity: (current?.quantity || 0) + quantity });
  renderCart();
  showToast(`${product.name} foi adicionado a sacola.`);
}

function decreaseFromCart(productId) {
  const current = cart.get(productId);
  if (!current) return;
  if (current.quantity === 1) cart.delete(productId);
  else cart.set(productId, { ...current, quantity: current.quantity - 1 });
  renderCart();
}

function removeFromCart(productId) {
  cart.delete(productId);
  renderCart();
}

function toggleFavorite(productId) {
  favorites.has(productId) ? favorites.delete(productId) : favorites.add(productId);
  saveFavorites();
  document.dispatchEvent(new CustomEvent("favorites:changed"));
}

function productCard(product) {
  return `
    <article class="product-card">
      <button class="favorite-button ${favorites.has(product.id) ? "active" : ""}" type="button" data-favorite="${product.id}" aria-label="Favoritar ${product.name}">
        ${favorites.has(product.id) ? "♥" : "♡"}
      </button>
      <a class="product-link" href="produto.html?id=${product.id}">
        <div class="product-media">
          <img src="${product.image}" alt="${product.name}" loading="lazy" />
        </div>
        <div class="product-info">
          <span class="product-badge">${product.badge}</span>
          <h3>${product.name}</h3>
          <p>${product.description}</p>
        </div>
      </a>
      <div class="product-bottom">
        <span class="price">${formatMoney(product.price)}</span>
        <button class="add-button" type="button" data-add="${product.id}" ${Number(product.stock) <= 0 ? "disabled" : ""}>${Number(product.stock) <= 0 ? "Esgotado" : "Adicionar"}</button>
      </div>
    </article>
  `;
}

function renderCart() {
  const cartCount = document.querySelector("[data-cart-count]");
  const cartItems = document.querySelector("[data-cart-items]");
  const cartTotal = document.querySelector("[data-cart-total]");
  const checkout = document.querySelector("[data-checkout]");

  const entries = [...cart.values()];
  const summary = getCartSummary(entries);
  if (cartCount) cartCount.textContent = summary.totalItems;
  if (!cartItems || !cartTotal || !checkout) {
    saveCart();
    return;
  }
  cartTotal.textContent = formatMoney(summary.total);

  cartItems.innerHTML = entries.length
    ? `
        <div class="cart-free-shipping">
          ${
            summary.freeShippingRemaining > 0
              ? `Faltam <strong>${formatMoney(summary.freeShippingRemaining)}</strong> para frete gratis.`
              : "<strong>Frete gratis aplicado.</strong>"
          }
        </div>
        ${entries
          .map(
            (item) => `
            <div class="cart-row">
              <span>${item.name}</span>
              <div class="quantity-control">
                <button type="button" data-decrease="${item.id}">-</button>
                <strong>${item.quantity}</strong>
                <button type="button" data-add="${item.id}">+</button>
              </div>
              <strong>${formatMoney(item.quantity * item.price)}</strong>
              <button class="remove-button" type="button" data-remove="${item.id}">Remover</button>
            </div>
          `
          )
          .join("")}
        ${checkoutTemplate(summary)}
      `
    : "<p>Sua sacola ainda esta vazia.</p>";

  checkout.textContent = "Finalizar compra";
  checkout.href = "#checkout";
  checkout.onclick = async (event) => {
    event.preventDefault();
    await submitCheckout(entries);
  };
  saveCart();
}

function checkoutTemplate(summary) {
  const shippingData = summary.shippingData;
  return `
    <form class="checkout-form" data-checkout-form id="checkout">
      <h3>Entrega</h3>
      <div class="checkout-grid">
        <label>CEP<input name="cep" inputmode="numeric" placeholder="00000-000" value="${shippingData.cep || ""}" required /></label>
        <label>Cidade<input name="city" placeholder="Brasilia" value="${shippingData.city || ""}" required /></label>
      </div>
      <label>Endereco<input name="address" placeholder="Rua, numero, complemento" value="${shippingData.address || ""}" required /></label>
      <label>Forma de entrega
        <select name="method" data-shipping-method>
          ${Object.entries(shippingRules)
            .map(
              ([value, rule]) => `
                <option value="${value}" ${summary.shippingMethod === value ? "selected" : ""}>
                  ${rule.label} - ${rule.price ? formatMoney(rule.price) : "Gratis"} - ${rule.days}
                </option>
              `
            )
            .join("")}
        </select>
      </label>
      <h3>Pagamento</h3>
      <div class="coupon-box">
        <label>Cupom de desconto<input name="coupon" placeholder="EX: DOISELOS10" value="${summary.coupon?.code || ""}" /></label>
        <button type="button" data-apply-coupon>Aplicar</button>
      </div>
      <label>Forma de pagamento
        <select name="paymentMethod" required>
          <option value="pix">Pix</option>
          <option value="credit_card">Cartao de credito</option>
          <option value="debit_card">Cartao de debito</option>
        </select>
      </label>
      <div class="order-summary">
        <div><span>Subtotal</span><strong>${formatMoney(summary.subtotal)}</strong></div>
        <div><span>Frete</span><strong>${summary.shipping ? formatMoney(summary.shipping) : "Gratis"}</strong></div>
        ${
          summary.freeShippingDiscount
            ? `<div><span>Desconto frete gratis</span><strong>-${formatMoney(summary.freeShippingDiscount)}</strong></div>`
            : ""
        }
        ${summary.couponDiscount ? `<div><span>Cupom ${summary.coupon.code}</span><strong>-${formatMoney(summary.couponDiscount)}</strong></div>` : ""}
        <div class="grand-total"><span>Total</span><strong>${formatMoney(summary.total)}</strong></div>
      </div>
      <p class="checkout-note">Ao finalizar, o pedido e registrado no sistema. O pagamento real sera conectado ao gateway escolhido.</p>
      <p class="checkout-status" data-checkout-status></p>
    </form>
  `;
}

function showToast(message) {
  let toast = document.querySelector("[data-toast]");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.toast = "";
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<span>${message}</span><a href="carrinho.html">Ver sacola</a>`;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}

async function registerOrder(entries) {
  if (!entries.length) return;

  const customer = JSON.parse(localStorage.getItem(customerStorageKey) || "null");
  const items = entries.map((item) => ({ id: item.id, quantity: item.quantity }));
  const summary = getCartSummary(entries);
  const shipping = getShippingData();

  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer,
        items,
        shipping,
        coupon: summary.coupon,
        totals: {
          subtotal: summary.subtotal,
          shipping: summary.shipping,
          total: summary.total,
          freeShippingDiscount: summary.freeShippingDiscount,
          couponDiscount: summary.couponDiscount,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      console.error("Erro do checkout:", result);
      throw new Error(result.error || result.detail || "Nao foi possivel registrar o pedido.");
    }
    return result;
  } catch (error) {
    throw error;
  }
}

async function submitCheckout(entries) {
  const form = document.querySelector("[data-checkout-form]");
  const status = document.querySelector("[data-checkout-status]");
  if (!entries.length || !form || !status) return;

  const data = new FormData(form);
  const shipping = {
    cep: data.get("cep"),
    city: data.get("city"),
    address: data.get("address"),
    method: data.get("method"),
    paymentMethod: data.get("paymentMethod"),
  };
  saveShippingData(shipping);
  status.textContent = "Registrando pedido...";

  let result;
  try {
    result = await registerOrder(entries);
  } catch (error) {
    status.textContent = error.message || "Nao foi possivel finalizar o pedido.";
    return;
  }

  cart.clear();
  saveCart();
  renderCart();
  showToast("Pedido registrado com sucesso.");
  status.textContent = "Pedido registrado com sucesso.";
  window.location.href = result.payment?.redirectUrl || `pagamento-pendente.html?pedido=${result.order.id}`;
}

async function applyCoupon(code) {
  const status = document.querySelector("[data-checkout-status]");
  if (!code) return;
  try {
    const response = await fetch("/api/admin/coupons");
    const coupons = await response.json();
    const coupon = coupons.find((item) => item.code === code.trim().toUpperCase() && item.active);
    if (!coupon) throw new Error("Cupom invalido.");
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) throw new Error("Cupom expirado.");
    if (coupon.maxUses && Number(coupon.usedCount) >= Number(coupon.maxUses)) throw new Error("Cupom indisponivel.");
    const subtotal = getCartSummary().subtotal;
    if (subtotal < Number(coupon.minSubtotal || 0)) throw new Error(`Compra minima: ${formatMoney(Number(coupon.minSubtotal || 0))}.`);
    localStorage.setItem(couponStorageKey, JSON.stringify(coupon));
    renderCart();
    showToast("Cupom aplicado.");
  } catch (error) {
    if (status) status.textContent = error.message;
  }
}

function wireSharedUi() {
  const cartModal = document.querySelector("[data-cart-modal]");
  document.querySelector("[data-open-cart]")?.addEventListener("click", () => {
    window.location.href = "carrinho.html";
  });
  document.querySelector("[data-close-cart]")?.addEventListener("click", () => cartModal?.close());
  document.querySelector("[data-cart-items]")?.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add]");
    const decreaseButton = event.target.closest("[data-decrease]");
    const removeButton = event.target.closest("[data-remove]");
    if (addButton || decreaseButton || removeButton) event.stopPropagation();
    if (addButton) addToCart(addButton.dataset.add);
    if (decreaseButton) decreaseFromCart(decreaseButton.dataset.decrease);
    if (removeButton) removeFromCart(removeButton.dataset.remove);
  });
  document.querySelector("[data-cart-items]")?.addEventListener("change", (event) => {
    if (!event.target.closest("[data-checkout-form]")) return;
    const form = event.target.closest("[data-checkout-form]");
    const data = new FormData(form);
    saveShippingData({
      cep: data.get("cep"),
      city: data.get("city"),
      address: data.get("address"),
      method: data.get("method"),
      paymentMethod: data.get("paymentMethod"),
    });
    renderCart();
  });
  document.querySelector("[data-cart-items]")?.addEventListener("click", (event) => {
    const couponButton = event.target.closest("[data-apply-coupon]");
    if (!couponButton) return;
    const input = document.querySelector("[data-checkout-form] [name=coupon]");
    applyCoupon(input?.value || "");
  });
  document.body.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add]");
    const favoriteButton = event.target.closest("[data-favorite]");
    if (addButton && !event.target.closest("[data-cart-items]")) {
      event.preventDefault();
      event.stopPropagation();
      addToCart(addButton.dataset.add);
    }
    if (favoriteButton) {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(favoriteButton.dataset.favorite);
    }
  });
}

async function bootShop() {
  await syncProductsFromApi();
  loadCart();
  wireSharedUi();
  renderCart();
  document.dispatchEvent(new CustomEvent("shop:ready"));
}

bootShop();
