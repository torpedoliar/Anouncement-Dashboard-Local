
const fs = require('fs');
const path = require('path');

const BACKUP_FILE = 'db_backup_20260205_093159.sql';

function debugParser() {
    console.log("🚀 Starting Debug Parser...");

    const backupPath = path.join(process.cwd(), BACKUP_FILE);
    if (!fs.existsSync(backupPath)) {
        console.error(`❌ Backup file not found: ${backupPath}`);
        return;
    }

    const fileContent = fs.readFileSync(backupPath, 'utf-8');
    const lines = fileContent.split('\n');
    console.log(`📂 Read backup file: ${lines.length} lines`);

    let inAnnouncements = false;
    let announcementCount = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for start block
        if (line.includes('COPY public.announcements')) {
            console.log(`\n✅ Found START block at line ${i + 1}:`);
            console.log(`   "${line.substring(0, 100)}..."`);
            inAnnouncements = true;
            continue;
        }

        // Check for end block
        if (inAnnouncements && line.trim() === '\\.') {
            console.log(`✅ Found END block at line ${i + 1}`);
            inAnnouncements = false;
            break;
        }

        if (inAnnouncements && line.trim()) {
            announcementCount++;

            // Analyze the first few lines closely
            if (announcementCount <= 3) {
                console.log(`\n🔍 Analyzing Announcement Line ${announcementCount} (File Line ${i + 1}):`);

                // 1. Check RAW line content (escape special chars)
                console.log(`   RAW: ${JSON.stringify(line.substring(0, 50))}...`);

                // 2. Try Splitting by TAB
                const cols = line.split('\t');
                console.log(`   Split by '\\t': ${cols.length} columns`);

                // 3. If split fails (length 1), try detecting other delimiters
                if (cols.length < 15) {
                    console.warn(`   ⚠️ WARNING: Split resulted in ${cols.length} columns (Expect > 15).`);
                    if (line.includes(',')) console.log(`   (Hint: Line contains commas. Is it CSV?)`);
                    if (line.includes('|')) console.log(`   (Hint: Line contains pipes. Is it Pipe-delimited?)`);
                } else {
                    console.log(`   ✅ Columns look good (${cols.length}). Index 15 (wordCount) value: "${cols[15]}"`);
                    console.log(`   Index 20 (categoryId) value: "${cols[20]}"`);
                    // Check if category ID looks like a CUID
                    if (cols[20] && cols[20].length > 20) {
                        console.log(`   ✅ Category ID format looks plausible.`);
                    } else {
                        console.warn(`   ⚠️ Category ID look suspicious: "${cols[20]}"`);
                    }
                }
            }
        }
    }

    console.log(`\nTotal Announcement Lines Detected: ${announcementCount}`);
}

debugParser();
