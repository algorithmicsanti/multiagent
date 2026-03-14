#!/usr/bin/env bash
# Used as CMD healthcheck in Docker or called by pnpm healthcheck
curl -sf http://localhost:3001/api/v1/health | grep -q '"status":"ok"'
