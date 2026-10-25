# Betbank Intelligence — Manual de Operações, Monitoramento e Recuperação de Desastres

**Versão:** 1.0.0  
**Data:** 25/10/2026  
**Classificação:** Documentação Operacional Interna  

---

## 1. Auditoria de Segurança e Gerenciamento de Credenciais

### 1.1 Exposição de Chaves no Frontend
- **Chave Pública (Publishable Key):** O frontend utiliza exclusivamente a chave com prefixo `sb_publishable_` (ou a chave `anon`). Essa chave é desenhada pela arquitetura do Supabase para ser pública e incluída no bundle do navegador.
- **Chave Administrativa (`service_role`):** Foi realizada varredura completa por regex em todos os arquivos rastreados, variáveis de ambiente e no bundle final gerado em `dist/assets/*.js`. **Nenhuma chave `service_role`, segredo de banco de dados ou token administrativo está exposto no código ou nos artefatos de build.**
- **Regras no `.gitignore`:** Arquivos `.env`, `.env.local`, `.env.*` (exceto `.env.example`) e `.vercel` são estritamente ignorados pelo versionamento.

### 1.2 Camada de Defesa no PostgreSQL (Row Level Security)
A segurança contra acesso indevido entre usuários reside exclusivamente no PostgreSQL do Supabase, não no cliente:
- `alter table public.betbank_user_data enable row level security;`
- `alter table public.betbank_user_data force row level security;`
- `revoke all on table public.betbank_user_data from anon;`
- As políticas de `SELECT`, `INSERT`, `UPDATE` e `DELETE` utilizam estritamente `(select auth.uid()) = user_id`. Mesmo que um usuário mal-intencionado manipule requisições HTTP para a API PostgREST, o banco recusa qualquer operação que não pertença ao UID do JWT autenticado.

---

## 2. Monitoramento de Erros e Telemetria

### 2.1 Captura Global no Cliente
A aplicação possui ouvintes globais para capturar e registrar falhas em tempo de execução:
- `window.addEventListener('error', ...)`: captura exceções síncronas e erros de sintaxe de scripts.
- `window.addEventListener('unhandledrejection', ...)`: captura rejeições de Promises e erros de rede não tratados.
- **Buffer de Diagnóstico Local:** Os últimos 50 eventos operacionais são retidos no buffer `window.__BETBANK_ERROR_LOG__`. Em sessões de suporte ou homologação de QA, basta abrir o console do navegador e inspecionar essa variável para extrair o stack trace e contexto exato da falha.

### 2.2 Integração com Plataformas de APM (Sentry / LogRocket)
Para ambiente de produção com usuários reais, recomenda-se plugar um serviço como Sentry. A função de captura `logOpsError(type, err, info)` já centraliza o ponto de despacho.
Exemplo de ativação futura com Sentry SDK:
```javascript
// Em index.html, no topo do script de módulo:
import * as Sentry from '@sentry/browser';
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}
```

### 2.3 Métricas de Infraestrutura a Monitorar
1. **Supabase Dashboard (Reports > API):**
   - Taxa de erro 4xx/5xx na API PostgREST.
   - Pool de conexões do PostgreSQL (`pgbouncer` / Supavisor).
   - Volume de envios de e-mail e rejeições de SMTP.
2. **Vercel Analytics & Logs (Staging / Produção):**
   - Taxa de erros HTTP 5xx nas rotas estáticas.
   - Tempos de resposta (TTFB e FCP).

---

## 3. Política e Rotina de Backups

### 3.1 Camada 1: Backups Voluntários do Usuário (Auto-serviço)
- No painel da aplicação (**Perfil e dados > Ações**):
  - **Baixar cópia JSON (`betbank-backup.json`):** Exporta o estado completo (`profile`, `bets`, `transactions`, `goals`).
  - **Exportar CSV (`betbank-apostas.csv`):** Exporta planilha tabular com encoding UTF-8 com BOM (compatível com Excel).
  - **Baixar dados locais anteriores:** Permite que o usuário baixe a cópia residual do `localStorage` de sessões passadas.
