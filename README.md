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

### Avances operativos 2026-03-15 (importante para Copilot)

- Se resolvió el arranque de contenedores que fallaba por módulos workspace no compilados en runtime Docker.
  - Fix aplicado: build explícito de `@wm/db`, `@wm/agent-core`, `@wm/observability` durante la imagen de `api` y `service`.
- Se resolvió error de BullMQ por nombre de cola inválido (`Queue name cannot contain :`).
  - Fix aplicado: colas renombradas de `agent:*` a `agent-*`.
- Se ajustó tipado en `packages/observability` para compatibilidad Prisma (`InputJsonValue`) y dependencia explícita de `@wm/db`.
- Se validó health real del stack:
  - `GET /api/v1/health` devuelve `status=ok, db=ok, redis=ok`.
- Se incorporó runbook operativo de instancia:
  - `docs/runbooks/instance-ops-baseline.md`.
- Se añadió smoke test post-deploy configurable por target:
  - `infra/scripts/smoke-post-deploy.sh`.
- Se añadió check de errores recientes (error-budget con filtros por servicio + hard-fail patterns):
  - `infra/scripts/check-errors-window.sh`.
- Reglas de error-budget externalizadas para tuning sin tocar script:
  - `infra/config/log-error-budget.rules.sh`
  - permite ajustar `SERVICES`, `BASE_ERROR_REGEX`, `GLOBAL_IGNORE_REGEX`, `SERVICE_IGNORE_REGEX`, `SERVICE_HARD_FAIL_REGEX`.
- Se creó pipeline de deploy unificado por target:
  - `infra/scripts/deploy-pipeline.sh [full|backend|frontend]`
  - wrappers npm: `pnpm deploy:full`, `pnpm deploy:backend`, `pnpm deploy:frontend`
  - `deploy-staging.sh` queda como compat wrapper hacia `full`.
- CI manual de deploy para staging:
  - `.github/workflows/deploy-staging.yml` (workflow_dispatch con input `target`, pre-checks de build/typecheck y ejecución en runner `self-hosted,linux,staging`).
- CI manual de deploy para producción con confirm explícita:
  - `.github/workflows/deploy-production.yml` (`confirm=DEPLOY_PROD`, pre-checks de build/typecheck, runner `self-hosted,linux,production`, `environment: production`).
- CI de predeploy para PR/manual:
  - `.github/workflows/ci-predeploy.yml`.
- Runbook operativo del pipeline por target:
  - `docs/runbooks/deploy-pipeline-targets.md`.
- Estado y trazabilidad de deploy guardados por script:
  - `infra/state/last-successful-deploy.env`
  - `infra/state/deploy-history.log`
  - rollback dirigido al último release exitoso: `infra/scripts/rollback-last-success.sh`.
- Fix de conectividad SSR del dashboard en Docker:
  - `API_INTERNAL_URL=http://api:3001` para llamadas server-side.
- Guía explícita para levantar DEV en VPS y ver dashboard en tiempo real:
  - `openclaw.md` sección **16.5 Runbook de levantar DEV en VPS**.
- Se removió `version:` del compose dev para evitar warning de deprecación en Docker Compose v2.

### Política de ramas operativas (evitar choques con Copilot)

Desde este punto, los cambios operativos/manuales del agente se desarrollan en rama dedicada:

- Rama activa del agente: `chore/ops-hardening-agent`
- `main` se mantiene como rama de integración estable para evitar colisiones con Copilot/automatizaciones.
- Flujo recomendado: trabajar en rama dedicada -> PR/review -> merge a `main`. 

### Estrategia de trabajo en paralelo (para evitar choques)

Mientras continúan features en API/orchestrator/dashboard, se recomienda que contribuciones paralelas se enfoquen en ejes de bajo conflicto:

1. **Testing + CI/CD básico**
   - pruebas unitarias y smoke tests
   - pipeline de lint/test/build en PR
   - checks mínimos de calidad antes de merge

2. **Contratos y tipado compartido**
   - endurecer tipos en `packages/agent-core`
   - validaciones consistentes de payloads
   - versionado de contratos entre orchestrator/workers

3. **Observabilidad operativa mínima**
   - logging estructurado consistente
   - correlación por `missionId/taskId`
   - eventos base para debugging y auditoría

4. **Runbooks y documentación operativa aterrizada**
   - alinear docs con la implementación real (no solo visión)
   - procedimientos de staging, healthchecks y rollback

