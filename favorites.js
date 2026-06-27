function renderFavoritesPage() {
  const root = document.querySelector("[data-favorites-page]");
  const items = products.filter((product) => favorites.has(product.id));
  root.innerHTML = items.length
    ? items.map(productCard).join("")
    : "<div class=\"empty-state\"><h3>Sua lista esta vazia</h3><p>Use o coracao nas pecas para salvar suas escolhas.</p><a class=\"button primary\" href=\"index.html#colecao\">Ver produtos</a></div>";
}

document.addEventListener("shop:ready", renderFavoritesPage);
document.addEventListener("favorites:changed", renderFavoritesPage);
