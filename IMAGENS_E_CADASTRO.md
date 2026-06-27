# Imagens e Cadastro de Produtos

## Como funciona

As imagens nao ficam dentro do PostgreSQL. O banco guarda somente o caminho da imagem no campo `image` do produto. O arquivo fica no sistema, em `assets/uploads`.

Esse modelo e mais rapido, deixa o banco menor e e o mesmo principio usado com armazenamentos profissionais como Cloudinary, Amazon S3 e Supabase Storage.

## Cadastrar pelo painel

1. Inicie o site com `PORT=3001 npm run dev`.
2. Abra `http://127.0.0.1:3001/admin.html`.
3. Em **Cadastrar produto**, preencha nome, categoria, preco, estoque, descricao e detalhes.
4. Em **Imagem principal**, selecione um arquivo JPEG, PNG ou WebP de ate 5 MB.
5. Clique em **Salvar produto**.

O sistema salva a foto em `assets/uploads` e grava o caminho no PostgreSQL junto do produto.

## Usar uma imagem ja existente

No campo **URL/caminho da imagem**, voce pode informar:

```text
assets/minha-peca.jpeg
```

ou uma URL publica:

```text
https://meusite.com/imagens/minha-peca.jpeg
```

## Descricoes

- **Descricao**: texto curto visto na vitrine.
- **Detalhes**: banho, dimensoes, material, garantia, cuidados e demais especificacoes.

## Recomendacoes de foto

- Use fundo claro e iluminacao uniforme.
- Prefira JPEG ou WebP para fotos.
- Mantenha a peca centralizada.
- Use imagens quadradas, idealmente 1200 x 1200 px.
- Antes de publicar, comprima as fotos para manter o site rapido.

## Producao

O upload local e adequado para desenvolvimento. Em producao, use Cloudinary, Amazon S3 ou Supabase Storage; o backend continua salvando apenas a URL retornada por esse servico no PostgreSQL.
