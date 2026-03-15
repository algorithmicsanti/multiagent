# Runbook: Main Branch Protection + Ready for Production

## Objetivo
Evitar pushes directos a `main`, forzar calidad mínima antes de merge/deploy y estandarizar el gate de producción.

## 1) Branch protection en GitHub (`main`)
Configurar en **Settings → Branches → Branch protection rules**:

- Branch name pattern: `main`
- ✅ Require a pull request before merging
  - ✅ Require approvals: 1 (mínimo)
  - ✅ Dismiss stale approvals when new commits are pushed
- ✅ Require status checks to pass before merging
  - Seleccionar checks:
    - `CI Predeploy / checks`
- ✅ Require branches to be up to date before merging
- ✅ Include administrators (recomendado)
- ✅ Restrict who can push to matching branches (opcional, recomendado)

## 2) GitHub Environments
### `staging`
- Opcional reviewers
- Secrets/vars de staging

### `production`
- ✅ Required reviewers (al menos 1 humano)
- ✅ Wait timer (opcional, 5-10 min)
- Secrets/vars de producción

## 3) Workflows ya preparados
- CI predeploy: `.github/workflows/ci-predeploy.yml`
- Deploy staging: `.github/workflows/deploy-staging.yml`
- Deploy production: `.github/workflows/deploy-production.yml`

## 4) Checklist “Ready for Production Deploy”
Antes de disparar `deploy-production.yml`:

1. PR merged a `main` con checks verdes.
2. `CI Predeploy` en verde para el commit objetivo.
3. Release notes/changelog actualizado.
4. Confirmar ventana de deploy y owner on-call.
5. Confirmar backups/snapshot DB recientes.
6. Confirmar estado servicios staging saludable.
7. Ejecutar workflow production con:
   - `target` correcto (`full|backend|frontend`)
   - `confirm=DEPLOY_PROD`
8. Validar smoke + error budget post-deploy.
9. Si hay incidencia: `infra/scripts/rollback-last-success.sh`.

## 5) Regla de operación
- Trabajo diario en ramas dedicadas (ej: `chore/ops-hardening-agent`).
- `main` solo por PR.
- Producción solo vía workflow con confirm + environment approval.