# Betbank Intelligence

Aplicação web para registro e acompanhamento financeiro de apostas. O Betbank Intelligence organiza banca, apostas, movimentações, metas e limites em um painel privado por conta. Ele **não prevê resultados, não recomenda apostas, não processa pagamentos e não se conecta a plataformas de apostas**.

> **Status:** beta privado, não certificado para produção. A autenticação e a persistência dependem de um projeto Supabase configurado externamente. Consulte [Limitações e status do beta](#13-limitações-e-status-do-beta) antes de convidar usuários.

## 1. Visão geral

Apostadores costumam manter registros dispersos em planilhas, anotações e extratos de plataformas diferentes. O projeto centraliza esse histórico em uma única conta e transforma os registros em indicadores descritivos: saldo, resultado líquido, ROI, taxa de acerto, exposição pendente, desempenho por modalidade e por faixa horária.

O público-alvo indicado pelo próprio produto é composto por pessoas adultas (18+) que já apostam e desejam acompanhar o próprio comportamento financeiro. A ferramenta é de **registro e controle pessoal**, não de incentivo à aposta.

## 2. Funcionalidades implementadas

As funcionalidades abaixo foram verificadas no código-fonte e na suíte de testes do repositório.

- **Autenticação:** cadastro, login, confirmação de e-mail, recuperação de senha, sessão com renovação automática e logout via Supabase Auth.
- **Perfil:** nome ou apelido, confirmação de maioridade (18+), banca inicial, reserva mínima, limites de perda diário/semanal/mensal e valor máximo por registro.
- **Apostas:** criação, edição e exclusão; status pendente, vitória, derrota, anulada e parcial; modalidade, evento, plataforma, tipo, cotação, estado emocional e observações.
- **Banca:** cálculo de saldo disponível, banca, valores comprometidos em apostas pendentes, resultado líquido, ROI, taxa de acerto e exposição.
- **Movimentações:** depósitos e retiradas, que alteram o saldo mas não o lucro operacional.
- **Análises descritivas:** evolução da banca, resultado diário, mapa de resultados por dia e horário, faixas horárias e desempenho por modalidade.
- **Metas e limites:** objetivos de quantidade, exposição ou perda; alertas de aproximação e de atingimento dos limites; pausa de 24 horas ou 7 dias.
- **Assistente local:** respostas determinísticas baseadas em regras sobre o histórico. Não há IA externa, previsão de resultados ou sugestão de apostas.
- **Dados:** exportação JSON e CSV, importação validada de CSV e JSON, detecção de duplicatas, mesclagem não destrutiva e download opcional de backups locais antigos.
- **Operação:** buffer local dos últimos 50 erros em `window.__BETBANK_ERROR_LOG__` e mensagens de falha de sincronização sem declarar sucesso falso.

O app bloqueia o registro de apostas sem confirmação de maioridade e suspende novos registros durante uma pausa ativa. A confirmação de idade é uma **autodeclaração**, não uma verificação documental.

Os limites de perda geram alertas e não bloqueiam o salvamento. O valor máximo por registro também não é um bloqueio rígido: acima do valor configurado, o app pede confirmação explícita para manter o histórico.

## 3. Tecnologias e arquitetura

| Camada | Tecnologia |
|---|---|
| Interface | HTML, CSS e JavaScript puro em `index.html` |
| Build/dev server | Vite 8 |
| Autenticação e dados | Supabase Auth + PostgreSQL via PostgREST |
| Cliente Supabase | `@supabase/supabase-js` 2 |
| Testes | Runner nativo do Node.js (`node --test`) |
| Hospedagem prevista | Vercel (site estático) |
| Runtime | Node.js >= 22.12.0 |

Não há servidor de aplicação próprio neste repositório. O navegador fala diretamente com o Supabase; a autorização dos dados é aplicada no PostgreSQL por RLS.

```text
Navegador
  └─ index.html + módulos JS (bundle Vite)
       ├─ Supabase Auth  ── JWT/sessão
       ├─ Supabase API   ── tabela public.betbank_user_data
       │                     └─ RLS: auth.uid() = user_id
       └─ localStorage   ── cache por usuário e backups legados
```

O estado financeiro é um documento JSONB por usuário com o formato:

```json
{
  "profile": {},
  "bets": [],
  "transactions": [],
  "goals": [],
  "pausedUntil": null,
  "createdAt": "2026-10-25T00:00:00.000Z"
}
```

## 4. Estrutura do projeto

```text
betbank/
├── index.html                     # Shell, estilos, telas, estado e integração Supabase
├── auth-utils.js                  # Validação de cadastro, chaves e telas de autenticação
├── cloud-store.js                 # Leitura/gravação em public.betbank_user_data
├── data-import.js                 # CSV/JSON, validação, escape, IDs e mesclagem
├── legacy-backup.js               # Download opcional de dados locais antigos
├── profile-utils.js               # Validação dos valores financeiros do perfil
├── bet-options.js                 # Categorias, plataformas e tipos de aposta
├── *.test.js                      # Testes unitários e estáticos (Node test runner)
├── scripts/rls-smoke.mjs          # Teste de isolamento entre dois usuários de staging
├── supabase/migrations/
│   └── 202610240001_betbank_user_data.sql
├── vercel.json                    # Build, saída e cabeçalhos de segurança
├── .env.example                   # Nomes e placeholders das variáveis
├── .env.local                     # Configuração local, ignorada pelo Git
├── OPERATIONS.md                  # Operação, monitoramento, backup e recuperação
├── BETA_AUDIT.md                  # Auditoria de beta mais recente
└── QA_AUDIT.md                    # Auditoria histórica; contém seções superadas
```

`node_modules/` e `dist/` são gerados localmente e não devem ser versionados. Os documentos de auditoria foram preservados como registro histórico; para o estado atual, prevalecem este README, `BETA_AUDIT.md` e `OPERATIONS.md`.

## 5. Pré-requisitos

- Node.js 22.12 ou superior.
- npm compatível com o Node instalado.
- Um projeto Supabase para autenticação e persistência em nuvem.
- Opcional: Supabase CLI para aplicar a migration.
- Opcional: conta na Vercel para deploy.
- Git para versionamento.

Sem um projeto Supabase configurado, a interface é carregada, mas o cadastro, o login e a persistência remota não funcionam.

## 6. Instalação e execução local

```powershell
# Na pasta do projeto
npm ci

# Windows PowerShell
Copy-Item .env.example .env.local

# Linux/macOS
# cp .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e uma chave pública no `.env.local` e aplique a migration descrita na seção 9. Depois:

```bash
npm run dev
```

O script inicia o Vite em `http://127.0.0.1:5173` (o Vite informa a porta efetiva). O servidor escuta apenas em `127.0.0.1` por padrão.

## 7. Scripts disponíveis

| Comando | Finalidade |
|---|---|
| `npm run dev` | Servidor local de desenvolvimento com Vite |
| `npm run build` | Gera o bundle de produção em `dist/` |
| `npm run preview` | Pré-visualiza localmente o build de produção |
| `npm test` | Executa os testes com `node --test` |
| `npm run test:rls` | Teste de isolamento RLS contra staging, com duas contas descartáveis |

`npm run test:rls` **não** é um teste local isolado: ele autentica em um Supabase real, cria uma linha de teste, tenta acesso cruzado e remove a linha ao final. Use somente em um projeto de staging dedicado, com contas descartáveis, jamais em produção ou com dados reais. O script exige `BETBANK_TEST_ENV=staging` e as variáveis descritas na seção 8.

Não há script de lint, verificação de tipos ou teste end-to-end no `package.json`.

## 8. Variáveis de ambiente

Crie `.env.local` a partir de `.env.example`. Os exemplos abaixo são fictícios.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_SUPABASE_URL` | Sim | URL do projeto Supabase. Ex.: `https://exemplo-projeto.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Uma das duas chaves | Chave pública *publishable*. Tem precedência quando preenchida. |
| `VITE_SUPABASE_ANON_KEY` | Uma das duas chaves | Chave pública `anon`, mantida por compatibilidade. |

Regras importantes:

- Use **somente** a chave pública (`anon` ou `publishable`). Nunca use `service_role`, senha do banco ou outro segredo em variáveis `VITE_`.
- Variáveis `VITE_` são incorporadas ao bundle pelo Vite e ficam visíveis no navegador; trate-as como públicas.
- Alterou uma variável de ambiente? Gere um novo build/redeploy para que o bundle seja atualizado.
- `.env`, `.env.local` e `.env.*` são ignorados pelo Git; `.env.example` contém apenas placeholders e é versionado.
- Na Vercel, cadastre as variáveis em **Project Settings > Environment Variables** para Preview e Production.

Para o teste de RLS, defina também no ambiente do processo (não no bundle):

```bash
BETBANK_TEST_ENV=staging
BETBANK_RLS_TEST_USER_A_EMAIL=qa-a@exemplo.invalid
BETBANK_RLS_TEST_USER_A_PASSWORD=senha-ficticia-a
BETBANK_RLS_TEST_USER_B_EMAIL=qa-b@exemplo.invalid
BETBANK_RLS_TEST_USER_B_PASSWORD=senha-ficticia-b
```

## 9. Supabase, migration e RLS

1. Crie projetos separados para desenvolvimento/staging e produção.
2. Em **Authentication > Providers**, habilite e-mail/senha e defina a regra de confirmação de e-mail. O app valida senhas com pelo menos 10 caracteres; configure uma regra compatível no provedor.
3. Em **Authentication > URL Configuration**, configure `Site URL` com o domínio HTTPS final e adicione `http://127.0.0.1:5173/**`, o domínio de preview autorizado e o domínio final às `Redirect URLs`.
4. Configure SMTP/transacional e teste os templates de confirmação e recuperação. O provedor de e-mail padrão do Supabase pode impor limites de envio.
5. Aplique `supabase/migrations/202610240001_betbank_user_data.sql` no ambiente correto, pelo SQL Editor ou com Supabase CLI linkado (`supabase db push`). Revise o projeto e o ambiente antes de executar.
6. Confirme que a tabela `public.betbank_user_data` existe, está com RLS ativo e possui as políticas de SELECT, INSERT, UPDATE e DELETE.

A migration versionada:

- cria uma linha por usuário, com `user_id uuid` como chave primária e referência a `auth.users(id) on delete cascade`;
- guarda o estado em `payload jsonb`, com constraint para o formato esperado;
- habilita e força RLS na tabela;
- revoga acesso de `anon` e concede CRUD apenas a `authenticated`;
- cria políticas CRUD baseadas em `(select auth.uid()) = user_id`;
- mantém `updated_at` por trigger.

O filtro por `user_id` feito no navegador é apenas uma chave de consulta. **A autorização efetiva é a RLS no PostgreSQL**: mesmo que alguém manipule a requisição HTTP, o banco recusa leitura ou escrita de linhas de outro usuário.

### Estado desta verificação

A migration e as políticas estão presentes no repositório e há testes estáticos sobre o SQL. Nesta preparação **não havia credenciais de staging/produção** e o teste com dois usuários reais não foi executado. Portanto, a aplicação da migration no projeto hospedado e o isolamento RLS real permanecem pendentes de validação operacional.

Para validar o isolamento, crie duas contas descartáveis confirmadas no staging e execute:

```bash
BETBANK_TEST_ENV=staging npm run test:rls
```

O teste tenta leitura, criação, alteração e exclusão cruzadas e remove a linha de teste ao final. Ele não substitui uma revisão das políticas no painel do Supabase.

## 10. Deploy na Vercel

1. Importe o repositório na Vercel.
2. Defina o **Root Directory**:
   - se o projeto estiver na raiz do repositório, mantenha a raiz;
   - se o repositório contiver o projeto em uma subpasta, aponte para `betbank`.
3. Confirme as configurações de `vercel.json`:
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Cadastre `VITE_SUPABASE_URL` e uma chave pública em **Preview** e **Production**.
5. Faça primeiro um deploy de **Preview**. Adicione a URL de preview às `Redirect URLs` do Supabase e teste com contas descartáveis.
6. Valide cadastro, confirmação de e-mail, login, refresh, recuperação de senha, logout, CRUD financeiro, importação/exportação e isolamento entre duas contas.
7. Configure o domínio final, atualize `Site URL`/`Redirect URLs` e o SMTP do Supabase e só então promova o build aprovado para Production.

A aplicação usa rotas de autenticação por fragmento (`#login`, `#signup`, `#forgot`) e não exige rewrite de SPA por caminho. O `vercel.json` adiciona cabeçalhos como `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` e `Permissions-Policy`; **não há CSP configurada**.

A migration do banco não é executada pela Vercel. Ela precisa ser aplicada separadamente no projeto Supabase correto.

## 11. Segurança e privacidade

- **Chaves:** apenas a chave pública do Supabase deve chegar ao frontend. `service_role` ignora RLS e nunca deve ser usada no cliente.
- **Autorização:** a RLS é a barreira de isolamento dos dados. O filtro no cliente não é suficiente por si só.
- **Validação:** apostas, movimentações, metas, perfil e backups passam por validação antes de persistir; textos renderizados usam escape de HTML.
- **Importação:** CSV é validado por linha e rejeitado por inteiro se houver erro; JSON é validado e mesclado sem sobrescrever dados atuais; há limites de 10 MB para CSV e 20 MB para JSON.
- **Cache local:** o `localStorage` guarda uma cópia por usuário. Quem controla o navegador/perfil pode acessá-la. Não use em computador compartilhado.
- **Idade:** a confirmação 18+ é autodeclarada e apenas controla o uso da interface.
- **Privacidade:** não há política de privacidade, termos de uso, fluxo completo de exclusão de conta, retenção documentada ou avaliação jurídica/LGPD publicada neste repositório.
- **Operação:** não há APM/telemetria externa configurada; os erros ficam em um buffer local no navegador.
- **Dependências externas:** a página carrega fontes do Google Fonts; hospedagem, autenticação e e-mail dependem de Vercel, Supabase e do provedor SMTP configurado.

Se uma credencial privada for exposta, apagar o arquivo atual não basta: ela continua no histórico do Git. O procedimento correto é revogar/rotacionar a credencial no provedor e limpar o histórico com uma ferramenta apropriada antes de publicar. Para este projeto, as credenciais privadas não devem existir no repositório em nenhuma circunstância.

## 12. Exportação, importação e recuperação

### Exportação

- **JSON:** baixa o estado completo (`profile`, `bets`, `transactions`, `goals`, `pausedUntil`, `createdAt`) em `betbank-backup.json`.
- **CSV:** exporta as apostas com BOM UTF-8 e delimitador `;`, compatível com Excel.
- **Dados locais anteriores:** quando existem, podem ser baixados separadamente como JSON; o download não altera nem apaga a cópia original.

### Importação

- **JSON:** valida o schema, normaliza IDs e mescla registros; dados atuais são preservados. A importação só ocorre após confirmação explícita.
- **CSV:** valida todas as linhas antes de qualquer alteração, mostra uma pré-visualização e separa registros novos, duplicados exatos e semelhantes. Duplicados exatos não são importados; semelhantes exigem confirmação.
- **Backup legado:** o login não transfere automaticamente dados antigos do navegador para a nuvem. A importação é voluntária.

### Recuperação

- O botão **Excluir dados** remove o documento remoto da conta e o cache ativo no navegador. Ele não exclui a conta do Supabase nem necessariamente todas as cópias legadas locais.
- A migration é aditiva e não inclui rollback destrutivo. Em falha, a recomendação é reverter o deployment na Vercel e preservar tabela e registros para investigação.
- Backups de produção, restauração administrativa, PITR e rotação de credenciais estão descritos em [`OPERATIONS.md`](OPERATIONS.md). A existência de PITR depende do plano contratado no Supabase.

## 13. Limitações e status do beta

O relatório mais recente (`BETA_AUDIT.md`) classifica o projeto como **bloqueado para beta com usuários reais** até que a validação de nuvem seja concluída. Pendências conhecidas:

- cadastro, confirmação de e-mail, login, recuperação e logout não foram percorridos de ponta a ponta em um ambiente hospedado nesta preparação;
- o isolamento RLS com duas contas reais de staging ainda precisa ser executado;
- o provedor de e-mail padrão do Supabase pode bloquear envios por limite; SMTP dedicado e templates precisam ser configurados;
- não há teste end-to-end, teste de navegador, lint ou verificação de tipos automatizada;
- não há CSP; a página usa scripts/estilos inline e fontes externas;
- cálculos monetários usam ponto flutuante, com validação de centavos, mas sem representação contábil em centavos inteiros;
- as fronteiras de fuso dos limites de período precisam de definição e testes;
- não há exclusão completa de conta, política de privacidade, termos de uso, retenção, monitoramento/APM ou plano de backup de produção automatizado no repositório;
- a cobertura visual e de acessibilidade em diferentes navegadores, tamanhos de tela e leitores de tela é limitada;
- não há licença de código aberto definida.

Nada disso deve ser interpretado como certificação, conformidade legal ou garantia de disponibilidade. O status é de **beta privado em preparação**.

## 14. Documentação operacional

- [`OPERATIONS.md`](OPERATIONS.md): credenciais, RLS, monitoramento, backups, recuperação de desastres e rotação de chaves.
- [`BETA_AUDIT.md`](BETA_AUDIT.md): auditoria de beta, achados, testes executados, checklist e recomendação.
- [`QA_AUDIT.md`](QA_AUDIT.md): auditoria histórica anterior à persistência remota. Algumas seções estão superadas; use `BETA_AUDIT.md` e este README como referência atual.

## 15. Contribuição

Este é um projeto privado e não possui um processo público formal de contribuição. Para alterações internas:

1. Crie uma branch descritiva.
2. Não inclua `.env.local`, credenciais, dados reais de usuários ou artefatos de build no commit.
3. Execute `npm ci`, `npm test` e `npm run build` antes de abrir uma revisão.
4. Mudanças de schema devem vir em migration aditiva e ser acompanhadas de revisão de RLS.
5. Mudanças de autenticação, importação ou cálculo financeiro devem incluir testes.

## 16. Licença

Não há arquivo `LICENSE` neste repositório e nenhuma licença de uso é declarada. O projeto é privado; não é concedida permissão para redistribuição, uso comercial ou publicação derivada sem autorização expressa do titular. Se uma licença for adicionada no futuro, este README deverá ser atualizado.
