function getCustomer() {
  return JSON.parse(localStorage.getItem(customerStorageKey) || "null");
}

function firstName(name = "") {
  return name.trim().split(" ")[0] || "Cliente";
}

function renderPromoBar() {
  if (document.querySelector(".promo-bar")) return;
  const bar = document.createElement("div");
  bar.className = "promo-bar";
  bar.innerHTML = `
    <div class="promo-track">
      <span>Frete gratis acima de R$199,99</span>
      <span>Semijoias com garantia</span>
      <span>Compra 100% segura</span>
      <span>Parcelamento em ate 12x</span>
    </div>
  `;
  document.body.prepend(bar);
}

function renderAccountArea() {
  const navLinks = [...document.querySelectorAll(".nav a")];
  const loginLink = navLinks.find((link) => link.getAttribute("href") === "login.html");
  const customer = getCustomer();
  if (!loginLink) return;

  if (!customer) {
    loginLink.textContent = "Login/Cadastrar";
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "account-menu";
  wrapper.innerHTML = `
    <button type="button">Ola, ${firstName(customer.name)}</button>
    <div class="account-dropdown">
      <a href="perfil.html">Meu Perfil</a>
      <a href="compras.html">Minhas Compras</a>
      <a href="favoritos.html">Favoritos</a>
      <a href="perfil.html#enderecos">Enderecos</a>
      <a href="perfil.html#seguranca">Alterar Senha</a>
      <a href="#" data-logout>Sair</a>
    </div>
  `;
  loginLink.replaceWith(wrapper);
  const accountButton = wrapper.querySelector("button");
  accountButton.setAttribute("aria-expanded", "false");
  accountButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = wrapper.classList.toggle("open");
    accountButton.setAttribute("aria-expanded", String(isOpen));
  });
  document.addEventListener("click", (event) => {
    if (wrapper.contains(event.target)) return;
    wrapper.classList.remove("open");
    accountButton.setAttribute("aria-expanded", "false");
  });
  wrapper.querySelector("[data-logout]").addEventListener("click", (event) => {
    event.preventDefault();
    localStorage.removeItem(customerStorageKey);
    localStorage.removeItem("doisElosToken");
    window.location.href = "index.html";
  });
}

function renderFooterUpgrade() {
  const footer = document.querySelector(".footer");
  if (!footer || footer.dataset.upgraded) return;
  footer.dataset.upgraded = "true";
  footer.innerHTML = `
    <div class="footer-brand">
      <img class="footer-logo" src="assets/logo-dois-elos-crop.jpeg" alt="Dois Elos Semijoias" />
      <strong>Dois Elos Semijoias</strong>
      <p>Semijoias delicadas para mulheres que carregam brilho nos detalhes.</p>
      <a href="https://instagram.com/doiselosemijoias" target="_blank" rel="noreferrer">@doiselosemijoias</a>
    </div>
    <div>
      <h3>Institucional</h3>
      <a href="institucional.html?pagina=sobre">Sobre Nos</a>
      <a href="institucional.html?pagina=termos">Termos de Uso</a>
      <a href="institucional.html?pagina=privacidade">Politica de Privacidade</a>
      <a href="institucional.html?pagina=trocas">Trocas e Devolucoes</a>
      <a href="garantia.html">Garantia</a>
      <a href="rastreamento.html">Rastrear Pedido</a>
    </div>
    <div>
      <h3>Atendimento</h3>
      <a href="https://wa.me/5561992656158" target="_blank" rel="noreferrer">WhatsApp: (61) 99265-6158</a>
      <a href="mailto:contato@doiselosemijoias.com.br">contato@doiselosemijoias.com.br</a>
      <span>Brasilia - DF</span>
    </div>
    <div>
      <h3>Pagamento</h3>
      <div class="payment-badges"><span>Pix</span><span>Visa</span><span>Mastercard</span><span>Elo</span><span>Amex</span><span>Boleto</span></div>
      <h3>Seguranca</h3>
      <div class="payment-badges"><span>SSL</span><span>Site Seguro</span></div>
    </div>
    <small class="copyright">© 2026 Dois Elos Semijoias. Todos os direitos reservados.</small>
  `;
}

renderPromoBar();
renderAccountArea();
renderFooterUpgrade();
