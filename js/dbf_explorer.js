
/**
 * dbf_explorer.js
 * Client-side DBF Parser and Viewer V2
 * Features: Stream Parsing on Filter, Infinite Scroll, CSV Export
 */

const DBF_URL = 'DBF/allsales.dbf';

// Field Descriptions
const FIELD_DESCRIPTIONS = {
    'PIN': 'Property Identification Number\nUnique ID for the parcel.',
    'FOLIO': 'Folio Number\nAlternative ID used by County.',
    'DOR_CODE': 'Dept. of Revenue Code\nUse Code (e.g., 0100 = SF Residential).',
    'NBHC': 'Neighborhood Code\nAppraisal neighborhood ID.',
    'S_DATE': 'Sale Date\nYYYYMMDD format.',
    'VI': 'Vacant / Improved\nV = Vacant Land\nI = Improved (Building)',
    'QU': 'Qualified / Unqualified\nQ = Arm\'s Length (Market Value)\nU = Unqualified (e.g. Foreclosure, Family Transfer)',
    'REA_CD': 'Reason Code\nWhy sale is qualified/unqualified.',
    'S_AMT': 'Sale Amount\nPrice stored in county records.',
    'SUB': 'Subdivision Code',
    'STR': 'Section-Township-Range',
    'S_TYPE': 'Sale Instrument Type\nWD = Warranty Deed, QC = Quit Claim, etc.',
    'OR_BK': 'Official Record Book',
    'OR_PG': 'Official Record Page',
    'GRANTOR': 'Seller Name',
    'GRANTEE': 'Buyer Name',
    'DOC_NUM': 'Document Number'
};

