# Auditoria de segurança (novembro de 2026)

Escopo: código deste repositório (Next.js 15, Postgres/Neon, Resend, Evolution API), configuração da Vercel
(só nomes e destinos das variáveis, nenhum valor lido) e dependências. Tudo testado em Postgres local com
grupos fictícios. Nada foi executado contra a produção, nenhum resultado real foi lido e nenhuma mensagem foi enviada.

Testes passando não significam que o sistema é seguro. Eles cobrem os cenários listados abaixo; os pontos
não verificados e os riscos restantes estão no fim.

## Modelo de acesso

Não há contas. Cada credencial é um segredo numa URL:

| Credencial | Onde | Dá acesso a | Não dá acesso a |
|---|---|---|---|
| Link do organizador `/o/<token>` | e-mail do organizador, aparelho dele | painel do próprio grupo: pessoas, regras, sorteio, reenvio de links; pares só se `organizer_can_see_pairs` foi marcado na criação | outros grupos; pares quando a opção está desligada (pela API) |
| Link do participante `/p/<token>` | e-mail/WhatsApp da pessoa, ou repassado pelo organizador | a própria presença, contato, lista de desejos e o próprio par | dados de outros participantes, painel |
| Código de convite `/g/<código>` | público, compartilhado em grupo | nome/data do evento, número de pessoas e entrar no grupo | painel, resultados, lista de pessoas |
| Visitante | — | criar grupo, recuperar links por e-mail | qualquer dado de grupo |

Tokens: 192 bits de `crypto.randomBytes`, guardados como SHA-256 (para achar o dono) e cifrados com
AES-256-GCM usando `APP_SECRET` (para o servidor reenviar o mesmo link por e-mail/WhatsApp e pela recuperação).
**Decisão documentada:** guardar a versão cifrada é necessário para "reenviar link" e "perdi meu link" sem trocar
o link de todo mundo. Quem tiver o banco **e** o `APP_SECRET` consegue abrir todos os links. Por isso o
`APP_SECRET` só existe em Produção na Vercel, e o código recusa cifrar ou decifrar em produção sem um segredo configurado.

Revogação e expiração: o organizador troca o link de uma pessoa ("gerar novo link"; o antigo deixa de funcionar
na hora). Todos os tokens morrem quando o grupo é apagado (manualmente, ou 30 dias depois da festa / 1 ano sem data).

## Endpoints (Server Actions) e permissão exigida

| Ação | Arquivo | Exige | Limites |
|---|---|---|---|
| `createGroupAction` | actions/create.ts | visitante | 10 grupos/h por IP; mensagens disparadas contam em 400/dia por IP |
| `joinAction` | actions/participant.ts | código de convite | 30/h por IP; 120/h por convite |
| `respondAction`, `contactAction`, `addWishAction`, `deleteWishAction`, `preferencesAction`, `revealAction` | actions/participant.ts | token do participante (só a própria linha) | token errado: 30/10 min por IP |
| `addPersonAction`, `editPersonAction`, `removePersonAction`, `addRuleAction`, `deleteRuleAction`, `setTeamAction`, `updateGroupAction`, `resetDrawAction`, `deleteGroupAction` | actions/organizer.ts | token do organizador; IDs conferidos contra o grupo do token | token errado: 30/10 min por IP |
| `resendInviteAction` | actions/organizer.ts | organizador | 5/h por participante; 400/dia por IP |
| `personalLinkAction` | actions/organizer.ts | organizador | 120/h por grupo |
| `drawAction` | actions/organizer.ts | organizador | 10/h por grupo (cada sorteio avisa todo mundo) |
| `pairsAction` | actions/organizer.ts | organizador **e** `organizer_can_see_pairs` | — |
| `recoverAction` | actions/recover.ts | visitante | 10/h por IP; no máximo 3 e-mails/h por endereço (o excesso é ignorado em silêncio) |
| `GET /api/cron/lembretes` | api/cron/lembretes | `CRON_SECRET` (comparação em tempo constante) | — |

