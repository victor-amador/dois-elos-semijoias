function cleanText(value, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function fail(error) {
  return { ok: false, error };
}

function ok(data = {}) {
  return { ok: true, ...data };
}

function validateUser(body, mode = "register") {
  const email = cleanText(body.email, 180).toLowerCase();
  const password = String(body.password || "");
  if (!isEmail(email)) return fail("Informe um e-mail valido.");
  if (mode === "register" && cleanText(body.name, 120).length < 2) return fail("Informe o nome completo.");
  if (password.length < 6) return fail("A senha deve ter pelo menos 6 caracteres.");
  return ok({ email, password, name: cleanText(body.name, 120) });
}

function validateProduct(body) {
  const name = cleanText(body.name, 140);
  const category = cleanText(body.category, 80).toLowerCase();
  const price = Number(body.price);
  const stock = Number(body.stock || 0);
  if (name.length < 2) return fail("Nome do produto e obrigatorio.");
  if (category.length < 2) return fail("Categoria do produto e obrigatoria.");
  if (!Number.isFinite(price) || price <= 0) return fail("Preco do produto deve ser maior que zero.");
  if (!Number.isInteger(stock) || stock < 0) return fail("Estoque deve ser um numero inteiro maior ou igual a zero.");
  return ok({ ...body, name, category, price, stock });
}

function validateCoupon(body) {
  const code = cleanText(body.code, 40).toUpperCase();
  const value = Number(body.value);
  const minSubtotal = Number(body.minSubtotal || 0);
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return fail("Codigo do cupom invalido.");
  if (!["percent", "fixed"].includes(body.type)) return fail("Tipo de cupom invalido.");
  if (!Number.isFinite(value) || value <= 0) return fail("Valor do cupom deve ser maior que zero.");
  if (body.type === "percent" && value > 80) return fail("Cupom percentual nao pode passar de 80%.");
  if (!Number.isFinite(minSubtotal) || minSubtotal < 0) return fail("Compra minima invalida.");
  return ok({ ...body, code, value, minSubtotal });
}

function validateCheckout(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return fail("Pedido sem produtos.");
  for (const item of items) {
    if (!item.id || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
      return fail("Itens do pedido invalidos.");
    }
  }
  const customer = body.customer || {};
  if (!customer.name || !isEmail(customer.email)) return fail("Dados do cliente invalidos.");
  if (!body.shipping?.cep || String(body.shipping.cep).replace(/\D/g, "").length !== 8) return fail("CEP invalido.");
  if (!body.shipping?.address) return fail("Endereco de entrega obrigatorio.");
  return ok();
}

module.exports = {
  cleanText,
  isEmail,
  validateCheckout,
  validateCoupon,
  validateProduct,
  validateUser,
};
