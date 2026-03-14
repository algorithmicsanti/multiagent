# Runbook: Deploy to Staging

## Purpose
Deploy the latest changes to the staging environment.

## Prerequisites
- All tests passing
- On the correct feature branch
- `.env` configured with staging values

## Steps

1. **Validate branch and status**
   ```bash
   git status
   git branch --show-current
   ```

2. **Run staging deploy script** (Nivel 2 — requires human confirmation)
   ```bash
   ./infra/scripts/deploy-staging.sh
   ```

3. **Verify health after deploy**
   ```bash
   pnpm healthcheck
   ```

4. **Check logs for errors**
   ```bash
   ./infra/scripts/check-logs.sh 100
   ```

## Rollback
If staging deploy fails:
```bash
./infra/scripts/rollback.sh HEAD~1
```
