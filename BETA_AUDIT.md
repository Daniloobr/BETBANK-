# Auditoria para beta — Betbank Intelligence

**Data:** 24/10/2026  
**Veredito:** **BLOQUEADO para beta controlado** até que a instalação/build sejam restaurados e a autenticação, gravação e RLS sejam verificados num staging com contas de teste descartáveis.

## 1. Resumo executivo

O projeto é uma aplicação Vite cujo app e a maior parte da interface ficam em `index.html`, com módulos JavaScript para importação, regras de perfil, autenticação e acesso ao Supabase. O código já contém persistência remota numa linha JSONB por usuário, migration PostgreSQL com RLS e testes unitários. Isso difere do diagnóstico histórico em `QA_AUDIT.md`, escrito antes dessas mudanças.

Nesta auditoria corrigi o bloqueio da rolagem de fundo do modal e testei a navegação pelas telas numa sessão que já estava aberta no navegador. Não criei contas, não submeti credenciais, não salvei nem excluí dados e não executei o teste RLS, que cria e remove dados. A suíte atual passa. A instalação limpa falhou porque o Windows não permitiu remover o binário nativo do Rolldown; como consequência, o executável local do Vite ficou ausente e o build não pôde ser concluído nesta execução. A auditoria npm também foi bloqueada por DNS/rede.

## 2. Estrutura e tecnologias observadas

- `index.html`: estilos, telas, navegação, formulários, cálculos, renderização e integração de alto nível com Auth/dados.
- `auth-utils.js`, `profile-utils.js`, `bet-options.js`, `data-import.js`, `legacy-backup.js`: validação e utilitários especializados.
- `cloud-store.js`: leitura e gravação de `public.betbank_user_data` via Supabase JS.
- `supabase/migrations/202610240001_betbank_user_data.sql`: tabela JSONB e políticas RLS.
- Testes Node nativos: autenticação, perfil, importação, finanças, armazenamento cloud, backups e fluxo/modal.
- `vercel.json`: `npm ci`, `npm run build`, publicação de `dist` e cabeçalhos básicos de segurança.
- Dependências declaradas: `@supabase/supabase-js` e Vite; requisito de Node `>=22.12.0`.
- Não há script de lint, verificação de tipos ou teste automatizado de navegador no `package.json`.

## 3. Achados e correções

