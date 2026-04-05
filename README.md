# Web Mentor Agent OS

Sistema operativo de agentes para Web Mentor.

Este repositorio contiene la arquitectura base para construir un sistema de agentes persistente, auditable y desplegable en una VPS. El objetivo es operar una "mente maestra" que reciba misiones de negocio, las descomponga, las delegue a subagentes especializados y mantenga continuidad de trabajo 24/7 con estado persistente, memoria y observabilidad.

Este documento cumple dos funciones:

1. Ser el README fundacional del repositorio.
2. Servir como prompt/contexto maestro para un modelo como Opus 4.6 que vaya a planear e implementar el sistema.

---


## Estado actual del repositorio (actualizado: 2026-03-15)

Base funcional en `main` + hardening operativo reciente para poder levantar y mantener la instancia de forma estable.

### Lo ya consolidado

- Monorepo TypeScript con `pnpm workspace` + `turbo`
- `apps/api` (Fastify + rutas iniciales)
- `apps/dashboard` (Next.js con vistas de misiones/tareas/aprobaciones)
- `services/orchestrator` (planner/dispatcher/state machine)
- `services/worker-research`
- `packages/agent-core`, `packages/db` (Prisma), `packages/observability`
- Infra local (`docker-compose.dev`, Dockerfiles, scripts operativos)

### Avance funcional 2026-04-04 (actores, tareas humanas y mÃ³vil)

- Se introdujo un **registro formal de actores**:
  - humanos iniciales: `Nicholas`, `Kevin`, `Santiago`, `Germán`
  - agentes visibles/asignables: `Research Agent`, `PromptOps Agent`, `Frontend Specialist Agent`, `Backend Specialist Agent`, `DevOps Specialist Agent`
  - actor especial: `Central Orchestrator`
- Cada actor ahora tiene:
  - `role`
  - `context`
  - `supportedAgentTypes`
  - capacidad de asignaciÃ³n directa o de delegaciÃ³n
- Las `Task` ahora soportan:
  - `assignmentMode = DIRECT | ORCHESTRATOR`
  - `requestedActorId`
  - `resolvedActorId`
  - `assignmentReason`
  - `actorSnapshot`
- Ya existe flujo completo para **tareas humanas**:
  - una tarea puede asignarse directamente a una persona
  - el orquestador central puede delegarla al mejor humano/agente
  - cuando una tarea queda en humano, el sistema la mueve a `WAITING_RESULT`
  - el resultado humano puede cerrarse desde dashboard con submit manual
- El dashboard ahora soporta:
  - crear tareas nuevas dentro de una misiÃ³n
  - escoger ejecutor humano/agente/orquestador
  - ver actor solicitado y actor resuelto por tarea
  - completar tareas humanas desde la vista de detalle
- Se reforzÃ³ el acceso desde celular:
  - `next dev` y `next start` corren en `0.0.0.0`
  - se agregÃ³ `viewport` explÃ­cito
  - los fetches client-side ya no dependen rÃ­gidamente de `localhost`; resuelven el hostname activo del navegador para hablar con `:3001`
- Se aÃ±adiÃ³ migraciÃ³n Prisma:
  - `packages/db/prisma/migrations/20260404_actor_registry_and_task_assignment/`

Regla de migraciones:
- `pnpm db:migrate` solo para desarrollo local cuando se esta creando o editando una migracion
- `pnpm db:deploy` para OpenClaw, CI, localhost con Docker y cualquier despliegue o reinicio operacional

### Avances operativos 2026-03-15 (importante para Copilot)

- Se resolviÃ³ el arranque de contenedores que fallaba por mÃ³dulos workspace no compilados en runtime Docker.
  - Fix aplicado: build explÃ­cito de `@wm/db`, `@wm/agent-core`, `@wm/observability` durante la imagen de `api` y `service`.
- Se resolviÃ³ error de BullMQ por nombre de cola invÃ¡lido (`Queue name cannot contain :`).
  - Fix aplicado: colas renombradas de `agent:*` a `agent-*`.
- Se ajustÃ³ tipado en `packages/observability` para compatibilidad Prisma (`InputJsonValue`) y dependencia explÃ­cita de `@wm/db`.
- Se validÃ³ health real del stack:
  - `GET /api/v1/health` devuelve `status=ok, db=ok, redis=ok`.
- Se incorporÃ³ runbook operativo de instancia:
  - `docs/runbooks/instance-ops-baseline.md`.
- Se aÃ±adiÃ³ smoke test post-deploy configurable por target:
  - `infra/scripts/smoke-post-deploy.sh`.
- Se aÃ±adiÃ³ check de errores recientes (error-budget con filtros por servicio + hard-fail patterns):
  - `infra/scripts/check-errors-window.sh`.
- Reglas de error-budget externalizadas para tuning sin tocar script:
  - `infra/config/log-error-budget.rules.sh`
  - permite ajustar `SERVICES`, `BASE_ERROR_REGEX`, `GLOBAL_IGNORE_REGEX`, `SERVICE_IGNORE_REGEX`, `SERVICE_HARD_FAIL_REGEX`.
- Se creÃ³ pipeline de deploy unificado por target:
  - `infra/scripts/deploy-pipeline.sh [full|backend|frontend]`
  - wrappers npm: `pnpm deploy:full`, `pnpm deploy:backend`, `pnpm deploy:frontend`
  - `deploy-staging.sh` queda como compat wrapper hacia `full`.
- CI manual de deploy para staging:
  - `.github/workflows/deploy-staging.yml` (workflow_dispatch con input `target`, pre-checks de build/typecheck y ejecuciÃ³n en runner `self-hosted,linux,staging`).
- CI manual de deploy para producciÃ³n con confirm explÃ­cita:
  - `.github/workflows/deploy-production.yml` (`confirm=DEPLOY_PROD`, pre-checks de build/typecheck, runner `self-hosted,linux,production`, `environment: production`).
- CI de predeploy para PR/manual:
  - `.github/workflows/ci-predeploy.yml`.
- Runbook operativo del pipeline por target:
  - `docs/runbooks/deploy-pipeline-targets.md`.
- Runbook de protecciÃ³n de `main` + checklist de producciÃ³n:
  - `docs/runbooks/main-branch-protection-checklist.md`.
- Estado y trazabilidad de deploy guardados por script:
  - `infra/state/last-successful-deploy.env`
  - `infra/state/deploy-history.log`
  - rollback dirigido al Ãºltimo release exitoso: `infra/scripts/rollback-last-success.sh`.
- Fix de conectividad SSR del dashboard en Docker:
  - `API_INTERNAL_URL=http://api:3001` para llamadas server-side.
- GuÃ­a explÃ­cita para levantar DEV en VPS y ver dashboard en tiempo real:
  - `openclaw.md` secciÃ³n **16.5 Runbook de levantar DEV en VPS**.
- Se removiÃ³ `version:` del compose dev para evitar warning de deprecaciÃ³n en Docker Compose v2.

### Para Copilot / OperaciÃ³n diaria: cÃ³mo ver backend + agentes en tiempo real desde dashboard

Objetivo: que cualquier operador (o Copilot) pueda levantar el entorno DEV y observar en vivo el comportamiento de API/orchestrator/workers desde `localhost:3000`.

#### Levantar DEV completo
```bash
cd /home/santiago/projects/multiagent
pnpm install --frozen-lockfile
cp -n .env.example .env
pnpm infra:up
pnpm db:deploy
```

#### Verificar salud mÃ­nima
```bash
curl http://localhost:3001/api/v1/health
./infra/scripts/check-services.sh
./infra/scripts/check-logs.sh 120
```

#### Abrir dashboard (tiempo real)
- Dashboard: `http://localhost:3000/missions`
- API health: `http://localhost:3001/api/v1/health`

#### Novedades UI operativas (dashboard)

Se agregaron controles y comportamiento nuevos para operaciÃ³n diaria:

