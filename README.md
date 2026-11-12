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

**Stack:** Next.js 15 + TypeScript + Tailwind, Supabase (Postgres, Auth, RLS), Resend, Vercel.

## Como rodar

1. Crie um projeto em [supabase.com](https://supabase.com) (plano grátis).
2. No **SQL Editor**, rode `supabase/migrations/0001_init.sql`.
3. Em **Authentication > URL Configuration**, coloque o endereço do app em *Site URL* e adicione `http://localhost:3000/auth/callback` (e o de produção) em *Redirect URLs*.
4. Copie `.env.example` para `.env.local` e preencha com as chaves de **Project Settings > API**.
5. Rode:

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Publicar na Vercel

1. Importe o repositório na Vercel.
2. Cadastre as mesmas variáveis do `.env.example` (com `NEXT_PUBLIC_SITE_URL` apontando para o domínio final).
3. O lembrete diário roda sozinho pelo `vercel.json` (12h UTC, 9h de Brasília).

## Testes

```bash
npm test
```

## Segurança

- Todas as tabelas têm RLS. Cada participante só lê o próprio par do sorteio.
- O sorteio é calculado no servidor e gravado com a chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`), que nunca vai para o navegador.