### Convención de ramas sugerida

- Trabajo de base/plataforma: `chore/*`, `docs/*`, `test/*`, `ci/*`
- Features de producto: `feature/*`
- Fixes puntuales: `fix/*`

Regla práctica: evitar tocar simultáneamente archivos núcleo de lógica (`services/orchestrator/*`, `apps/api/src/routes/*`) desde múltiples ramas sin coordinación explícita.

---

# 1. Visión

Queremos construir un sistema donde:

- exista un *orquestador maestro*
- existan *subagentes especializados*
- el sistema pueda recibir órdenes desde un *dashboard* y eventualmente por *voz*
- el sistema pueda mantener contexto de largo plazo
- el sistema pueda continuar trabajo aunque un proceso falle o la VPS se reinicie
- el sistema pueda modificar repositorios, investigar documentación, analizar frontend, backend, DevOps y prompts
- el sistema pueda operar con *aprobaciones humanas* cuando una acción sea sensible
- el sistema pueda vivir en una *VPS propia*
- el sistema sea un activo propio de Web Mentor, no dependiente de un framework externo como núcleo del negocio

La arquitectura debe priorizar:

- persistencia
- trazabilidad
- control
- separación de responsabilidades
- seguridad
- despliegue pragmático
- capacidad de evolucionar a SaaS en el futuro

---

# 2. Principio arquitectónico central

No vamos a construir un sistema basado en un "prompt infinito" o en agentes hablándose sin control.

Vamos a construir un sistema basado en:

- *estado persistente*
- *eventos*
- *cola de trabajos*
- *workers especializados*
- *orquestación explícita*
- *guardrails*
- *dashboard de control*
- *checkpoints*
- *aprobaciones*

Es decir:

*no conversación infinita*  
*sí sistema de ejecución durable*

---

# 3. Qué es y qué no es OpenClaw dentro de esta arquitectura

## OpenClaw sí puede servir para:

- operar desde la VPS
- inspeccionar archivos
- correr comandos
- ayudar en mantenimiento
- preparar cambios
- revisar logs
- actuar como operador técnico
- ejecutar workflows auxiliares
- servir como interfaz agentic experimental

## OpenClaw no será:

- el producto central
- el orquestador maestro definitivo del negocio
- la única memoria del sistema
- la única capa de ejecución
- la fuente de verdad del estado del sistema

## Decisión arquitectónica

El sistema principal será *un repositorio nuevo* y *un runtime propio*.

OpenClaw, si se utiliza, será un *agente operador/maintainer* dentro de la VPS, no el corazón del negocio.

---

# 4. Arquitectura general

## Componentes

1. *Dashboard*
   - interfaz visual del sistema
   - input por texto
   - futuro input por voz
   - timeline de eventos
   - visualización de tareas, agentes, errores, aprobaciones y costos

2. *API central*
   - recibe misiones
   - administra autenticación
   - expone endpoints
   - sirve estado al dashboard
   - abre websocket o SSE para tiempo real

3. *Orchestrator*
   - recibe una misión
   - la convierte en plan
   - crea tareas
   - encola trabajos
   - revisa resultados
   - decide siguiente paso
   - pausa o solicita aprobación cuando sea necesario

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
   - evita ejecución duplicada
   - desacopla al orquestador de los workers

6. *Postgres*
   - guarda estado persistente
   - guarda misiones, tareas, runs, eventos, artifacts, aprobaciones, presupuestos, resultados

7. *Redis*
   - cola de trabajos
   - locks
   - estado efímero de ejecución
   - coordinación rápida entre procesos

8. *Storage de artifacts*
   - logs
   - reportes
   - diffs
   - archivos generados
   - capturas
   - resultados de análisis

9. *Observabilidad*
   - logs estructurados
   - métricas
   - errores
   - health checks
   - auditoría

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
Repositorio = código fuente del sistema
VPS = infraestructura donde corre el sistema
Runtime = procesos vivos 24/7
OpenClaw = operador técnico opcional dentro de la VPS
Claude/Opus = asistentes de desarrollo/planeación para construir el sistema

# Web Mentor Agent OS

Sistema operativo de agentes para Web Mentor.

Este repositorio contiene la arquitectura base para construir un sistema de agentes persistente, auditable y desplegable en una VPS. El objetivo es operar una "mente maestra" que reciba misiones de negocio, las descomponga, las delegue a subagentes especializados y mantenga continuidad de trabajo 24/7 con estado persistente, memoria y observabilidad.

