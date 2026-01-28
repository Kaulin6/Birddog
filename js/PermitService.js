/**
 * PermitService.js
 * Handles generation of deep links to Accela Citizen Access portals.
 */

const PORTALS = {
    TAMPA: {
        name: 'City of Tampa',
        url: 'https://aca-prod.accela.com/TAMPA/Cap/CapHome.aspx?module=Building&TabName=Building',
        searchUrl: 'https://aca-prod.accela.com/TAMPA/Cap/CapHome.aspx?module=Building&TabName=Building'
    },
    HILLSBOROUGH: {
        name: 'Hillsborough County',
        url: 'https://aca-prod.accela.com/HCFL/Cap/CapHome.aspx?module=Building&TabName=Building',
        searchUrl: 'https://aca-prod.accela.com/HCFL/Cap/CapHome.aspx?module=Building&TabName=Building'
    }
};

export const PermitService = {
    /**
     * Parse a full address string into components
     * @param {string} fullAddress - Full address string
     * @returns {Object} - Parsed address components {street, city, state, zip}
     */
    parseAddress(fullAddress) {
        if (!fullAddress) return { street: '', city: '', state: '', zip: '' };

        // Remove extra whitespace and normalize
        const normalized = fullAddress.trim().replace(/\s+/g, ' ');

        // Try to extract zip code (5 digits)
        const zipMatch = normalized.match(/\b(\d{5})\b/);
        const zip = zipMatch ? zipMatch[1] : '';

        // Try to extract state (FL, Florida)
        const stateMatch = normalized.match(/\b(FL|Florida)\b/i);
        const state = stateMatch ? stateMatch[1] : '';

        // Common Florida cities in Hillsborough County
        const cities = ['Tampa', 'Brandon', 'Riverview', 'Valrico', 'Seffner', 'Plant City', 'Temple Terrace', 'Lutz', 'Carrollwood', 'Town n Country', 'Egypt Lake-Leto'];

        let city = '';
        for (const cityName of cities) {
            const regex = new RegExp(`\\b${cityName}\\b`, 'i');
            if (regex.test(normalized)) {
                city = cityName;
                break;
            }
        }

        // Extract street (everything before city or state or zip)
        let street = normalized;
        if (city) {
            street = normalized.split(new RegExp(city, 'i'))[0].trim();
        } else if (state) {
            street = normalized.split(new RegExp(state, 'i'))[0].trim();
        } else if (zip) {
            street = normalized.split(zip)[0].trim();
        }

        // Clean up street (remove trailing commas)
        street = street.replace(/,\s*$/, '').trim();

        return { street, city, state, zip };
    },

    /**
     * Determine jurisdiction based on city or zip.
     * @param {string} city 
     * @param {string} zip 
     */
    getJurisdiction(city, zip) {
        // Expanded Tampa zip codes (includes more areas within city limits)
        const tampaZips = [
            '33602', '33603', '33604', '33605', '33606', '33607', '33609', '33610',
            '33611', '33612', '33613', '33614', '33615', '33616', '33617', '33618',
            '33619', '33620', '33621', '33629', '33634', '33635', '33647', '33625',
            '33626', '33630', '33631', '33633', '33646', '33650', '33655', '33660',
            '33661', '33662', '33663', '33664', '33672', '33673', '33674', '33675',
            '33677', '33679', '33680', '33681', '33682', '33684', '33685', '33686',
            '33687', '33689', '33694'
        ];

        // Check city name first (case-insensitive)
        if (city && city.toLowerCase() === 'tampa') {
            return PORTALS.TAMPA;
        }

        // Check zip code
        if (zip && tampaZips.includes(zip)) {
            return PORTALS.TAMPA;
        }

        // Default to Hillsborough County for other areas in the region
        return PORTALS.HILLSBOROUGH;
    },

    /**
     * Get the URL to check permits.
     * @param {Object} deal - The deal object containing address info.
     */
    getPermitSearchUrl(deal) {
        const jurisdiction = this.getJurisdiction(deal.city, deal.zip);
        return {
            name: jurisdiction.name,
            url: jurisdiction.searchUrl,
            instructions: `Search for: ${deal.address}`
        };
    },

    /**
     * Save a permit search to history
     * @param {string} address - Full address searched
     * @param {string} jurisdiction - Jurisdiction name
     */
    savePermitSearch(address, jurisdiction) {
        const searches = this.getRecentPermitSearches();

        // Add new search at the beginning
        searches.unshift({
            address,
            jurisdiction,
            timestamp: new Date().toISOString()
        });

        // Keep only last 10 searches
        const trimmed = searches.slice(0, 10);

        localStorage.setItem('permitSearchHistory', JSON.stringify(trimmed));
    },

    /**
     * Get recent permit searches from localStorage
     * @returns {Array} - Array of recent searches
     */
    getRecentPermitSearches() {
        try {
            const stored = localStorage.getItem('permitSearchHistory');
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error loading permit search history:', e);
            return [];
        }
    },

    /**
     * Clear permit search history
     */
    clearPermitSearchHistory() {
        localStorage.removeItem(HISTORY_KEY);
    },

    /**
     * Fetch permit history from Hillsborough County ArcGIS
     * @param {string} folioNumber - The formatted folio number (e.g. 4325.0986)
     * @returns {Promise<Array>} - List of permits
     */
    async fetchPermits(folioNumber) {
        if (!folioNumber) return [];

        const API_URL = 'https://maps.hillsboroughcounty.org/arcgis/rest/services/PermitsPlus/ResidentialCommericalIssuedPermitsCertOccMapService/MapServer/0';
        const whereClause = `PARCEL_NO = '${folioNumber}'`;
        const url = `${API_URL}/query?where=${encodeURIComponent(whereClause)}&outFields=*&orderByFields=Issued DESC&f=json`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                return data.features.map(f => {
                    const attrs = f.attributes;
                    return {
                        permitNumber: attrs.PERMIT__,
                        type: attrs.PERMIT_TYPE,
                        status: attrs.STATUS_1,
                        date: attrs.Issued ? new Date(attrs.Issued).toLocaleDateString() : 'N/A',
                        description: attrs.JOB_TITLE || attrs.OCC_TYPE_DESC || 'No description',
                        value: attrs.VAL_TOTAL
                    };
                });
            }
            return [];
        } catch (error) {
            console.error('Permit Fetch Error:', error);
            return [];
        }
    }
};