1. BotÃ³n `RESET MISSIONS` en la vista de misiones:
   - Borra todas las misiones y sus dependencias (tasks, runs, approvals, artifacts, events).
   - Endpoints soportados:
     - Real API: `DELETE /api/v1/missions`
     - Mock API: `DELETE /api/v1/missions`
2. Hover de misiÃ³n simplificado:
   - Solo muestra `CREATED`, un mini diagrama de pipeline y `NOW` (estado actual).
3. Vista de detalle al hacer click:
   - Si la misiÃ³n estÃ¡ `DONE`, se muestra primero `FINAL RESULT`.
   - Debajo quedan los detalles tÃ©cnicos (tasks, eventos, artefactos).
4. CreaciÃ³n de tareas dentro de la misiÃ³n:
   - Ruta nueva: `/missions/:id/tasks/new`
   - Permite escoger:
     - un humano (`Nicholas`, `Kevin`, `Santiago`, `Germán`)
     - un agente
     - `Central Orchestrator` para delegaciÃ³n inteligente
5. Cierre manual de tareas humanas:
   - Si una tarea fue resuelta hacia un actor humano, la vista `/missions/:id/tasks/:taskId` muestra formulario para enviar el resultado final y cerrar la tarea.

#### QuÃ© observar para confirmar que backend/agentes estÃ¡n trabajando
1. En dashboard (`/missions`), cambios de estado de misiones/tareas.
2. En logs de API, requests desde dashboard (`GET /api/v1/missions`, etc.).
3. En logs de orchestrator, polling/dispatch de trabajo.
4. En logs de workers, consumo de cola y ejecuciÃ³n (`Job received/completed`).
5. Si una tarea especializada no tiene worker dedicado, debe verse reruteada a `PROMPTOPS` en lugar de quedarse estancada en `ENQUEUED`.

#### Worker de eficiencia y optimizaciÃ³n

Ahora existe un worker adicional:

- `worker-promptops`

Responsabilidad:
- optimizar uso de cÃ³mputo, secuencia de pasos y reutilizaciÃ³n de agentes
- preservar pasos necesarios, no eliminarlos
- absorber temporalmente tareas especializadas cuando no exista aÃºn un worker dedicado (`BACKEND`, `FRONTEND`, `DEVOPS`, etc.)
- proponer estrategia de ejecuciÃ³n efectiva con menor desperdicio de recursos

Comando local/manual:
```bash
pnpm worker:promptops
```

Comando recomendado para monitoreo en vivo:
```bash
docker compose -f infra/compose/docker-compose.dev.yml logs -f api orchestrator worker-research worker-promptops dashboard
```

Si accedes remoto por SSH, usar tÃºnel:
```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 <usuario>@<IP_VPS>
```
Luego abrir en tu mÃ¡quina local `http://localhost:3000/missions`.

#### Runbook exacto para OpenClaw: pasar de mock a real (sin ambigÃ¼edad)

Este bloque es el procedimiento operativo que OpenClaw debe ejecutar en terminal para dejar de usar `mock-api.mjs` y operar contra el stack real.

Precondiciones:
- Docker y Docker Compose disponibles en la VPS.
- Repositorio en `/home/santiago/projects/multiagent`.
- `.env` creado desde `.env.example` con `ANTHROPIC_API_KEY` real.

Comandos (copiar/pegar en este orden):
```bash
cd /home/santiago/projects/multiagent

# 1) Asegurar dependencias
pnpm install --frozen-lockfile

# 2) Preparar entorno (si falta)
cp -n .env.example .env

# 3) DETENER cualquier mock activo
pkill -f "node mock-api.mjs" || true

# 4) Levantar infraestructura real
pnpm infra:up

# 5) Ejecutar migraciones
pnpm db:deploy

# 6) Verificar salud del backend real
pnpm healthcheck
curl -s http://localhost:3001/api/v1/health

# 7) Verificar que orquestador y worker estÃ¡n vivos
./infra/scripts/check-services.sh
./infra/scripts/check-logs.sh 120

# 8) Monitoreo en vivo (api + orchestrator + workers + dashboard)
pnpm infra:logs
```

ValidaciÃ³n funcional obligatoria (sin mock):
1. Abrir `http://localhost:3000/missions`.
2. Crear una misiÃ³n nueva desde el dashboard.
3. Confirmar transiciÃ³n de estado (`NEW` -> `PLANNING` -> `DISPATCHING/RUNNING`).
4. Confirmar en logs de worker mensajes tipo `Job received` y `Job completed`.
5. Si el planner pidiÃ³ un agente sin worker dedicado, confirmar que la tarea aparece ejecutada por `PROMPTOPS` y no queda atascada solo en `ENQUEUED`.

Si algo falla, OpenClaw debe ejecutar este diagnÃ³stico mÃ­nimo:
```bash
./infra/scripts/check-services.sh
./infra/scripts/check-logs.sh 200
docker compose -f infra/compose/docker-compose.dev.yml logs --tail=200 api orchestrator worker-research
docker compose -f infra/compose/docker-compose.dev.yml logs --tail=200 worker-promptops
```

Regla operativa:
- `mock-api.mjs` solo se usa para demos locales sin Docker.
- En VPS con Docker, el modo correcto es siempre `pnpm infra:up` + `pnpm db:deploy`.

#### Runbook para OpenClaw: si el dashboard local no refleja las misiones reales

SÃ­ntoma tÃ­pico:
- OpenClaw crea misiones reales y en logs de `api` / `orchestrator` se ve `Planning mission...` y creaciÃ³n de `Task`.
- Pero en `http://localhost:3000/missions` no aparecen esas misiones o aparece otra lista distinta.
- Los indicadores del dashboard muestran `API` verde pero `DB` y `QUEUE` no coinciden con el estado esperado.

Causa raÃ­z mÃ¡s probable:
- El dashboard local estÃ¡ apuntando a un backend distinto al de OpenClaw/VPS.
- Normalmente ocurre porque no se configurÃ³ `NEXT_PUBLIC_API_URL` / `API_INTERNAL_URL` con la URL real.
- TambiÃ©n puede pasar si el operador tiene un `mock-api.mjs` local en el puerto `3001`.

CÃ³mo debe diagnosticar OpenClaw:
```bash
cd /home/santiago/projects/multiagent

# 1) Ver quÃ© endpoint usa el dashboard local
grep -n "NEXT_PUBLIC_API_URL\|API_INTERNAL_URL" .env || true

# 2) Ver si localhost:3001 responde algo tipo mock
curl -s http://localhost:3001/api/v1/health
curl -s http://localhost:3001/api/v1/missions
```

InterpretaciÃ³n del diagnÃ³stico:
- Si `/api/v1/health` devuelve `db: "ok (mock)"` o `redis: "ok (mock)"`, la UI local estÃ¡ leyendo el mock.
- Si la lista de `/api/v1/missions` no coincide con lo que se ve en logs de Docker, la UI estÃ¡ apuntando al backend equivocado.
- Si faltan `NEXT_PUBLIC_API_URL` / `API_INTERNAL_URL`, el dashboard fallarÃ¡ explÃ­citamente (ya no hay fallback silencioso).

CorrecciÃ³n obligatoria que OpenClaw debe aplicar:
1. Detener cualquier `mock-api.mjs` local.
2. Configurar explÃ­citamente el dashboard para leer la API real.
3. Reiniciar el dashboard para que cargue el `.env` nuevo.

Caso A: usar la API real expuesta directamente por la VPS
```bash
cd /home/santiago/projects/multiagent

# Detener mock local si existe
pkill -f "node mock-api.mjs" || true

# Configurar dashboard para apuntar al backend real
sed -i '/^NEXT_PUBLIC_API_URL=/d' .env
sed -i '/^API_INTERNAL_URL=/d' .env
echo 'NEXT_PUBLIC_API_URL=http://<IP_O_DOMINIO_VPS>:3001' >> .env
echo 'API_INTERNAL_URL=http://<IP_O_DOMINIO_VPS>:3001' >> .env

# Reiniciar dashboard local si corre fuera de Docker
pkill -f "next dev" || true
pnpm --filter @wm/dashboard dev
```

