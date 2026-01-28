/**
 * calculator.js
 * Core calculation logic for the Instant Underwrite Calculator
 */

import { UI } from './ui.js';

export const Calculator = {
    calculate(inputs) {
        // Inputs are expected to be raw numbers (parsed by UI layer)
        const arv = inputs.arv || 0;
        const repairs = inputs.repairCosts || 0;
        const assignmentFee = inputs.assignmentFee || 0;

        // Percentages
        const agentCommPct = (inputs.agentCommission || 0) / 100;
        const closingCostsPct = (inputs.closingCosts || 0) / 100;
        const investorProfitPct = (inputs.investorProfit || 0) / 100;
        const costBufferPct = (inputs.costBuffer || 0) / 100;

        // Calculate Deductions
        const agentCommAmt = arv * agentCommPct;
        const closingCostsAmt = arv * closingCostsPct;
        const costBufferAmt = arv * costBufferPct;
        const investorProfitAmt = arv * investorProfitPct;

        const totalFixedCosts = agentCommAmt + closingCostsAmt + repairs + costBufferAmt;

        // Core Formulas
        const mao = arv - totalFixedCosts - investorProfitAmt - assignmentFee;
        const salePriceToInvestor = mao + assignmentFee;

        // Buyer ROI
        const totalInvestment = salePriceToInvestor + repairs + closingCostsAmt;
        const buyerRoi = totalInvestment > 0 ? (investorProfitAmt / totalInvestment) * 100 : 0;

        // Motivation Offers
        const offerHigh = mao * 0.90; // High Motivation (Green) - We offer LESS
        const offerMedium = mao * 1.0; // Medium Motivation
        const offerLow = mao * 1.10;   // Low Motivation (Red) - We offer MORE

        return {
            results: {
                mao,
                salePriceToInvestor,
                buyerRoi,
                assignmentFee,
                investorProfitAmt,
                offerHigh,
                offerMedium,
                offerLow
            },
            deductions: [
                { label: 'Agent Commission', value: agentCommAmt },
                { label: 'Closing Costs', value: closingCostsAmt },
                { label: 'Repair Costs', value: repairs },
                { label: 'Investor Profit', value: investorProfitAmt },
                { label: 'Assignment Fee', value: assignmentFee },
                { label: 'Cost Buffer', value: costBufferAmt },
            ],
            yourNumbers: [
                { label: 'Max Allowable Offer', value: mao },
                { label: 'Sale Price to Investor', value: salePriceToInvestor },
                { label: 'Your Assignment Fee', value: assignmentFee },
            ]
        };
    },

    calculateRepairs(sqft, condition) {
        let costPerSqft = 0;
        let label = '';

        switch (condition) {
            case 'light':
                costPerSqft = 15;
                label = 'Light ($15/sqft)';
                break;
            case 'medium':
                costPerSqft = 30;
                label = 'Medium ($30/sqft)';
                break;
            case 'heavy':
                costPerSqft = 60;
                label = 'Heavy ($60/sqft)';
                break;
            case 'custom':
                return null; // Handled manually
        }

        if (costPerSqft > 0 && sqft > 0) {
            return {
                total: sqft * costPerSqft,
                label: label
            };
        }
        return null;
    }
};
