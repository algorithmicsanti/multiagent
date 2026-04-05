# OpenClaw Operations Manual

## Rol de OpenClaw
OpenClaw es un operador tecnico residente para Web Mentor Agent OS.
No es el orquestador central del negocio ni la fuente de verdad del sistema.
Su trabajo es inspeccionar, mantener, desplegar de forma controlada y seguir runbooks.

## Principios operativos
- Priorizar scripts del repo antes que comandos improvisados.
- Evitar acciones destructivas sin aprobacion humana.
- Diferenciar desarrollo, staging y produccion.
- Dejar trazabilidad de lo ejecutado.
- Validar salud del sistema despues de cada cambio operativo.

## Estado funcional relevante al 2026-04-04
- Existe registro formal de actores humanos y agentes.
- Una tarea puede asignarse directo a una persona, a un agente o al `Central Orchestrator`.
- El `Central Orchestrator` puede delegar al mejor humano o agente segun rol y contexto.
- Las tareas humanas quedan en `WAITING_RESULT` hasta que alguien carga el resultado desde el dashboard.
- El dashboard ya funciona mejor desde celular y escucha en `0.0.0.0`.

## Politica de migraciones
- `pnpm db:migrate` se usa solo en desarrollo local cuando alguien esta creando una migracion nueva.
- `pnpm db:deploy` es el comando correcto para OpenClaw, CI y despliegues sobre localhost o VPS.
- Si OpenClaw ejecuta `pnpm deploy:backend` o `pnpm deploy:full`, el pipeline ya corre `pnpm db:deploy` automaticamente.
- Si OpenClaw ejecuta solo `pnpm deploy:frontend`, no debe correr migraciones.
- Si el deploy fallo antes de alcanzar Postgres o si la base no estaba arriba, OpenClaw debe levantar el stack y luego correr `pnpm db:deploy` manualmente.

## Runbook base para localhost o VPS
```bash
cd /home/santiago/projects/multiagent
pnpm install --frozen-lockfile
cp -n .env.example .env
pnpm infra:up
pnpm db:deploy
pnpm healthcheck
curl http://localhost:3001/api/v1/health
./infra/scripts/check-services.sh
./infra/scripts/check-logs.sh 200
```

## Deploy por target
### Backend o Full
```bash
pnpm deploy:backend
# o
pnpm deploy:full
```
Estos targets ya incluyen migraciones con `pnpm db:deploy`.

### Frontend
```bash
pnpm deploy:frontend
```
No requiere migracion.

## Si el stack no responde
1. Confirmar puertos locales:
   - `localhost:5432` para Postgres
   - `localhost:3001` para API
2. Revisar estado Docker:
   - `docker compose -f infra/compose/docker-compose.dev.yml ps`
3. Revisar logs:
   - `docker compose -f infra/compose/docker-compose.dev.yml logs --tail=200 api orchestrator worker-research worker-promptops dashboard`
4. Si Postgres estaba abajo, levantarlo y reintentar:
   - `pnpm infra:up`
   - `pnpm db:deploy`

## Ver dashboard remoto desde celular o laptop
- Si el stack corre en la VPS y los puertos estan expuestos, abrir:
  - `http://<IP_VPS>:3000/missions`
  - `http://<IP_VPS>:3001/api/v1/health`
- Si prefieres tunel SSH:
```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 <usuario>@<IP_VPS>
```
Luego abrir `http://localhost:3000/missions`.

## Checklist minimo post-deploy
1. `curl http://localhost:3001/api/v1/health`
2. Abrir dashboard en `/missions`
3. Confirmar que lista misiones reales
4. Crear una mision o tarea y verificar eventos
5. Si la tarea fue humana, confirmar que aparece el flujo manual de cierre