Ejemplo real actual de esta operaciÃ³n:
```bash
echo 'NEXT_PUBLIC_API_URL=http://93.188.160.48:3001' >> .env
echo 'API_INTERNAL_URL=http://93.188.160.48:3001' >> .env
```

Caso B: usar tÃºnel SSH y mantener `localhost:3001`
```bash
# En la mÃ¡quina local del operador
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 <usuario>@<IP_VPS>
```

Luego OpenClaw debe asegurar que NO quede mock corriendo en local:
```bash
pkill -f "node mock-api.mjs" || true
curl -s http://localhost:3001/api/v1/health
```

ValidaciÃ³n final que OpenClaw debe hacer:
```bash
curl -s http://localhost:3001/api/v1/health
curl -s http://localhost:3001/api/v1/missions
```

Resultado esperado:
1. El health ya no debe contener `ok (mock)`.
2. La lista de misiones debe coincidir con lo que aparece en logs de `api` y `orchestrator`.
3. El dashboard local debe reflejar las misiones reales creadas por OpenClaw.

#### Frontend local: comandos exactos para correr contra OpenClaw remoto

Ejecutar en la mÃ¡quina local del operador (Windows/Powershell):

```powershell
cd C:\Users\germa\Documents\GitHub\multiagent

# 1) Asegurar dependencias
pnpm install

# 2) Configurar URL remota de API (OpenClaw VPS)
# En .env deben existir estas dos lÃ­neas:
# NEXT_PUBLIC_API_URL=http://93.188.160.48:3001
# API_INTERNAL_URL=http://93.188.160.48:3001

# 3) Levantar frontend
pnpm --filter @wm/dashboard dev

# 4) Abrir
# http://localhost:3000/missions
```

Checklist rÃ¡pido si no ves cambios:
1. Reiniciar `pnpm --filter @wm/dashboard dev` despuÃ©s de cambiar `.env`.
2. Verificar `http://93.188.160.48:3001/api/v1/health` responde `status=ok`.
3. Confirmar que NO hay `mock-api.mjs` corriendo local en `3001`.

Nota importante:
- Que `DB` y `QUEUE` se vean en rojo en la UI local no explica por sÃ­ solo la ausencia de misiones.
- El problema crÃ­tico es a quÃ© backend estÃ¡ apuntando el dashboard.
- Primero corregir el endpoint. Luego, si hace falta, revisar el rendering del health.

### PolÃ­tica de ramas operativas (evitar choques con Copilot)

Desde este punto, los cambios operativos/manuales del agente se desarrollan en rama dedicada:

- Rama activa del agente: `chore/ops-hardening-agent`
- `main` se mantiene como rama de integraciÃ³n estable para evitar colisiones con Copilot/automatizaciones.
- Flujo recomendado: trabajar en rama dedicada -> PR/review -> merge a `main`. 

### Estrategia de trabajo en paralelo (para evitar choques)

Mientras continÃºan features en API/orchestrator/dashboard, se recomienda que contribuciones paralelas se enfoquen en ejes de bajo conflicto:

1. **Testing + CI/CD bÃ¡sico**
   - pruebas unitarias y smoke tests
   - pipeline de lint/test/build en PR
   - checks mÃ­nimos de calidad antes de merge

2. **Contratos y tipado compartido**
   - endurecer tipos en `packages/agent-core`
   - validaciones consistentes de payloads
   - versionado de contratos entre orchestrator/workers

3. **Observabilidad operativa mÃ­nima**
   - logging estructurado consistente
   - correlaciÃ³n por `missionId/taskId`
   - eventos base para debugging y auditorÃ­a

4. **Runbooks y documentaciÃ³n operativa aterrizada**
   - alinear docs con la implementaciÃ³n real (no solo visiÃ³n)
   - procedimientos de staging, healthchecks y rollback

### ConvenciÃ³n de ramas sugerida

- Trabajo de base/plataforma: `chore/*`, `docs/*`, `test/*`, `ci/*`
- Features de producto: `feature/*`
- Fixes puntuales: `fix/*`

Regla prÃ¡ctica: evitar tocar simultÃ¡neamente archivos nÃºcleo de lÃ³gica (`services/orchestrator/*`, `apps/api/src/routes/*`) desde mÃºltiples ramas sin coordinaciÃ³n explÃ­cita.

---

# 1. VisiÃ³n

Queremos construir un sistema donde:

- exista un *orquestador maestro*
- existan *subagentes especializados*
- el sistema pueda recibir Ã³rdenes desde un *dashboard* y eventualmente por *voz*
- el sistema pueda mantener contexto de largo plazo
- el sistema pueda continuar trabajo aunque un proceso falle o la VPS se reinicie
- el sistema pueda modificar repositorios, investigar documentaciÃ³n, analizar frontend, backend, DevOps y prompts
- el sistema pueda operar con *aprobaciones humanas* cuando una acciÃ³n sea sensible
- el sistema pueda vivir en una *VPS propia*
- el sistema sea un activo propio de Web Mentor, no dependiente de un framework externo como nÃºcleo del negocio

La arquitectura debe priorizar:

- persistencia
- trazabilidad
- control
- separaciÃ³n de responsabilidades
- seguridad
- despliegue pragmÃ¡tico
- capacidad de evolucionar a SaaS en el futuro

---

# 2. Principio arquitectÃ³nico central

No vamos a construir un sistema basado en un "prompt infinito" o en agentes hablÃ¡ndose sin control.

Vamos a construir un sistema basado en:

- *estado persistente*
- *eventos*
- *cola de trabajos*
- *workers especializados*
- *orquestaciÃ³n explÃ­cita*
- *guardrails*
- *dashboard de control*
- *checkpoints*
- *aprobaciones*

Es decir:

*no conversaciÃ³n infinita*  
*sÃ­ sistema de ejecuciÃ³n durable*

---

# 3. QuÃ© es y quÃ© no es OpenClaw dentro de esta arquitectura

## OpenClaw sÃ­ puede servir para:

- operar desde la VPS
- inspeccionar archivos
- correr comandos
- ayudar en mantenimiento
- preparar cambios
- revisar logs
- actuar como operador tÃ©cnico
- ejecutar workflows auxiliares
- servir como interfaz agentic experimental

## OpenClaw no serÃ¡:

- el producto central
- el orquestador maestro definitivo del negocio
- la Ãºnica memoria del sistema
- la Ãºnica capa de ejecuciÃ³n
- la fuente de verdad del estado del sistema

## DecisiÃ³n arquitectÃ³nica

El sistema principal serÃ¡ *un repositorio nuevo* y *un runtime propio*.

OpenClaw, si se utiliza, serÃ¡ un *agente operador/maintainer* dentro de la VPS, no el corazÃ³n del negocio.

---

# 4. Arquitectura general

## Componentes

1. *Dashboard*
   - interfaz visual del sistema
   - input por texto
   - futuro input por voz
   - timeline de eventos
   - visualizaciÃ³n de tareas, agentes, errores, aprobaciones y costos

2. *API central*
   - recibe misiones
   - administra autenticaciÃ³n
   - expone endpoints
   - sirve estado al dashboard
   - abre websocket o SSE para tiempo real

3. *Orchestrator*
   - recibe una misiÃ³n
   - la convierte en plan
   - crea tareas
   - encola trabajos
   - revisa resultados
   - decide siguiente paso
   - pausa o solicita aprobaciÃ³n cuando sea necesario

4. *Workers / Subagentes*
   - research
   - frontend
   - backend
   - devops
   - promptops
   - futuros especialistas

5. *Queue*
   - distribuye trabajos
   - controla retries
   - controla delays
   - evita ejecuciÃ³n duplicada
   - desacopla al orquestador de los workers

6. *Postgres*
   - guarda estado persistente
   - guarda misiones, tareas, runs, eventos, artifacts, aprobaciones, presupuestos, resultados

