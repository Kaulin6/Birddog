const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const CONFIG = {
    // Basic FSBO Tampa URL
    url: 'https://www.zillow.com/tampa-fl/fsbo/',
    outputFile: 'leads_zillow.json',
    maxPages: 3 // Target 3 pages (~120 leads potential if max results per page, usually 40 per page)
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min) + min);

(async () => {
    console.log(`Starting Zillow Scraper for: ${CONFIG.url}`);

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    try {
        await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log('Page loaded. Starting scraping loop...');

        const allLeads = [];

        for (let pageNum = 1; pageNum <= CONFIG.maxPages; pageNum++) {
            console.log(`Scraping Page ${pageNum}...`);

            // Random sleep to act human
            await sleep(randomDelay(3000, 5000));

            // Scroll loop to trigger lazy loading
            await page.evaluate(async () => {
                const distance = 400;
                let scrolled = 0;
                // Zillow often has ~40 cards or so. Scroll enough to cover them.
                while (scrolled < 10000) {
                    document.scrollingElement.scrollBy(0, distance);
                    scrolled += distance;
                    await new Promise(r => setTimeout(r, 400));
                    if (document.scrollingElement.scrollTop + window.innerHeight >= document.scrollingElement.scrollHeight) break;
                }
            });
            await sleep(2000);

            // Scrape Data from current page
            const pageLeads = await page.evaluate(() => {
                const results = [];
                // Simplified selectors
                const cards = document.querySelectorAll('article, [data-test="property-card"]');

                cards.forEach((card) => {
                    const priceEl = card.querySelector('[data-test="property-card-price"]');
                    const addrEl = card.querySelector('address');

                    // Zillow list items often have links wrapping the whole card or specific parts
                    const linkEl = card.querySelector('a[href*="/homedetails/"]');

                    const price = priceEl ? priceEl.innerText : null;
                    const address = addrEl ? addrEl.innerText : null;
                    const link = linkEl ? linkEl.href : null;

                    if (price && address) {
                        // Basic parsing
                        const priceNum = parseInt(price.replace(/[^0-9]/g, '')) || 0;
                        results.push({
                            address: address,
                            owner_name: "FSBO Seller",
                            mailing_address: "Same as Property",
                            property_details: {
                                summary: "View Link for Details",
                                source_link: link || ''
                            },
                            financials: {
                                list_price: priceNum,
                                arv: Math.floor(priceNum * 1.1),
                                equity_percent: 10,
                                repair_estimate: 20000
                            },
                            distress_flags: ['FSBO'],
                            opportunity_score: 80,
                            status: 'Active',
                            source: 'Zillow'
                        });
                    }
                });
                return results;
            });

            console.log(`Page ${pageNum}: Found ${pageLeads.length} leads.`);
            allLeads.push(...pageLeads);

            // Incremental Save
            fs.writeFileSync(CONFIG.outputFile, JSON.stringify(allLeads, null, 2));

            // Next Page Logic
            if (pageNum < CONFIG.maxPages) {
                // Try multiple selector types for 'Next'
                const nextButton = await page.$('a[title="Next page"], a[rel="next"], [data-test="pagination-next-button"]');
                if (nextButton) {
                    // Check if disabled
                    const isDisabled = await page.evaluate(el => el.getAttribute('aria-disabled') === 'true' || el.disabled, nextButton);
                    if (isDisabled) {
                        console.log("Next button disabled. Reached end.");
                        break;
                    }

                    console.log('Navigating to next page...');
                    try {
                        await Promise.all([
                            // Wait for either navigation or just a bit of time if it's SPA
                            new Promise(r => setTimeout(r, 5000)),
                            nextButton.click()
                        ]);
                    } catch (navErr) {
                        console.warn("Navigation warning:", navErr.message);
                        break;
                    }
                } else {
                    console.log('No next page found. Stopping.');
                    break;
                }
            }
        }

        const finalLeads = allLeads.map((lead, idx) => ({
            ...lead,
            id: `zillow_${Date.now()}_${idx}`
        }));

        console.log(`Total Leads Scraped: ${finalLeads.length}`);
        fs.writeFileSync(CONFIG.outputFile, JSON.stringify(finalLeads, null, 2));
        console.log(`Saved to ${CONFIG.outputFile}`);

    } catch (err) {
        console.error('Error scraping Zillow:', err);
    } finally {
        await browser.close();
    }
})();