- O backup JSON possui validação estrita de schema (`validateBackup`) e processo de mesclagem não destrutivo (`mergeBackup`), garantindo que registros válidos não sobrescrevam dados existentes sem confirmação.

### 3.2 Camada 2: Backups Lógicos do Banco de Dados
Para o operador do sistema, recomenda-se rotina diária de extração dos dados de todos os usuários:
```bash
# Dump apenas da tabela de dados do Betbank
pg_dump -h db.<PROJECT-REF>.supabase.co \
        -U postgres \
        -d postgres \
        -t public.betbank_user_data \
        --data-only \
        --inserts > betbank_backup_$(date +%Y%m%d).sql
```
Alternativamente via Supabase CLI:
```bash
supabase db dump --data-only --schema public -f backup_public_$(date +%Y%m%d).sql
```

### 3.3 Camada 3: Point-in-Time Recovery (PITR)
- No plano Pro do Supabase, o PITR permite restauração granular do banco para qualquer segundo dos últimos 7 a 30 dias.
- Deve ser mantido **ativado** antes de abrir o produto para beta público ou usuários pagantes.

---

## 4. Procedimento de Recuperação de Desastres (Runbook)

### Cenário A: Usuário relata corrupção ou perda de histórico
1. Solicitar ao usuário o arquivo `betbank-backup.json` mais recente que ele possua.
2. Instruir o usuário a acessar **Perfil e dados > Importar backup JSON**.
3. O validador do cliente analisa o arquivo, apresenta o total de apostas e metas a recuperar e solicita confirmação antes de persistir na nuvem.
4. Caso o usuário não tenha o JSON, consultar o dump diário do operador filtrando por `user_id`.

### Cenário B: Restauração Administrativa de um Usuário Específico no Banco
Se for necessário restaurar manualmente o estado de um usuário a partir de um backup SQL sem afetar os demais:
```sql
-- 1. Verificar o UID do usuário
SELECT id, email FROM auth.users WHERE email = 'usuario@exemplo.com';

-- 2. Restaurar o payload do usuário a partir do backup
INSERT INTO public.betbank_user_data (user_id, payload, updated_at)
VALUES (
  'UUID-DO-USUARIO',
  '{"profile": {...}, "bets": [...], "transactions": [...], "goals": [...], "pausedUntil": null, "createdAt": "2026-10-25T00:00:00.000Z"}'::jsonb,
  now()
)
ON CONFLICT (user_id) DO UPDATE
SET payload = EXCLUDED.payload,
    updated_at = now();
```

### Cenário C: Corrupção Global de Migração ou Falha Catastrófica
1. **Pausar o tráfego da aplicação:** Ativar tela de manutenção ou pausar o deploy na Vercel para evitar escritas concorrentes.
2. **Restaurar snapshot no Supabase:**
   - Acesse **Database > Backups > Restore**.
   - Selecione o ponto de restauração imediatamente anterior ao incidente.
3. **Validar integridade:**
   - Rodar consulta de verificação de sanidade:
     ```sql
     SELECT count(*), max(updated_at) FROM public.betbank_user_data;
     ```
4. **Liberar tráfego:** Reativar o deploy na Vercel e notificar os usuários.

### Cenário D: Rotação Emergencial de Credenciais (Vazamento de Chaves)
Caso ocorra suspeita de comprometimento de chaves:
1. No painel Supabase (**Project Settings > API**), clicar em **Rotate API Keys** para a chave `anon`/`publishable` e redefinir o `JWT Secret`.
2. Atualizar imediatamente as variáveis `VITE_SUPABASE_PUBLISHABLE_KEY` no painel da Vercel (Production e Preview).
3. Disparar redeploy na Vercel para que o bundle do cliente receba a nova chave.
4. Notificar usuários para realizarem login novamente (já que a rotação do JWT Secret invalida tokens antigos).