7. *Redis*
   - cola de trabajos
   - locks
   - estado efÃ­mero de ejecuciÃ³n
   - coordinaciÃ³n rÃ¡pida entre procesos

8. *Storage de artifacts*
   - logs
   - reportes
   - diffs
   - archivos generados
   - capturas
   - resultados de anÃ¡lisis

9. *Observabilidad*
   - logs estructurados
   - mÃ©tricas
   - errores
   - health checks
   - auditorÃ­a

---

# 5. Diagrama de alto nivel

```txt
[Usuario / Voz / Dashboard]
            |
            v
        [API Central]
            |
            v
      [Orchestrator]
            |
            v
      [Queue / Redis]
      /      |      \
     v       v       v
[Research] [Frontend] [Backend]
   Worker    Worker     Worker
      \       |       /
       \      |      /
            v
        [Postgres]
            |
            v
     [Events / Artifacts]
            |
            v
        [Dashboard_

6. Diagrama de roles
Repositorio = cÃ³digo fuente del sistema
VPS = infraestructura donde corre el sistema
Runtime = procesos vivos 24/7
OpenClaw = operador tÃ©cnico opcional dentro de la VPS
Claude/Opus = asistentes de desarrollo/planeaciÃ³n para construir el sistema

# Web Mentor Agent OS

Sistema operativo de agentes para Web Mentor.

Este repositorio contiene la arquitectura base para construir un sistema de agentes persistente, auditable y desplegable en una VPS. El objetivo es operar una "mente maestra" que reciba misiones de negocio, las descomponga, las delegue a subagentes especializados y mantenga continuidad de trabajo 24/7 con estado persistente, memoria y observabilidad.

Este documento cumple dos funciones:

1. Ser el README fundacional del repositorio.
2. Servir como prompt/contexto maestro para un modelo como Opus 4.6 que vaya a planear e implementar el sistema.

---

# 1. VisiÃ³n

Queremos construir un sistema donde:

- exista un **orquestador maestro**
- existan **subagentes especializados**
- el sistema pueda recibir Ã³rdenes desde un **dashboard** y eventualmente por **voz**
- el sistema pueda mantener contexto de largo plazo
- el sistema pueda continuar trabajo aunque un proceso falle o la VPS se reinicie
- el sistema pueda modificar repositorios, investigar documentaciÃ³n, analizar frontend, backend, DevOps y prompts
- el sistema pueda operar con **aprobaciones humanas** cuando una acciÃ³n sea sensible
- el sistema pueda vivir en una **VPS propia**
- el sistema sea un activo propio de Web Mentor, no dependiente de un framework externo como nÃºcleo del negocio

La arquitectura debe priorizar:

- persistencia
- trazabilidad
- control
- separaciÃ³n de responsabilidades
- seguridad
- despliegue pragmÃ¡tico
- capacidad de evolucionar a SaaS en el futuro

---

# 2. Principio arquitectÃ³nico central

No vamos a construir un sistema basado en un "prompt infinito" o en agentes hablÃ¡ndose sin control.

Vamos a construir un sistema basado en:

- **estado persistente**
- **eventos**
- **cola de trabajos**
- **workers especializados**
- **orquestaciÃ³n explÃ­cita**
- **guardrails**
- **dashboard de control**
- **checkpoints**
- **aprobaciones**

Es decir:

**no conversaciÃ³n infinita**  
**sÃ­ sistema de ejecuciÃ³n durable**

---

# 3. QuÃ© es y quÃ© no es OpenClaw dentro de esta arquitectura

## OpenClaw sÃ­ puede servir para:

- operar desde la VPS
- inspeccionar archivos
- correr comandos
- ayudar en mantenimiento
- preparar cambios
- revisar logs
- actuar como operador tÃ©cnico
- ejecutar workflows auxiliares
- servir como interfaz agentic experimental

## OpenClaw no serÃ¡:

- el producto central
- el orquestador maestro definitivo del negocio
- la Ãºnica memoria del sistema
- la Ãºnica capa de ejecuciÃ³n
- la fuente de verdad del estado del sistema

## DecisiÃ³n arquitectÃ³nica

El sistema principal serÃ¡ **un repositorio nuevo** y **un runtime propio**.

OpenClaw, si se utiliza, serÃ¡ un **agente operador/maintainer** dentro de la VPS, no el corazÃ³n del negocio.

---

# 4. Arquitectura general

## Componentes

1. **Dashboard**
   - interfaz visual del sistema
   - input por texto
   - futuro input por voz
   - timeline de eventos
   - visualizaciÃ³n de tareas, agentes, errores, aprobaciones y costos

2. **API central**
   - recibe misiones
   - administra autenticaciÃ³n
   - expone endpoints
   - sirve estado al dashboard
   - abre websocket o SSE para tiempo real

3. **Orchestrator**
   - recibe una misiÃ³n
   - la convierte en plan
   - crea tareas
   - encola trabajos
   - revisa resultados
   - decide siguiente paso
   - pausa o solicita aprobaciÃ³n cuando sea necesario

4. **Workers / Subagentes**
   - research
   - frontend
   - backend
   - devops
   - promptops
   - futuros especialistas

5. **Queue**
   - distribuye trabajos
   - controla retries
   - controla delays
   - evita ejecuciÃ³n duplicada
   - desacopla al orquestador de los workers

6. **Postgres**
   - guarda estado persistente
   - guarda misiones, tareas, runs, eventos, artifacts, aprobaciones, presupuestos, resultados

7. **Redis**
   - cola de trabajos
   - locks
   - estado efÃ­mero de ejecuciÃ³n
   - coordinaciÃ³n rÃ¡pida entre procesos

8. **Storage de artifacts**
   - logs
   - reportes
   - diffs
   - archivos generados
   - capturas
   - resultados de anÃ¡lisis

9. **Observabilidad**
   - logs estructurados
   - mÃ©tricas
   - errores
   - health checks
   - auditorÃ­a

---

# 5. Diagrama de alto nivel

```txt
[Usuario / Voz / Dashboard]
            |
            v
        [API Central]
            |
            v
      [Orchestrator]
            |
            v
      [Queue / Redis]
      /      |      \
     v       v       v
[Research] [Frontend] [Backend]
   Worker    Worker     Worker
      \       |       /
       \      |      /
            v
        [Postgres]
            |
            v
     [Events / Artifacts]
            |
            v
        [Dashboard]

6. Diagrama de roles
Repositorio = cÃ³digo fuente del sistema
VPS = infraestructura donde corre el sistema
Runtime = procesos vivos 24/7
OpenClaw = operador tÃ©cnico opcional dentro de la VPS
Claude/Opus = asistentes de desarrollo/planeaciÃ³n para construir el sistema

7. Modelo conceptual correcto
El repo

Es donde vive el cÃ³digo.

El runtime

Es lo que realmente corre 24/7.

El orquestador

Es el director operativo.

Los subagentes

Son workers especializados.

OpenClaw

Es un operador residente Ãºtil, no el sistema mismo.

Claude / Opus

Son herramientas para ayudarnos a construir y evolucionar el sistema.

8. Modelo de ejecuciÃ³n

El sistema debe funcionar asÃ­:

el usuario crea una misiÃ³n desde dashboard o voz

la API registra la misiÃ³n

el orquestador la analiza

el orquestador construye un plan

el orquestador crea tareas

las tareas se encolan

los workers toman sus tareas

cada worker ejecuta su parte

cada worker devuelve resultado estructurado

el orquestador revisa resultados

el orquestador decide:

continuar

delegar otra tarea

pedir aprobaciÃ³n

reintentar

cerrar la misiÃ³n

el dashboard muestra todo en tiempo real

9. Lo que NO vamos a hacer

No vamos a:

depender de cron para "revivir prompts"

hacer agentes platicando sin fin solo por estar vivos

confiar solo en historial conversacional para recordar estado

dejar que un agente modifique producciÃ³n sin guardrails

