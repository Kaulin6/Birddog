/**
 * PropertyService.js
 * Handles interactions with the RentCast API for property data.
 */

const RENTCAST_API_URL = 'https://api.rentcast.io/v1';
const STORAGE_KEY_API_KEY = 'birddog_rentcast_key';
const STORAGE_KEY_USAGE = 'birddog_rentcast_usage';
const DEFAULT_API_KEY = '05bf6824054442059c0bc2123bffbfae';
const FREE_LIMIT = 50;

export const PropertyService = {
    /**
     * Get the stored API key or use the default.
     */
    getApiKey() {
        return localStorage.getItem(STORAGE_KEY_API_KEY) || DEFAULT_API_KEY;
    },

    /**
     * Set the API key.
     * @param {string} key 
     */
    setApiKey(key) {
        localStorage.setItem(STORAGE_KEY_API_KEY, key);
    },

    /**
     * Get current usage count for the month.
     * Resets if the month has changed (stored as 'YYYY-MM').
     */
    getUsage() {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

        let stored = JSON.parse(localStorage.getItem(STORAGE_KEY_USAGE) || '{}');

        if (stored.month !== currentMonth) {
            stored = { month: currentMonth, count: 0 };
            localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(stored));
        }

        return stored.count;
    },

    incrementUsage() {
        console.log('PropertyService: Incrementing usage...');
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
        let stored = JSON.parse(localStorage.getItem(STORAGE_KEY_USAGE) || '{}');

        if (stored.month !== currentMonth) {
            stored = { month: currentMonth, count: 1 };
        } else {
            stored.count++;
        }

        localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(stored));
        console.log('PropertyService: New usage count:', stored.count);
        return stored.count;
    },

    /**
     * Fetch property details from RentCast.
     * @param {string} address - The full address to search.
     * @returns {Promise<Object>} - The property data.
     */
    async getPropertyDetails(address) {
        const usage = this.getUsage();
        if (usage >= FREE_LIMIT) {
            throw new Error(`Monthly limit reached (${usage}/${FREE_LIMIT}). Upgrade RentCast or wait until next month.`);
        }

        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('API Key missing. Please configure your RentCast API key.');
        }

        try {
            console.log(`PropertyService: Fetching property details for: ${address}`);
            // 1. Fetch Property Details
            const propUrl = `${RENTCAST_API_URL}/properties?address=${encodeURIComponent(address)}`;
            const propResponse = await fetch(propUrl, {
                headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' }
            });

            if (!propResponse.ok) throw new Error(`Property API Error: ${propResponse.statusText}`);

            const propData = await propResponse.json();
            this.incrementUsage(); // Count property fetch

            let property = null;
            if (propData && propData.length > 0) {
                property = propData[0];
            }

            // 2. Fetch Comps (if property found)
            let comps = [];
            if (property) {
                // Use property characteristics to find comps
                // RentCast /avm/value endpoint provides a value estimate AND comps
                // Or /properties/comparables
                // Let's use /properties/comparables for specific comp data
                // We need lat/long or address.

                const compUrl = `${RENTCAST_API_URL}/properties/comparables?address=${encodeURIComponent(address)}&radius=1&daysOld=180&limit=5`;

                // Check usage again before second call? 
                // For now, let's treat it as one user action, but technically it's 2 API calls.
                // We'll increment usage again.

                if (this.getUsage() < FREE_LIMIT) {
                    console.log('PropertyService: Fetching comps...');
                    const compResponse = await fetch(compUrl, {
                        headers: { 'X-Api-Key': apiKey, 'Accept': 'application/json' }
                    });

                    if (compResponse.ok) {
                        const compData = await compResponse.json();
                        comps = compData || [];
                        console.log(`PropertyService: Found ${comps.length} comps.`);
                        this.incrementUsage(); // Count comp fetch
                    } else {
                        console.warn('PropertyService: Failed to fetch comps', compResponse.statusText);
                    }
                }
            }

            return { property, comps };

        } catch (error) {
            console.error('PropertyService Error:', error);
            throw error;
        }
    },

    /**
     * Map RentCast data to Bird Dog OS internal format.
     * @param {Object} apiData 
     */
    mapDataToDeal(apiData) {
        if (!apiData) return {};

        // Get most recent tax year
        const currentYear = new Date().getFullYear();
        const recentTaxYear = apiData.propertyTaxes ?
            Object.keys(apiData.propertyTaxes).sort().reverse()[0] : null;
        const recentAssessmentYear = apiData.taxAssessments ?
            Object.keys(apiData.taxAssessments).sort().reverse()[0] : null;

        return {
            // Basic Info
            address: apiData.formattedAddress || apiData.addressLine1,
            city: apiData.city,
            state: apiData.state,
            zip: apiData.zipCode,
            beds: apiData.bedrooms,
            baths: apiData.bathrooms,
            sqft: apiData.squareFootage,
            yearBuilt: apiData.yearBuilt,

            // Owner Info
            ownerName: apiData.owner && apiData.owner.names ? apiData.owner.names[0] : (apiData.owner ? apiData.owner.name : ''),
            ownerOccupied: apiData.ownerOccupied,

            // Financial Info
            lastSaleDate: apiData.lastSaleDate,
            lastSalePrice: apiData.lastSalePrice,
            estimatedValue: apiData.price || (recentAssessmentYear ? apiData.taxAssessments[recentAssessmentYear].value : null),
            hoaFee: apiData.hoa ? apiData.hoa.fee : null,
            propertyTax: recentTaxYear ? apiData.propertyTaxes[recentTaxYear].total : null,

            // Property Features
            features: apiData.features ? {
                pool: apiData.features.pool,
                poolType: apiData.features.poolType,
                garage: apiData.features.garage,
                garageSpaces: apiData.features.garageSpaces,
                fireplace: apiData.features.fireplace,
                cooling: apiData.features.cooling,
                coolingType: apiData.features.coolingType,
                heating: apiData.features.heating,
                heatingType: apiData.features.heatingType,
                roofType: apiData.features.roofType,
                lotSize: apiData.lotSize
            } : null,

            // Raw data for reference
            rawData: {
                taxAssessments: apiData.taxAssessments,
                propertyTaxes: apiData.propertyTaxes,
                history: apiData.history,
                propertyType: apiData.propertyType,
                county: apiData.county,
                subdivision: apiData.subdivision,
                zoning: apiData.zoning,
                assessorID: apiData.assessorID
            }
        };
    }
};