Este documento cumple dos funciones:

1. Ser el README fundacional del repositorio.
2. Servir como prompt/contexto maestro para un modelo como Opus 4.6 que vaya a planear e implementar el sistema.

---

# 1. Visión

Queremos construir un sistema donde:

- exista un **orquestador maestro**
- existan **subagentes especializados**
- el sistema pueda recibir órdenes desde un **dashboard** y eventualmente por **voz**
- el sistema pueda mantener contexto de largo plazo
- el sistema pueda continuar trabajo aunque un proceso falle o la VPS se reinicie
- el sistema pueda modificar repositorios, investigar documentación, analizar frontend, backend, DevOps y prompts
- el sistema pueda operar con **aprobaciones humanas** cuando una acción sea sensible
- el sistema pueda vivir en una **VPS propia**
- el sistema sea un activo propio de Web Mentor, no dependiente de un framework externo como núcleo del negocio

La arquitectura debe priorizar:

- persistencia
- trazabilidad
- control
- separación de responsabilidades
- seguridad
- despliegue pragmático
- capacidad de evolucionar a SaaS en el futuro

---

# 2. Principio arquitectónico central

No vamos a construir un sistema basado en un "prompt infinito" o en agentes hablándose sin control.

Vamos a construir un sistema basado en:

- **estado persistente**
- **eventos**
- **cola de trabajos**
- **workers especializados**
- **orquestación explícita**
- **guardrails**
- **dashboard de control**
- **checkpoints**
- **aprobaciones**

Es decir:

**no conversación infinita**  
**sí sistema de ejecución durable**

---

# 3. Qué es y qué no es OpenClaw dentro de esta arquitectura

## OpenClaw sí puede servir para:

- operar desde la VPS
- inspeccionar archivos
- correr comandos
- ayudar en mantenimiento
- preparar cambios
- revisar logs
- actuar como operador técnico
- ejecutar workflows auxiliares
- servir como interfaz agentic experimental

## OpenClaw no será:

- el producto central
- el orquestador maestro definitivo del negocio
- la única memoria del sistema
- la única capa de ejecución
- la fuente de verdad del estado del sistema

## Decisión arquitectónica

El sistema principal será **un repositorio nuevo** y **un runtime propio**.

OpenClaw, si se utiliza, será un **agente operador/maintainer** dentro de la VPS, no el corazón del negocio.

---

# 4. Arquitectura general

## Componentes

1. **Dashboard**
   - interfaz visual del sistema
   - input por texto
   - futuro input por voz
   - timeline de eventos
   - visualización de tareas, agentes, errores, aprobaciones y costos

2. **API central**
   - recibe misiones
   - administra autenticación
   - expone endpoints
   - sirve estado al dashboard
   - abre websocket o SSE para tiempo real

3. **Orchestrator**
   - recibe una misión
   - la convierte en plan
   - crea tareas
   - encola trabajos
   - revisa resultados
   - decide siguiente paso
   - pausa o solicita aprobación cuando sea necesario

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
   - evita ejecución duplicada
   - desacopla al orquestador de los workers

6. **Postgres**
   - guarda estado persistente
   - guarda misiones, tareas, runs, eventos, artifacts, aprobaciones, presupuestos, resultados

7. **Redis**
   - cola de trabajos
   - locks
   - estado efímero de ejecución
   - coordinación rápida entre procesos

8. **Storage de artifacts**
   - logs
   - reportes
   - diffs
   - archivos generados
   - capturas
   - resultados de análisis

9. **Observabilidad**
   - logs estructurados
   - métricas
   - errores
   - health checks
   - auditoría

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
Repositorio = código fuente del sistema
VPS = infraestructura donde corre el sistema
Runtime = procesos vivos 24/7
OpenClaw = operador técnico opcional dentro de la VPS
Claude/Opus = asistentes de desarrollo/planeación para construir el sistema

7. Modelo conceptual correcto
El repo

Es donde vive el código.

El runtime

Es lo que realmente corre 24/7.

El orquestador

Es el director operativo.

Los subagentes

Son workers especializados.

OpenClaw

Es un operador residente útil, no el sistema mismo.

Claude / Opus

Son herramientas para ayudarnos a construir y evolucionar el sistema.

8. Modelo de ejecución

El sistema debe funcionar así:

el usuario crea una misión desde dashboard o voz

