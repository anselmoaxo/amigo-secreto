# 🎁 Amigo Secreto

App web para organizar amigo secreto: crie o grupo, convide pelo WhatsApp, faça o sorteio e cada pessoa vê só quem tirou.

**O que tem**

- Sem conta: o organizador usa o link do painel e cada participante, o próprio link (códigos aleatórios de 192 bits; no banco ficam só o hash e uma cópia cifrada)
- Criação do grupo em 5 etapas (grupo, encontro, participantes, regras, revisão), sem perder dados ao voltar ou recarregar
- Ocasião, data e horário, local, faixa de valor, recado, prazo para confirmar, lista de desejos com prazo, lista aberta ou fechada
- Convite geral (mensagem pronta para o WhatsApp) e link individual de cada pessoa (WhatsApp, copiar ou e-mail)
- Confirmação de presença, reenvio de links, troca de link, edição e remoção antes do sorteio
- Regras: núcleos (casais, famílias) e combinações proibidas nos dois sentidos ou num só; antes de sortear o site confere se há solução e explica o que ajustar
- Sorteio com `crypto.randomInt`; tenta um ciclo único (sem trocas diretas) e, se as regras não deixarem, aceita qualquer combinação válida
- Revelação com tela de confirmação, botão para esconder de novo e aviso de quando o resultado foi aberto pela primeira vez
- Refazer o sorteio só antes de alguém ver; depois disso, exige confirmação explícita
- Organizador só vê os pares se marcar isso na criação (todos são avisados; dá para desligar, não para religar)
- "Meus grupos" guardado no aparelho e "Perdi meu link" por e-mail
- Encerrar e apagar o grupo; apagamos sozinhos 30 dias depois da festa
- E-mail (Resend) e WhatsApp (Evolution API) para convite, aviso do sorteio e lembrete na véspera

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

4. Abra http://localhost:3000 e crie um grupo. **Sem `RESEND_API_KEY`, os e-mails (com os links) aparecem só no terminal** onde o `npm run dev` está rodando.

## Publicar (Neon + Vercel)

1. Crie um banco no Neon e copie a connection string (com `?sslmode=require`).
2. Não precisa migrar à mão: na Vercel o build roda `scripts/migrate.mjs` antes do `next build` (script `vercel-build`).
3. Importe o repositório na Vercel e cadastre as variáveis do `.env.example`, com `NEXT_PUBLIC_SITE_URL` no domínio final e `APP_SECRET` (gere com `openssl rand -base64 32`; sem ele o app usa o `CRON_SECRET`). Não troque o `APP_SECRET` depois de publicar.
4. O lembrete diário roda sozinho pelo `vercel.json` (12h UTC, 9h de Brasília) e também apaga grupos antigos.

## WhatsApp (Evolution API)

Preencha `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE` no `.env.local`. Quem informar o WhatsApp recebe:

- aviso quando o sorteio sai;
- lembrete na véspera da festa.

O lembrete é disparado pela rota `GET /api/cron/lembretes` com o cabeçalho `Authorization: Bearer <CRON_SECRET>`. Na Vercel isso roda sozinho (`vercel.json`). Fora da Vercel, crie no n8n um *Schedule Trigger* diário às 9h + *HTTP Request* para essa rota.

## Testes

```bash
npm test                                     # sorteio
TEST_DATABASE_URL=postgres://... npm test    # + regras de acesso no banco (APAGA esse banco)
```

## Segurança e privacidade

- Links individuais longos e aleatórios; o resultado nunca vai na URL. `Referrer-Policy: no-referrer` evita vazar o link para lojas da lista de desejos.
- O nome sorteado não vai no HTML: só é buscado quando a pessoa confirma que quer ver.
- Toda leitura e escrita passa por `src/lib/queries.ts`, que resolve o token e confere o que cada um pode fazer.
- Grupos antigos (do tempo do login por e-mail) continuam no banco: quem acessar `/grupos/...` é levado a "Perdi meu link" para receber os links novos.
