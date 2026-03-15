#!/usr/bin/env bash
# Reglas para infra/scripts/check-errors-window.sh
# Edita aquí patrones sin tocar el script principal.

# Servicios a evaluar
SERVICES=(api orchestrator worker-research)

# Patrones base de error
BASE_ERROR_REGEX='(\b(ERROR|FATAL)\b|UnhandledPromiseRejection|TypeError:|ReferenceError:|PrismaClientKnownRequestError|ERR_[A-Z_]+)'

# Ruido global conocido
GLOBAL_IGNORE_REGEX='(DeprecationWarning|ExperimentalWarning|the attribute `version` is obsolete)'

# Filtros por servicio
# shellcheck disable=SC2034
# (variables consumidas por script externo)
declare -A SERVICE_IGNORE_REGEX
SERVICE_IGNORE_REGEX[api]='request completed|incoming request|Server listening at'
SERVICE_IGNORE_REGEX[orchestrator]='No active missions found'
SERVICE_IGNORE_REGEX[worker-research]='Worker-research started|Job completed'

# Hard-fail por servicio (si matchea, falla siempre)
declare -A SERVICE_HARD_FAIL_REGEX
SERVICE_HARD_FAIL_REGEX[api]='EADDRINUSE|PrismaClientInitializationError|Cannot find module'
SERVICE_HARD_FAIL_REGEX[orchestrator]='Queue name cannot contain|PrismaClientInitializationError|Cannot find module|The table `public\.'
SERVICE_HARD_FAIL_REGEX[worker-research]='Queue name cannot contain|PrismaClientInitializationError|Cannot find module'