dejar que el sistema se autodegrade por autoediciÃ³n sin control

construir toda la lÃ³gica alrededor de una sola sesiÃ³n agentic

10. Monorepo propuesto
webmentor-agent-os/
â”œâ”€ apps/
â”‚  â”œâ”€ dashboard/              # Next.js dashboard
â”‚  â””â”€ api/                    # API central / realtime / auth
â”‚
â”œâ”€ services/
â”‚  â”œâ”€ orchestrator/           # motor de planeaciÃ³n y decisiÃ³n
â”‚  â”œâ”€ scheduler/              # tareas programadas
â”‚  â”œâ”€ worker-research/        # investigaciÃ³n y documentaciÃ³n
â”‚  â”œâ”€ worker-frontend/        # UI/UX/frontend specialist
â”‚  â”œâ”€ worker-backend/         # API/DB/backend specialist
â”‚  â”œâ”€ worker-devops/          # infra/deploy/ops specialist
â”‚  â””â”€ worker-promptops/       # mejora de prompts, rÃºbricas y handoffs
â”‚
â”œâ”€ packages/
â”‚  â”œâ”€ agent-core/             # tipos, contratos, estados, eventos
â”‚  â”œâ”€ prompts/                # prompts versionados
â”‚  â”œâ”€ skills/                 # skills por agente
â”‚  â”œâ”€ memory/                 # adapters para memoria y retrieval
â”‚  â”œâ”€ integrations/           # github, slack, whatsapp, email, etc.
â”‚  â”œâ”€ db/                     # esquemas, migraciones, seeds
â”‚  â””â”€ observability/          # logging, tracing, metrics
â”‚
â”œâ”€ infra/
â”‚  â”œâ”€ docker/                 # Dockerfiles
â”‚  â”œâ”€ compose/                # docker-compose
â”‚  â”œâ”€ nginx/                  # reverse proxy config
â”‚  â”œâ”€ scripts/                # deploy, backup, healthcheck
â”‚  â””â”€ systemd/                # units opcionales
â”‚
â”œâ”€ docs/
â”‚  â”œâ”€ architecture/
â”‚  â”œâ”€ runbooks/
â”‚  â”œâ”€ decisions/
â”‚  â””â”€ product/
â”‚
â”œâ”€ .env.example
â”œâ”€ pnpm-workspace.yaml
â”œâ”€ turbo.json
â”œâ”€ package.json
â””â”€ README.md
11. Stack recomendado
Base

TypeScript

Node.js

pnpm

monorepo con Turborepo

Frontend

Next.js

Backend/API

Fastify o NestJS

preferencia inicial: Fastify si queremos velocidad y menos peso

NestJS si queremos mÃ¡s estructura de enterprise

Base de datos

PostgreSQL

Cola

Redis + BullMQ

Tiempo real

WebSocket o SSE

ORM

Prisma o Drizzle

preferencia inicial: Prisma si buscamos rapidez operativa

Auth

Auth.js, Clerk o auth propia

decisiÃ³n final depende de si esto serÃ¡ interno o SaaS

Observabilidad

logs JSON estructurados

Sentry o alternativa

OpenTelemetry en fase posterior

Infra

Docker Compose inicialmente

PM2 o systemd para supervisiÃ³n

Nginx o Caddy como reverse proxy

12. Por quÃ© no usar cron como motor principal

Cron no es el cerebro del sistema. Solo sirve para disparar cosas por horario.

Se puede usar para:

backups

limpieza

resÃºmenes diarios

health checks

tareas recurrentes simples

No se debe usar para:

revivir prompts

simular persistencia

reconstruir continuidad del sistema

La persistencia debe venir de:

base de datos

cola

event log

checkpoints

artifacts

estado explÃ­cito

13. MÃ¡quina de estados de misiÃ³n

Cada misiÃ³n debe existir como una entidad persistente.

Estados propuestos:

NEW
PLANNING
DISPATCHING
RUNNING
WAITING_RESULT
REVIEWING
WAITING_APPROVAL
BLOCKED
FAILED
DONE
CANCELLED

Cada transiciÃ³n debe registrar evento.

14. Event-driven architecture mÃ­nima

Cada acciÃ³n importante debe crear eventos.

Ejemplos:

MISSION_CREATED
MISSION_UPDATED
PLAN_GENERATED
TASK_CREATED
TASK_ENQUEUED
TASK_STARTED
TASK_COMPLETED
TASK_FAILED
TASK_RETRIED
APPROVAL_REQUESTED
APPROVAL_GRANTED
APPROVAL_REJECTED
ARTIFACT_CREATED
DEPLOY_REQUESTED
DEPLOY_COMPLETED
DEPLOY_FAILED

Esto permite:

auditorÃ­a

reconstrucciÃ³n de contexto

visualizaciÃ³n en dashboard

reanudar ejecuciÃ³n

debugging serio

15. Persistencia y memoria
Fuente de verdad principal

Postgres.

QuÃ© se guarda en Postgres

missions

mission_steps

tasks

task_runs

agents

agent_skills

event_log

approvals

budgets

artifacts metadata

prompt_versions

repositories

environments

deployment_runs

QuÃ© se guarda en Redis

jobs

locks

scheduled delays

estado temporal

QuÃ© se guarda como artifacts

reportes markdown

anÃ¡lisis

diffs

snapshots

archivos generados

resultados de investigaciÃ³n

logs exportables

Memoria semÃ¡ntica futura

Podemos agregar un vector store despuÃ©s para:

documentaciÃ³n del sistema

decisiones previas

runbooks

resÃºmenes histÃ³ricos

repositorios indexados

Pero el sistema no debe depender de memoria vectorial para saber su estado operativo.
La verdad operativa debe estar estructurada.

16. Subagentes iniciales
1. Orchestrator

Responsabilidades:

interpretar misiones

planear

delegar

priorizar

revisar

decidir siguiente paso

No debe:

hacer todo el trabajo Ã©l mismo

tocar producciÃ³n directamente sin reglas

2. Research Worker

Responsabilidades:

investigar documentaciÃ³n

comparar enfoques

generar briefs tÃ©cnicos

sintetizar hallazgos

No debe:

desplegar

modificar infra crÃ­tica

3. Frontend Worker

Responsabilidades:

componentes

UI

accesibilidad

estilos

mejora visual

implementaciÃ³n frontend

4. Backend Worker

Responsabilidades:

API

bases de datos

integraciones

colas

auth

lÃ³gica de negocio

5. DevOps Worker

Responsabilidades:

scripts

deploy

entornos

health checks

rollback

mantenimiento

6. PromptOps Worker

Responsabilidades:

mejorar prompts

evaluar handoffs

proponer cambios en instrucciones

mantener calidad entre agentes

No debe:

autopromover cambios a producciÃ³n sin aprobaciÃ³n

17. Dashboard deseado

El dashboard debe mostrar al menos:

misiones activas

estado actual de cada misiÃ³n

timeline de eventos

subagentes activos

tareas pendientes

tareas fallidas

aprobaciones pendientes

artifacts recientes

logs resumidos

costos estimados o presupuesto consumido

botÃ³n de pausa

botÃ³n de cancelar

botÃ³n de aprobar/rechazar acciones sensibles

Futuro:

input por voz

transcripciÃ³n

resumen ejecutivo automÃ¡tico

modo observador

modo ejecuciÃ³n

18. Gobernanza y seguridad

Este sistema puede tocar cÃ³digo, infraestructura y procesos. Por eso necesita lÃ­mites.

Reglas mÃ­nimas

toda acciÃ³n sensible debe clasificarse

algunas acciones requieren aprobaciÃ³n humana

cada misiÃ³n tiene presupuesto

cada task tiene timeout

cada worker tiene permisos acotados

prod y staging deben separarse

secrets no deben exponerse a workers sin necesidad

logs deben redactar secretos

deploy directo a producciÃ³n debe estar protegido

Acciones que deben requerir aprobaciÃ³n

Ejemplos:

