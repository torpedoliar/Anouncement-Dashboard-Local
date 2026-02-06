# Legacy Data Restoration - Usage Guide

**Version:** 2.5.1  
**Script:** `restore-legacy-production.ps1`  
**Data Script:** `scripts/restore-legacy-data.ts`

---

## What It Does

Restores legacy data from SQL backup files to the current production database:
- ✅ **Categories** - Restores all categories with proper site assignment
- ✅ **Announcements** - Restores all articles with content, media, and metadata
- ✅ **Comments** - Restores all comments linked to announcements
- ✅ **Site Links** - Creates relationships between articles and default site

---

## Prerequisites

### 1. Default Site Must Exist

The script requires a site with `isDefault = true` to exist:

```powershell
# Check if default site exists
docker-compose exec -T db psql -U postgres announcement_db -c "SELECT id, name, slug, \"isDefault\" FROM sites WHERE \"isDefault\" = true;"
```

**If no default site exists, create one:**
```powershell
# Run seed script to create default site
docker-compose exec -T web npx tsx prisma/seed.ts
```

### 2. Backup File

You need a SQL backup file from `pg_dump`. Default expected: `db_backup_20260205_093159.sql`

---

## Usage

### Basic Usage (Default Backup File)

```powershell
.\restore-legacy-production.ps1
```

Uses default backup: `db_backup_20260205_093159.sql`

### Custom Backup File

```powershell
.\restore-legacy-production.ps1 -BackupFile "backups/my_backup.sql"
```

---

## What Happens

### Step 1: Validation

- Checks if backup file exists locally
- Finds and verifies web container is running

### Step 2: File Copy

Copies to container:
- Backup SQL file
- `restore-legacy-data.ts` script

### Step 3: Restoration Process

Inside container, the script:

1. **Finds Default Site**
   ```
   ✅ Default Site Found: Santos Jaya Abadi (clxyz123...)
   ```

2. **Finds Default Author** (Optional)
   ```
   ✅ Default Author Found: Admin User (clxyz456...)
   ```
   *If not found, announcements will have `authorId = null`*

3. **Processes Categories**
   ```
   🔄 Restoring Categories...
     -> Found Categories block!
     -> Restored Category: Berita
     -> Restored Category: Pengumuman
     -> End of Categories block.
   ```

4. **Processes Announcements**
   ```
   🔄 Restoring Announcements...
     -> Found Announcements block!
     ℹ️ First restored announcement: [clxyz789...] Judul Artikel
     -> End of Announcements block.
   ```

5. **Processes Comments**
   ```
   🔄 Restoring Comments...
     -> Found Comments block!
     ℹ️ First restored comment: [clxyz012...] by John Doe
     -> End of Comments block.
   ```

### Step 4: Summary

```
=================================
✅ RESTORATION COMPLETE
📊 Categories Restored:    5
📊 Announcements Restored: 120
📊 Comments Restored:      34
🔗 Site Links Created:     120
=================================
```

---

## Verification

### Check Restored Data

```powershell
# Count categories
docker-compose exec -T db psql -U postgres announcement_db -c "SELECT COUNT(*) FROM categories;"

# Count announcements
docker-compose exec -T db psql -U postgres announcement_db -c "SELECT COUNT(*) FROM announcements;"

# Count comments
docker-compose exec -T db psql -U postgres announcement_db -c "SELECT COUNT(*) FROM comments;"

# Check site links
docker-compose exec -T db psql -U postgres announcement_db -c "SELECT COUNT(*) FROM announcement_sites;"
```

### View Sample Data

```powershell
# View first 5 announcements
docker-compose exec -T db psql -U postgres announcement_db -c "SELECT id, title, \"categoryId\", \"isPublished\", \"createdAt\" FROM announcements ORDER BY \"createdAt\" DESC LIMIT 5;"

# View first 5 comments
docker-compose exec -T db psql -U postgres announcement_db -c "SELECT id, \"announcementId\", \"authorName\", content, status FROM comments LIMIT 5;"
```

---

## Troubleshooting

### Error: "No Default Site found!"

**Solution:** Run seed script first
```powershell
docker-compose exec -T web npx tsx prisma/seed.ts
```

### Error: "Backup file not found"

**Solution:** Check file path
```powershell
# List files in current directory
ls *.sql

# Or specify full path
.\restore-legacy-production.ps1 -BackupFile "E:\Backups\db_backup_20260205_093159.sql"
```

### Error: "Foreign key constraint failed"

**Cause:** Category doesn't exist for announcement

**What happens:** Script automatically skips that announcement and continues

**Check logs** for specific errors

### Error: "Web container not running"

**Solution:** Start containers first
```powershell
docker-compose up -d
Start-Sleep -Seconds 10
.\restore-legacy-production.ps1
```

---

## Data Behavior

### Upsert Logic

- **Categories:** If ID exists, skip (don't overwrite)
- **Announcements:** If ID exists, skip (don't overwrite)
- **Comments:** If ID exists, skip (don't overwrite)
- **Site Links:** If relationship exists, skip

**Safe to run multiple times** - won't create duplicates

### Missing Data Handling

| Field | If Missing | Behavior |
|-------|------------|----------|
| Category slug | `\N` | Generates `category-{timestamp}` |
| Announcement content | `\N` | Uses empty string `""` |
| Comment authorName | `\N` | Defaults to `"Anonymous"` |
| Comment status | `\N` | Defaults to `"PENDING"` |
| Author (user) | Not found | Sets `authorId = null` |

---

## Important Notes

### Site Assignment

All restored data goes to the **Default Site** (`isDefault = true`)

### Author Assignment

- If `admin@example.com` exists → all announcements assigned to this user
- If not found → `authorId = null` (anonymous articles)

### Comment Validation

Comments are only restored if:
1. Announcement exists
2. AnnouncementId is valid

Invalid/orphaned comments are skipped with warning

---

## Next Steps After Restoration

1. **Verify Data**
   ```powershell
   # Quick check
   docker-compose exec -T db psql -U postgres announcement_db -c "
     SELECT 
       (SELECT COUNT(*) FROM announcements) as announcements,
       (SELECT COUNT(*) FROM categories) as categories,
       (SELECT COUNT(*) FROM comments) as comments;
   "
   ```

2. **Check Frontend**
   - Visit site: `http://localhost:3100/site/default`
   - Verify articles appear
   - Check categories work
   - Test comments display

3. **Optional: Assign Authors**
   If you want to assign specific authors to articles:
   ```sql
   UPDATE announcements 
   SET "authorId" = 'your-user-id' 
   WHERE "authorId" IS NULL;
   ```

---

## Related Scripts

- `seed.ts` - Creates default site and admin user
- `update.ps1` - Updates production (uses migration system now)
- `restore.ps1` - Restores from backup (full database restore)

---

## Summary

**Purpose:** Import legacy article data into new multi-site system  
**Safety:** Upsert-based, no duplicates, safe to re-run  
**Requirements:** Default site must exist  
**What Gets Restored:** Categories, Announcements, Comments, Site Links  
**Author Handling:** Auto-assigns to admin@example.com if exists
