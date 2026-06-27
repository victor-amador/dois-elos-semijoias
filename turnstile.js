async function loadTurnstile() {
  const root = document.querySelector("[data-turnstile]");
  if (!root) return;
  try {
    const response = await fetch("/api/public-config");
    const config = await response.json();
    if (!config.turnstileSiteKey) return;
    root.innerHTML = `<div class="cf-turnstile" data-sitekey="${config.turnstileSiteKey}"></div>`;
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  } catch (error) {
    root.innerHTML = "";
  }
}

loadTurnstile();
