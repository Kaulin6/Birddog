/**
 * dashboard.js
 * Dashboard with analytics, follow-ups, stale alerts, and deal scoring
 */

import { Store } from './store.js';
import { UI } from './ui.js';

export const Dashboard = {
    init() {
        this.setupListeners();
        this.render();
    },

    render() {
        this.renderStatsRow();
        this.renderTodayTasks();
        this.renderOverdueTasks();
        this.renderStaleAlerts();
        this.renderFunnel();
        this.renderTopDeals();
        this.renderAvgDays();
        this.populateDealSelect();
    },

    // --- Stats Row ---
    renderStatsRow() {
        const container = document.getElementById('dashboardStatsRow');
        if (!container) return;

        const analytics = Store.getAnalytics();
        const overdue = Store.getOverdueTasks().length;
        const stale = Store.getStaleDeals(7).length;

        container.innerHTML = `
            <div class="stat-box">
                <h4>Total Deals</h4>
                <div class="stat-value">${analytics.totalDeals}</div>
            </div>
            <div class="stat-box">
                <h4>Pipeline Value</h4>
                <div class="stat-value green">${UI.formatCurrency(analytics.pipelineValue)}</div>
            </div>
            <div class="stat-box">
                <h4>Avg Deal Size</h4>
                <div class="stat-value">${UI.formatCurrency(analytics.avgDealSize)}</div>
            </div>
            <div class="stat-box">
                <h4>Win Rate</h4>
                <div class="stat-value blue">${analytics.winRate}%</div>
            </div>
            <div class="stat-box">
                <h4>Revenue (Closed)</h4>
                <div class="stat-value green">${UI.formatCurrency(analytics.totalRevenue)}</div>
            </div>
            <div class="stat-box">
                <h4>Overdue Tasks</h4>
                <div class="stat-value" style="color: ${overdue > 0 ? '#ff5252' : 'var(--text-primary)'}">${overdue}</div>
            </div>
        `;
    },

    // --- Today's Tasks ---
    renderTodayTasks() {
        const container = document.getElementById('todayTasksList');
        const badge = document.getElementById('todayTaskCount');
        if (!container) return;

        const todayTasks = Store.getDueTodayTasks();
        const upcomingTasks = Store.getUpcomingTasks(7).filter(t => {
            const today = new Date().toISOString().split('T')[0];
            return !t.dueDate.startsWith(today);
        });

        const allTasks = [...todayTasks, ...upcomingTasks];

        if (badge) badge.textContent = todayTasks.length;

        if (allTasks.length === 0) {
            if (allTasks.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <p>No upcoming tasks. You're all caught up!</p>
                </div>`;
                return;
            }
            return;
        }

        container.innerHTML = allTasks.map(task => {
            const deal = Store.getDeal(task.dealId);
            const dealName = deal ? deal.propertyAddress : 'Unknown';
            const isToday = task.dueDate && task.dueDate.startsWith(new Date().toISOString().split('T')[0]);
            const dueDate = task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString() : '';

            return `
                <div class="task-item ${isToday ? 'due-today' : ''}">
                    <div class="task-check" data-task-id="${task.id}" title="Mark complete"></div>
                    <div class="task-body">
                        <div class="task-text">${task.text}</div>
                        <div class="task-meta">
                            <span class="task-deal-link" data-deal-id="${task.dealId}">${dealName}</span>
                            &middot; Due: ${dueDate}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.attachTaskListeners(container);
    },

    // --- Overdue Tasks ---
    renderOverdueTasks() {
        const container = document.getElementById('overdueTasksList');
        const badge = document.getElementById('overdueTaskCount');
        if (!container) return;

        const overdueTasks = Store.getOverdueTasks();
        if (badge) badge.textContent = overdueTasks.length;

        if (overdueTasks.length === 0) {
            if (overdueTasks.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <p>No overdue tasks. Great job!</p>
                </div>`;
                return;
            }
            return;
        }

        container.innerHTML = overdueTasks.map(task => {
            const deal = Store.getDeal(task.dealId);
            const dealName = deal ? deal.propertyAddress : 'Unknown';
            const dueDate = task.dueDate ? new Date(task.dueDate + 'T00:00:00').toLocaleDateString() : '';

            return `
                <div class="task-item overdue">
                    <div class="task-check" data-task-id="${task.id}" title="Mark complete"></div>
                    <div class="task-body">
                        <div class="task-text">${task.text}</div>
                        <div class="task-meta">
                            <span class="task-deal-link" data-deal-id="${task.dealId}">${dealName}</span>
                            &middot; Was due: ${dueDate}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        this.attachTaskListeners(container);
    },

    attachTaskListeners(container) {
        // Complete task
        container.querySelectorAll('.task-check').forEach(el => {
            el.addEventListener('click', () => {
                const taskId = parseInt(el.dataset.taskId);
                Store.completeTask(taskId);
                this.render();
            });
        });

        // Navigate to deal
        container.querySelectorAll('.task-deal-link').forEach(el => {
            el.addEventListener('click', () => {
                const dealId = parseInt(el.dataset.dealId);
                const event = new CustomEvent('loadDeal', { detail: { id: dealId } });
                document.dispatchEvent(event);
            });
        });
    },

    // --- Stale Alerts ---
    renderStaleAlerts() {
        const container = document.getElementById('staleAlertsList');
        const badge = document.getElementById('staleCount');
        if (!container) return;

        const staleDeals = Store.getStaleDeals(7);
        if (badge) badge.textContent = staleDeals.length;

        if (staleDeals.length === 0) {
            if (staleDeals.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔥</div>
                    <p>Pipeline is active. No stale deals found.</p>
                </div>`;
                return;
            }
            return;
        }

        container.innerHTML = staleDeals.slice(0, 15).map(deal => {
            const days = deal.daysSinceActivity;
            let cls = 'stale-warm';
            if (days >= 30) cls = 'stale-critical';
            else if (days >= 14) cls = 'stale-hot';

            return `
                <div class="stale-alert ${cls}" data-deal-id="${deal.id}">
                    <div>
                        <div class="stale-address">${deal.propertyAddress || 'Untitled'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${deal.status}</div>
                    </div>
                    <div class="stale-days">${days}d</div>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.stale-alert').forEach(el => {
            el.addEventListener('click', () => {
                const dealId = parseInt(el.dataset.dealId);
                const event = new CustomEvent('loadDeal', { detail: { id: dealId } });
                document.dispatchEvent(event);
            });
        });
    },

    // --- Conversion Funnel ---
    renderFunnel() {
        const container = document.getElementById('funnelChart');
        if (!container) return;

        const analytics = Store.getAnalytics();
        const funnel = analytics.conversionFunnel;

        container.innerHTML = funnel.map(step => `
            <div class="funnel-row">
                <div class="funnel-label">${step.stage}</div>
                <div class="funnel-bar-container">
                    <div class="funnel-bar" style="width: ${Math.max(step.pct, 5)}%">
                        <span>${step.pct}%</span>
                    </div>
                </div>
                <div class="funnel-count">${step.count}</div>
            </div>
        `).join('');
    },

    // --- Top Deals ---
    renderTopDeals() {
        const container = document.getElementById('topDealsList');
        if (!container) return;

        const deals = Store.getDeals()
            .filter(d => d.status !== 'closed' && d.status !== 'dead')
            .map(d => ({ ...d, score: Store.scoreDeal(d) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        if (deals.length === 0) {
            if (deals.length === 0) {
                container.innerHTML = `
                <li style="list-style:none;">
                    <div class="empty-state">
                        <div class="empty-state-icon">📊</div>
                        <p>No active deals to score.</p>
                    </div>
                </li>`;
                return;
            }
            return;
        }

        container.innerHTML = deals.map((deal, i) => {
            const scoreClass = deal.score >= 60 ? 'score-high' : deal.score >= 30 ? 'score-medium' : 'score-low';
            return `
                <li class="top-deal-item" data-deal-id="${deal.id}">
                    <span class="deal-rank">${i + 1}</span>
                    <span class="score-badge ${scoreClass}">${deal.score}</span>
                    <span class="deal-name">${deal.propertyAddress || 'Untitled'}</span>
                    <span class="deal-fee">${deal.profit || '$0'}</span>
                </li>
            `;
        }).join('');

        container.querySelectorAll('.top-deal-item').forEach(el => {
            el.addEventListener('click', () => {
                const dealId = parseInt(el.dataset.dealId);
                const event = new CustomEvent('loadDeal', { detail: { id: dealId } });
                document.dispatchEvent(event);
            });
        });
    },

    // --- Avg Days Per Stage ---
    renderAvgDays() {
        const container = document.getElementById('avgDaysList');
        if (!container) return;

        const analytics = Store.getAnalytics();
        const stageLabels = {
            lead: 'Lead',
            interested: 'Interested',
            analyzed: 'Analyzed',
            offer_sent: 'Offer Sent',
            under_contract: 'Under Contract',
            closed: 'Closed',
            dead: 'Dead'
        };

        container.innerHTML = Object.entries(analytics.avgDaysPerStage).map(([stage, days]) => `
            <li class="avg-days-item">
                <span class="stage-name">${stageLabels[stage] || stage}</span>
                <span class="days-count">${days} days</span>
            </li>
        `).join('');
    },

    // --- Populate Deal Select for Task Form ---
    populateDealSelect() {
        const select = document.getElementById('taskDealSelect');
        if (!select) return;

        const deals = Store.getDeals().filter(d => d.status !== 'closed' && d.status !== 'dead');
        select.innerHTML = '<option value="">-- Select Deal --</option>' +
            deals.map(d => `<option value="${d.id}">${(d.propertyAddress || 'Untitled').substring(0, 40)}</option>`).join('');
    },

    // --- Setup Listeners ---
    setupListeners() {
        // Add task
        const addTaskBtn = document.getElementById('addTaskBtn');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', () => {
                const dealId = parseInt(document.getElementById('taskDealSelect').value);
                const text = document.getElementById('taskText').value.trim();
                const dueDate = document.getElementById('taskDueDate').value;

                if (!text) { alert('Enter a task description.'); return; }
                if (!dueDate) { alert('Select a due date.'); return; }

                Store.saveTask({
                    dealId: dealId || null,
                    text,
                    dueDate
                });

                // Clear form
                document.getElementById('taskText').value = '';
                document.getElementById('taskDueDate').value = '';
                document.getElementById('taskDealSelect').value = '';

                this.render();
            });
        }
    }
};
