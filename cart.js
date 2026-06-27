function renderCartPage() {
  const itemsRoot = document.querySelector("[data-cart-page-items]");
  const summaryRoot = document.querySelector("[data-cart-page-summary]");
  const caption = document.querySelector("[data-cart-page-caption]");
  const entries = [...cart.values()];
  const summary = getCartSummary(entries);
  caption.textContent = summary.totalItems ? `${summary.totalItems} item(ns) na sua sacola.` : "Sua sacola esta vazia.";

  if (!entries.length) {
    itemsRoot.innerHTML = `<div class="empty-state"><h3>Sua sacola esta vazia</h3><p>Encontre uma peca especial para voce.</p><a class="button primary" href="index.html#colecao">Continuar comprando</a></div>`;
    summaryRoot.innerHTML = "";
    return;
  }

  itemsRoot.innerHTML = entries.map((item) => `
    <article class="cart-product-row">
      <img src="${item.image}" alt="${item.name}" />
      <div><span class="product-badge">${item.category}</span><h3>${item.name}</h3><strong>${formatMoney(item.price)}</strong><button type="button" data-remove="${item.id}">Remover</button></div>
      <div class="quantity-control"><button type="button" data-decrease="${item.id}">-</button><strong>${item.quantity}</strong><button type="button" data-add="${item.id}">+</button></div>
      <strong>${formatMoney(item.price * item.quantity)}</strong>
    </article>`).join("");

  summaryRoot.innerHTML = `
    <h2>Resumo do pedido</h2>
    <div><span>Produtos</span><strong>${formatMoney(summary.subtotal)}</strong></div>
    <div><span>Frete</span><strong>${summary.freeShippingDiscount ? "Gratis" : "Calculado no checkout"}</strong></div>
    ${summary.freeShippingRemaining > 0 ? `<p class="shipping-callout">Faltam ${formatMoney(summary.freeShippingRemaining)} para frete gratis.</p>` : `<p class="shipping-callout success">Frete gratis aplicado.</p>`}
    <div class="summary-total"><span>Subtotal</span><strong>${formatMoney(summary.subtotal)}</strong></div>
    <a class="button primary full" href="checkout.html">Continuar para checkout</a>
    <a class="continue-shopping" href="index.html#colecao">Continuar comprando</a>`;
}

document.addEventListener("shop:ready", renderCartPage);
document.querySelector("[data-cart-page-items]")?.addEventListener("click", (event) => {
  const add = event.target.closest("[data-add]");
  const decrease = event.target.closest("[data-decrease]");
  const remove = event.target.closest("[data-remove]");
  if (add || decrease || remove) event.stopPropagation();
  if (add) addToCart(add.dataset.add);
  if (decrease) decreaseFromCart(decrease.dataset.decrease);
  if (remove) removeFromCart(remove.dataset.remove);
  renderCartPage();
});
