# Runbook: Instance Ops Baseline

## Objetivo
Tener una rutina minima para levantar, actualizar, verificar y recuperar el stack Docker local o en VPS.

## Stack esperado
- `postgres` en `5432`
- `redis` en `6379`
- `api` en `3001`
- `dashboard` en `3000`
- `orchestrator`
- `worker-research`
- `worker-promptops`

## Preflight
1. Docker socket accesible para el usuario operativo.
2. `pnpm` instalado.
3. `.env` presente en la raiz del repo.
4. `DATABASE_URL` apuntando al Postgres correcto.

## Comandos operativos
```bash
cd /home/claw/.openclaw/workspace/multiagent

# levantar o rebuild
./infra/scripts/deploy-staging.sh

# estado
./infra/scripts/check-services.sh

# health API
curl http://localhost:3001/api/v1/health

# logs recientes
./infra/scripts/check-logs.sh 150

# reinicio parcial
./infra/scripts/restart-api.sh
./infra/scripts/restart-workers.sh

# reinicio total
pnpm infra:down
pnpm infra:up
pnpm db:deploy
```

## Politica de migraciones
- `pnpm db:migrate` es solo para desarrollo local cuando se crea una migracion nueva.
- `pnpm db:deploy` es el comando correcto para OpenClaw, localhost y despliegues.

## Flujo recomendado de actualizacion
1. `git fetch --all && git pull --ff-only`
2. `pnpm install --frozen-lockfile`
3. `pnpm build && pnpm typecheck`
4. `pnpm infra:up`
5. `pnpm db:deploy`
6. `./infra/scripts/check-services.sh`
7. `./infra/scripts/check-logs.sh 200`
8. `pnpm healthcheck`

## Recuperacion rapida por sintoma
- Contenedor en restart loop:
  - revisar `docker compose -f infra/compose/docker-compose.dev.yml logs <service> --tail=200`
  - validar `.env`
  - rebuild del servicio afectado
- API sin health:
  - revisar logs de `api`
  - validar conectividad a `postgres` y `redis`
  - reiniciar `api`
- Orchestrator o workers sin procesar:
  - revisar logs de `orchestrator`, `worker-research` y `worker-promptops`
  - validar Redis y jobs pendientes
  - reiniciar workers
- Error de Docker socket:
  - `sudo usermod -aG docker $USER`
  - relogin o `newgrp docker`

## Si falla la migracion
1. Confirmar que `localhost:5432` esta accesible.
2. Confirmar que el contenedor `postgres` esta healthy.
3. Reintentar `pnpm db:deploy`.
4. Si la base no estaba arriba durante el deploy, correr la migracion despues de levantar el stack y antes de validar la app.
