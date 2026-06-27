const params = new URLSearchParams(window.location.search);
let product = products.find((item) => item.id === params.get("id")) || products[0];
const root = document.querySelector("[data-product-page]");

function renderProductPage() {
  document.title = `${product.name} | Dois Elos Semijoias`;
  root.innerHTML = `
    <section class="product-detail">
      <div class="detail-gallery">
        <div class="detail-main-image detail-zoom">
          <img src="${product.image}" alt="${product.name}" data-main-image />
        </div>
        <div class="thumbs">
          ${product.gallery
            .map(
              (image) => `
                <button type="button" data-thumb="${image}">
                  <img src="${image}" alt="Foto de ${product.name}" />
                </button>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="detail-info">
        <a class="back-link" href="index.html#colecao">Voltar para a loja</a>
        <span class="product-badge">${product.badge}</span>
        <h1>${product.name}</h1>
        <p>${product.description}</p>
        <div class="detail-price">
          <strong>${formatMoney(product.price)}</strong>
          ${product.oldPrice ? `<span>${formatMoney(product.oldPrice)}</span>` : ""}
        </div>
        <div class="rating-summary" data-rating-summary>Carregando avaliacoes...</div>
        <div class="detail-actions">
          <button class="button primary" type="button" data-add="${product.id}">Adicionar a sacola</button>
          <button class="button ghost" type="button" data-favorite="${product.id}">Favoritar</button>
        </div>
        <div class="detail-panels">
          <article><h3>Detalhes</h3><p>${product.details}</p></article>
          <article><h3>Garantia</h3><p>Garantia de 1 ano contra defeitos de fabricacao, com cuidados de uso descritos na politica da loja.</p></article>
          <article><h3>Entrega</h3><p>Frete gratis acima de R$199,99 e rastreamento do pedido quando enviado.</p></article>
        </div>
      </div>
    </section>
    <section class="section-heading compact">
      <p class="eyebrow">Combine tambem</p>
      <h2>Outras pecas que conversam com essa escolha</h2>
    </section>
    <section class="product-grid related-grid">
      ${products
        .filter((item) => item.id !== product.id)
        .slice(0, 3)
        .map(productCard)
        .join("")}
    </section>
    <section class="reviews-section">
      <div class="section-heading compact"><p class="eyebrow">Avaliacoes</p><h2>O que as clientes dizem</h2></div>
      <div class="reviews-layout">
        <div class="reviews-list" data-reviews-list></div>
        <form class="account-form review-form" data-review-form>
          <h3>Avalie esta peca</h3>
          <p class="verified-note">Avaliacao disponivel apenas para clientes com compra verificada desta peca.</p>
          <label>Nota<select name="rating"><option value="5">5 estrelas</option><option value="4">4 estrelas</option><option value="3">3 estrelas</option><option value="2">2 estrelas</option><option value="1">1 estrela</option></select></label>
          <label>Comentario<textarea name="comment" placeholder="Conte como foi sua experiencia"></textarea></label>
          <button class="button primary full" type="submit">Enviar avaliacao</button>
          <p data-review-status></p>
        </form>
      </div>
    </section>
  `;
  loadReviews();
}

async function loadReviews() {
  const list = root.querySelector("[data-reviews-list]");
  const summary = root.querySelector("[data-rating-summary]");
  try {
    const response = await fetch(`/api/products/${product.id}/reviews`);
    const reviews = await response.json();
    const average = reviews.length ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length : 0;
    summary.textContent = reviews.length ? `${average.toFixed(1)} de 5 - ${reviews.length} avaliacao(oes)` : "Ainda nao ha avaliacoes.";
    list.innerHTML = reviews.length
      ? reviews.map((review) => `<article><strong>${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</strong><span>${review.customerName} ${review.verifiedPurchase ? `<b class="verified-badge">Compra verificada</b>` : ""}</span><p>${review.comment || "Sem comentario."}</p></article>`).join("")
      : "<p>Seja a primeira pessoa a avaliar esta peca.</p>";
  } catch (error) {
    summary.textContent = "Avaliacoes indisponiveis agora.";
  }
}

root.addEventListener("click", (event) => {
  const thumb = event.target.closest("[data-thumb]");
  if (!thumb) return;
  root.querySelector("[data-main-image]").src = thumb.dataset.thumb;
});

root.addEventListener("submit", async (event) => {
  if (!event.target.matches("[data-review-form]")) return;
  event.preventDefault();
  const customer = JSON.parse(localStorage.getItem(customerStorageKey) || "null");
  const status = root.querySelector("[data-review-status]");
  if (!customer) {
    status.textContent = "Entre na sua conta para avaliar.";
    return;
  }
  const data = new FormData(event.target);
  try {
    const response = await fetch(`/api/products/${product.id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: customer.name, customerEmail: customer.email, rating: data.get("rating"), comment: data.get("comment") }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Nao foi possivel enviar.");
    event.target.reset();
    status.textContent = "Avaliacao enviada.";
    loadReviews();
  } catch (error) {
    status.textContent = error.message;
  }
});

document.addEventListener("shop:ready", () => {
  product = products.find((item) => item.id === params.get("id")) || products[0];
  renderProductPage();
});