la API registra la misión

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

pedir aprobación

reintentar

cerrar la misión

el dashboard muestra todo en tiempo real

9. Lo que NO vamos a hacer

No vamos a:

depender de cron para "revivir prompts"

hacer agentes platicando sin fin solo por estar vivos

confiar solo en historial conversacional para recordar estado

dejar que un agente modifique producción sin guardrails

dejar que el sistema se autodegrade por autoedición sin control

construir toda la lógica alrededor de una sola sesión agentic

10. Monorepo propuesto
webmentor-agent-os/
├─ apps/
│  ├─ dashboard/              # Next.js dashboard
│  └─ api/                    # API central / realtime / auth
│
├─ services/
│  ├─ orchestrator/           # motor de planeación y decisión
│  ├─ scheduler/              # tareas programadas
│  ├─ worker-research/        # investigación y documentación
│  ├─ worker-frontend/        # UI/UX/frontend specialist
│  ├─ worker-backend/         # API/DB/backend specialist
│  ├─ worker-devops/          # infra/deploy/ops specialist
│  └─ worker-promptops/       # mejora de prompts, rúbricas y handoffs
│
├─ packages/
│  ├─ agent-core/             # tipos, contratos, estados, eventos
│  ├─ prompts/                # prompts versionados
│  ├─ skills/                 # skills por agente
│  ├─ memory/                 # adapters para memoria y retrieval
│  ├─ integrations/           # github, slack, whatsapp, email, etc.
│  ├─ db/                     # esquemas, migraciones, seeds
│  └─ observability/          # logging, tracing, metrics
│
├─ infra/
│  ├─ docker/                 # Dockerfiles
│  ├─ compose/                # docker-compose
│  ├─ nginx/                  # reverse proxy config
│  ├─ scripts/                # deploy, backup, healthcheck
│  └─ systemd/                # units opcionales
│
├─ docs/
│  ├─ architecture/
│  ├─ runbooks/
│  ├─ decisions/
│  └─ product/
│
├─ .env.example
├─ pnpm-workspace.yaml
├─ turbo.json
├─ package.json
└─ README.md
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

NestJS si queremos más estructura de enterprise

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

decisión final depende de si esto será interno o SaaS

Observabilidad

logs JSON estructurados

Sentry o alternativa

OpenTelemetry en fase posterior

Infra

Docker Compose inicialmente

PM2 o systemd para supervisión

Nginx o Caddy como reverse proxy

12. Por qué no usar cron como motor principal

Cron no es el cerebro del sistema. Solo sirve para disparar cosas por horario.

Se puede usar para:

backups

limpieza

resúmenes diarios

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

estado explícito

13. Máquina de estados de misión

Cada misión debe existir como una entidad persistente.

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

Cada transición debe registrar evento.

14. Event-driven architecture mínima

Cada acción importante debe crear eventos.

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

auditoría

reconstrucción de contexto

visualización en dashboard

reanudar ejecución

debugging serio

15. Persistencia y memoria
Fuente de verdad principal

Postgres.

Qué se guarda en Postgres

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

Qué se guarda en Redis

jobs

locks

scheduled delays

estado temporal

Qué se guarda como artifacts

reportes markdown

análisis

diffs

snapshots

archivos generados

resultados de investigación

logs exportables

Memoria semántica futura

Podemos agregar un vector store después para:

documentación del sistema

decisiones previas

runbooks

resúmenes históricos

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

hacer todo el trabajo él mismo

tocar producción directamente sin reglas

2. Research Worker

Responsabilidades:

investigar documentación

comparar enfoques

generar briefs técnicos

sintetizar hallazgos

No debe:

desplegar

modificar infra crítica

3. Frontend Worker

Responsabilidades:

componentes

UI

accesibilidad

estilos

mejora visual

implementación frontend

4. Backend Worker

Responsabilidades:

API

bases de datos

integraciones

colas

auth

lógica de negocio

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

autopromover cambios a producción sin aprobación

17. Dashboard deseado

El dashboard debe mostrar al menos:

misiones activas

estado actual de cada misión

timeline de eventos

subagentes activos

tareas pendientes

tareas fallidas

aprobaciones pendientes

artifacts recientes

logs resumidos

costos estimados o presupuesto consumido

botón de pausa

botón de cancelar

botón de aprobar/rechazar acciones sensibles

Futuro:

input por voz

transcripción

resumen ejecutivo automático

modo observador