Os limites ficam no Postgres (`rate_limits`, chave em HMAC, sem IP ou e-mail em texto), então valem entre
instâncias. O IP vem de `x-real-ip`/`x-forwarded-for` só na Vercel (que reescreve esses cabeçalhos) ou com
`TRUST_PROXY=1`; fora disso, nenhum cabeçalho do cliente é usado. IPv6 conta por bloco /64. Os limites por
recurso (grupo, participante, convite) não dependem de IP, o que protege mesmo atrás de redes compartilhadas.
Não há CAPTCHA: os limites atuais bastam para o volume do site; se houver abuso real, avaliar o Vercel Firewall
antes de um CAPTCHA (que exigiria alternativa acessível).

---

## Vulnerabilidades confirmadas

### V1. Alta: deploys de Preview aplicam migrações no banco de produção
- **Evidência:** `package.json` (`vercel-build` roda `scripts/migrate.mjs`); na Vercel, `DATABASE_URL` tem destino Preview **e** Production (mesmo banco Neon).
- **Exploração:** qualquer push de branch gera um Preview, que roda as migrações daquele branch no banco real antes de qualquer revisão. Um branch com migração errada altera ou apaga dados de produção.
- **Correção:** `scripts/migrate.mjs` só aplica migrações quando `VERCEL_ENV=production` (ou fora da Vercel). Este próprio PR já sobe com essa trava, então o Preview dele não altera o banco.
- **Teste:** conferido manualmente (o script sai antes de conectar quando `VERCEL=1` e `VERCEL_ENV=preview`).
- **Pendente:** o Preview continua **lendo e gravando** no banco de produção quando alguém o abre, e não tem `APP_SECRET`, Resend nem Evolution. Recomendo tirar `DATABASE_URL`/`POSTGRES_*` do ambiente Preview ou apontá-lo para um branch do Neon. Isso é configuração da Vercel e precisa do seu ok.

### V2. Alta: sorteio não era idempotente
- **Evidência:** `runDraw` (src/lib/queries.ts, versão anterior linhas 433–452) sorteava de novo sempre que ninguém tinha visto o resultado; o botão "Fazer o sorteio" e o "Sortear de novo" chamavam a mesma ação sem distinguir intenção. Participantes e regras eram lidos fora da transação.
- **Exploração:** clique duplo, duas abas ou requisição repetida refaziam o sorteio em silêncio, depois de os avisos já terem saído, e reenviavam aviso para todos.
- **Correção:** `runDraw` trava o grupo, relê o estado e só refaz com `redraw: true` (vem só do botão "Sortear de novo", campo `mode=redraw`). Leituras dentro da transação. O resultado é conferido (`assertValidPairs`) antes de gravar.
- **Testes:** `security.test.ts` → 6 (seis pedidos simultâneos geram um único resultado; pedido repetido não muda nada), `queries.test.ts` → "refazer só com confirmação".

### V3. Alta: corrida entre sorteio e mudanças de participantes
- **Evidência:** `removeParticipant`, `updateParticipant`, `respond`, `joinByInvite`, `addExclusion`, `setTeam`, `updateGroup` conferiam `group.status` com o objeto lido no início da requisição (antes do lock).
- **Exploração:** uma remoção ou desistência que chegasse junto com o sorteio passava na checagem e apagava, por cascade, o par de alguém: uma pessoa ficava sem amigo secreto e outra sem quem a tirasse.
- **Correção:** todas essas operações agora travam o grupo (`select … for update`) e conferem o estado dentro da transação. No banco, o trigger `participants_guard_drawn` recusa entrar, sair ou desistir num grupo sorteado, mesmo fora do app.
- **Testes:** 6b (sorteio + remoção + desistência + entrada simultâneos: todos dão e recebem exatamente uma vez), 6c (o banco recusa as mudanças diretas), 7.

### V4. Alta: envio de mensagens sem limite (spam pelo domínio e pelo WhatsApp do site)
- **Evidência:** `createGroupAction` com `sendInvites` mandava convite para até 200 endereços/telefones arbitrários por requisição; `recoverAction`, `joinAction`, `resendInviteAction` e `drawAction` também disparavam e-mail/WhatsApp sem nenhum limite.
- **Exploração:** um script cria grupos em série e usa o site como disparador de e-mails/WhatsApp. Risco de bloqueio do domínio no Resend e do número na Evolution/WhatsApp, além de incômodo a terceiros.
- **Correção:** limites por IP e por recurso (tabela acima), guardados no Postgres.
- **Testes:** 5, 5b, 7.

