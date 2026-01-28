const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const CONFIG = {
    // Redfin URL for Tampa, "Fixer Upper" keyword often involves complexity, 
    // but we can try a direct search URL or simulate user typing.
    // For MVP, we will use a known search URL pattern for "Tampa" + "Fixer Upper" if possible, 
    // OR just general Tampa listings and we filter by description text if visible.
    // Redfin is TOUGH on bots. We will try a 'just sold' or 'active' page and look for keywords.
    // URL below is 'Tampa' generic.
    url: 'https://www.redfin.com/city/18142/FL/Tampa/filter/remarks=tlc,sort=lo-price',
    outputFile: 'leads_redfin.json'
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    console.log(`Starting Redfin Scraper for: ${CONFIG.url}`);

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('Page loaded...');

        // Redfin often shows a captcha or a "Unusual activity" block.
        // If blocked, we might only get a few.
        await sleep(5000);

        // Scroll
        await page.evaluate(async () => {
            window.scrollBy(0, 600);
            await new Promise(r => setTimeout(r, 1000));
            window.scrollBy(0, 600);
        });

        const leads = await page.evaluate(() => {
            const results = [];
            // Redfin Cards usually have class 'HomeCardContainer' or similar
            const cards = document.querySelectorAll('.HomeCardContainer, .bp-HomeCard');

            cards.forEach((card, index) => {
                // Redfin classes are obfuscated often, try generic approach
                const text = card.innerText;
                const priceEl = card.querySelector('.homecardV2Price, .bp-Homecard__Price--value');
                const addrEl = card.querySelector('.homeAddressV2, .bp-Homecard__Address');
                const linkEl = card.querySelector('a[href^="/FL/Tampa"]');

                const price = priceEl ? priceEl.innerText : null;
                const address = addrEl ? addrEl.innerText : null;
                const link = linkEl ? linkEl.href : null;

                if (price && address) {
                    // Check for "Fixer Upper" cues if accessible, or just assume the filter worked
                    // Since we put 'tlc' in the URL filter, we assume these are leads.

                    const priceNum = parseInt(price.replace(/[^0-9]/g, '')) || 0;

                    results.push({
                        id: `redfin_${index}`,
                        address: address,
                        owner_name: "Unknown (Redfin)",
                        mailing_address: "Unknown",
                        property_details: {
                            summary: "Fixer Upper / TLC",
                            source_link: link || ''
                        },
                        financials: {
                            list_price: priceNum,
                            arv: Math.floor(priceNum * 1.3), // Higher spread for fixer uppers
                            equity_percent: 15,
                            repair_estimate: 40000 // Higher repairs
                        },
                        distress_flags: ['Fixer Upper', 'TLC'],
                        opportunity_score: 75,
                        status: 'Active',
                        source: 'Redfin'
                    });
                }
            });
            return results;
        });

        console.log(`Found ${leads.length} leads on Redfin.`);
        fs.writeFileSync(CONFIG.outputFile, JSON.stringify(leads, null, 2));

    } catch (err) {
        console.error('Error scraping Redfin:', err);
    } finally {
        await browser.close();
    }
})();
