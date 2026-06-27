# Regras de negocio do checkout

## Carrinho

- Cada produto aparece uma vez no carrinho.
- Os botoes `+` e `-` alteram a quantidade de 1 em 1.
- Ao chegar em 0, o produto sai da sacola.
- A sacola fica salva no navegador da cliente.

## Frete

- Frete gratis a partir de R$ 199,99 em produtos.
- O frete gratis considera somente o subtotal dos produtos, sem somar frete.
- Retirada combinada: R$ 0,00.
- Entrega local e Correios/transportadora sao calculados pelo backend a partir do CEP.
- O CEP precisa ter 8 digitos.
- Se o subtotal for maior ou igual a R$ 199,99, qualquer forma de entrega fica com frete R$ 0,00.

## Total

- Subtotal = soma de produto x quantidade.
- Frete = valor da entrega escolhida, exceto quando houver frete gratis.
- Total = subtotal + frete.

## Pedido

- Para finalizar, a cliente informa CEP, cidade, endereco, entrega e pagamento.
- O pedido e registrado no backend com status `payment_pending`.
- O estoque e reservado por tempo limitado durante o pagamento.
- O estoque so e baixado definitivamente quando o pagamento e aprovado.
- Se o pagamento for cancelado, expirado ou reembolsado, a reserva de estoque e liberada.
- O carrinho e limpo depois do pedido registrado com sucesso.

## Pagamento

- O checkout cria cobranca PagBank para Pix, cartao de credito, cartao de debito ou boleto.
- O webhook `/api/webhooks/pagbank` atualiza automaticamente o status do pedido.
- Status internos: `payment_pending`, `paid`, `preparing`, `shipped`, `delivered`, `cancelled`, `expired`, `refunded`.

## Proximas regras antes de publicar

- Exigir login ou dados de contato no checkout.
- Proteger o painel administrativo com usuario de admin.
- Trocar notificacoes em log por envio real de e-mail/WhatsApp com provedor contratado.
- Integrar frete real com Melhor Envio ou Correios para prazo/preco oficial.
