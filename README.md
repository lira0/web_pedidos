# Água Delivery — Pedidos Web V1

Primeira versão da página pública de pedidos automáticos.

## Pastas

- `docs/`: site estático pronto para GitHub Pages.
- `supabase/setup.sql`: banco separado para clientes e pedidos web.

## Teste visual sem Supabase

Abra `docs/index.html` ou publique no GitHub Pages. O arquivo `docs/config.js` vem com `demoMode: true`.

## Ativação do Supabase

1. Crie um projeto no Supabase.
2. Abra SQL Editor, cole e execute `supabase/setup.sql`.
3. No projeto, copie a Project URL e a Publishable key (ou a anon key legada).
4. Edite `docs/config.js` e preencha `supabaseUrl` e `supabaseKey`.
5. Mude `demoMode` para `false`.
6. Publique novamente no GitHub Pages.

Nunca coloque a service_role/secret key no GitHub Pages. O navegador usa somente uma chave publicável; RLS e as funções RPC protegem os dados pessoais.

## Fluxo

Produtos -> entrega -> pagamento -> confirmação -> acompanhamento.

O mini cadastro é salvo no Supabase, mas o navegador guarda um UUID aleatório (`agua_client_token`) para recuperar os próprios dados. Digitar apenas um número de WhatsApp não revela endereço de terceiros.
