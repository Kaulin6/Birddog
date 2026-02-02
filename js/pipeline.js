/**
 * pipeline.js
 * Manages the Deal Pipeline (Kanban Board) with aging, stats, and dead column
 */

import { Store } from './store.js';
import { UI } from './ui.js';

export const Pipeline = {
    init() {
        this.render();
        this.setupDragAndDrop();
    },

    render() {
        const deals = Store.getDeals();
        const columns = {
            'lead': document.getElementById('col-lead'),
            'interested': document.getElementById('col-interested'),
            'analyzed': document.getElementById('col-analyzed'),
            'offer_sent': document.getElementById('col-offer_sent'),
            'under_contract': document.getElementById('col-under_contract'),
            'closed': document.getElementById('col-closed'),
            'dead': document.getElementById('col-dead')
        };

        // Clear columns
        Object.values(columns).forEach(col => {
            if (col) col.innerHTML = '';
        });

        deals.forEach(deal => {
            const status = deal.status || 'lead';
            const col = columns[status];

            if (col) {
                const card = this.createCard(deal);
                col.appendChild(card);
            }
        });

        // Add empty states to empty columns
        Object.values(columns).forEach(col => {
            if (col && col.children.length === 0) {
                col.innerHTML = `
                    <div class="empty-state" style="border:none; padding: 20px; background: transparent;">
                        <div class="empty-state-icon" style="font-size: 1.5rem; margin-bottom: 5px;">⚡</div>
                        <p>No deals</p>
                    </div>`;
            }
        });

        this.renderStatsBar();
    },

    createCard(deal) {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;
        card.dataset.id = deal.id;

        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData("text/plain", deal.id);
            e.dataTransfer.effectAllowed = "move";
            card.classList.add('dragging');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });

        card.addEventListener('click', () => {
            const event = new CustomEvent('loadDeal', { detail: { id: deal.id } });
            document.dispatchEvent(event);
        });

        const profit = deal.profit || '$0';
        const mao = deal.mao || '$0';

        // Deal aging
        const dealAge = Store.getDealAge(deal);
        const daysInStage = Store.getDaysInStage(deal);
        let ageClass = 'age-fresh';
        if (dealAge >= 30) ageClass = 'age-stale';
        else if (dealAge >= 14) ageClass = 'age-hot';
        else if (dealAge >= 7) ageClass = 'age-warm';

        const waitingOn = deal.waitingOn ? deal.waitingOn.replace(/_/g, ' ') : '';

        card.innerHTML = `
            <h4>${deal.propertyAddress || 'Untitled'}</h4>
            <div class="card-metrics">
                <span>MAO: ${mao}</span>
                <span class="card-profit">${profit}</span>
            </div>
            ${waitingOn ? `<div class="card-waiting-on"><span class="waiting-on-badge">⏳ ${waitingOn}</span></div>` : ''}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                <span class="age-badge ${ageClass}">${dealAge}d old</span>
                <span class="card-stage-days">In stage: ${daysInStage}d</span>
            </div>
        `;

        return card;
    },

    renderStatsBar() {
        const container = document.getElementById('pipelineStatsBar');
        if (!container) return;

        const analytics = Store.getAnalytics();

        container.innerHTML = `
            <div class="pipeline-stat">
                <h4>Total Deals</h4>
                <div class="stat-num">${analytics.totalDeals}</div>
            </div>
            <div class="pipeline-stat">
                <h4>Pipeline Value</h4>
                <div class="stat-num" style="color: var(--accent-green);">${UI.formatCurrency(analytics.pipelineValue)}</div>
            </div>
            <div class="pipeline-stat">
                <h4>Avg Deal</h4>
                <div class="stat-num">${UI.formatCurrency(analytics.avgDealSize)}</div>
            </div>
            <div class="pipeline-stat">
                <h4>Win Rate</h4>
                <div class="stat-num" style="color: var(--accent-blue);">${analytics.winRate}%</div>
            </div>
            <div class="pipeline-stat">
                <h4>Closed Revenue</h4>
                <div class="stat-num" style="color: var(--accent-green);">${UI.formatCurrency(analytics.totalRevenue)}</div>
            </div>
        `;
    },

    setupDragAndDrop() {
        const columns = document.querySelectorAll('.kanban-column');

        columns.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                col.classList.add('drag-over');
            });

            col.addEventListener('dragleave', (e) => {
                if (!col.contains(e.relatedTarget)) {
                    col.classList.remove('drag-over');
                }
            });

            col.addEventListener('drop', (e) => {
                e.preventDefault();
                col.classList.remove('drag-over');

                const dealId = e.dataTransfer.getData("text/plain");
                const newStatus = col.dataset.status;

                if (dealId && newStatus) {
                    Store.updateDealStatus(parseInt(dealId), newStatus);
                    this.render();

                    const event = new CustomEvent('dealStatusChanged', { detail: { id: parseInt(dealId), status: newStatus } });
                    document.dispatchEvent(event);
                }
            });
        });
    }
};
