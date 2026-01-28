import React from 'react';
import DealAnalyzer from './DealAnalyzer';

const LeadCard = ({ lead }) => {
    const { address, property_details, financials, distress_flags, opportunity_score } = lead;

    // Color coding for score
    let scoreClass = "score-low";
    if (opportunity_score > 70) scoreClass = "score-high";
    else if (opportunity_score > 40) scoreClass = "score-med";

    return (
        <div className="glass-card mb-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold mb-1">{address}</h2>
                    <div className="text-sm text-gray-400 mb-4">
                        {property_details.beds}bd, {property_details.baths}ba • {property_details.sqft} sqft • Built {property_details.year_built}
                    </div>
                </div>
                <div className={`text-3xl font-bold ${scoreClass}`}>
                    {opportunity_score}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Distress Signals</h3>
                    <div className="flex flex-wrap gap-2 mb-4">
                        {distress_flags.length > 0 ? (
                            distress_flags.map((flag, idx) => (
                                <span key={idx} className="chip chip-red">{flag}</span>
                            ))
                        ) : (
                            <span className="text-gray-500 italic">No distress detected</span>
                        )}
                        {financials.equity_percent > 40 && (
                            <span className="chip chip-green">High Equity ({financials.equity_percent}%)</span>
                        )}
                    </div>

                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Owner Info</h3>
                    <div className="text-sm">
                        <p><span className="text-gray-500">Owner:</span> {lead.owner_name}</p>
                        <p><span className="text-gray-500">Mailing:</span> {lead.mailing_address}</p>
                    </div>
                </div>

                <div>
                    <DealAnalyzer financials={financials} />
                </div>
            </div>
        </div>
    );
};

export default LeadCard;
