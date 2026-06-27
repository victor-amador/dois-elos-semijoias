# Dois Elos Semijoias

Protótipo de ecommerce com frontend em HTML/CSS/JavaScript e backend simples em Node.js.

## Rodar com backend simples

```bash
cd outputs/dois-elos-site
node backend/server.js
```

Depois acesse:

```text
http://127.0.0.1:3000
```

## O que o backend faz

- Serve o site completo.
- Lista produtos em `/api/products`.
- Busca produto por id em `/api/products/:id`.
- Cria cadastro em `/api/register`.
- Faz login em `/api/login`.
- Registra pedido em `/api/orders` com entrega, pagamento escolhido e totais.
- Calcula frete por CEP em `/api/shipping/quote`.
- Recebe confirmacoes PagBank em `/api/webhooks/pagbank`.
- Cadastra produtos em `/api/admin/products`.
- Lista pedidos em `/api/admin/orders`.
- Atualiza status e rastreio em `/api/admin/orders/:id`.
- Lista clientes em `/api/admin/customers`.

As regras de checkout estao documentadas em `CHECKOUT_RULES.md`.

Os dados ficam em:

```text
backend/data/db.json
backend/data/products.json
```

## Rodar com PostgreSQL

1. Instale as dependencias:

```bash
npm install
```

2. Crie um banco PostgreSQL chamado `dois_elos`.

3. Rode o SQL de tabelas:

```bash
psql postgresql://usuario:senha@localhost:5432/dois_elos -f backend/schema.sql
```

4. Configure a variavel `DATABASE_URL` e inicie:

```bash
export DATABASE_URL="postgresql://usuario:senha@localhost:5432/dois_elos"
npm run dev
```

Sem `DATABASE_URL`, o projeto continua usando JSON local.

## Painel administrativo

Acesse:

```text
http://127.0.0.1:3000/admin.html
```

O painel inicial permite cadastrar produtos, ver pedidos e ver clientes.

Para upload de imagens e preenchimento de descricoes, consulte `IMAGENS_E_CADASTRO.md`.

## Próximos passos profissionais

- Proteger o painel administrativo com login de admin.
- Migrar o upload local para Cloudinary, Amazon S3 ou Supabase Storage ao publicar.
- Configurar webhook publico do PagBank em producao.
- Integrar frete oficial com Melhor Envio ou Correios.
- Integrar envio real de e-mail/WhatsApp transacional.
- Publicar em uma hospedagem como Render, Railway, Vercel ou VPS.
