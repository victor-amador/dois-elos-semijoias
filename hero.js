const heroSlides = [
  {
    eyebrow: "Nova Colecao",
    title: "Semijoias delicadas para iluminar sua rotina.",
    text: "Pecas finas, femininas e versateis, escolhidas para criar presenca com leveza.",
    image: "assets/banner-home.jpg",

  },
  {
    eyebrow: "Promocoes da Semana",
    title: "Escolhas especiais para presentear.",
    text: "Selecao com brilho elegante e condicoes para renovar seus favoritos.",
  },
  {
    eyebrow: "Frete Gratis",
    title: "Frete gratis acima de R$199,99.",
    text: "Monte sua sacola com tranquilidade e veja o desconto aplicado no checkout.",
  },
  {
    eyebrow: "Destaques da Loja",
    title: "Os favoritos da Dois Elos em um so lugar.",
    text: "Colares, brincos, aneis e pulseiras para compor do basico ao sofisticado.",
  },
];

let currentHeroSlide = 0;
const heroCopy = document.querySelector(".hero-copy");

function renderHeroSlide() {
  if (!heroCopy) return;
  const slide = heroSlides[currentHeroSlide];
  heroCopy.innerHTML = `
    <p class="eyebrow">${slide.eyebrow}</p>
    <h1>${slide.title}</h1>
    <p>${slide.text}</p>
    <div class="hero-actions">
      <a class="button primary" href="#colecao">Comprar agora</a>
      <a class="button ghost" href="login.html">Entrar ou cadastrar</a>
    </div>
    <div class="hero-dots">${heroSlides.map((_, index) => `<button type="button" data-hero-dot="${index}" class="${index === currentHeroSlide ? "active" : ""}" aria-label="Ir para slide ${index + 1}"></button>`).join("")}</div>
  `;
}

if (heroCopy) {
  renderHeroSlide();
  setInterval(() => {
    currentHeroSlide = (currentHeroSlide + 1) % heroSlides.length;
    renderHeroSlide();
  }, 5200);
  heroCopy.addEventListener("click", (event) => {
    const dot = event.target.closest("[data-hero-dot]");
    if (!dot) return;
    currentHeroSlide = Number(dot.dataset.heroDot);
    renderHeroSlide();
  });
}