const App = {
    rawBuffer: null, // Full file buffer
    header: null,    // DBF Header Info
    fields: [],      // Field Definitions

    // Display State
    filteredIndices: [], // Array of integers (record indices) ensuring low memory usage
    displayLimit: 100,
    BATCH_SIZE: 100,

    init() {
        this.bindEvents();
        document.getElementById('emptyState').style.display = 'block';

        // Setup Infinite Scroll
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                this.loadMore();
            }
        }, { root: document.getElementById('gridContainer'), threshold: 0.1 });

        // Add sentinel dynamically if not present? 
        // We'll append rows, so the sentinel should be at the bottom of the TABLE or Container.
        // Actually, let's just use the end of the table.
    },

    bindEvents() {
        document.getElementById('loadDbfBtn').addEventListener('click', () => this.loadData());
        document.getElementById('applyFiltersBtn').addEventListener('click', () => {
            this.runFilterScan();
        });
        document.getElementById('downloadCsvBtn').addEventListener('click', () => this.downloadCsv());

        // Attach Scroll Listener for simpler "Load More"
        const container = document.getElementById('gridContainer');
        container.addEventListener('scroll', () => {
            if (container.scrollTop + container.clientHeight >= container.scrollHeight - 100) {
                this.loadMore();
            }
        });
    },

    async loadData() {
        const overlay = document.getElementById('loadingOverlay');
        const progressEl = document.getElementById('loadingProgress');
        const textEl = document.getElementById('loadingText');

        overlay.classList.remove('hidden');
        textEl.textContent = 'Fetching DBF File...';

        try {
            if (window.location.protocol === 'file:') {
                alert('Browser Security Restriction: Cannot load huge DBF files directly from disk.\n\nPlease use the "Server" link I just opened, or run a local server.');
            }
            const response = await fetch(DBF_URL);
            if (!response.ok) throw new Error(`Failed to load DBF: ${response.statusText}`);

            const contentLength = response.headers.get('content-length');
            const totalBytes = parseInt(contentLength, 10);

            const reader = response.body.getReader();
            let receivedLength = 0;
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                receivedLength += value.length;

                if (totalBytes) {
                    const pct = Math.round((receivedLength / totalBytes) * 100);
                    progressEl.textContent = `${pct}%`;
                }
            }

            textEl.textContent = 'Processing...';
            await new Promise(r => setTimeout(r, 10));

            const dbfBuffer = new Uint8Array(receivedLength);
            let position = 0;
            for (let chunk of chunks) {
                dbfBuffer.set(chunk, position);
                position += chunk.length;
            }

            this.rawBuffer = dbfBuffer; // Store globally
            this.parseHeader();

            // Initial "Scan" (Recent 5000)
            this.runFilterScan(true); // true = recent only default

        } catch (error) {
            console.error(error);
            alert('Error: ' + error.message);
        } finally {
            overlay.classList.add('hidden');
        }
    },

    parseHeader() {
        const view = new DataView(this.rawBuffer.buffer);
        const version = view.getUint8(0);
        const numRecords = view.getUint32(4, true);
        const headerLen = view.getUint16(8, true);
        const recordLen = view.getUint16(10, true);

        this.header = { version, numRecords, headerLen, recordLen };
        console.log('Header Parsed:', this.header);

        // Parse Fields
        this.fields = [];
        let offset = 32;
        while (offset < headerLen) {
            if (view.getUint8(offset) === 0x0D) break;

            const nameBytes = new Uint8Array(this.rawBuffer.buffer, offset, 11);
            let name = '';
            for (let i = 0; i < 11; i++) {
                if (nameBytes[i] === 0) break;
                name += String.fromCharCode(nameBytes[i]);
            }
            name = name.trim();
            const type = String.fromCharCode(view.getUint8(offset + 11));
            const len = view.getUint8(offset + 16);

            this.fields.push({ name, type, len, offset: 0 });
            offset += 32;
        }

        // Calculate relative offsets
        let currentOffset = 1;
        this.fields.forEach(f => {
            f.offset = currentOffset;
            currentOffset += f.len;
        });

        // Setup Grid Header
        this.renderTableHeader();
    },

    renderTableHeader() {
        const thead = document.getElementById('gridHeader');
        thead.innerHTML = '<tr>' + this.fields.map(f => {
            const desc = FIELD_DESCRIPTIONS[f.name];
            if (desc) {
                return `<th><div class="header-cell">${f.name}<span class="info-icon" data-tooltip="${desc}">i</span></div></th>`;
            }
            return `<th>${f.name}</th>`;
        }).join('') + '</tr>';
    },

    // --- Core Scanning Logic ---
    runFilterScan(isInitial = false) {
        if (!this.rawBuffer) return;

        const overlay = document.getElementById('loadingOverlay');
        const textEl = document.getElementById('loadingText');
        overlay.classList.remove('hidden');
        document.getElementById('loadingProgress').textContent = '';
        textEl.textContent = 'Filtering Records...';

        // Get Filter Values
        const minDate = document.getElementById('filterDate').value;
        const minAmt = parseFloat(document.getElementById('filterAmount').value) || 0;
        const buyerName = document.getElementById('filterGrantee').value.toLowerCase();
        const pin = document.getElementById('filterPin').value.toLowerCase();
        const reaCd = document.getElementById('filterReaCd').value;
        const qualifiedOnly = document.getElementById('filterQualified').checked;

        // Reset Display
        this.filteredIndices = [];
        this.displayLimit = this.BATCH_SIZE;
        document.getElementById('gridBody').innerHTML = '';

        // Optimization: Pre-calculate offsets used in filtering
        const dateField = this.fields.find(f => f.name === 'S_DATE');
        const amtField = this.fields.find(f => f.name === 'S_AMT');
        const quField = this.fields.find(f => f.name === 'QU');
        const granteeField = this.fields.find(f => f.name === 'GRANTEE');
        const pinField = this.fields.find(f => f.name === 'PIN');
        const reaField = this.fields.find(f => f.name === 'REA_CD');

        setTimeout(() => { // Allow UI to render loading state
            const { numRecords, headerLen, recordLen } = this.header;
            const buffer = this.rawBuffer;
            const indices = [];

            // If initial load, only look at last 5000 to be fast
            const startIndex = isInitial ? Math.max(0, numRecords - 5000) : 0;

            // Loop backwards for "Recent First"
            for (let i = numRecords - 1; i >= startIndex; i--) {
                const recOffset = headerLen + (i * recordLen);
                if (recOffset + recordLen > buffer.length) continue;

                if (buffer[recOffset] === 0x2A) continue; // Deleted

                // DIRECT BUFFER CHECKS (Fastest)

                // 1. Qualified
                if (qualifiedOnly && quField) {
                    const qVal = String.fromCharCode(buffer[recOffset + quField.offset]);
                    if (qVal !== 'Q') continue;
                }

                // 2. REA_CD
                if (reaCd && reaField) {
                    let val = '';
                    for (let k = 0; k < reaField.len; k++) val += String.fromCharCode(buffer[recOffset + reaField.offset + k]);
                    if (val.trim() !== reaCd) continue;
                }

                // 3. Date
                if (minDate && dateField) {
                    let val = '';
                    for (let k = 0; k < 8; k++) val += String.fromCharCode(buffer[recOffset + dateField.offset + k]);
                    if (val < minDate) continue;
                }

                // 4. Amount (Requires Parsing Number)
                if (minAmt && amtField) {
                    let val = '';
                    for (let k = 0; k < amtField.len; k++) val += String.fromCharCode(buffer[recOffset + amtField.offset + k]);
                    if (parseFloat(val) < minAmt) continue;
                }

                // 5. PIN (String Includes)
                if (pin && pinField) {
                    let val = '';
                    for (let k = 0; k < pinField.len; k++) val += String.fromCharCode(buffer[recOffset + pinField.offset + k]);
                    if (!val.toLowerCase().includes(pin)) continue;
                }

                // 6. Grantee (String Includes)
                if (buyerName && granteeField) {
                    let val = '';
                    for (let k = 0; k < granteeField.len; k++) val += String.fromCharCode(buffer[recOffset + granteeField.offset + k]);
                    if (!val.toLowerCase().includes(buyerName)) continue;
                }

                indices.push(i);
            }

            this.filteredIndices = indices;

            // Hide Overlay and Render First Batch
            overlay.classList.add('hidden');
            document.getElementById('statusCount').textContent = `Rows: ${indices.length} (Filtered from ${numRecords})`;
            document.getElementById('emptyState').style.display = indices.length === 0 ? 'block' : 'none';

            this.renderBatch(0, this.displayLimit);
        }, 50);
    },

    renderBatch(start, end) {
        const tbody = document.getElementById('gridBody');
        const slice = this.filteredIndices.slice(start, end);
        if (slice.length === 0) return;

        const { headerLen, recordLen } = this.header;
        const buffer = this.rawBuffer;

        let html = '';
        slice.forEach(idx => {
            const recOffset = headerLen + (idx * recordLen);

            html += '<tr>';
            this.fields.forEach(f => {
                let val = '';
                for (let k = 0; k < f.len; k++) {
                    val += String.fromCharCode(buffer[recOffset + f.offset + k]);
                }
                val = val.trim();

                // Format Money
                if (f.name === 'S_AMT') {
                    const num = parseFloat(val);
                    val = isNaN(num) ? val : num.toLocaleString('en-US', { maximumFractionDigits: 0 });
                }

                html += `<td>${val}</td>`;
            });
            html += '</tr>';
        });

        if (start === 0) tbody.innerHTML = html;
        else tbody.insertAdjacentHTML('beforeend', html);
    },

    loadMore() {
        if (this.displayLimit >= this.filteredIndices.length) return;

        const nextLimit = this.displayLimit + this.BATCH_SIZE;
        this.renderBatch(this.displayLimit, nextLimit);
        this.displayLimit = nextLimit;
    },

    downloadCsv() {
        if (this.filteredIndices.length === 0) {
            alert('No data to download.');
            return;
        }

        const overlay = document.getElementById('loadingOverlay');
        const textEl = document.getElementById('loadingText');
        overlay.classList.remove('hidden');
        textEl.textContent = 'Generating CSV...';

        setTimeout(() => {
            const { headerLen, recordLen } = this.header;
            const buffer = this.rawBuffer;

            // Header
            let csv = this.fields.map(f => `"${f.name}"`).join(',') + '\n';

            // Rows
            this.filteredIndices.forEach(idx => {
                const recOffset = headerLen + (idx * recordLen);
                const row = this.fields.map(f => {
                    let val = '';
                    for (let k = 0; k < f.len; k++) val += String.fromCharCode(buffer[recOffset + f.offset + k]);
                    val = val.trim().replace(/"/g, '""'); // Escape quotes
                    return `"${val}"`;
                }).join(',');
                csv += row + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sales_export_${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            overlay.classList.add('hidden');
        }, 50);
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
