import React, { useState } from 'react';

const DealAnalyzer = ({ financials }) => {
    const { arv, repair_estimate } = financials;

    const [discount, setDiscount] = useState(0.70); // 70% Rule
    const [fee, setFee] = useState(10000); // Wholesale Fee

    const mao = (arv * discount) - repair_estimate - fee;

    const formatMoney = (amount) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
    };

    return (
        <div className="bg-black bg-opacity-30 rounded-xl p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-3">Quick Deal Analyzer</h3>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                    <div className="text-gray-500">ARV</div>
                    <div className="font-mono text-white">{formatMoney(arv)}</div>
                </div>
                <div>
                    <div className="text-gray-500">Repairs</div>
                    <div className="font-mono text-red-300">{formatMoney(repair_estimate)}</div>
                </div>
            </div>

            <div className="mb-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                    <label>Discount Rule ({(discount * 100).toFixed(0)}%)</label>
                    <input
                        type="range" min="0.5" max="0.85" step="0.01"
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value))}
                        className="w-24 accent-purple-500"
                    />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                    <label>Wholesale Fee ({formatMoney(fee)})</label>
                    <input
                        type="range" min="0" max="50000" step="1000"
                        value={fee}
                        onChange={(e) => setFee(parseFloat(e.target.value))}
                        className="w-24 accent-purple-500"
                    />
                </div>
            </div>

            <div className="pt-3 border-t border-gray-700">
                <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Max Allowable Offer</span>
                    <span className="text-xl font-bold text-green-400 font-mono">{formatMoney(mao)}</span>
                </div>
            </div>
        </div>
    );
};

export default DealAnalyzer;