### V5. Média: links pessoais (tokens) podiam ir para os logs
- **Evidência:** `whatsapp.ts` (`console.log` do texto inteiro, com o link, quando a Evolution não está configurada); `email.ts` (link no log sem Resend; corpo da resposta de erro do provedor); vários `console.error(e)` com erros do Postgres, que trazem consulta e parâmetros.
- **Condições:** em Produção as chaves estão configuradas, então o caminho "desativado" não é o normal; mas o Preview (sem as chaves e com o banco real) e qualquer falha do provedor escreveriam links válidos nos logs da Vercel.
- **Correção:** `src/lib/log.ts`: em produção, tokens, e-mails e telefones são removidos; erros viram uma linha com nome/código/mensagem, sem parâmetros. Corpo de erro do provedor não é mais registrado.
- **Testes:** 3 (sorteio com envio em modo produção: logs sem tokens e sem e-mails) e teste unitário de `redact`.
- **Pendente:** logs antigos da Vercel podem conter links. Não foram lidos (para não acessar dados reais). Se quiser, apague os logs antigos ou troque os links dos grupos ativos.

### V6. Média: recuperação revelava cadastro pelo tempo e servia para encher caixas de e-mail
- **Evidência:** `recoverAction` só esperava o envio do e-mail quando o endereço tinha grupos (resposta visivelmente mais lenta), e não tinha limite por endereço.
- **Correção:** a busca e o envio rodam depois da resposta (`after()`), então texto e tempo são iguais; até 3 e-mails/h por endereço e 10 pedidos/h por IP, com a mesma mensagem para qualquer endereço.
- **Teste:** 5.

### V7. Média (decisão de produto): o organizador consegue abrir o resultado de um participante
- **Evidência:** `personalLinkAction` (actions/organizer.ts) devolve ao organizador o link individual de qualquer pessoa, inclusive depois do sorteio; antes do sorteio ele também pode trocar o e-mail de alguém pelo dele.
- **Exploração:** mesmo com "ver os pares" desligado, o organizador abre o link de alguém e vê quem a pessoa tirou.
- **Por que não foi bloqueado:** repassar o link pelo WhatsApp do organizador é o fluxo principal para quem não tem e-mail. Sem contas, quem tem o link tem o acesso.
- **Correção parcial (detecção):** ao abrir o papelzinho, o aparelho fica registrado (cookie aleatório `HttpOnly`, `SameSite=Strict`, só em `/p`; no banco fica só um hash). Se o mesmo papelzinho for aberto depois em outro aparelho, o participante vê o aviso "já tinha sido aberto em outro aparelho em …".
- **Teste:** 3b.
- **Pendente:** decidir se, depois do sorteio, os links passam a ser trocados e entregues só pelo servidor (e-mail/WhatsApp), sem o organizador poder copiá-los.

### V8. Baixa: faltavam cabeçalhos de segurança
- **Correção (`next.config.ts`):** CSP só com recursos próprios (nenhum script de terceiros), `frame-ancestors 'none'` + `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` (além da meta que já existia), HSTS, `Permissions-Policy`, `X-Powered-By` removido; `/o`, `/p`, `/g`, `/recuperar` e `/meus-grupos` com `Cache-Control: private, no-store` e `X-Robots-Tag: noindex`. Limite de payload das Server Actions em 300 KB.
- **Teste:** unitário dos cabeçalhos + conferido com `next start` e navegador (sorteio e revelação funcionam sem erro de CSP).
- **Observação:** `script-src` precisa de `'unsafe-inline'` para a hidratação do Next sem nonce. Usar nonce exigiria middleware em todas as páginas; não vale agora, já que não há HTML vindo de usuário sem escape.

### V9. Baixa: comparação do `CRON_SECRET` sem tempo constante
- **Correção:** `crypto.timingSafeEqual` em `api/cron/lembretes`.

### V10. Baixa: link de desejo aceitava `usuario:senha@` (truque de phishing)
- **Correção:** só `http(s)`, com domínio, sem credenciais, até 500 caracteres (também no banco).
- **Teste:** 7.

