# Betbank Intelligence — relatório de auditoria QA

> **Relatório histórico:** este documento foi escrito antes da integração atual com Supabase e contém conclusões que já não descrevem o repositório presente. Use [`BETA_AUDIT.md`](./BETA_AUDIT.md) para o estado reavaliado em 24/10/2026. O conteúdo abaixo foi mantido como histórico, sem apagar as evidências e recomendações originais.

Data: 24/10/2026  
Escopo: repositório `betbank/` presente neste workspace. Auditoria estática, build e testes locais; sem conexão autenticada ao Supabase.

## 1. Resumo executivo

**Veredito: NÃO PRONTO para lançamento como plataforma full-stack multiusuário.** O projeto compila e os testes locais passam, mas os dados de perfil, apostas, movimentações e metas permanecem no `localStorage`. Não existe backend de dados, esquema PostgreSQL, migração, nem política RLS; por isso não há isolamento multiusuário garantido no servidor nem sincronização entre dispositivos. A autenticação real depende de configuração Supabase externa ainda ausente neste workspace.

Foram confirmadas falhas na validação de CSV (stake negativa aceita e duplicatas dentro do mesmo arquivo repetidas) e uma superfície de XSS armazenado possível via ID arbitrário de um backup JSON importado, que depois é interpolado sem escape em atributos HTML. O navegador integrado não conseguiu conectar ao servidor local nesta execução; autenticação real, console e responsividade visual ficam não testados.

Nenhuma lógica de produção foi alterada. Foi acrescentado `qa-financial.test.js`, que executa as funções financeiras existentes diretamente e cobre cinco cenários.

## 2. Inventário técnico

| Item | Evidência / estado |
|---|---|
| Linguagens | HTML, CSS e JavaScript ESM em `index.html`; módulos auxiliares JavaScript. |
| Framework / build | Vite `^8.3.5`; SDK `@supabase/supabase-js` `^2.117.3`; versões resolvidas registradas no `package-lock.json`. |
| Runtime declarado | Node `>=22.12.0`; executado com Node `v22.18.0`, npm `10.9.3`. |
| Entrada e telas | `index.html` é a única aplicação e controla telas por estado/DOM: página pública, cadastro, login, recuperação, configuração inicial, dashboard, apostas, análises, metas/limites, assistente e perfil/dados. Não há roteador de páginas. |
| Autenticação | Supabase Auth no browser: cadastro, senha, confirmação de e-mail, login, recuperação, atualização de senha, restauração/verificação de sessão e logout. Credenciais/configuração do projeto ausentes, então provedores não foram exercitados. |
| Dados | `localStorage` no browser. Chave legada `betbank-intelligence-v1`; dados atuais usam `betbank-intelligence-v1:<auth-user-id>`. Não há API de dados ou banco no repositório. |
| Testes | `node --test`; seis testes prévios de validação/estado de autenticação e cinco novos testes das funções financeiras do código de produção. Não há cobertura medida, navegador automatizado, lint, checagem de tipos ou testes de integração. |
| Build/publicação | `npm run build` gera `dist/`; `npm run preview` serve a build local. Não há workflow ou configuração de publicação detectados. |

### Classificação funcional

| Funcionalidade | Estado | Observação |
|---|---|---|
| Perfil e configuração inicial | IMPLEMENTADA | Perfil guardado localmente; confirmação de maioridade é exigida para registrar apostas. |
| Apostas | IMPLEMENTADA | CRUD, busca, filtros e status pendente/vitória/derrota/anulada/parcial; execução real de ponta a ponta não observada no browser. |
| Banca e movimentos | IMPLEMENTADA | Depósitos/retiradas afetam saldo calculado localmente, não ROI. |
| Limites e metas | PARCIAL | Alertas e metas descritivas existem; limite máximo é aviso com opção de continuar, e os limites não são proteção no backend. |
| Pausas | IMPLEMENTADA no cliente | `betModal` impede novos registros durante a pausa ativa; edição também fica bloqueada. Não controla atividade externa. |
| Análises e assistente | IMPLEMENTADA | Indicadores determinísticos sobre os registros locais. |
| Importar/exportar | PARCIAL | CSV/JSON no cliente; validação CSV incompleta, sem envio/validação de servidor. Exportações não foram testadas via navegador. |
| Cadastro/login/sessão | PARCIAL / NÃO VERIFICADA | Código usa Supabase Auth, mas falta configuração e teste real do provedor. |
| Multiusuário com dados privados | AUSENTE | Não há persistência/backend/RLS para dados financeiros; chave local por UID não equivale a autorização de servidor. |
| Privacidade, termos, exclusão de conta no provedor | AUSENTE / NÃO VERIFICADA | Há exclusão dos dados locais do browser, não fluxo de exclusão da conta Supabase nem política/termos identificados. |

