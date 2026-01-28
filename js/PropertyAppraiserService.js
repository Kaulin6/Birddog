/**
 * PropertyAppraiserService.js
 * Service to interact with Hillsborough County Property Appraiser's ArcGIS REST API.
 */

const API_BASE_URL = 'https://maps.hillsboroughcounty.org/arcgis/rest/services/InfoLayers/HC_ParcelsPublic/MapServer/0';

export const PropertyAppraiserService = {
    /**
     * Search for property data by address
     * @param {string} address - The address to search for
     * @returns {Promise<Object|null>} - The mapped property data or null if not found
     */
    async searchByAddress(address) {
        if (!address) return null;

        // Clean up address for query
        // The API expects "SITE_ADDR LIKE '%...%'"
        // We'll try to use the street number and name if possible, or just a broad search

        // Simple parsing to get street part
        // e.g. "11660 Hidden Hollow Cir, Tampa, FL" -> "11660 Hidden Hollow"
        const parts = address.split(',');
        let searchStr = parts[0].trim();

        // Remove unit numbers if present (often causes issues with simple LIKE queries)
        searchStr = searchStr.replace(/Unit\s*#?\w+/i, '').trim();

        // Construct query URL
        // We use LIKE with wildcards to be flexible
        const whereClause = `SITE_ADDR LIKE '%${encodeURIComponent(searchStr)}%'`;
        const url = `${API_BASE_URL}/query?where=${whereClause}&outFields=*&f=json&returnGeometry=false`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                // Return the first match mapped to our app's format
                return this.mapData(data.features[0].attributes);
            }
            return null;
        } catch (error) {
            console.error('Property Appraiser API Error:', error);
            throw new Error('Failed to fetch data from Property Appraiser.');
        }
    },

    /**
     * Map API attributes to App data structure
     * @param {Object} attrs - Raw attributes from ArcGIS API
     * @returns {Object} - Mapped data
     */
    mapData(attrs) {
        return {
            ownerName: this.formatOwnerName(attrs.OWNER),
            address: attrs.SITE_ADDR, // Use official address
            city: attrs.SITE_CITY,
            zip: attrs.SITE_ZIP,
            nbhc: attrs.NBHC, // Neighborhood Code for Comps
            beds: attrs.tBEDS,
            baths: attrs.tBATHS,
            sqft: attrs.HEAT_AR, // Heated area is usually what's used for living sqft
            yearBuilt: attrs.ACT, // Actual year built
            assessedValue: attrs.ASD_VAL,
            marketValue: attrs.JUST, // Just/Market value
            taxValue: attrs.TAX_VAL,
            lastSaleDate: attrs.S_DATE ? new Date(attrs.S_DATE).toISOString().split('T')[0] : null,
            lastSalePrice: attrs.S_AMT,
            folio: attrs.FOLIO,
            folioFormatted: attrs.FOLIO_NUMB, // Needed for Permit Search (e.g. 4325.0986)
            legalDescription: `${attrs.LEGAL1 || ''} ${attrs.LEGAL2 || ''}`.trim(),
            propertyUse: attrs.LU_GRP // Land Use Group
        };
    },

    /**
     * Format owner name (often comes as LAST FIRST)
     * @param {string} name 
     */
    formatOwnerName(name) {
        if (!name) return '';
        // If it's just one name, return as Title Case
        return name.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
};
