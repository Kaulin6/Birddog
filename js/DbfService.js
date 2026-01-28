
/**
 * DbfService.js
 * Service to efficiently load and query the local allsales.dbf file.
 * Optimized for lookups by Neighborhood Code (NBHC).
 */

const DBF_PATH = 'DBF/allsales.dbf';

export const DbfService = {
    buffer: null,
    header: null,
    fields: [],

    // Status flags
    isLoading: false,
    isReady: false,

    /**
     * Parse the DBF header and fields. 
     * Does not load the whole body if not needed, but for now we load all for client-side filtering.
     */
    async init() {
        if (this.isReady || this.isLoading) return;
        this.isLoading = true;

        console.log('DbfService: Loading DBF file...');
        try {
            const response = await fetch(DBF_PATH);
            if (!response.ok) throw new Error('Failed to load DBF file');

            // Streaming load or full load?
            // For 600MB, streaming is better for memory, but for *random access* queries by NBHC,
            // we either index it or load it.
            // Client-side indexing of 2.4M records is heavy.
            // Let's load the buffer but only parse records on demand.

            this.buffer = await response.arrayBuffer();
            this.parseHeader();
            this.isReady = true;
            console.log('DbfService: Ready. Records:', this.header.numRecords);
        } catch (err) {
            console.error('DbfService Init Error:', err);
        } finally {
            this.isLoading = false;
        }
    },

    parseHeader() {
        const view = new DataView(this.buffer);
        this.header = {
            version: view.getUint8(0),
            numRecords: view.getUint32(4, true),
            headerLen: view.getUint16(8, true),
            recordLen: view.getUint16(10, true)
        };

        // Parse Fields
        this.fields = [];
        let offset = 32;
        while (offset < this.header.headerLen) {
            if (view.getUint8(offset) === 0x0D) break; // Terminator

            const nameBytes = new Uint8Array(this.buffer, offset, 11);
            let name = new TextDecoder().decode(nameBytes).replace(/\u0000/g, '').trim();
            const type = String.fromCharCode(view.getUint8(offset + 11));
            const len = view.getUint8(offset + 16);

            this.fields.push({ name, type, len, offset: 0 });
            offset += 32;
        }

        // Calculate relative offsets
        let currentOffset = 1; // 1 byte for deletion flag
        this.fields.forEach(f => {
            f.offset = currentOffset;
            currentOffset += f.len;
        });
    },

    /**
     * Get field definition by name
     */
    getField(name) {
        return this.fields.find(f => f.name === name);
    },

    /**
     * Find comparable sales in a specific neighborhood.
     * @param {string} nbhc - Neighborhood Code
     * @param {Object} criteria - Optional filters (minDate, qualifiedOnly)
     */
    getCompsByNeighborhood(nbhc, criteria = {}) {
        if (!this.isReady) {
            console.warn('DbfService: Not ready yet.');
            return [];
        }

        const { minDate, qualifiedOnly } = criteria;
        const nbhcField = this.getField('NBHC');
        const dateField = this.getField('S_DATE');
        const quField = this.getField('QU'); // Qualified
        const amtField = this.getField('S_AMT');
        const viField = this.getField('VI'); // Vacant/Improved

        if (!nbhcField) return [];

        const results = [];
        const view = new DataView(this.buffer);
        const { headerLen, recordLen, numRecords } = this.header;
        const limit = 50; // Max comps to return

        // Scan backwards for recent sales first
        for (let i = numRecords - 1; i >= 0; i--) {
            if (results.length >= limit) break;

            const recOffset = headerLen + (i * recordLen);

            // Skip deleted
            if (new Uint8Array(this.buffer, recOffset, 1)[0] === 0x2A) continue;

            // Check Neighborhood (Fast check)
            const recordNbhc = this.readField(recOffset, nbhcField).trim();
            if (recordNbhc !== nbhc) continue;

            // Check V/I (We usually want Improved for house comps, Vacant for land)
            // Default to 'I' if not specified? Let's just return what matches criteria.

            // Check Qualified
            if (qualifiedOnly) {
                const qu = this.readField(recOffset, quField);
                if (qu !== 'Q') continue;
            }

            // Check Date
            if (minDate) {
                const date = this.readField(recOffset, dateField);
                if (date < minDate) continue;
            }

            // Check Amount (Filter out $100 transfers)
            const amtStr = this.readField(recOffset, amtField);
            const amt = parseFloat(amtStr);
            if (amt < 10000) continue;

            // Parse full record for result
            results.push(this.parseRecord(recOffset));
        }

        return results;
    },

    readField(recOffset, fieldDef) {
        const bytes = new Uint8Array(this.buffer, recOffset + fieldDef.offset, fieldDef.len);
        return new TextDecoder().decode(bytes).trim();
    },

    parseRecord(recOffset) {
        const record = {};
        this.fields.forEach(f => {
            let val = this.readField(recOffset, f);
            if (f.name === 'S_AMT') val = parseFloat(val);
            record[f.name] = val;
        });
        return record;
    }
};