## 3. Estrutura e módulos responsáveis

```text
betbank/
  index.html                 Aplicação, estilos, navegação, dados, formulários e integrações
  auth-utils.js              Validação de cadastro, mensagens e helpers de navegação
  auth-utils.test.js         Testes unitários de autenticação
  qa-financial.test.js       Testes QA financeiros adicionados nesta auditoria
  package.json               Scripts e dependências
  package-lock.json          Resolução reproduzível das dependências npm
  .env.example               Nomes/formatos de variáveis Supabase (valores demonstrativos)
  .gitignore                 Ignora node_modules, dist e arquivos de ambiente locais
  README.md                  Inicialização, auth, recuperação do legado e limitações
  dist/                      Build produzido localmente
```

Os módulos funcionais não estão separados em arquivos: estão implementados em funções na aplicação monolítica `index.html`. Pontos relevantes: cálculo financeiro e limites linhas 35–37; dashboard e histórico 41–46; assistente 47–48; perfil/dados 49; modais de perfil/aposta/movimentação/meta/limite e pausa 52–57; exportação e importação 58–62; Supabase Auth e controle da sessão 63–90. As linhas são do estado auditado e podem mudar com futuras edições.

## 4. Armazenamento e segurança

- Leituras: chave legada durante detecção de dados antigos, `load()` e `establishSession()`; leitura da chave local da conta após verificação de usuário pelo Supabase.
- Gravações: `save()` serializa `db`; onboarding, apostas, movimentos, metas, limites e pausas chamam essa função. `deleteData()` remove apenas a chave local da conta atual. Backup JSON/CSV baixa arquivos; importadores mesclam dados no estado local.
- Sessão: persistência/refresh são delegados ao SDK Supabase. O código chama `getUser()` antes de montar a área privada. Sem as variáveis Supabase, os botões de autenticação ficam desativados.
- Segredos: `.env.example` contém apenas placeholders. `.env.local`/`.env` e variáveis Supabase não estavam presentes no projeto inspecionado. O uso futuro de `VITE_` expõe deliberadamente URL e chave pública no bundle; uma chave `service_role` nunca pode ser usada aí.
- Não foram encontrados `sessionStorage`, cookies definidos pela aplicação, endpoints próprios, backend, migrações SQL, RLS, configuração CORS, cabeçalhos CSP ou mecanismos de rate limiting no repositório.
- XSS: dados textuais comuns são escapados via `esc()`, mas IDs importados por JSON não são validados e alguns são colocados diretamente em atributos HTML. Ver BUG-003.
- O conteúdo do `localStorage` fica acessível ao perfil de navegador e a scripts executados na mesma origem. A chave baseada no UID é organização local, não controle de acesso confiável. Sem servidor, não é possível testar IDOR, RLS, CORS ou isolamento entre usuários.

## 5. Regras financeiras e testes

Implementação observada em `cashStats()` (`index.html:35`): `net = retorno total - stake` para status liquidados; banca = banca inicial + depósitos − retiradas + resultados; saldo disponível = banca − stakes pendentes; ROI = lucro líquido / stakes de apostas liquidadas contabilizadas; taxa de acerto conta resultados líquidos positivos entre vitória/derrota/parcial. Anuladas contam como liquidadas no total de stake/retorno/ROI, mas ficam fora da taxa de acerto. Movimentações não entram no ROI.

Na liquidação parcial, o campo é descrito como **retorno total efetivamente recebido** e o resultado é calculado uma vez como `retorno total - stake`; não há lançamento incremental separado. Logo, cadastrar uma parcial uma vez não soma duas vezes na implementação examinada. Edição substitui o objeto pelo mesmo ID; exclusão remove o registro e recalcula os totais derivados. Casos de UI para edição/exclusão não foram operados no browser.

Os cinco testes adicionados executam as funções `settled`, `net`, `eligible` e `cashStats` extraídas do `index.html`, cobrindo vitória/derrota/pendente, anulada, parcial, períodos sem amostra e centavos. Foram aprovados; são testes de funções, não uma cobertura ampla de interface/importação.

