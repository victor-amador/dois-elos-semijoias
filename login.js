const form = document.querySelector("[data-auth-form]");
const statusBox = document.querySelector("[data-login-status]");
const submitButton = document.querySelector("[data-auth-submit]");
const nameField = document.querySelector("[data-name-field]");
const modeButtons = document.querySelectorAll("[data-auth-mode]");
let authMode = "login";

function setAuthMode(mode) {
  authMode = mode;
  modeButtons.forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  nameField.classList.toggle("hidden", mode !== "register");
  submitButton.textContent = mode === "register" ? "Cadastrar e entrar" : "Entrar";
  statusBox.textContent = "";
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const customer = {
    name: data.get("name") || "Cliente Dois Elos",
    email: data.get("email"),
  };

  try {
    const response = await fetch(authMode === "register" ? "/api/register" : "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        password: data.get("password"),
        turnstileToken: data.get("cf-turnstile-response"),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Nao foi possivel entrar.");
    const guestCart = JSON.parse(localStorage.getItem(cartStorageKey) || "[]");
    if (guestCart.length && result.customer?.email) {
      localStorage.setItem(`${cartStorageKey}:${result.customer.email}`, JSON.stringify(guestCart));
    }
    localStorage.setItem(customerStorageKey, JSON.stringify(result.customer));
    if (result.token) localStorage.setItem("doisElosToken", result.token);
    statusBox.textContent = authMode === "register" ? "Cadastro criado. Voce ja esta logada." : "Login realizado.";
    setTimeout(() => {
      window.location.href = "index.html#colecao";
    }, 700);
  } catch (error) {
    if (authMode === "register" && error instanceof TypeError) {
      localStorage.setItem(customerStorageKey, JSON.stringify(customer));
      statusBox.textContent = `Cadastro salvo localmente para ${customer.email}. Ligue o backend para salvar no servidor.`;
      return;
    }
    statusBox.textContent = error.message;
  }

  form.reset();
});
