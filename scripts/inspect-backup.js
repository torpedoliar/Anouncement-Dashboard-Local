
const fs = require('fs');
const path = require('path');

const BACKUP_FILE = 'db_backup_20260205_093159.sql';

function inspectBackup() {
    console.log("🚀 Starting Line Inspector...");
    const backupPath = path.join(process.cwd(), BACKUP_FILE);
    const fileContent = fs.readFileSync(backupPath, 'utf-8');
    const lines = fileContent.split('\n');

    console.log(`Total Lines: ${lines.length}`);

    // Search for the line grep found (around line 500)
    for (let i = 495; i < 505; i++) {
        if (i >= lines.length) break;
        const line = lines[i];

        console.log(`\n[Line ${i + 1}] Length: ${line.length}`);
        console.log(`Content: "${line}"`);

        if (line.includes('announcements')) {
            console.log("--> This line contains 'announcements'. Analyzing characters:");
            for (let j = 0; j < Math.min(line.length, 50); j++) {
                process.stdout.write(`${line.charCodeAt(j)}[${line[j]}] `);
            }
            console.log("\n");

            console.log("Check 'COPY public.announcements':", line.includes('COPY public.announcements'));
            console.log("Check 'COPY':", line.includes('COPY'));
        }
    }
}

inspectBackup();