Limitações financeiras identificadas:

- Aritmética usa `Number` de ponto flutuante e soma decimal binária; os testes com centavos aprovam dentro de tolerância, mas não há representação monetária em centavos nem validação geral de `Number.isFinite` na UI/importação. Acúmulos grandes podem apresentar frações internas; testar e migrar a centavos antes de confiar em reconciliação contábil.
- A aposta anulada com stake e retorno iguais não altera lucro/banca, mas sua stake integra o denominador de ROI. O tratamento deve ser confirmado como regra de produto antes do lançamento.
- Limites de período usam janelas de 1/7/30 dias; `sessionLoss()` define meia-noite pelo fuso local do dispositivo, enquanto `today()` e `dayKey()` usam `America/Sao_Paulo`. Usuários fora desse fuso podem ver limite diário diferente da segmentação de dia. Requer decisão de regra/fuso e teste dedicado.
- Não há testes automatizados de limites, stake acima do máximo, reserva, datas/fusos, edição e exclusão como fluxos, nem validação em servidor.

## 6. Bugs e riscos registrados

### BUG-001 — Dados financeiros locais impedem isolamento multiusuário real

- **Severidade:** ALTA · **Prioridade:** P0 · **Status:** CONFIRMADO (lacuna de arquitetura).
- **Área/ambiente:** persistência e segurança; build local auditada.
- **Evidência:** README declara que perfil/apostas/movimentos/metas continuam no navegador. `index.html:33–35` lê/grava localStorage; estrutura não tem API, SQL ou migração.
- **Passos:** inspecionar `package.json`, estrutura do repositório e `load()`/`save()`; confirmar ausência de backend e RLS.
- **Esperado:** dados privados persistidos e autorizados no servidor por usuário autenticado.
- **Observado/impacto:** autenticação existe no provedor, mas dados podem ser alterados/lidos no browser, não sincronizam entre dispositivos e não existe política de banco para provar isolamento. Não lançar como SaaS multiusuário.
- **Correção:** tabelas PostgreSQL com `user_id`, RLS habilitado e políticas CRUD por `auth.uid()`, validação de constraints, migração/backup e testes negativos com dois usuários independentes.

### BUG-002 — Importador CSV aceita stake negativa

- **Severidade:** ALTA · **Prioridade:** P1 · **Status:** CONFIRMADO por inspeção de validação.
- **Área/ambiente:** importação CSV no browser, `index.html:61`.
- **Passos:** importar uma linha com colunas `data;modalidade;valor;status;retorno` e `valor=-10`, com data, modalidade e status válido.
- **Esperado:** rejeitar stake não positiva antes de pré-visualizar/importar.
- **Observado:** parser converte o valor para `Number` e testa `!b.stake`; `-10` é truthy e passa. Pode inverter métricas de stake/ROI e gerar dados inconsistentes. O formulário manual impõe `min=0.01`, mas o CSV não replica a regra.
- **Correção:** validar finitude, stake > 0, retorno não negativo e consistência de retorno/status, idealmente compartilhar o mesmo schema de validação.

### BUG-003 — ID de backup JSON é interpolado sem escape em atributo HTML

- **Severidade:** MÉDIA · **Prioridade:** P1 · **Status:** CONFIRMADO por fluxo estático.
- **Área/ambiente:** importação de JSON e renderização de aposta/meta, `index.html:41,44,60` e `goalView()`.
- **Pré-condição:** usuário escolhe importar backup JSON; um `id` fornecido no arquivo contém aspas e atributos HTML. O importador valida campos de aposta/movimento, mas não valida/normaliza IDs de apostas ou metas; o render coloca IDs em `data-edit`/`data-delete-goal` sem `esc()`.
- **Esperado:** conteúdo importado ser escapado e não criar atributos executáveis.
- **Observado/impacto:** um backup especialmente preparado pode injetar marcação/atributos na mesma origem após importação e executar script quando o elemento for acionado/focado. Requer importação consciente de arquivo não confiável; risco de XSS armazenado no próprio browser.
- **Correção:** normalizar IDs para UUID gerado pela aplicação (ou validar estritamente UUID) e escapar todo valor interpolado em HTML; preferir DOM APIs para atributos.

### BUG-004 — CSV repete linhas duplicadas dentro do próprio arquivo