### Dependências
- `sharp` (alta, libvips/libheif): atualizado para 0.35.5. Exposição real era baixa (o site não usa `next/image`).
- `postcss` dentro do `next` (moderada/alta): afeta o processamento de CSS no build, com CSS do próprio repositório; sem exposição em produção. A correção exige Next 16 (versão maior) e fica para um PR próprio.

## Melhorias preventivas
- Banco: `CHECK (giver_id <> receiver_id)`; chaves estrangeiras compostas garantindo que pares e regras só ligam pessoas do mesmo grupo; limites de tamanho de telefone e link. Entraram como `NOT VALID` para não travar o deploy por algum dado antigo; depois de conferir, dá para validar com `alter table … validate constraint …`.
- Consultas de participante agora sempre filtram também pelo grupo (`and group_id = …`).
- Mensagens de erro: só texto pronto para o usuário; SQL, stack trace e dados internos nunca vão na resposta.
- Limite de tentativas com token errado por IP (defesa extra; adivinhar 192 bits é inviável).

## Conferido sem mudança
- IDOR/BOLA: toda ação resolve grupo/participante pelo token no servidor e confere IDs vindos do navegador contra esse grupo (testes 1, 2, 7).
- O resultado só é buscado quando a pessoa pede (`revealAction`), nunca vai no HTML, e traz apenas nome, preferências e desejos de quem ela tirou. O painel do organizador não recebe nenhum par. `pairsAction` exige a opção marcada na criação.
- "Ver os pares" só pode ser desligado depois da criação, nunca ligado (`updateGroup`); a opção aparece no convite e na página do participante antes da entrada.
- SQL: tudo parametrizado (templates do `postgres`); `sql.unsafe` só em migrações e testes.
- XSS: React escapa tudo; sem `dangerouslySetInnerHTML`; e-mails usam `escapeHtml`.
- Open redirect: nenhum redirect usa endereço vindo do usuário (`JoinWithCode` só navega para caminhos internos).
- SSRF: o servidor não busca URLs de usuários (só Resend e Evolution, configuradas por variável de ambiente).
- CSRF/CORS: Server Actions conferem `Origin` com o host; não há sessão por cookie que autorize ações; não há API com CORS.
- Sorteio: `crypto.randomInt` + Fisher–Yates; restrições impossíveis detectadas antes de gravar (teorema de Hall). A preferência por um ciclo único é escolha de produto e não deixa a distribuição uniforme entre todas as combinações, mas não reduz o sigilo.
- Segredos: nenhum segredo encontrado no código ou no histórico do git; só `.env.example` com valores vazios.
- Credenciais do banco nunca vão para o navegador (`server-only` em `db.ts`/`queries.ts`; nenhuma variável `NEXT_PUBLIC_` sensível).

## Não verificado / riscos restantes
- **Deployment Protection** dos Previews na Vercel (se estão fechados para quem não é do time). Importa enquanto o Preview usar o banco de produção (V1).
- **Privilégios do banco:** o app usa o usuário dono do Neon, que também roda as migrações. Recomendado: um usuário só com `select/insert/update/delete` para o app e outro para migrações. RLS não se aplica (sem acesso direto do navegador ao banco).
- **Tabelas antigas** `users`, `sessions`, `login_tokens` (da versão com login) seguem no banco com e-mails, sem uso. Apagar exige seu ok.
- **Retenção:** grupos somem 30 dias depois da festa; backups do Neon, logs da Vercel e históricos do Resend/Evolution guardam dados (e links) pelo prazo de cada serviço. Não verificado.
- **Tokens na URL:** o link continua na barra de endereço e nos logs de acesso da Vercel. Trocar por sessão (cookie) depois do primeiro acesso é a próxima melhoria possível; mexe nas telas e fica para outro PR.
- **`APP_SECRET`:** existe em Produção. O código ainda aceita `CRON_SECRET` como reserva para a cifra (dois usos para um segredo); não mudei porque trocar a chave invalida os links salvos. Se um dia rotacionar, é preciso recifrar os tokens.
- O telefone do organizador que só organiza (não participa) é descartado na criação; não é um risco, só registro.
