
const fs = require('fs');
const path = require('path');

const DBF_PATH = path.join(__dirname, 'allsales.dbf');

/**
 * Reads a DBF file and logs headers and records.
 */
function readDbf(filePath) {
    console.log(`Reading DBF file: ${filePath}`);

    const fd = fs.openSync(filePath, 'r');

    // 1. Read Header (32 bytes)
    const headerBuf = Buffer.alloc(32);
    fs.readSync(fd, headerBuf, 0, 32, 0);

    const version = headerBuf.readUInt8(0);
    const numRecords = headerBuf.readUInt32LE(4);
    const headerLen = headerBuf.readUInt16LE(8);
    const recordLen = headerBuf.readUInt16LE(10);

    console.log('--- DBF Header ---');
    console.log(`Version: ${version}`);
    console.log(`Total Records: ${numRecords}`);
    console.log(`Header Length: ${headerLen}`);
    console.log(`Record Length: ${recordLen}`);

    // 2. Read Field Descriptors
    // Starts at 32, ends when we find 0x0D or hit headerLen
    const fields = [];
    let offset = 32;

    while (offset < headerLen) {
        const fieldBuf = Buffer.alloc(32);
        fs.readSync(fd, fieldBuf, 0, 32, offset);

        // Check for terminator
        if (fieldBuf[0] === 0x0D) break;

        const name = fieldBuf.toString('ascii', 0, 11).replace(/\0/g, '').trim();
        const type = String.fromCharCode(fieldBuf[11]);
        const length = fieldBuf.readUInt8(16);
        const decimal = fieldBuf.readUInt8(17);

        fields.push({ name, type, length, decimal });
        offset += 32;
    }

    console.log('\n--- Field Definitions ---');
    fields.forEach(f => {
        console.log(`${f.name.padEnd(12)} | Type: ${f.type} | Len: ${f.length}`);
    });

    // 3. Read Records
    // To safe-guard, let's read the *last* 10 records to check for recency, 
    // and maybe the first 10 to see structure.

    console.log('\n--- First 5 Records ---');
    readRecords(fd, headerLen, recordLen, fields, 0, 5);

    console.log('\n--- Last 5 Records ---');
    const startLast = Math.max(0, numRecords - 5);
    readRecords(fd, headerLen, recordLen, fields, startLast, 5);

    fs.closeSync(fd);
}

function readRecords(fd, headerOffset, recordLen, fields, startIndex, count) {
    for (let i = 0; i < count; i++) {
        const currentIdx = startIndex + i;
        const position = headerOffset + (currentIdx * recordLen);
        const buffer = Buffer.alloc(recordLen);

        try {
            const bytesRead = fs.readSync(fd, buffer, 0, recordLen, position);
            if (bytesRead < recordLen) break;

            const isDeleted = buffer[0] === 0x2A; // '*'
            if (isDeleted) continue; // Skip deleted for display

            const record = parseRecord(buffer, fields);
            console.log(`[${currentIdx}]`, JSON.stringify(record));
        } catch (e) {
            console.error(`Error reading record ${currentIdx}:`, e.message);
        }
    }
}

function parseRecord(buffer, fields) {
    let offset = 1; // Skip deletion flag
    const record = {};

    fields.forEach(field => {
        const raw = buffer.toString('ascii', offset, offset + field.length);
        record[field.name] = raw.trim();
        offset += field.length;
    });

    return record;
}

if (fs.existsSync(DBF_PATH)) {
    readDbf(DBF_PATH);
} else {
    console.error(`File not found: ${DBF_PATH}`);
}
