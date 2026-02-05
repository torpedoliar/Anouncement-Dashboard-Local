
const fs = require('fs');
const path = require('path');

const BACKUP_FILE = 'db_backup_20260205_093159.sql';

function dumpLines() {
    console.log("🚀 Dumping Lines 495-505...");
    const backupPath = path.join(process.cwd(), BACKUP_FILE);
    const fileContent = fs.readFileSync(backupPath, 'utf-8');
    const lines = fileContent.split('\n');

    for (let i = 495; i < 505; i++) {
        if (i >= lines.length) break;
        const line = lines[i];
        console.log(`\n[Line ${i + 1}] Length: ${line.length}`);
        console.log(`Content: "${line}"`);
        console.log(`Hex: `);
        for (let j = 0; j < Math.min(line.length, 50); j++) {
            process.stdout.write(`${line.charCodeAt(j).toString(16)} `);
        }
        console.log("");
    }
}

dumpLines();
