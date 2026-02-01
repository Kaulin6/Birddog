/**
 * followup.js
 * Standalone Follow-Up Manager — helps prioritize calls and track outreach
 */

import { Store } from './store.js';
import { UI } from './ui.js';

const CONTACT_TYPES = ['call', 'email', 'text', 'meeting'];

const FollowUp = {
    _currentDealId: null,

    init() {
        this.renderStats();
        this.renderQueue();
        this.setupListeners();
    },

    getFollowUpData() {
        const deals = Store.getDeals();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return deals
            .filter(d => d.status !== 'closed' && d.status !== 'dead')
            .map(deal => {
                const timeline = deal.timeline || [];
                const interactions = timeline.filter(e => CONTACT_TYPES.includes(e.type));
                const sorted = [...interactions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const firstContact = sorted.length > 0 ? new Date(sorted[0].timestamp) : null;
                const lastContact = sorted.length > 0 ? new Date(sorted[sorted.length - 1].timestamp) : null;
                const daysSinceContact = lastContact ? Math.floor((now - lastContact) / (1000 * 60 * 60 * 24)) : null;

                // Follow-up date from tasks
                const tasks = Store.getTasks();
                const dealTask = tasks.find(t => t.dealId === deal.id && t.dueDate && !t.completed);
                const followUpDate = dealTask ? new Date(dealTask.dueDate) : null;

                const isOverdue = followUpDate && followUpDate < today;
                const isDueToday = followUpDate && followUpDate.toDateString() === today.toDateString();
                const isUpcoming = followUpDate && followUpDate > today && followUpDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

                const seller = (deal.contacts || []).find(c => c.role === 'seller');
                const dealAge = deal.id ? Math.floor((now - new Date(deal.id)) / (1000 * 60 * 60 * 24)) : 0;

                return {
                    deal,
                    seller,
                    firstContact,
                    lastContact,
                    daysSinceContact,
                    followUpDate,
                    isOverdue,
                    isDueToday,
                    isUpcoming,
                    totalInteractions: interactions.length,
                    dealAge,
                    maoNum: UI.parseInput({ value: deal.mao || '0' })
                };
            });
    },

    renderStats() {
        const container = document.getElementById('followUpStats');
        if (!container) return;

        const data = this.getFollowUpData();
        const overdue = data.filter(d => d.isOverdue).length;
        const dueToday = data.filter(d => d.isDueToday).length;
        const neverContacted = data.filter(d => d.totalInteractions === 0).length;
        const stale = data.filter(d => d.daysSinceContact !== null && d.daysSinceContact >= 7).length;

        container.innerHTML = `
            <div class="pipeline-stat">
                <h4>Overdue</h4>
                <div class="stat-num" style="color: var(--accent-red);">${overdue}</div>
            </div>
            <div class="pipeline-stat">
                <h4>Due Today</h4>
                <div class="stat-num" style="color: var(--accent-orange);">${dueToday}</div>
            </div>
            <div class="pipeline-stat">
                <h4>Never Contacted</h4>
                <div class="stat-num" style="color: var(--accent-blue);">${neverContacted}</div>
            </div>
            <div class="pipeline-stat">
                <h4>Stale (7+ days)</h4>
                <div class="stat-num" style="color: var(--accent-orange);">${stale}</div>
            </div>
            <div class="pipeline-stat">
                <h4>Active Deals</h4>
                <div class="stat-num">${data.length}</div>
            </div>
        `;
    },

    renderQueue() {
        const container = document.getElementById('followUpQueue');
        if (!container) return;

        const filterVal = document.getElementById('viewFilter').value;
        const sortVal = document.getElementById('sortBy').value;

        let data = this.getFollowUpData();

        // Filter
        switch (filterVal) {
            case 'overdue':
                data = data.filter(d => d.isOverdue);
                break;
            case 'today':
                data = data.filter(d => d.isDueToday);
                break;
            case 'upcoming':
                data = data.filter(d => d.isUpcoming);
                break;
            case 'no_contact':
                data = data.filter(d => d.totalInteractions === 0);
                break;
            case 'stale':
                data = data.filter(d => d.daysSinceContact !== null && d.daysSinceContact >= 7);
                break;
            // 'all' shows everything
        }

        // Sort
        switch (sortVal) {
            case 'urgency':
                data.sort((a, b) => {
                    // Overdue first, then due today, then by days since contact
                    if (a.isOverdue && !b.isOverdue) return -1;
                    if (!a.isOverdue && b.isOverdue) return 1;
                    if (a.isDueToday && !b.isDueToday) return -1;
                    if (!a.isDueToday && b.isDueToday) return 1;
                    return (b.daysSinceContact || 999) - (a.daysSinceContact || 999);
                });
                break;
            case 'last_contact':
                data.sort((a, b) => {
                    if (!a.lastContact) return -1;
                    if (!b.lastContact) return 1;
                    return a.lastContact - b.lastContact;
                });
                break;
            case 'deal_age':
                data.sort((a, b) => b.dealAge - a.dealAge);
                break;
            case 'value':
                data.sort((a, b) => b.maoNum - a.maoNum);
                break;
        }

        if (data.length === 0) {
            container.innerHTML = '<div class="empty-state" style="padding: 40px;"><p>No deals match this filter.</p></div>';
            return;
        }

        container.innerHTML = data.map(item => {
            const d = item.deal;
            const sellerName = item.seller ? item.seller.name : 'No seller';
            const sellerPhone = item.seller ? item.seller.phone : '';
            const status = (d.status || 'lead').replace(/_/g, ' ');

            let urgencyClass = '';
            let urgencyLabel = '';
            if (item.isOverdue) {
                urgencyClass = 'urgency-overdue';
                urgencyLabel = `Overdue (${item.followUpDate.toLocaleDateString()})`;
            } else if (item.isDueToday) {
                urgencyClass = 'urgency-today';
                urgencyLabel = 'Due Today';
            } else if (item.isUpcoming) {
                urgencyClass = 'urgency-upcoming';
                urgencyLabel = `Due ${item.followUpDate.toLocaleDateString()}`;
            }

            const lastContactStr = item.lastContact
                ? `${item.lastContact.toLocaleDateString()} (${item.daysSinceContact}d ago)`
                : 'Never';

            const firstContactStr = item.firstContact
                ? item.firstContact.toLocaleDateString()
                : '--';

            return `
                <div class="card followup-card ${urgencyClass}" style="padding: 16px; margin-bottom: 0;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 6px; font-size: 1rem; border: none; padding: 0;">${d.propertyAddress || 'Untitled'}</h3>
                            <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 0.85rem; color: var(--text-secondary);">
                                <span class="status-pill status-${d.status}">${status}</span>
                                <span>Seller: <strong>${sellerName}</strong></span>
                                <span>First: ${firstContactStr}</span>
                                <span>Last: <strong>${lastContactStr}</strong></span>
                                <span>Interactions: ${item.totalInteractions}</span>
                                ${d.mao ? `<span>MAO: ${d.mao}</span>` : ''}
                            </div>
                            ${urgencyLabel ? `<div class="urgency-badge ${urgencyClass}" style="margin-top: 6px;">${urgencyLabel}</div>` : ''}
                            ${d.waitingOn ? `<div style="margin-top: 4px;"><span class="waiting-on-badge">⏳ ${d.waitingOn.replace(/_/g, ' ')}</span></div>` : ''}
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                            ${sellerPhone ? `<a href="tel:${sellerPhone}" class="btn-primary" style="text-decoration:none; font-size: 0.85rem;">📞 Call</a>` : ''}
                            <button class="btn-secondary log-btn" data-id="${d.id}" style="font-size: 0.85rem;">Log</button>
                            <a href="app.html" class="btn-ghost view-btn" data-id="${d.id}" style="font-size: 0.85rem;">View</a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.bindQueueEvents();
    },

    bindQueueEvents() {
        document.querySelectorAll('.log-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dealId = parseInt(e.target.dataset.id);
                this.openQuickLog(dealId);
            });
        });
    },

    openQuickLog(dealId) {
        this._currentDealId = dealId;
        const deal = Store.getDeal(dealId);
        const modal = document.getElementById('quickLogModal');
        const title = document.getElementById('quickLogTitle');

        title.textContent = `Log: ${deal ? deal.propertyAddress : 'Deal'}`;

        // Default next follow-up to 2 days from now
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + 2);
        document.getElementById('quickLogNextFollowUp').value = nextDate.toISOString().split('T')[0];
        document.getElementById('quickLogNotes').value = '';
        document.getElementById('quickLogOutcome').value = 'connected';

        modal.classList.remove('hidden');
    },

    saveQuickLog() {
        if (!this._currentDealId) return;

        const type = document.getElementById('quickLogType').value;
        const direction = document.getElementById('quickLogDirection').value;
        const outcome = document.getElementById('quickLogOutcome').value;
        const notes = document.getElementById('quickLogNotes').value;
        const nextFollowUp = document.getElementById('quickLogNextFollowUp').value;

        const outcomeLabels = {
            connected: 'Connected',
            voicemail: 'Left Voicemail',
            no_answer: 'No Answer',
            callback: 'Requested Callback',
            not_interested: 'Not Interested'
        };

        const text = `[${outcomeLabels[outcome]}] ${notes || 'No notes'}`;

        Store.addLogToDeal(this._currentDealId, {
            type,
            direction,
            text,
            outcome
        });

        // Save follow-up task
        if (nextFollowUp) {
            const deal = Store.getDeal(this._currentDealId);
            Store.saveTask({
                dealId: this._currentDealId,
                address: deal ? deal.propertyAddress : '',
                dueDate: nextFollowUp,
                note: `Follow up after ${type}`,
                createdAt: new Date().toISOString()
            });
        }

        // If not interested, offer to mark as dead
        if (outcome === 'not_interested') {
            if (confirm('Mark this deal as Dead?')) {
                Store.updateDealStatus(this._currentDealId, 'dead');
            }
        }

        document.getElementById('quickLogModal').classList.add('hidden');
        this._currentDealId = null;

        this.renderStats();
        this.renderQueue();
    },

    setupListeners() {
        document.getElementById('viewFilter').addEventListener('change', () => this.renderQueue());
        document.getElementById('sortBy').addEventListener('change', () => this.renderQueue());

        document.getElementById('quickLogSave').addEventListener('click', () => this.saveQuickLog());
        document.getElementById('quickLogCancel').addEventListener('click', () => {
            document.getElementById('quickLogModal').classList.add('hidden');
            this._currentDealId = null;
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    FollowUp.init();
});
