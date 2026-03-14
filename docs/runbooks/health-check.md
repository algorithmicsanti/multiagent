# Runbook: Health Check

## Purpose
Verify all Web Mentor Agent OS services are running correctly.

## Steps

1. **Run the health check script**
   ```bash
   pnpm healthcheck
   # or
   ./infra/scripts/check-services.sh
   ```

2. **Check Docker services**
   ```bash
   docker compose -f infra/compose/docker-compose.dev.yml ps
   ```

3. **Check API health endpoint**
   ```bash
   curl http://localhost:3001/api/v1/health
   ```
   Expected: `{"status":"ok","db":"ok","redis":"ok"}`

4. **Check recent logs for errors**
   ```bash
   ./infra/scripts/check-logs.sh 50
   ```

5. **Check queue depth (via Redis)**
   ```bash
   redis-cli -u redis://localhost:6379 keys "bull:agent:*"
   ```

## Expected healthy state
- All Docker containers: `Up (healthy)`
- API `/health`: status=ok, db=ok, redis=ok
- No ERROR-level logs in last 50 lines
- Dashboard accessible at http://localhost:3000

## If unhealthy
- API down → `./infra/scripts/restart-api.sh`
- Worker down → `./infra/scripts/restart-workers.sh`
- Full restart → `pnpm infra:down && pnpm infra:up`
- DB issue → check `docker compose logs postgres`
