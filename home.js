let activeFilter = "todas";
let activeSort = "featured";
let searchTerm = "";

const productGrid = document.querySelector("[data-products]");
const searchInputs = document.querySelectorAll("[data-search]");
const shopSummary = document.querySelector("[data-shop-summary]");
const filterButtons = document.querySelectorAll("[data-filter]");
const sortSelect = document.querySelector("[data-sort]");

function getVisibleProducts() {
  const normalizedSearch = searchTerm.trim().toLowerCase();
  let visible = products.filter((product) => {
    const matchesCategory =
      activeFilter === "todas" ||
      product.category === activeFilter ||
      (activeFilter === "novidades" && product.isNew) ||
      (activeFilter === "mais-vendidos" && product.isBestSeller) ||
      (activeFilter === "favoritos" && favorites.has(product.id));

    const matchesSearch =
      !normalizedSearch ||
      product.name.toLowerCase().includes(normalizedSearch) ||
      product.description.toLowerCase().includes(normalizedSearch) ||
      product.category.toLowerCase().includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  if (activeSort === "price-asc") visible = visible.sort((a, b) => a.price - b.price);
  if (activeSort === "price-desc") visible = visible.sort((a, b) => b.price - a.price);
  if (activeSort === "name") visible = visible.sort((a, b) => a.name.localeCompare(b.name));
  return visible;
}

function renderProducts() {
  const visible = getVisibleProducts();
  shopSummary.textContent =
    visible.length === 1 ? "1 peca encontrada" : `${visible.length} pecas encontradas`;
  productGrid.innerHTML = visible.length
    ? visible.map(productCard).join("")
    : `<div class="empty-state"><h3>Nenhuma peca encontrada</h3><p>Tente buscar por outra palavra ou categoria.</p></div>`;
}

function renderShelf(selector, items) {
  const shelf = document.querySelector(selector);
  if (shelf) shelf.innerHTML = items.map(productCard).join("");
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderProducts();
  });
});

searchInputs.forEach((input) => {
  input.addEventListener("input", (event) => {
    searchTerm = event.target.value;
    searchInputs.forEach((item) => {
      if (item !== event.target) item.value = searchTerm;
    });
    renderProducts();
  });
});

sortSelect?.addEventListener("change", (event) => {
  activeSort = event.target.value;
  renderProducts();
});

document.addEventListener("favorites:changed", renderProducts);

function renderHome() {
  renderShelf("[data-new-products]", products.filter((product) => product.isNew).slice(0, 3));
  renderShelf("[data-best-products]", products.filter((product) => product.isBestSeller).slice(0, 3));
  renderProducts();
  renderHomeFeedbacks();
}

async function renderHomeFeedbacks() {
  const root = document.querySelector("[data-home-feedbacks]");
  if (!root) return;
  try {
    const response = await fetch("/api/reviews");
    const reviews = await response.json();
    root.innerHTML = reviews.length
      ? reviews.slice(0, 3).map((review) => `<article><strong>${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</strong><p>${review.comment || "Compra aprovada pela cliente."}</p><span>${review.customerName} ${review.verifiedPurchase ? `<b class="verified-badge">Compra verificada</b>` : ""}</span></article>`).join("")
      : `<article class="feedback-empty"><p>As avaliacoes das clientes aparecerao aqui apos as primeiras compras.</p></article>`;
  } catch (error) {
    root.innerHTML = "";
  }
}

document.addEventListener("shop:ready", renderHome);
