# 🎁 Amigo Secreto

App web para organizar amigo secreto: crie o grupo, convide pelo WhatsApp, faça o sorteio e cada pessoa vê só quem tirou.

**O que já tem (MVP)**

- Login sem senha (link mágico por e-mail)
- Criar grupo com data, local e faixa de valor
- Convite por link e botão de WhatsApp
- Lista de desejos com links
- Sorteio em ciclo: ninguém tira a si mesmo, sem trocas diretas, com regras de "quem não pode tirar quem"
- Tela "Ver quem eu tirei" (nem o organizador vê os pares)
- E-mail quando o sorteio sai e lembrete na véspera da festa
- Painel do organizador: remover pessoas, regras, refazer ou desfazer o sorteio

**Stack:** Next.js 15 + TypeScript + Tailwind, Postgres (local ou [Neon](https://neon.tech)), Resend para e-mail, Vercel.

## Como rodar no seu computador

Precisa de Node 20+ e um Postgres rodando (ex.: `localhost:5432`, usuário e senha `postgres`).

1. Crie o banco `amigo-secreto` (no pgAdmin, DBeaver ou `createdb -U postgres amigo-secreto`).
2. Copie `.env.example` para `.env.local` (o padrão já aponta para `postgres:postgres@localhost:5432/amigo-secreto`).
3. Rode:

```bash
npm install
npm run db:migrate
npm run dev
```

4. Abra http://localhost:3000 e peça o link de acesso. **Sem `RESEND_API_KEY`, o link de login aparece no terminal** onde o `npm run dev` está rodando: copie e abra no navegador.

## Publicar (Neon + Vercel)

1. Crie um banco no Neon e copie a connection string (com `?sslmode=require`).
2. Rode `DATABASE_URL="<string do Neon>" npm run db:migrate`.
3. Importe o repositório na Vercel e cadastre as variáveis do `.env.example` (com `NEXT_PUBLIC_SITE_URL` no domínio final e `RESEND_API_KEY` preenchida, senão ninguém recebe o link de login).
4. O lembrete diário roda sozinho pelo `vercel.json` (12h UTC, 9h de Brasília).

## Testes

```bash
npm test                                     # sorteio
TEST_DATABASE_URL=postgres://... npm test    # + regras de acesso no banco (APAGA esse banco)
```

## Segurança

- Login sem senha: link de uso único, válido por 30 minutos; guardamos só o hash do token e da sessão.
- O link do e-mail abre uma página com botão "Entrar", para leitores de e-mail não gastarem o link sozinhos.
- Toda leitura e escrita passa por `src/lib/queries.ts`, que confere se a pessoa é membro ou organizadora.
- Cada participante só vê o próprio par do sorteio. Nem o organizador vê os outros.
