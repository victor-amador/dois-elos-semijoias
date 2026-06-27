const pages = {
  sobre: { title: "Sobre a Dois Elos", body: "A Dois Elos Semijoias nasceu para acompanhar momentos especiais com pecas delicadas, elegantes e cheias de significado. Cada escolha e feita com cuidado para valorizar sua beleza nos detalhes." },
  privacidade: { title: "Politica de Privacidade", body: "Usamos seus dados apenas para atendimento, pedidos, entrega e comunicacoes relacionadas a sua compra. Seus dados nao sao vendidos a terceiros." },
  termos: { title: "Termos de Uso", body: "Ao utilizar esta loja, voce concorda com as condicoes de compra, pagamento, envio e atendimento informadas durante o checkout." },
  trocas: { title: "Trocas e Devolucoes", body: "Para solicitar troca ou devolucao, entre em contato pelo WhatsApp com o numero do pedido. A analise segue as condicoes da peca, prazo informado e legislacao aplicavel." },
};
const key = new URLSearchParams(window.location.search).get("pagina") || "sobre";
const page = pages[key] || pages.sobre;
document.title = `${page.title} | Dois Elos Semijoias`;
document.querySelector("[data-institutional-page]").innerHTML = `<section class="section-heading"><p class="eyebrow">Institucional</p><h1>${page.title}</h1><p>${page.body}</p><a class="button ghost" href="index.html">Voltar para a loja</a></section>`;