modo ejecución

18. Gobernanza y seguridad

Este sistema puede tocar código, infraestructura y procesos. Por eso necesita límites.

Reglas mínimas

toda acción sensible debe clasificarse

algunas acciones requieren aprobación humana

cada misión tiene presupuesto

cada task tiene timeout

cada worker tiene permisos acotados

prod y staging deben separarse

secrets no deben exponerse a workers sin necesidad

logs deben redactar secretos

deploy directo a producción debe estar protegido

Acciones que deben requerir aprobación

Ejemplos:

deploy a producción

borrar datos

modificar secretos

reiniciar servicios críticos

migraciones destructivas

cambios irreversibles

acciones con impacto al cliente

19. OpenClaw dentro de la VPS: papel recomendado
Papel recomendado

OpenClaw se usará como:

operador técnico

asistente de mantenimiento

capa agentic auxiliar

interfaz para inspección y ejecución controlada

herramienta de soporte para revisar sistema y preparar cambios

No usar OpenClaw como

fuente única de estado

orquestador maestro final

runtime exclusivo del negocio

mecanismo único de persistencia

agente con poder irrestricto en producción

Integración recomendada

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

Supervisión sugerida:

PM2 o systemd

opcionalmente Docker Compose

21. Diagrama de separación de responsabilidades
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

main = producción estable

develop = integración

