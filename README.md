# Gestão de OS — Manutenção Escolar

Versão com autenticação, RLS e modo demonstração para portfólio.

## O que foi alterado

- Login real usando Supabase Auth.
- Acesso ao banco real somente para usuários autenticados.
- RLS habilitado nas tabelas.
- Logout.
- Modo demonstração independente do banco real.
- O login de demonstração usa apenas dados fictícios no `localStorage`.
- Integração do Google Forms preparada para Edge Function, sem expor `service_role`.

## Login de demonstração

O botão **Acessar demonstração do portfólio** não consulta o Supabase.

Para apresentação, ele abre o mesmo sistema com dados fictícios. Alterações feitas durante a demonstração ficam somente no navegador.

Se você quiser divulgar credenciais em um botão de teste, pode usar:

- E-mail: `demo@portfolio.local`
- Senha: `demo1234`

Essas credenciais são apenas uma referência visual; o botão de demonstração não envia esses dados ao Supabase.

## Configurar o banco REAL

### Se já existem dados no Supabase

**NÃO execute o `schema.sql`**, porque ele recria as tabelas e pode apagar os dados existentes.

Execute somente:

`security-migration.sql`

Depois vá em Supabase > Authentication > Users e crie manualmente os usuários autorizados.

### Se for um banco novo

Você pode executar `schema.sql`. Ele cria as tabelas, índices, dados iniciais e políticas RLS.

## Variáveis públicas

`js/config.js` contém apenas a URL e a ANON KEY.

Isso é esperado: a ANON KEY é uma chave pública do cliente Supabase. A proteção real é feita pelo Auth + RLS.

**Nunca coloque a `service_role` key no JavaScript do site.**

## Google Forms

Após ativar RLS, o Google Apps Script antigo não deve mais gravar diretamente no REST API com a ANON KEY.

A pasta `supabase/functions/form-os` contém uma Edge Function para receber as solicitações do formulário.

Configure:

1. Publique a Edge Function.
2. Configure o segredo `FORM_WEBHOOK_SECRET`.
3. No Google Apps Script, em Propriedades do script, crie `FORM_WEBHOOK_SECRET` com o mesmo valor.
4. Use o novo `google-forms-script.js`.
5. Crie o acionador `enviarParaSupabase` para o envio do formulário.

A `SERVICE_ROLE KEY` deve existir somente como segredo da Edge Function.

## 2FA / Authenticator

O login implementado aqui é autenticação por e-mail e senha.

Se a intenção for exigir código de aplicativo Authenticator (TOTP/2FA), isso deve ser ativado separadamente no Supabase Auth. É uma camada adicional e não substitui o RLS.

## Deploy

Depois de configurar o Supabase, publique o frontend normalmente no Vercel ou em outro host estático.