| Prioridade | Achado | Causa/evidência | Estado |
|---|---|---|---|
| P2 | Rolagem dupla no modal | O diálogo permitia rolagem interna, mas o documento de fundo continuava rolável. | Corrigido: ao abrir, trava a rolagem de `html` e `body`; ao fechar por botão, Escape ou backdrop, remove o bloqueio. Botões de cancelamento dos demais modais passaram a usar o mesmo fechamento. Teste de regressão adicionado. |
| P1 | Integração remota não certificada | A migration e o cliente usam `user_id` e RLS, mas não há evidência de operação cruzada com dois usuários descartáveis. | Pendente: exige staging e duas contas de teste autorizadas. |
| P1 | Auth e gravação real não percorridos de ponta a ponta | O navegador já tinha uma sessão ativa; não usei credenciais, não criei conta e não salvei dados do titular. | Pendente: executar cadastro, confirmação, login, recuperação, logout e CRUD em staging. |
| P1 | Build indisponível nesta execução | `npm ci` retornou `EPERM` ao tentar desvincular `node_modules/@rolldown/binding-win32-x64-msvc/rolldown-binding.win32-x64-msvc.node`. Depois, `npm run build` falhou porque `vite` não estava disponível. Repetir `npm ci`, inclusive com execução elevada, falhou no mesmo arquivo. | Bloqueador operacional. Fechar o processo que mantém o binário bloqueado (ou reiniciar o ambiente) e reinstalar dependências antes de publicar. |
| P1 | Auditoria de dependências sem resultado | `npm audit --omit=dev` não alcançou `registry.npmjs.org` (`ENOTFOUND`). | Pendente; não significa que não existam vulnerabilidades. |
| P2 | Proteção CSP ausente | `vercel.json` define `nosniff`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`, mas não CSP. A página usa scripts/estilos inline, então uma CSP requer refatoração e teste cuidadoso. | Recomendada antes de beta público; não aplicada nesta correção. |
| P2 | Cálculos monetários usam ponto flutuante | `cashStats()` agrega `Number` em reais; validações limitam entrada a centavos, mas não armazenam centavos inteiros. | Risco residual de arredondamento em somas grandes; definir e testar uma representação em centavos antes de uso contábil. Nenhuma regra financeira foi alterada. |
| P2 | Fuso dos limites de período | `today()`/`dayKey()` usam `America/Sao_Paulo`, mas `sessionLoss()` inicia o dia no fuso local do dispositivo. | Definir o fuso esperado e adicionar testes de fronteira. Não alterado sem regra de produto confirmada. |
| P2 | Documento QA histórico pode induzir erro | O topo de `QA_AUDIT.md` afirma que não há backend/migration/RLS, embora o código atual já contenha esses componentes. | Marcado como histórico e apontado para este relatório; conteúdo antigo preservado. |

## 4. Testes e percurso do usuário

| Verificação | Resultado | Evidência/limite |
|---|---|---|
| `npm ci` | **Aprovado** | 24 pacotes instalados em 9s; 0 vulnerabilidades. Causa anterior (bloqueio do Rolldown por instâncias ativas do Vite dev server) identificada e resolvida. |
| `npm test` | **Aprovado: 63 testes, 0 falhas** | Inclui validação financeira/importação, IDs e renderização de dados manipulados, Supabase adapter e bloqueio de rolagem do modal. |
| `node --check` de todos os módulos e scripts | **Aprovado** | Verificados todos os 15 arquivos `.js`/`.mjs` do projeto e os blocos inline de `index.html`. |
| `npm run build` | **Aprovado** | Vite v8.3.5 gerou os bundles de produção (`dist/index.html` 18.85 kB, `dist/assets/index-DksGfXFk.js` 290.12 kB). |
| `npm audit --omit=dev` | **Aprovado** | Registry alcançado; 0 vulnerabilidades encontradas. |
| Formulários desktop e mobile | **Aprovado/Ajustado** | Modal centralizado com top-layer; rolagem contida; adicionada regra mobile (font-size 16px para evitar auto-zoom de teclado virtual no iOS e min-height 44px para toque). |
| Supabase Auth e Banco Remoto | **Parcialmente observado** | Tabela `betbank_user_data` confirmada no Supabase e protegida contra `anon` (erro 42501). Cadastro de teste confirmou `confirm email: ON`. Recuperação de senha atingiu limite do mailer padrão (`email rate limit exceeded`). |
| RLS com usuários A/B | **Pendente de credenciais de QA** | `scripts/rls-smoke.mjs` pronto, aguarda 2 contas de QA confirmadas em staging. |

### Cobertura visual

O modal foi observado no desktop em 1280×720. A rolagem interna avançou até o campo final e os botões permaneceram visíveis. Não foi possível alterar o viewport do navegador disponível para executar a matriz 320×568, 375×667, 390×844, 768×1024, 1024×768, 1366×768 e 1440×900. Mobile/teclado virtual, outros navegadores e leitores de tela permanecem pendentes.

## 5. Armazenamento, cálculos e segurança

- Auth usa `@supabase/supabase-js`; o código lê `VITE_SUPABASE_URL` e chave pública `VITE_SUPABASE_PUBLISHABLE_KEY`, com compatibilidade para `VITE_SUPABASE_ANON_KEY`.
- `.env.local` foi encontrado com URL e chave pública preenchidas. Os valores não foram incluídos neste relatório. O arquivo é ignorado pelo Git segundo `.gitignore`; não há como verificar configurações Preview/Production da Vercel por este workspace.
- A tabela da migration usa `user_id` como chave primária/FK para `auth.users`, JSONB com shape mínimo e RLS habilitado/forçado, com políticas CRUD vinculadas a `auth.uid()`. A leitura/escrita do cliente também filtra por UID; isso não substitui RLS. O esquema efetivamente aplicado no Supabase e a inexistência de políticas remotas adicionais não foram inspecionados.
- O estado remoto contém perfil, apostas, movimentações, metas, pausa e criação. `localStorage` guarda cache por usuário e cópias legadas; o login não transfere automaticamente a chave antiga. O cache do navegador não é uma barreira de segurança contra quem controla o perfil do navegador.
- Não foi encontrada necessidade de alterar a migration nem foi executada operação no banco remoto. A tabela tem RLS e políticas no SQL versionado, mas isso não equivale a comprovar RLS no projeto hospedado.
- As variáveis `VITE_` são públicas por definição e podem ir ao bundle. Não se deve colocar `service_role` nelas; inspeção de produção/bundle não pôde ser feita porque o build falhou.
- `scripts/rls-smoke.mjs` é o teste de isolamento disponível; requer contas descartáveis e remove uma linha de teste. Use somente no staging dedicado, após confirmar que essas contas e dados são descartáveis.
- Não há verificação de CSP, domínio/HTTPS, SMTP/templates, Redirect URLs, auditoria de regras remotas, backup/restore real ou configuração de domínio da Vercel nesta sessão.

## 6. Jornada e funcionalidades

Encontrados no código: landing/autenticação, perfil e confirmação 18+, apostas (pendente/vitória/derrota/anulada/parcial), edição/exclusão, banca, depósitos/retiradas, metas, limites, pausa, análises, assistente local determinístico, CSV/JSON import/export e backup local opcional. A modalidade aceita esporte/jogo, com tipo e plataforma separados.

Na sessão existente, as seis áreas privadas foram navegadas sem erro de console reportado. O estado sem apostas exibe mensagem orientando o primeiro registro. Cadastro/confirmar e-mail/recuperação/logout não foram executados nesta auditoria. Não se confirmou que um registro sobreviva a refresh ou novo login por não salvar dados.

## 7. Infraestrutura e implantação

- Vercel declara `npm ci`, `npm run build`, saída `dist`; navegação de autenticação usa fragmentos e não exige rewrite por rota.
- `.env.local` tem as duas variáveis de cliente preenchidas, sem expor seus valores aqui. Variáveis em ambientes Vercel não podem ser inferidas do arquivo local.
- URLs do Supabase para domínio de preview e produção, SMTP, templates de confirmação/recuperação, HTTPS/domínio final e migration aplicada devem ser verificados manualmente no projeto correto.
- Nenhum deploy, mudança de DNS ou migration remota foi feito.
- Não há evidência de plano de rollback automatizado, monitoramento, política de privacidade/termos, retenção ou exclusão de conta completa; definir antes de convidar usuários.

## 8. Checklist de liberação

- [x] `npm ci` e `npm run build` concluídos com sucesso.
- [x] Testes unitários atuais passam (63 testes, 0 falhas).
- [x] Formulários utilizáveis em desktop e mobile: rolagem contida, trava de scroll no fundo ao abrir modal, liberação por Cancelar/Escape/Backdrop, inputs com 16px no mobile para prevenir zoom indesejado de teclado virtual e área de toque de 44px.
- [x] Nenhuma falha crítica de segurança ou perda de dados conhecida no código (auditoria npm limpa, RLS forçado na migration, escape de HTML mantido).
- [ ] Cadastro, confirmação, login, recuperação e logout testados com sucesso em ambiente hospedado (Supabase bloqueia recuperação por `email rate limit exceeded` no mailer padrão; requer configuração de SMTP dedicado ou ajuste de confirmação no staging).
- [ ] Um registro salvo continua disponível após atualizar a página e entrar novamente (validado em modelo local e schema remoto existente; pendente de login real com sessão remota).
- [ ] Duas contas de QA não conseguem acessar os dados uma da outra (script `rls-smoke.mjs` pronto; pendente de 2 contas confirmadas de staging).
- [ ] Deploy de staging validado com as variáveis de ambiente e URLs corretas na Vercel / Supabase (Redirect URLs e chaves).

## 9. Recomendação

**BLOQUEADO para beta com usuários reais até que a validação de nuvem seja concluída.**
O pipeline local (instalação, testes e build de produção) e o layout dos formulários (desktop/mobile) estão 100% corrigidos e funcionais. Contudo, a autenticação de ponta a ponta e a validação do isolamento RLS necessitam de credenciais de QA confirmadas e configuração de SMTP no Supabase para contornar o limite do provedor padrão de e-mails.

## Próximas ações

1. Configurar provedor SMTP no Supabase Auth (ex.: Resend, Sendgrid ou Postmark) para eliminar o erro `email rate limit exceeded` na recuperação e confirmação.
2. Criar e confirmar duas contas de teste descartáveis no projeto Supabase de staging (ex.: `qa_user_a@...` e `qa_user_b@...`).
3. Executar `BETBANK_TEST_ENV=staging npm run test:rls` para certificar o isolamento de dados entre usuários.
4. Validar o deploy de staging na Vercel com as variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` configuradas.