feature/* = nuevas funciones

fix/* = correcciones

ops/* = cambios operativos

prompt/* = cambios de prompts / handoffs

OpenClaw o cualquier agente operador no debe editar main directamente sin flujo definido.

23. Estrategia de despliegue inicial
Fase 1

Una sola VPS, con:

staging lógico y producción ligera

DB en misma VPS

Redis en misma VPS

dashboard + api + workers + OpenClaw

Fase 2

Separar:

staging y production

backups formales

observabilidad más robusta

storage dedicado

CI/CD más serio

24. Scripts esperados

En el repo deben existir scripts como:

pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm db:migrate
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
25. Propuesta de tablas mínimas
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
Fase 0 — Fundación

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

Fase 1 — Runtime mínimo viable

Objetivo:

tener sistema vivo y observable

Entregables:

dashboard básico

API básica

orchestrator mínimo

queue

2 workers iniciales

persistencia de misiones, tasks y eventos

panel de visualización inicial

Fase 2 — Sistema usable

Objetivo:

flujo completo misión → delegación → resultado

Entregables:

approvals

artifacts

retries

scheduler

workers backend/frontend/research

trazabilidad

seguridad mínima

Fase 3 — Operación real

Objetivo:

usarlo para trabajo real de Web Mentor

Entregables:

integración con repos reales

flujo controlado de cambios

runbooks

budgets

logs de negocio

mejoras continuas

Fase 4 — Escalamiento

Objetivo:

preparar para multi-proyecto o SaaS

Entregables:

multi-tenant conceptual

separación entornos

billing conceptual

roles/permisos

mayor robustez infra

27. Qué pasos hacer en el repositorio
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

Definir esquema mínimo de base de datos.

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

28. Qué pasos hacer en OpenClaw
Objetivo

Configurar OpenClaw como operador técnico de la VPS.

Acciones

validar que esté estable en la VPS

definir qué comandos/scripts puede ejecutar

apuntarlo al nuevo repositorio

crear skills/runbooks específicos

limitar acciones sensibles

usarlo para:

inspección

mantenimiento

soporte

preparación de cambios

ayuda en deploy

No hacer

no usarlo como fuente de verdad del estado del negocio

no dejarlo deployar producción sin controles

no darle rol de orquestador principal del producto

29. Qué necesitamos del equipo para ejecutar este proyecto
Infraestructura

acceso a la VPS o detalles completos

sistema operativo

RAM

CPU

disco

puertos abiertos

dominio/subdominios disponibles

método de despliegue actual

Producto

definir primer caso de uso real

definir primera misión real que resolverá el sistema

definir qué agentes son prioritarios

definir qué acciones requieren aprobación

Seguridad

decidir manejo de secrets

decidir quién puede aprobar deploys

decidir separación staging/prod

decidir si OpenClaw tendrá acceso root o usuario limitado

Desarrollo

decidir stack final entre opciones sugeridas

elegir naming del proyecto

definir convenciones de branch

definir repositorio base

definir si el dashboard será interno o futuro SaaS

30. Primer caso de uso recomendado

No arrancar con "haga todo".

Arrancar con algo concreto como:

Caso de uso recomendado inicial:
"Recibir una misión de mejora del sistema, investigar lo necesario, proponer cambios en frontend o backend, registrar artifacts y dejar lista una propuesta de ejecución o branch."

Esto permite validar:

orquestación

tareas

research

backend/frontend

dashboard

artifacts

approvals

sin intentar automatizar todo desde el día uno.

31. Criterios de éxito

El sistema será exitoso cuando:

pueda recibir una misión real

pueda dividirla en tareas

pueda asignarlas a subagentes

pueda registrar todo en DB

pueda mostrar estado en dashboard

pueda continuar tras reinicio

pueda pedir aprobación donde corresponde

pueda completar flujo real sin depender de memoria conversacional manual

32. Errores que debemos evitar

construir un agente omnipotente sin límites

mezclar desarrollo, orquestación y operación en una sola capa

usar prompts largos como única memoria

dejar que todo viva en una sola terminal

intentar resolver multi-agent + infra + voz + auto-deploy en el primer sprint

depender demasiado de OpenClaw como núcleo del negocio

33. Roadmap inmediato recomendado
Sprint 1

crear repo

configurar monorepo

configurar db + redis

crear dashboard base

crear API base

crear esquema de misiones y tasks

Sprint 2

crear orchestrator mínimo

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

Tu tarea no es reinventar la visión, sino traducir esta arquitectura en un plan de implementación extremadamente práctico.

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

proponer orden de implementación óptimo

detectar ambigüedades y resolverlas de forma pragmática

Lo que no debes hacer

convertir OpenClaw en el núcleo del sistema

diseñar un sistema basado en conversación infinita

proponer un stack innecesariamente complejo para fase inicial

asumir Kubernetes o microservicios pesados desde el principio

depender de memoria no estructurada como estado operativo

Resultado esperado

Genera un plan de desarrollo detallado, por fases, con:

prioridades

dependencias

estructura del repo

definición de servicios

tareas técnicas

riesgos

decisiones a validar con el equipo

35. Estado de este README

Este README debe evolucionar, pero por ahora es la fuente fundacional de decisiones para arrancar el repositorio y el plan técnico.

36. Próximos archivos sugeridos

Después de este README, los siguientes archivos recomendados son:

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

La base correcta no es un prompt infinito ni un framework externo como núcleo del negocio. La base correcta es un runtime propio con:

orchestrator

workers especializados

cola

estado persistente

dashboard

approvals

observabilidad

OpenClaw puede vivir en la VPS y aportar valor real, pero como operador técnico del sistema, no como el cerebro central del negocio.

El activo estratégico debe ser el repositorio y runtime propio de Web Mentor.

---

## 38. Operación Docker en VPS (quickstart validado)

Se validó que este repo ya está listo para operar con Docker Compose desde terminal de operaciones.

### Comandos base

```bash
# desde la raíz del repo
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
3. Si no hay permisos del socket, Docker fallará con `permission denied`.

### Error operativo conocido

En entornos sin permisos Docker para el usuario actual, aparece:

`permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock`

Acción recomendada en VPS:

```bash
sudo usermod -aG docker $USER
newgrp docker
# o re-login de sesión
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
pnpm db:migrate

# 6) Verificar estado y salud
./infra/scripts/check-services.sh
pnpm healthcheck

# 7) Revisar logs recientes
./infra/scripts/check-logs.sh 200
```

### Cómo ver avances visualmente

1. Dashboard: `http://<IP_VPS>:3000`
2. API Health: `http://<IP_VPS>:3001/api/v1/health`

Si no quieres exponer puertos públicos, usa túnel SSH desde tu máquina local:

```bash
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 <usuario>@<IP_VPS>
```

Luego abre:

1. `http://localhost:3000`
2. `http://localhost:3001/api/v1/health`

### Notas de operación

1. OpenClaw debe usar scripts existentes del repo antes que comandos improvisados.
2. `deploy:staging` es un flujo distinto de `dev`; no mezclar ambos en la misma validación.
3. Si el healthcheck falla, revisar primero logs de `api`, `orchestrator` y `worker-research`.

### Modo sin mock (backend real)

Para validar el dashboard contra datos reales, OpenClaw no debe usar `mock-api.mjs`.

1. Levantar backend real en VPS con el flujo anterior (`pnpm infra:up` + `pnpm db:migrate`).
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

