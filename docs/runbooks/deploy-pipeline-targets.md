# Runbook: Deploy Pipeline por Target (frontend/backend/full)

## Objetivo
Desplegar de forma sistematizada por alcance:
- `backend` → API + orchestrator + workers + dependencias
- `frontend` → dashboard (+ api para dependencia)
- `full` → stack completo

## Scripts
- Pipeline principal: `infra/scripts/deploy-pipeline.sh`
- Compat staging: `infra/scripts/deploy-staging.sh` (llama a `full`)
- Smoke: `infra/scripts/smoke-post-deploy.sh`
- Error budget: `infra/scripts/check-errors-window.sh`
- Reglas error budget: `infra/config/log-error-budget.rules.sh`
- Rollback al último release exitoso: `infra/scripts/rollback-last-success.sh`
- Estado de releases: `infra/state/last-successful-deploy.env` + `infra/state/deploy-history.log`

## Comandos locales
```bash
# Full stack
pnpm deploy:full

# Solo backend
pnpm deploy:backend

# Solo frontend
pnpm deploy:frontend
```

## Flujo que ejecuta el pipeline
1. `pnpm install --frozen-lockfile`
2. `pnpm build`
3. `pnpm typecheck`
4. `pnpm db:migrate`
5. `docker compose up -d --build` del target
6. smoke test del target
7. error-budget de logs recientes
8. si falla y está habilitado → intento de auto-rollback

## CI/CD manual (GitHub Actions)
### Staging
Workflow: `.github/workflows/deploy-staging.yml`
- trigger: `workflow_dispatch`
- input: `target` (`full|backend|frontend`)
- runner esperado: `self-hosted, linux, staging`

### Production
Workflow: `.github/workflows/deploy-production.yml`
- trigger: `workflow_dispatch`
- inputs: `target` + `confirm`
- `confirm` debe ser exactamente `DEPLOY_PROD`
- runner esperado: `self-hosted, linux, production`
- usa `environment: production` para approval gates de GitHub

## Notas importantes
- Dashboard usa:
  - `NEXT_PUBLIC_API_URL` para navegador
  - `API_INTERNAL_URL` para SSR dentro del contenedor (`http://api:3001`)
- Ajustar patrones de logs en `infra/config/log-error-budget.rules.sh` para reducir ruido sin perder errores reales.