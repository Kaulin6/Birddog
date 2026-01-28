const fs = require('fs');

const CONFIG = {
    outputFile: 'leads.json',
    leadCount: 150 // Scaled up for "as many lists as we can" demo
};

// Simulation of "Driving for Dollars" or "List Stacking"
// Generating mock residential leads with various distress signals.

const STREET_NAMES = ['Maple', 'Oak', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lake', 'Hill', 'Main', 'Park', 'View', 'Sunset', 'Magnolia', 'Palm'];
// Tampa + 2hr Drive Radius
const CITIES = [
    'Tampa', 'St. Petersburg', 'Clearwater', 'Brandon', 'Riverview', // Immediate
    'Lakeland', 'Plant City', 'Spring Hill', // 30-45m
    'Sarasota', 'Bradenton', // 1h
    'Orlando', 'Kissimmee' // ~1.5h
];

const STATE = 'FL';
const MOCK_FLAGS = [
    'Vacant', 'Tax Delinquent', 'Pre-Foreclosure', 'Code Violation', 'Probate', 'Divorce Filing', 'Water Shutoff'
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomBool = (prob = 0.5) => Math.random() < prob;

const generateLead = (id) => {
    const isDistressed = randomBool(0.7); // 70% chance of having some distress
    const equity = randomInt(10, 100);
    const arv = randomInt(200, 600) * 1000;
    const repairEst = randomInt(20, 80) * 1000;

    // High equity + Distress = High Opportunity
    let score = 0;
    if (equity > 40) score += 30;
    if (equity > 80) score += 20;

    const flags = [];
    if (isDistressed) {
        const numFlags = randomInt(1, 3);
        for (let i = 0; i < numFlags; i++) {
            const flag = randomChoice(MOCK_FLAGS);
            if (!flags.includes(flag)) {
                flags.push(flag);
                score += 15;
            }
        }
    }

    // Absentee Owner Logic
    const isAbsentee = randomBool(0.4);
    let mailingAddr = "Same";
    if (isAbsentee) {
        mailingAddr = `${randomInt(100, 9999)} Other St, New York, NY`;
        flags.push("Absentee Owner");
        score += 10;
    }

    score = Math.min(score, 100);

    return {
        id: id,
        address: `${randomInt(100, 9999)} ${randomChoice(STREET_NAMES)} St, ${randomChoice(CITIES)}, ${STATE}`,
        owner_name: `Owner ${id}`,
        mailing_address: mailingAddr,
        property_details: {
            beds: randomInt(2, 5),
            baths: randomInt(1, 4),
            sqft: randomInt(1000, 3500),
            year_built: randomInt(1950, 2010),
            property_type: "Single Family"
        },
        financials: {
            arv: arv,
            estimated_loans: Math.floor(arv * (1 - (equity / 100))),
            equity_percent: equity,
            repair_estimate: repairEst
        },
        distress_flags: flags,
        opportunity_score: score,
        status: 'New'
    };
};

(async () => {
    console.log('Starting Residential Lead Collector (Simulation)...');

    const leads = [];
    for (let i = 0; i < CONFIG.leadCount; i++) {
        leads.push(generateLead(i + 1));
    }

    // Sort by opportunity score desc
    leads.sort((a, b) => b.opportunity_score - a.opportunity_score);

    fs.writeFileSync(CONFIG.outputFile, JSON.stringify(leads, null, 2));
    console.log(`Saved ${leads.length} residential leads to ${CONFIG.outputFile}`);
})();
