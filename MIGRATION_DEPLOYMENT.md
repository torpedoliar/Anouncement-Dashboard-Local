# Data Loss Fix - Deployment Instructions

## ⚠️ CRITICAL: Read Before Deploying

This update fixes the critical data loss issue during updates. **FOLLOW THESE STEPS EXACTLY** to avoid data loss.

---

## What Was Fixed

1. **Dockerfile** - Removed destructive `pre-migration.ts` + `--accept-data-loss`
2. **docker-entrypoint.sh** - Changed to use `prisma migrate deploy`
3. **update.ps1** - Switched from `db push` to `migrate deploy`
4. **/api/update endpoint** - Temporarily disabled (will be re-enabled after migration system is fully set up)
5. **Baseline migration** - Created to establish migration history

---

## Prerequisites

1. **Take a full backup** (update.ps1 does this automatically, but verify it exists)
2. **Stop making schema changes** until this is deployed
3. **Containers must be running** for migration marking

---

## Deployment Steps

### Step 1: Pull Latest Code

```powershell
git pull origin main
```

### Step 2: Start Database (if not running)

```powershell
docker-compose up -d db
# Wait 5 seconds for DB to be healthy
Start-Sleep -Seconds 5
```

### Step 3: Mark Baseline Migration as Applied

This tells Prisma that the baseline migration (which creates all existing tables) has already been applied, so it won't try to execute it again.

```powershell
# Copy mark script to container
docker cp prisma/mark-baseline-applied.ts announcement-dashboard-db-1:/tmp/

# Execute marking script inside container (where DB is accessible)
docker-compose exec -T web npx tsx prisma/mark-baseline-applied.ts
```

**Expected Output:**
```
🔍 Looking for baseline migration...
✅ Found baseline migration: 20260206000000_baseline_multisite
📝 Migration checksum: a1b2c3d4e5f6...
📥 Marking migration as applied...
✅ Baseline migration successfully marked as applied!
```

### Step 4: Rebuild and Deploy

```powershell
.\update.ps1
```

**What happens:**
- Backup created ✅
- Code pulled ✅
- Containers rebuilt (with NEW Dockerfile) ✅
- `prisma migrate deploy` runs (sees baseline already applied, does nothing) ✅
- App starts ✅

### Step 5: Verify

```powershell
# Check migration status
docker-compose exec -T web npx prisma migrate status

# Expected: "Database schema is up to date!"

# Count announcements (should be unchanged)
docker-compose exec -T db psql -U postgres announcement_db -c "SELECT COUNT(*) FROM announcements;"
```

---

## Troubleshooting

### "No migrations found to apply"

✅ **GOOD** - This means baseline is marked and no new migrations exist

###  "Migration `20260206000000_baseline_multisite` failed to apply"

❌ **PROBLEM** - The baseline tried to execute (which would recreate tables)

**Fix:**
```powershell
# Manually mark as applied
docker-compose exec -T web npx tsx prisma/mark-baseline-applied.ts
```

### "Cannot reach database server"

Make sure DB container is running:
```powershell
docker-compose ps
# db should show "Up" and "healthy"
```

---

## Future Schema Changes

**OLD WAY (DANGEROUS):**
```bash
# Edit schema.prisma
# Run: npx prisma db push --accept-data-loss  ❌ DON'T DO THIS
```

**NEW WAY (SAFE):**
```bash
# 1. Edit schema.prisma
# 2. Create migration
docker-compose exec -T web npx prisma migrate dev --name add_my_feature

# 3. Commit migration files
git add prisma/migrations/
git commit -m "feat: Add my_feature migration"

# 4. Deploy (via update.ps1)
.\update.ps1  # This now runs: prisma migrate deploy
```

---

## Rollback Plan

If something goes wrong:

```powershell
# 1. Stop containers
docker-compose down

# 2. Start only DB
docker-compose up -d db
Start-Sleep -Seconds 5

# 3. Restore from backup
$backupFile = "backups/db_backup_YYYYMMDD_HHMMSS.sql"  # Use latest
Get-Content $backupFile | docker-compose exec -T db psql -U postgres announcement_db

# 4. Restart all
docker-compose up -d
```

---

## Verification Checklist

- [ ] Git pulled successfully
- [ ] Baseline migration marked as applied
- [ ] update.ps1 completed without errors
- [ ] `prisma migrate status` shows "up to date"
- [ ] Announcement count unchanged
- [ ] Categories still exist
- [ ] Can login to admin panel
- [ ] Can view articles on site

---

## Next Steps (After Successful Deployment)

1. **Re-enable web-based updates** (future task)
2. **Train team on new migration workflow**
3. **Document schema change process**
4. **Create rollback automation**

---

## Questions?

Check the deep analysis report for detailed explanations:
- `deep_analysis_report.md` - Full root cause analysis
- `task.md` - Implementation checklist
