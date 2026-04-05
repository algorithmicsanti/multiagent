# Runbook: Deploy Pipeline por Target

## Objetivo
Desplegar por alcance sin mezclar pasos innecesarios:
- `backend`: API + orchestrator + workers + dependencias
- `frontend`: dashboard
- `full`: stack completo

## Scripts
- Pipeline principal: `infra/scripts/deploy-pipeline.sh`
- Compat staging: `infra/scripts/deploy-staging.sh`
- Rollback: `infra/scripts/rollback-last-success.sh`
- Smoke: `infra/scripts/smoke-post-deploy.sh`
- Error budget: `infra/scripts/check-errors-window.sh`

## Comandos locales
```bash
pnpm deploy:full
pnpm deploy:backend
pnpm deploy:frontend
```

## Politica de migraciones
- `pnpm db:migrate` queda solo para desarrollo local cuando alguien esta creando o editando una migracion nueva.
- `pnpm db:deploy` es el comando correcto para OpenClaw, CI y cualquier deploy sobre una base ya existente.

## Flujo actual del pipeline
1. `pnpm install --frozen-lockfile`
2. `pnpm build`
3. `pnpm typecheck`
4. Si el target es `backend` o `full`, correr `pnpm db:deploy`
5. Si el target es `frontend`, omitir migraciones
6. `docker compose up -d --build` del target
7. Smoke test del target
8. Revision de errores recientes
9. Si falla y esta habilitado, intento de auto-rollback

## CI/CD manual
### Staging
- Workflow: `.github/workflows/deploy-staging.yml`
- Trigger: `workflow_dispatch`
- Input: `target` (`full|backend|frontend`)
- Runner esperado: `self-hosted, linux, staging`

### Production
- Workflow: `.github/workflows/deploy-production.yml`
- Trigger: `workflow_dispatch`
- Inputs: `target` y `confirm`
- `confirm` debe ser exactamente `DEPLOY_PROD`
- Runner esperado: `self-hosted, linux, production`

## Notas
- El pipeline de backend/full ya aplica migraciones automaticamente con `pnpm db:deploy`.
- Si el deploy fue solo frontend, no hace falta tocar Prisma ni Postgres.
- Dashboard usa `NEXT_PUBLIC_API_URL` para navegador y `API_INTERNAL_URL` para SSR.
