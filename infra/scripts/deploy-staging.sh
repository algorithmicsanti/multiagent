#!/usr/bin/env bash
set -euo pipefail

# Compat wrapper
exec ./infra/scripts/deploy-pipeline.sh full
