# Runbook: Instance Ops Baseline (Docker + Recovery)

## Objetivo
Tener una rutina operativa mínima para esta instancia: levantar, actualizar, verificar y recuperar servicios del stack.

## Stack detectado
- `postgres` (`postgres:16-alpine`)
- `redis` (`redis:7-alpine`)
- `api` (`@wm/api` en puerto `3001`)
- `orchestrator` (`@wm/orchestrator`)
- `worker-research` (`@wm/worker-research`)
- `dashboard` (`@wm/dashboard` en puerto `3000`)
- Compose file: `infra/compose/docker-compose.dev.yml`

## Preflight (bloqueantes)
1. Docker socket accesible por el usuario operativo.
2. `pnpm` instalado (engine del repo: `pnpm >=9`).
3. `.env` presente en raíz del repo (`cp -n .env.example .env`).

## Comandos operativos
```bash
cd /home/claw/.openclaw/workspace/multiagent

# levantar/rebuild
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
pnpm infra:down && pnpm infra:up
```

## Flujo de actualización recomendado
1. `git fetch --all && git pull --ff-only`
2. `pnpm install --frozen-lockfile`
3. `pnpm build && pnpm typecheck`
4. `pnpm db:migrate`
5. `docker compose -f infra/compose/docker-compose.dev.yml up -d --build`
6. `./infra/scripts/check-services.sh`
7. `./infra/scripts/check-logs.sh 200`

## Recuperación rápida por síntoma
- **Contenedor en restart loop**
  - `docker compose -f infra/compose/docker-compose.dev.yml logs <service> --tail=200`
  - validar variables en `.env`
  - rebuild del servicio afectado

- **API sin health (`/api/v1/health`)**
  - revisar `api` logs
  - validar conectividad a `postgres` y `redis`
  - reiniciar `api`

- **Orchestrator/worker sin procesar**
  - revisar logs de `orchestrator` y `worker-research`
  - inspeccionar Redis (`keys bull:agent:*`)
  - reiniciar workers

- **Error Docker socket permission denied**
  - `sudo usermod -aG docker $USER`
  - relogin (o `newgrp docker`)

## Notas de esta instancia (2026-03-15)
- Desde esta sesión no hay acceso a Docker daemon (socket denied).
- Tampoco hay `pnpm` disponible en PATH.
- Sin esos dos puntos no se puede ejecutar deploy/healthchecks end-to-end desde aquí.