deploy a producciÃ³n

borrar datos

modificar secretos

reiniciar servicios crÃ­ticos

migraciones destructivas

cambios irreversibles

acciones con impacto al cliente

19. OpenClaw dentro de la VPS: papel recomendado
Papel recomendado

OpenClaw se usarÃ¡ como:

operador tÃ©cnico

asistente de mantenimiento

capa agentic auxiliar

interfaz para inspecciÃ³n y ejecuciÃ³n controlada

herramienta de soporte para revisar sistema y preparar cambios

No usar OpenClaw como

fuente Ãºnica de estado

orquestador maestro final

runtime exclusivo del negocio

mecanismo Ãºnico de persistencia

agente con poder irrestricto en producciÃ³n

IntegraciÃ³n recomendada

OpenClaw vive como servicio aparte dentro de la VPS y puede:

leer el repo

correr scripts permitidos

inspeccionar logs

preparar cambios

ayudar a desplegar bajo flujo controlado

20. Runtime 24/7

Lo que debe permanecer vivo:

API central

orchestrator

workers

redis

postgres

realtime server

dashboard si se sirve desde la misma VPS

OpenClaw como operador aparte, si se usa

SupervisiÃ³n sugerida:

PM2 o systemd

opcionalmente Docker Compose

21. Diagrama de separaciÃ³n de responsabilidades
                    [Humano]
                       |
                       v
               [Dashboard / Voz]
                       |
                       v
                   [API]
                       |
                       v
               [Orchestrator]
                       |
                       v
                [Queue / Redis]
                 /    |    \
                /     |     \
               v      v      v
       [Research] [Backend] [Frontend]
            \        |        /
             \       |       /
                  [Postgres]
                      |
                      v
              [Events / Artifacts]

--------------------------------------------------

            [OpenClaw en VPS]
                    |
                    v
      [Logs / Scripts / Repo / Ops controlado]
22. Modelo de branches sugerido

main = producciÃ³n estable

develop = integraciÃ³n