- **Severidade:** MÉDIA · **Prioridade:** P2 · **Status:** CONFIRMADO por lógica estática, ainda não operado no browser.
- **Área/ambiente:** `index.html:62`.
- **Passos:** importar CSV contendo duas linhas idênticas que não existam no banco local.
- **Esperado:** pré-visualização identificar repetidas internas e permitir importação sem duplicá-las.
- **Observado:** `dupes` e `unique` comparam cada linha somente com `db.bets`, que ainda não foi atualizado durante o filtro; duas cópias ausentes no estado atual passam ambas. Totais ficam duplicados.
- **Correção:** deduplicar também contra uma chave composta/conjunto da própria importação e deixar explícita a regra para registros parecidos.

### BUG-005 — Auditoria de vulnerabilidades npm sem resultado

- **Severidade:** MÉDIA · **Prioridade:** P1 antes de release · **Status:** NÃO TESTADO (bloqueio de rede, não vulnerabilidade confirmada).
- **Evidência:** `npm audit --omit=dev --json` falhou ao acessar `https://registry.npmjs.org/-/npm/v1/security/audits/quick`, com `getaddrinfo ENOTFOUND registry.npmjs.org`.
- **Impacto/correção:** não há conclusão sobre CVEs. Reexecutar `npm audit` (e revisar alertas/transitivas) em ambiente com acesso ao registro; não interpretar falha como aprovação.

## 7. Comandos e resultados reproduzíveis

Executados na pasta `betbank/`:

| Comando | Resultado |
|---|---|
| `node --version` | `v22.18.0` |
| `npm --version` | `10.9.3` |
| `npm test` (antes dos testes QA) | 6 aprovados, 0 falhas. |
| `npm run build` | Vite 8.3.5; 49 módulos transformados; build de `dist/` concluído. |
| `npm audit --omit=dev --json` | Falhou por DNS/rede; sem relatório de vulnerabilidade. |
| `npm run dev` | Vite iniciou em `http://127.0.0.1:5173/`. |
| Abrir URL no browser integrado | `net::ERR_CONNECTION_TIMED_OUT`; não foi possível inspecionar DOM/console. Servidor local encerrado após a tentativa. |
| `npm test` (após criar QA financeiro) | 11 aprovados, 0 falhas; inclui os seis existentes e cinco financeiros. |
| `npm run build` (após QA) | Concluído; mesma build de sucesso. |

Não foi executada instalação de dependências porque `node_modules` já existia; não foi simulado `npm ci` nem acesso à rede. Sem scripts, não há comando de lint ou verificação de tipos configurado.

## 8. Não testado / riscos restantes

- Cadastro real (válido/inválido/duplicado), login correto/incorreto, recuperação e confirmação de e-mail, persistência de sessão, logout, falhas/repetição e rate limit Supabase: **NÃO TESTADOS**, pois `.env.local` e projeto Supabase não estão configurados.
- Isolamento de dois usuários, RLS, IDOR, autorização de API, cookies/CORS/HTTPS/headers e operação de banco: **NÃO TESTADOS / não aplicável à arquitetura atual**, que não tem backend de dados.
- Interface real, console, teclado, contraste, responsividade móvel/desktop, entrada de dados e upload/download em browser: **NÃO TESTADOS** porque o navegador integrado expirou a conexão com o servidor local. O build não substitui QA visual.
- Testes de CSV e JSON (arquivo inválido, formato monetário local, UTF-8, linhas grandes, arquivo grande, truncamento, duplicação, exportar/reimportar): não executados; defeitos BUG-002/003/004 vistos estaticamente.
- Cópia do legado `file://`, migração entre contas e integridade de backup real: não testadas para preservar dados do usuário.
- Backup/restauração de banco, observabilidade, retenção/logs, exclusão completa de conta, termos e política de privacidade, revisão jurídica/operacional: ausentes ou pendentes.
- O `localStorage` pode falhar por quota/desativação; `save()` não captura exceção de gravação. Não há recuperação automática além dos backups manuais.

## 9. Plano de correção por prioridade

