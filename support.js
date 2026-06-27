const supportAnswers = {
  entrega: "Voce confere as opcoes e o prazo de entrega no checkout, depois de informar seu endereco.",
  troca: "Acesse Trocas e Devolucoes no rodape para consultar as regras. Para um caso especifico, fale conosco pelo WhatsApp.",
  garantia: "Todas as informacoes de garantia aparecem na pagina de cada peca. Guarde seu comprovante de compra.",
};

function addSupportWidget() {
  const widget = document.createElement("section");
  widget.className = "support-widget";
  widget.innerHTML = `<button class="support-trigger" type="button" aria-expanded="false">Ajuda</button><div class="support-panel"><strong>Como podemos ajudar?</strong><p>Escolha um assunto ou fale diretamente com a Dois Elos.</p><div class="support-actions"><button data-support="entrega">Entrega</button><button data-support="troca">Trocas</button><button data-support="garantia">Garantia</button></div><p class="support-answer" data-support-answer></p><a href="https://wa.me/5561992656158?text=Ola! Gostaria de tirar uma duvida sobre um produto." target="_blank" rel="noreferrer">Falar no WhatsApp</a></div>`;
  document.body.appendChild(widget);
  const trigger = widget.querySelector(".support-trigger");
  trigger.addEventListener("click", () => {
    const open = widget.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(open));
  });
  widget.querySelector(".support-actions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-support]");
    if (!button) return;
    widget.querySelector("[data-support-answer]").textContent = supportAnswers[button.dataset.support];
  });
}

addSupportWidget();