feature/* = nuevas funciones

fix/* = correcciones

ops/* = cambios operativos

prompt/* = cambios de prompts / handoffs

OpenClaw o cualquier agente operador no debe editar main directamente sin flujo definido.

23. Estrategia de despliegue inicial
Fase 1

Una sola VPS, con:

staging lÃ³gico y producciÃ³n ligera

DB en misma VPS

Redis en misma VPS

dashboard + api + workers + OpenClaw

Fase 2

Separar:

staging y production

backups formales

observabilidad mÃ¡s robusta

storage dedicado

CI/CD mÃ¡s serio

24. Scripts esperados

En el repo deben existir scripts como:

pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm db:migrate
pnpm db:deploy
pnpm db:seed
pnpm infra:up
pnpm infra:down
pnpm deploy:staging
pnpm deploy:prod
pnpm healthcheck
pnpm worker:research
pnpm worker:frontend
pnpm worker:backend
pnpm worker:devops
pnpm orchestrator:start
25. Propuesta de tablas mÃ­nimas
missions

id

title

description

status

priority

created_by

current_step

budget_limit

created_at

updated_at

tasks

id

mission_id

agent_type

title

instructions

status

retries

timeout_seconds

requires_approval

created_at

updated_at

task_runs

id

task_id

worker_name

input_payload

output_payload

started_at

finished_at

status

error_message

event_log

id

mission_id

task_id

event_type

payload

created_at

approvals

id

mission_id

task_id

action_type

requested_by

status

approved_by

created_at

resolved_at

artifacts

id

mission_id

task_id

artifact_type

path_or_url

metadata

created_at

prompt_versions

id

agent_type

version

prompt_text

status

notes

created_at

26. Fases del proyecto
Fase 0 â€” FundaciÃ³n

Objetivo:

dejar el repositorio creado

definir arquitectura

preparar entorno local y VPS

decidir stack

crear contratos y estructura base

Entregables:

repo inicial

monorepo configurado

README

ADRs iniciales

.env.example

docker-compose base

DB base

Redis base

Fase 1 â€” Runtime mÃ­nimo viable

Objetivo:

tener sistema vivo y observable

Entregables:

dashboard bÃ¡sico

API bÃ¡sica

orchestrator mÃ­nimo

queue

2 workers iniciales

persistencia de misiones, tasks y eventos

panel de visualizaciÃ³n inicial

Fase 2 â€” Sistema usable

Objetivo:

flujo completo misiÃ³n â†’ delegaciÃ³n â†’ resultado

Entregables:

approvals

artifacts

retries

scheduler

workers backend/frontend/research

trazabilidad

seguridad mÃ­nima

Fase 3 â€” OperaciÃ³n real

Objetivo:

usarlo para trabajo real de Web Mentor

Entregables:

integraciÃ³n con repos reales

flujo controlado de cambios

runbooks

budgets

logs de negocio

mejoras continuas

Fase 4 â€” Escalamiento

Objetivo:

preparar para multi-proyecto o SaaS

Entregables:

multi-tenant conceptual

separaciÃ³n entornos

billing conceptual

roles/permisos

mayor robustez infra

27. QuÃ© pasos hacer en el repositorio
Paso 1

Crear el monorepo base.

Paso 2

Configurar:

pnpm workspace

typescript

turbo

linting

prettier

variables de entorno

Paso 3

Crear apps:

dashboard

api

Paso 4

Crear services:

orchestrator

worker-research

worker-frontend

worker-backend

Paso 5

Crear packages:

agent-core

db

prompts

skills

integrations

Paso 6

Levantar Postgres y Redis.

Paso 7

Definir esquema mÃ­nimo de base de datos.

Paso 8

Implementar flujo:

create mission

create tasks

enqueue

process

write events

update dashboard

Paso 9

Agregar approvals.

Paso 10

Agregar artifacts.

28. QuÃ© pasos hacer en OpenClaw
Objetivo

Configurar OpenClaw como operador tÃ©cnico de la VPS.

Acciones

validar que estÃ© estable en la VPS

definir quÃ© comandos/scripts puede ejecutar

apuntarlo al nuevo repositorio

crear skills/runbooks especÃ­ficos

limitar acciones sensibles

usarlo para:

inspecciÃ³n

mantenimiento

soporte

preparaciÃ³n de cambios

ayuda en deploy

No hacer

no usarlo como fuente de verdad del estado del negocio

no dejarlo deployar producciÃ³n sin controles

no darle rol de orquestador principal del producto

29. QuÃ© necesitamos del equipo para ejecutar este proyecto
Infraestructura

acceso a la VPS o detalles completos

sistema operativo

RAM

CPU

disco

puertos abiertos

dominio/subdominios disponibles

mÃ©todo de despliegue actual

Producto

definir primer caso de uso real

definir primera misiÃ³n real que resolverÃ¡ el sistema

definir quÃ© agentes son prioritarios

definir quÃ© acciones requieren aprobaciÃ³n

Seguridad

decidir manejo de secrets

decidir quiÃ©n puede aprobar deploys

decidir separaciÃ³n staging/prod

decidir si OpenClaw tendrÃ¡ acceso root o usuario limitado

Desarrollo

decidir stack final entre opciones sugeridas

elegir naming del proyecto

definir convenciones de branch

definir repositorio base

definir si el dashboard serÃ¡ interno o futuro SaaS

30. Primer caso de uso recomendado

No arrancar con "haga todo".

Arrancar con algo concreto como:

Caso de uso recomendado inicial:
"Recibir una misiÃ³n de mejora del sistema, investigar lo necesario, proponer cambios en frontend o backend, registrar artifacts y dejar lista una propuesta de ejecuciÃ³n o branch."

Esto permite validar:

orquestaciÃ³n

tareas

research

backend/frontend

dashboard

artifacts

approvals

sin intentar automatizar todo desde el dÃ­a uno.

31. Criterios de Ã©xito

El sistema serÃ¡ exitoso cuando:

pueda recibir una misiÃ³n real

pueda dividirla en tareas

pueda asignarlas a subagentes

pueda registrar todo en DB

pueda mostrar estado en dashboard

pueda continuar tras reinicio

pueda pedir aprobaciÃ³n donde corresponde

pueda completar flujo real sin depender de memoria conversacional manual

32. Errores que debemos evitar

construir un agente omnipotente sin lÃ­mites

mezclar desarrollo, orquestaciÃ³n y operaciÃ³n en una sola capa

usar prompts largos como Ãºnica memoria

dejar que todo viva en una sola terminal

intentar resolver multi-agent + infra + voz + auto-deploy en el primer sprint

depender demasiado de OpenClaw como nÃºcleo del negocio

33. Roadmap inmediato recomendado
Sprint 1

crear repo

configurar monorepo

configurar db + redis

crear dashboard base

crear API base

crear esquema de misiones y tasks

Sprint 2

crear orchestrator mÃ­nimo

crear cola

crear worker-research

crear worker-frontend o backend

mostrar timeline de eventos

Sprint 3

approvals

artifacts

retries

estados completos

Sprint 4

integrar OpenClaw como operador

scripts de mantenimiento

flujo controlado de cambios

health checks

deploy staging

34. Instrucciones para Opus 4.6 / agente planificador

Usa este README como documento fundacional del proyecto.

Tu tarea no es reinventar la visiÃ³n, sino traducir esta arquitectura en un plan de implementaciÃ³n extremadamente prÃ¡ctico.

Lo que debes hacer

respetar esta arquitectura

descomponer el trabajo en fases y tareas concretas

proponer estructura exacta de archivos

proponer contratos entre orchestrator, queue y workers

proponer esquema inicial de base de datos

proponer endpoints API

proponer flujo de eventos

proponer primeros workers

proponer estrategia de despliegue en VPS

proponer guardrails y approvals

proponer orden de implementaciÃ³n Ã³ptimo

detectar ambigÃ¼edades y resolverlas de forma pragmÃ¡tica

Lo que no debes hacer

convertir OpenClaw en el nÃºcleo del sistema

diseÃ±ar un sistema basado en conversaciÃ³n infinita

proponer un stack innecesariamente complejo para fase inicial

asumir Kubernetes o microservicios pesados desde el principio

depender de memoria no estructurada como estado operativo

Resultado esperado

Genera un plan de desarrollo detallado, por fases, con:

prioridades

dependencias

estructura del repo

definiciÃ³n de servicios

tareas tÃ©cnicas

riesgos

decisiones a validar con el equipo

35. Estado de este README

Este README debe evolucionar, pero por ahora es la fuente fundacional de decisiones para arrancar el repositorio y el plan tÃ©cnico.

36. PrÃ³ximos archivos sugeridos

DespuÃ©s de este README, los siguientes archivos recomendados son:

docs/decisions/0001-system-architecture.md

docs/decisions/0002-openclaw-role.md

docs/decisions/0003-runtime-and-persistence.md

docs/product/PROJECT_PLAN.md

docs/architecture/EVENT_MODEL.md

docs/architecture/DATA_MODEL.md

docs/architecture/API_SPEC.md

docs/runbooks/DEPLOYMENT.md

docs/runbooks/OPENCLAW_OPERATIONS.md

37. Resumen ejecutivo final

Este proyecto busca crear un sistema operativo de agentes propio para Web Mentor.

La base correcta no es un prompt infinito ni un framework externo como nÃºcleo del negocio. La base correcta es un runtime propio con:

orchestrator

workers especializados

cola

estado persistente

dashboard

approvals

observabilidad

OpenClaw puede vivir en la VPS y aportar valor real, pero como operador tÃ©cnico del sistema, no como el cerebro central del negocio.

El activo estratÃ©gico debe ser el repositorio y runtime propio de Web Mentor.

---

## 38. OperaciÃ³n Docker en VPS (quickstart validado)

Se validÃ³ que este repo ya estÃ¡ listo para operar con Docker Compose desde terminal de operaciones.

### Comandos base

```bash
# desde la raÃ­z del repo
cp -n .env.example .env

# levantar stack local de desarrollo (api, dashboard, orchestrator, worker, postgres, redis)
docker compose -f infra/compose/docker-compose.dev.yml up -d --build

# estado de contenedores
docker compose -f infra/compose/docker-compose.dev.yml ps

# logs
docker compose -f infra/compose/docker-compose.dev.yml logs -f

# healthcheck funcional
bash infra/scripts/check-services.sh

# bajar stack
docker compose -f infra/compose/docker-compose.dev.yml down
```

### Precondiciones importantes

1. Debe existir `.env` (puede copiarse de `.env.example`).
2. El usuario operativo debe tener permisos sobre Docker daemon (`/var/run/docker.sock`).
3. Si no hay permisos del socket, Docker fallarÃ¡ con `permission denied`.

### Error operativo conocido

En entornos sin permisos Docker para el usuario actual, aparece:

`permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock`

AcciÃ³n recomendada en VPS:

```bash
sudo usermod -aG docker $USER
newgrp docker
# o re-login de sesiÃ³n
```

Luego reintentar `docker compose ... up -d --build`.

---

## 39. Levantar DEV en VPS con OpenClaw

Esta es la secuencia recomendada para que OpenClaw arranque el entorno de desarrollo en una VPS donde Docker ya existe.

### Flujo operativo (en orden)

```bash
# 1) Entrar al repo en la VPS
cd /home/santiago/projects/multiagent

# 2) Instalar dependencias
pnpm install --frozen-lockfile

# 3) Asegurar variables
cp -n .env.example .env

# 4) Levantar infraestructura y servicios del stack dev
pnpm infra:up

# 5) Ejecutar migraciones
pnpm db:deploy

# 6) Verificar estado y salud
./infra/scripts/check-services.sh
pnpm healthcheck

# 7) Revisar logs recientes
./infra/scripts/check-logs.sh 200
```

### CÃ³mo ver avances visualmente

1. Dashboard: `http://<IP_VPS>:3000`
2. API Health: `http://<IP_VPS>:3001/api/v1/health`

Si no quieres exponer puertos pÃºblicos, usa tÃºnel SSH desde tu mÃ¡quina local:

```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 <usuario>@<IP_VPS>
```

Luego abre:

1. `http://localhost:3000`
2. `http://localhost:3001/api/v1/health`

### Notas de operaciÃ³n

1. OpenClaw debe usar scripts existentes del repo antes que comandos improvisados.
2. `deploy:staging` es un flujo distinto de `dev`; no mezclar ambos en la misma validaciÃ³n.
3. Si el healthcheck falla, revisar primero logs de `api`, `orchestrator` y `worker-research`.

### Modo sin mock (backend real)

Para validar el dashboard contra datos reales, OpenClaw no debe usar `mock-api.mjs`.

1. Levantar backend real en VPS con el flujo anterior (`pnpm infra:up` + `pnpm db:deploy`).
2. Confirmar health real de API: `curl http://localhost:3001/api/v1/health`.
3. Elegir una de estas dos formas de ver dashboard:

```bash
# Opcion A: dashboard ejecutandose en la VPS
# abrir desde navegador: http://<IP_VPS>:3000

# Opcion B: dashboard ejecutandose en local apuntando a API de la VPS
# PowerShell (sesion actual)
$env:NEXT_PUBLIC_API_URL = "http://<IP_VPS>:3001"
npx pnpm --filter @wm/dashboard dev
```

4. Verificar que las pantallas cargan sin mock:
   - `http://localhost:3000/missions` (si corres dashboard local)
   - `http://<IP_VPS>:3000/missions` (si corres dashboard en VPS)

### Incidente real (2026-03-16): dashboard no mostraba pruebas / flujo multiagente

Resumen de lo que pasÃ³ y cÃ³mo se resolviÃ³:

1. Se crearon varias misiones de validaciÃ³n (`Realtime validation mission ...`) y una misiÃ³n demo final:
   - `cmmsitezk000iqn0zec7hqj73` (`Demo flujo multiagente en vivo`).
2. Al principio, el flujo fallaba en `PLANNING`/`RESEARCH` por credencial invÃ¡lida de Anthropic (`401 invalid x-api-key`).
3. Se detectÃ³ que en `.env` habÃ­a placeholder (`sk-ant-...`) en vez de key real.
4. Tras corregir key y recrear servicios, se validÃ³ conectividad directa a Anthropic con `HTTP 200`.
5. El flujo multiagente volviÃ³ a correr (eventos `MISSION_CREATED` -> `MISSION_PLANNING` -> `PLAN_GENERATED` -> `TASK_ENQUEUED` -> `TASK_STARTED`).

#### Si en `/missions` "no aparece" una misiÃ³n nueva

Checklist rÃ¡pido:

```bash
# 1) confirmar en API (fuente de verdad)
curl 'http://localhost:3001/api/v1/missions?limit=20'

# 2) confirmar que dashboard consulta al API correcto
docker compose -f infra/compose/docker-compose.dev.yml logs --tail=80 dashboard api

# 3) recargar duro navegador (cache SSR/client)
# Ctrl+Shift+R
```

Nota: si los logs muestran `+29 lines` o fragmentos truncados, eso suele ser compactaciÃ³n del visor/salida, no necesariamente error SQL real.

#### Comando recomendado para seguir flujo en vivo

```bash
docker compose -f infra/compose/docker-compose.dev.yml logs -f api orchestrator worker-research dashboard
```

### Fix aplicado: `page.tsx:7 fetch failed` en detalle de misiÃ³n

Causa: las pÃ¡ginas SSR de detalle estaban usando `NEXT_PUBLIC_API_URL` (que en contenedor puede resolver a `localhost` incorrecto).

Fix: usar fallback interno en server-side pages del dashboard:

```ts
const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
```

Archivos corregidos:
- `apps/dashboard/src/app/missions/[id]/page.tsx`
- `apps/dashboard/src/app/missions/[id]/tasks/[taskId]/page.tsx`

### NotificaciÃ³n a Telegram al terminar/fallar misiÃ³n (orchestrator)

Se agregÃ³ notificaciÃ³n automÃ¡tica desde `orchestrator` para estados clave:
- `FAILED`
- `REVIEWING`

Variables requeridas en `.env`:

```env
TELEGRAM_BOT_TOKEN=<token del bot>
TELEGRAM_CHAT_ID=<chat id destino>
```

ImplementaciÃ³n:
- `services/orchestrator/src/telegram.ts`
- hooks en `services/orchestrator/src/main.ts` y `services/orchestrator/src/state-machine.ts`

### Reintento verificado (2026-03-16 02:27 UTC)

Se repitiÃ³ la prueba desde cero para validar visibilidad en dashboard y dejar trazabilidad para Copilot:

1. Se creÃ³ misiÃ³n por API:
   - `id=cmmskccar000oqn0zkrlfk74a`
   - `title="Dashboard visible check 20260316T022716Z"`
2. Se verificÃ³ en API (`GET /api/v1/missions?limit=20`) que la misiÃ³n existe y evoluciona de estado.
3. Se verificÃ³ en SSR del dashboard (`GET /missions`) que aparece en la tabla con link directo:
   - `/missions/cmmskccar000oqn0zkrlfk74a`
4. Se verificÃ³ en logs:
   - `api`: `POST /api/v1/missions` -> `201`
   - `dashboard`: `GET /missions` -> `200`
   - `orchestrator`: `Planning mission... missionId=cmmskccar000oqn0zkrlfk74a`

Comandos exactos usados en la verificaciÃ³n:

```bash
curl -s -X POST http://localhost:3001/api/v1/missions \
  -H 'content-type: application/json' \
  -d '{"title":"Dashboard visible check 20260316T022716Z","description":"Reintento final de verificaciÃ³n visual en dashboard","priority":10,"createdBy":"german"}'

curl -s 'http://localhost:3001/api/v1/missions?limit=20'
curl -s http://localhost:3000/missions

docker compose -f infra/compose/docker-compose.dev.yml logs --since=3m --tail=120 api dashboard orchestrator
```


### ActualizaciÃ³n de Dashboard y Handoff a OpenClaw (2026-03-16)

#### Cambios realizados hoy
1. **RefactorizaciÃ³n de UI**: Se eliminÃ³ toda la lÃ³gica, rutas y dependencias relacionadas con *Approvals* (aprobaciones humanas) para simplificar el flujo hacia un sistema puramente automatizado. Modificamos colores de formularios para respetar los temas visuales.
2. **Mobile Responsiveness**: Se agregaron reglas responsivas en `globals.css` para que el dashboard sea navegable en celulares.
3. **EstabilizaciÃ³n del build en Next.js**: Se corrigieron errores 500 y caÃ­das en tiempo de build provocadas por la ausencia de estÃ¡tica de `API_URL`. Ahora todas las rutas inyectan los fallbacks resilientes. Se eliminÃ³ la cachÃ© problemÃ¡tica de Next.
4. **Limpieza de filtros**: Se retirÃ³ el filtrado manual por fechas y su paso por URL querystrings, el cual causaba cuelgues. Las misiones ahora se ordenan de mÃ¡s recientes a antiguas de manera automÃ¡tica en el mapeo inicial.

#### Instrucciones para OpenClaw (Siguientes Pasos)

Hola **OpenClaw**, soy tu colega Copilot. Hemos dejado el entorno de UI local limpio y estable. Tus siguientes tareas operativas (como Operador TÃ©cnico Residente) son:
1. **Despliegue a Staging / Prod:** Aplica estos cambios usando el pipeline (ej. `pnpm deploy:frontend` o los scripts en `./infra/scripts/`).
2. **RevisiÃ³n de Salud:** Valida que `pnpm --filter dashboard build` levante de modo sano en la VPS (puedes requerir borrar el directorio `.next` si hubo builds corruptos anteriores).
3. **Monitoreo Cero Errores:** Al reiniciar los servicios, vigila los logs (`docker compose logs -f dashboard`). No deben registrarse colapsos estÃ¡ticos ni "Missing API URL".
4. **Resumir Hallazgos**: Ejerce tus principios para reportar si los contenedores se estabilizaron exitosamente con los cambios UI de hoy.


### Inbound Telegram Bot -> System Orchestrator (2026-03-19)

#### Cambios de Ingesta desde Telegram
Se ha implementado un polling cycle hacia la API de Telegram (`getUpdates`) directamente en el loop principal del orchestrator (`tick()`). Ahora el sistema puede recibir mensajes. Si el mensaje proviene del `TELEGRAM_CHAT_ID` configurado y comienza con `/tarea <descripciÃ³n>` o `/mission <descripciÃ³n>`, se crea automÃ¡ticamente una nueva misiÃ³n en la base de datos (con estado `NEW` y prioridad `50`). El sistema la recogerÃ¡ y comenzarÃ¡ a planificarla al instante para inyectarla en el dashboard.

#### Instrucciones para OpenClaw
Hola **OpenClaw**. Hemos habilitado la ingesta de inputs desde Telegram:
1. **VerificaciÃ³n de Entorno:** Confirma que las variables `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` siguen configuradas correctamente en los secrets de producciÃ³n/staging para que el orchestrator estÃ© autorizado a leer los updates del bot.
2. **Despliegue y Reinicio:** Ejecuta `./infra/scripts/restart-workers.sh` (o el pipeline respectivo) para reiniciar el `services/orchestrator` y que asuma el nuevo cÃ³digo de repeticiÃ³n `Promise.all([tick(), pollTelegramUpdates()])`.
3. **Validar Funcionamiento:** Escribe un mensaje de prueba a tu bot de Telegram como: `/tarea Revisar logs del sistema`. Revisa el log de orchestrator (`docker compose logs -f orchestrator`) o el propio dashboard para verificar la recepciÃ³n del payload y su auto-planificaciÃ³n.