1. **P0 — Backend multiusuário:** definir esquema/migrações PostgreSQL e RLS; portar dados financeiros, manter exportação/backup original e migrador idempotente; criar testes de isolamento (dois usuários, operações CRUD e IDs alheios).
2. **P1 — Importação segura:** normalizar IDs, corrigir stake/retorno/status, deduplicar entradas internas, limitar tamanho, validar datas/encoding/locale e adicionar fixtures CSV/JSON sem dados pessoais.
3. **P1 — Auditoria npm:** executar audit com rede, fixar decisões de atualização no lockfile, revisar CVEs e repetir build/testes.
4. **P1 — Auth operacional:** configurar projeto de teste, URLs de retorno, templates/envio de e-mail, rate limits e regras de senha; executar fluxos E2E com duas contas de teste.
5. **P1 — Financeiro:** definir formalmente ROI para anuladas, fuso e períodos de limite, moeda em centavos e limites de dados; adicionar testes de edição, exclusão, movimentos, datas, máximos/reserva e importação.
6. **P2 — Release e privacidade:** política/termos revisados, exclusão da conta e dados, backups testados, HTTPS/domínio, monitoramento, logs seguros, CSP/headers, acessibilidade e browser QA responsivo.

## 10. Critérios objetivos de prontidão

- Dados financeiros persistidos em PostgreSQL e políticas RLS testadas por operação com usuários A/B; nenhum teste cruzado de leitura/escrita/exclusão pode passar.
- Migração de legado comprovada em cópia: contagens e totais reconciliados, reexecução idempotente, backup original preservado e rollback documentado.
- Todos os casos financeiros definidos pelo produto aprovados em testes automatizados, inclusive anulada/parcial/edição/exclusão, limites e fusos; valores monetários sem deriva além de centavos.
- CSV/JSON malformados, duplicados e hostis rejeitados sem XSS ou alteração parcial; exportar/reimportar mantém totais.
- Auth real de teste aprovada para confirmação, login, recovery, refresh, logout e indisponibilidade; endpoints/dados autorizados no servidor.
- Audit de dependências concluído sem vulnerabilidade bloqueadora ou com mitigação aprovada; build e suíte passam em CI reproduzível.
- QA visual/teclado/acessibilidade em navegadores e larguras declaradas aprovado; privacidade, retenção, exclusão, backup e implantação revisados operacional e juridicamente.

## 11. Configurações que dependem do usuário/equipe

- Criar projeto Supabase de desenvolvimento/staging e configurar `.env.local` apenas com URL e chave pública; nunca usar chave `service_role` no frontend.
- Definir URLs de Site/Redirect, domínio HTTPS, confirmação e recuperação de e-mail, limites/rate limiting e política mínima de senha no provedor.
- Provisionar PostgreSQL/migrações e aprovar políticas de acesso e semântica de períodos/ROI.
- Disponibilizar ambiente autorizado de staging e duas contas de teste independentes. Não testar contas ou dados reais.
- Escolher plataforma de hospedagem, domínio, backup/restore, monitoramento e responsáveis por revisão jurídica de privacidade/termos.

## 12. Aditivo — correções QA (24/10/2026)

Após a auditoria, BUG-002, BUG-003 e BUG-004 foram corrigidos no frontend, sem migração de backend:

- `data-import.js` centraliza validação de apostas, parser CSV com diagnósticos por linha, classificação de repetidas/semelhantes, validação de backup e normalização de IDs.
- `index.html` aplica a mesma validação de aposta ao formulário manual e CSV; o arquivo CSV inteiro é validado antes de qualquer alteração. A prévia separa novos, duplicados exatos e semelhantes (estes exigem checkbox explícito). Backup JSON é validado e mesclado em novo estado antes de persistir; `localStorage` só é atualizado após validação e serialização.
- IDs recebidos em JSON só são preservados se forem UUIDs válidos; demais recebem IDs internos. A renderização usa escape HTML compartilhado também para atributos dos botões de edição e exclusão. Campos textuais continuam aceitando conteúdo legítimo, mas são escapados ao montar HTML.
- A validação de status preserva o cálculo líquido existente e rejeita combinações incoerentes: vitória exige retorno acima da stake; parcial exige retorno positivo; derrota/pendente exigem retorno zero; anulada exige retorno igual à stake. O retorno parcial continua contabilizado como valor total recebido uma única vez.
- `qa-import.test.js` adiciona os testes de CSV/JSON e strings especiais; junto com os testes financeiros e de autenticação, `npm test` passou com **24 testes, 0 falhas**. `npm run build` passou com Vite 8.3.5 e 50 módulos transformados.

Isso não altera o veredito de prontidão multiusuário: dados ainda são locais, não existe RLS/backend financeiro, e os fluxos reais Supabase e a inspeção em navegador continuam não verificados. A suíte testa o sanitizador/validador e preparação de dados, sem executar scripts de teste nem importar arquivos hostis na aplicação.
