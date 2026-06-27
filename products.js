let products = [
  {
    id: "colar-elos",
    name: "Colar Dois Elos",
    category: "colares",
    price: 129.9,
    oldPrice: 159.9,
    badge: "Mais vendido",
    collection: "Essenciais",
    description: "Colar dourado com elos delicados para compor looks leves e sofisticados.",
    details: "Banho dourado, corrente ajustavel e pingente com acabamento polido.",
    image: "assets/colar-elos.png",
    gallery: ["assets/colar-elos.png", "assets/colar-ponto.svg", "assets/pulseira-fina.svg"],
    isNew: false,
    isBestSeller: true,
  },
  {
    id: "brinco-perola",
    name: "Brinco Perola Serena",
    category: "brincos",
    price: 89.9,
    oldPrice: null,
    badge: "Novo",
    collection: "Classicos",
    description: "Brinco com perola e banho dourado, perfeito para ocasioes especiais.",
    details: "Peca leve com perola sintetica e base delicada para uso confortavel.",
    image: "assets/brinco-perola.svg",
    gallery: ["assets/brinco-perola.svg", "assets/argola-classica.svg", "assets/anel-luz.svg"],
    isNew: true,
    isBestSeller: false,
  },
  {
    id: "anel-luz",
    name: "Anel Ponto de Luz",
    category: "aneis",
    price: 74.9,
    oldPrice: null,
    badge: "Delicado",
    collection: "Luz",
    description: "Anel delicado com pedra central luminosa e acabamento elegante.",
    details: "Ideal para composicoes com outros aneis finos. Consulte disponibilidade de aro.",
    image: "assets/anel-luz.svg",
    gallery: ["assets/anel-luz.svg", "assets/colar-ponto.svg", "assets/brinco-perola.svg"],
    isNew: true,
    isBestSeller: true,
  },
  {
    id: "pulseira-fina",
    name: "Pulseira Elo Fino",
    category: "pulseiras",
    price: 99.9,
    oldPrice: 119.9,
    badge: "Presenteavel",
    collection: "Essenciais",
    description: "Pulseira minimalista com brilho suave para uso diario.",
    details: "Fecho regulavel, elos finos e visual discreto para combinar com relogios.",
    image: "assets/pulseira-fina.svg",
    gallery: ["assets/pulseira-fina.svg", "assets/colar-elos.svg", "assets/argola-classica.svg"],
    isNew: false,
    isBestSeller: true,
  },
  {
    id: "argola-classica",
    name: "Argola Classica",
    category: "brincos",
    price: 79.9,
    oldPrice: null,
    badge: "Classico",
    collection: "Classicos",
    description: "Argola lisa, elegante e versatil para combinar com outras pecas.",
    details: "Acabamento polido e tamanho medio para acompanhar do trabalho ao jantar.",
    image: "assets/argola-classica.svg",
    gallery: ["assets/argola-classica.svg", "assets/brinco-perola.svg", "assets/pulseira-fina.svg"],
    isNew: false,
    isBestSeller: true,
  },
  {
    id: "colar-ponto",
    name: "Colar Ponto de Luz",
    category: "colares",
    price: 119.9,
    oldPrice: null,
    badge: "Novo",
    collection: "Luz",
    description: "Um brilho discreto no colo, com acabamento fino e feminino.",
    details: "Corrente delicada com ponto central luminoso para sobreposicoes.",
    image: "assets/colar-ponto.svg",
    gallery: ["assets/colar-ponto.svg", "assets/anel-luz.svg", "assets/colar-elos.svg"],
    isNew: true,
    isBestSeller: false,
  },
];

async function syncProductsFromApi() {
  try {
    const response = await fetch("/api/products");
    if (!response.ok) return products;
    products = await response.json();
    document.dispatchEvent(new CustomEvent("products:loaded"));
    return products;
  } catch (error) {
    return products;
  }
}
