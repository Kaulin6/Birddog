const fs = require('fs');
const Papa = require('papaparse');

const OUTPUT_FILE = 'leads_real.json';
const OUTPUT_CSV = 'leads_real.csv';
const SOURCES = ['leads_zillow.json', 'leads_redfin.json'];

let allLeads = [];

SOURCES.forEach(file => {
    if (fs.existsSync(file)) {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            console.log(`Loaded ${data.length} leads from ${file}`);
            allLeads.push(...data);
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    } else {
        console.warn(`${file} not found. Skipping.`);
    }
});

// Deduplicate
const seenMap = new Map();
const uniqueLeads = [];

allLeads.forEach(lead => {
    // Normalize address lightly
    const key = lead.address.toLowerCase().trim();
    if (!seenMap.has(key)) {
        seenMap.set(key, true);
        uniqueLeads.push(lead);
    }
});

console.log(`Total Unique Leads: ${uniqueLeads.length}`);

// Sort by Opportunity Score Descending
uniqueLeads.sort((a, b) => b.opportunity_score - a.opportunity_score);

// Add global index IDs
const finalLeads = uniqueLeads.map((lead, idx) => ({
    ...lead,
    id: `lead_${idx}`
}));

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalLeads, null, 2));
console.log(`Merged data saved to ${OUTPUT_FILE}`);

// Export to CSV
const csv = Papa.unparse(finalLeads.map(lead => ({
    ID: lead.id,
    Address: lead.address,
    Price: lead.financials.list_price,
    ARV: lead.financials.arv,
    Equity_Percent: lead.financials.equity_percent,
    Opportunity_Score: lead.opportunity_score,
    Distress_Flags: lead.distress_flags.join(', '),
    Source: lead.source,
    Link: lead.property_details.source_link
})));

fs.writeFileSync(OUTPUT_CSV, csv);
console.log(`Merged data saved to ${OUTPUT_CSV}`);
