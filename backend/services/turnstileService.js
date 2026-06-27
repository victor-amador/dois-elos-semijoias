const config = {
  siteKey: process.env.TURNSTILE_SITE_KEY || "",
  secretKey: process.env.TURNSTILE_SECRET_KEY || "",
};

function isTurnstileConfigured() {
  return Boolean(config.siteKey && config.secretKey);
}

async function validateTurnstile(token, remoteIp) {
  if (!isTurnstileConfigured()) return { success: true, skipped: true };
  if (!token) return { success: false, error: "Verificacao de seguranca obrigatoria." };

  const body = new URLSearchParams({ secret: config.secretKey, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = await response.json();
  return result.success ? { success: true } : { success: false, error: "Verificacao de seguranca falhou." };
}

module.exports = { isTurnstileConfigured, validateTurnstile };
