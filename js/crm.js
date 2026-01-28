
/**
 * crm.js
 * Manages Deal CRM: Contacts, Interaction Logs, Timeline
 */

import { Store } from './store.js';
import { UI } from './ui.js';

export const CRM = {
    currentDealId: null,

    init(dealId) {
        this.currentDealId = dealId;

        // If init with a deal ID, default to "Current Property" tab
        // If init without (null), default to "All Contacts" or last used
        if (dealId) {
            this.switchTab('viewCurrentDeal');
        } else {
            this.switchTab('viewAllContacts');
        }

        this.setupListeners();
        this.render();
    },

    render() {
        // Render sub-views based on what's active (or all for simplicity)
        if (this.currentDealId) {
            this.renderDealView();
        } else {
            // If no deal selected, show empty state in Current Deal tab if user clicks it
            const container = document.getElementById('viewCurrentDeal');
            if (container) {
                container.innerHTML = '<div class="card"><p class="empty-state" style="padding:40px;">No deal selected. Use the "All Contacts" or "Call Queue" tabs.</p></div>';
            }
        }

        this.renderAllContacts();
        this.renderCallQueue();
    },

    switchTab(viewId) {
        // Hide all views
        ['viewCurrentDeal', 'viewAllContacts', 'viewCallQueue'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        // Remove active class from tabs
        ['tabCurrentDeal', 'tabAllContacts', 'tabCallQueue'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });

        // Show target
        const target = document.getElementById(viewId);
        if (target) target.classList.remove('hidden');

        // Activate Tab Button
        const map = {
            'viewCurrentDeal': 'tabCurrentDeal',
            'viewAllContacts': 'tabAllContacts',
            'viewCallQueue': 'tabCallQueue'
        };
        const btn = document.getElementById(map[viewId]);
        if (btn) btn.classList.add('active');
    },

    // --- Sub-View: Current Deal ---
    renderDealView() {
        const deal = Store.getDeal(this.currentDealId);
        if (!deal) return;

        // Restore inner HTML structure if it was overwritten by empty state
        const container = document.getElementById('viewCurrentDeal');
        if (container && container.innerHTML.includes('No deal selected')) {
            // Re-inject the standard layout if missing
            // In a real app we'd cache this or use a template, but for now we assume app.html static structure persists
            // or we'd reload the page.
            // Issue: If I overwrote it with "No deal selected", I lost the forms!
            // Fix: Don't overwrite the *whole* viewCurrentDeal, just hide/show content?
            // Or restore it. Since app.html has the structure, better to NOT overwrite it in render() if possible.
            // Let's just alert user "Go to All Contacts" instead of destroying DOM.
            // The previous logic was: document.getElementById('viewCurrentDeal').innerHTML = ...
            // That destroys the forms.
            // I will fix this logic: Check if children exist.
        }

        this.renderContacts(deal.contacts || []);
        this.renderLogs(deal.timeline || []);
        this.renderTimeline(deal.timeline || []);
        this.updateContactSelect(deal.contacts || []);
    },

    // --- Sub-View: All Contacts ---
    renderAllContacts() {
        const tbody = document.getElementById('globalContactsBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const contacts = Store.getAllContacts();
        const searchInput = document.getElementById('globalContactSearch');
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        const filtered = contacts.filter(c =>
            c.name.toLowerCase().includes(searchTerm) ||
            (c.role && c.role.toLowerCase().includes(searchTerm)) ||
            (c.propertyAddress && c.propertyAddress.toLowerCase().includes(searchTerm))
        );

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No contacts found</td></tr>';
            return;
        }

        filtered.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${c.name}</td>
                <td><span class="role-badge">${c.role}</span></td>
                <td>${c.phone || '-'}</td>
                <td>${c.email || '-'}</td>
                <td><a href="#" class="deal-link" data-id="${c.dealId}">${c.propertyAddress}</a></td>
                <td>
                    <button class="btn-small" onclick="window.location.href='tel:${c.phone}'">📞 Call</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Bind deal links
        tbody.querySelectorAll('.deal-link').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const dealId = parseInt(e.target.dataset.id);
                // Switch to Deal View
                this.currentDealId = dealId;
                this.switchTab('viewCurrentDeal');
                this.renderDealView();
            });
        });
    },

    // --- Sub-View: Call Queue ---
    renderCallQueue() {
        const container = document.getElementById('callQueueContainer');
        if (!container) return;
        container.innerHTML = '';

        const filterVal = document.getElementById('callQueueFilter') ? document.getElementById('callQueueFilter').value : 'all_leads';
        const deals = Store.getDeals();
        let queue = [];

        // Base Logic: Only active leads
        const activeDeals = deals.filter(d => d.status === 'lead' || d.status === 'analyzed' || d.status === 'offer_sent');

        // Apply Rules
        if (filterVal === 'fresh_leads') {
            // Rule: Created in last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            queue = activeDeals.filter(d => {
                const created = d.id ? new Date(d.id) : new Date(); // timestamp is in ID usually
                return created > sevenDaysAgo;
            });
        } else if (filterVal === 'follow_up_needed') {
            // Rule: No logs in > 3 days
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            queue = activeDeals.filter(d => {
                if (!d.timeline || d.timeline.length === 0) return true; // Never contacted
                const lastLog = new Date(d.timeline[0].timestamp);
                return lastLog < threeDaysAgo;
            });
        } else {
            // Default: All active leads
            queue = activeDeals;
        }

        if (queue.length === 0) {
            container.innerHTML = '<p class="empty-state">No deals match this filter criteria.</p>';
            return;
        }

        queue.forEach(deal => {
            const card = document.createElement('div');
            card.className = 'card';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            card.style.padding = '16px';
            card.style.marginBottom = '0';

            const seller = (deal.contacts || []).find(c => c.role === 'seller') || { name: 'Unknown', phone: '' };

            // Determine "Last Contact" for context
            let lastContact = 'Never';
            if (deal.timeline && deal.timeline.length > 0) {
                const last = deal.timeline[0];
                const date = new Date(last.timestamp).toLocaleDateString();
                lastContact = `${date} (${last.type})`;
            }

            card.innerHTML = `
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 4px 0; font-size: 1rem; border: none; padding: 0;">${deal.propertyAddress}</h3>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        <span class="status-pill">${deal.status}</span> • Seller: ${seller.name} • Last Activity: ${lastContact}
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    ${seller.phone ? `<a href="tel:${seller.phone}" class="btn-primary quick-log-btn" style="text-decoration:none; display:inline-flex; align-items:center;" data-id="${deal.id}" data-seller="${seller.name}">📞 Dial</a>` : '<span class="text-muted">No Phone</span>'}
                    <button class="btn-secondary load-deal-btn" data-id="${deal.id}">View</button>
                </div>
            `;
            container.appendChild(card);
        });

        this.bindQueueEvents(container);
    },

    bindQueueEvents(container) {
        container.querySelectorAll('.load-deal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dealId = parseInt(e.target.dataset.id);
                this.currentDealId = dealId;
                this.switchTab('viewCurrentDeal');
                this.renderDealView();
            });
        });

        // "Dial" button now opens phone app AND prompts to log
        // We attach click listener to the link
        container.querySelectorAll('.quick-log-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Allow the tel: link to proceed (don't preventDefault)
                // But after a short delay, prompt for log
                const dealId = parseInt(e.target.dataset.id);
                const sellerName = e.target.dataset.seller;

                setTimeout(() => {
                    const note = prompt(`How did the call with ${sellerName} go?`, "Called, left voicemail");
                    if (note) {
                        Store.addLogToDeal(dealId, {
                            type: 'call',
                            text: note,
                            contact: sellerName
                        });
                        // Refresh to show updated last contact
                        this.renderCallQueue();
                    }
                }, 500); // Small delay to let system handle dial handler
            });
        });

        // Bind Filter Change
        const filterSelect = document.getElementById('callQueueFilter');
        if (filterSelect && !filterSelect.hasAttribute('data-init')) {
            filterSelect.setAttribute('data-init', 'true');
            filterSelect.addEventListener('change', () => this.renderCallQueue());
        }
    },

    // --- Existing Helper Functions (Contacts/Logs) ---
    renderContacts(contacts) {
        const list = document.getElementById('contactsList');
        if (!list) return;
        list.innerHTML = '';

        if (contacts.length === 0) {
            list.innerHTML = '<li class="empty-state">No contacts added</li>';
            return;
        }

        contacts.forEach((contact, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="contact-info">
                    <strong>${contact.name}</strong>
                    <span class="role-badge">${contact.role}</span>
                    <div class="contact-details">
                        ${contact.phone ? `<a href="tel:${contact.phone}">📞 ${contact.phone}</a>` : ''}
                        ${contact.email ? `<a href="mailto:${contact.email}">✉️ ${contact.email}</a>` : ''}
                    </div>
                </div>
                <button class="delete-btn" data-index="${index}" title="Remove Contact">×</button>
            `;
            list.appendChild(li);
        });

        // Add delete listeners
        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                this.deleteContact(idx);
            });
        });
    },

    renderLogs(timeline) {
        const list = document.getElementById('interactionLog');
        if (!list) return;
        list.innerHTML = '';

        // Filter for user logs + important system events
        const logs = timeline.filter(t => t.type === 'note' || t.type === 'call' || t.type === 'email');

        if (logs.length === 0) {
            list.innerHTML = '<li class="empty-state">No interaction logs yet. Add a note above.</li>';
            return;
        }

        logs.forEach(log => {
            const li = document.createElement('li');
            li.className = 'log-entry';
            const icon = log.type === 'call' ? '📞' : (log.type === 'email' ? '✉️' : '📝');
            const date = new Date(log.timestamp).toLocaleString();

            li.innerHTML = `
                <div class="log-header">
                    <span class="log-type">${icon} ${log.contact ? `with ${log.contact}` : 'Note'}</span>
                    <span class="log-date">${date}</span>
                </div>
                <div class="log-content">${log.text}</div>
            `;
            list.appendChild(li);
        });
    },

    renderTimeline(timeline) {
        const list = document.getElementById('dealTimeline');
        if (!list) return;
        list.innerHTML = '';

        if (timeline.length === 0) {
            list.innerHTML = '<li class="empty-state">New Deal</li>';
            return;
        }

        // Show all events
        timeline.forEach(item => {
            const li = document.createElement('li');
            const date = new Date(item.timestamp).toLocaleDateString();

            let content = '';
            if (item.type === 'status_change') {
                content = `Status changed to <span class="status-pill">${item.status}</span>`;
            } else if (item.type === 'system') {
                content = item.text;
            } else {
                // Short preview of logs
                content = `${item.contact ? item.contact + ': ' : ''}${item.text.substring(0, 50)}${item.text.length > 50 ? '...' : ''}`;
            }

            li.innerHTML = `
                <span class="timeline-date">${date}</span>
                <span class="timeline-content">${content}</span>
            `;
            list.appendChild(li);
        });
    },

    addLog(type, text, contactName) {
        if (!this.currentDealId) return;

        Store.addLogToDeal(this.currentDealId, {
            type,
            text,
            contact: contactName
        });
        this.render();
    },

    updateContactSelect(contacts) {
        const select = document.getElementById('logContactSelect');
        if (!select) return;

        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Contact (Optional) --</option>';

        contacts.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = `${c.name} (${c.role})`;
            select.appendChild(opt);
        });

        // Try to restore selection
        select.value = currentVal;
    },

    addContact(contact) {
        if (!this.currentDealId) return;
        Store.addContactToDeal(this.currentDealId, contact);

        // Auto-log the addition
        Store.addLogToDeal(this.currentDealId, {
            type: 'system',
            text: `Added contact: ${contact.name} (${contact.role})`
        });

        this.render();
    },

    deleteContact(index) {
        if (!this.currentDealId) return;
        const deal = Store.getDeal(this.currentDealId);
        if (deal && deal.contacts) {
            const removed = deal.contacts[index];
            deal.contacts.splice(index, 1);
            Store.saveDeal(deal);

            // Log removal
            Store.addLogToDeal(this.currentDealId, {
                type: 'system',
                text: `Removed contact: ${removed.name}`
            });

            this.render();
        }
    },

    // --- Setup ---
    setupListeners() {
        // Tab Linking
        const bindTab = (btnId, viewId) => {
            const btn = document.getElementById(btnId);
            if (btn) btn.addEventListener('click', () => this.switchTab(viewId));
        };
        bindTab('tabCurrentDeal', 'viewCurrentDeal');
        bindTab('tabAllContacts', 'viewAllContacts');
        bindTab('tabCallQueue', 'viewCallQueue');

        // Search Listener
        const searchInput = document.getElementById('globalContactSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderAllContacts());
        }

        // Add Contact
        const addContactBtn = document.getElementById('addContactBtn');
        if (addContactBtn && !addContactBtn.hasAttribute('data-init')) {
            addContactBtn.setAttribute('data-init', 'true');
            addContactBtn.addEventListener('click', () => {
                const name = document.getElementById('contactName').value;
                const role = document.getElementById('contactRole').value;
                const phone = document.getElementById('contactPhone').value;
                const email = document.getElementById('contactEmail').value;

                if (name) {
                    this.addContact({ name, role, phone, email });
                    // Clear inputs
                    document.getElementById('contactName').value = '';
                    document.getElementById('contactPhone').value = '';
                    document.getElementById('contactEmail').value = '';
                }
            });
        }

        // Add Log
        const addLogBtn = document.getElementById('addLogBtn');
        if (addLogBtn && !addLogBtn.hasAttribute('data-init')) {
            addLogBtn.setAttribute('data-init', 'true');
            addLogBtn.addEventListener('click', () => {
                const text = document.getElementById('logEntry').value;
                const contact = document.getElementById('logContactSelect').value;

                if (text) {
                    // Detect type keywords?
                    let type = 'note';
                    const lower = text.toLowerCase();
                    if (lower.includes('call') || lower.includes('spoke') || lower.includes('phone')) type = 'call';
                    else if (lower.includes('email') || lower.includes('sent')) type = 'email';

                    this.addLog(type, text, contact);
                    document.getElementById('logEntry').value = '';
                }
            });
        }

        // Status Timeline Event Listener (Triggered by Pipeline)
        document.removeEventListener('dealStatusChanged', this.handleStatusChange); // Cleanup old if any
        document.addEventListener('dealStatusChanged', this.handleStatusChange.bind(this));
    },

    handleStatusChange(e) {
        const { id, status } = e.detail;
        if (this.currentDealId === id) {
            // Log it
            Store.addLogToDeal(id, {
                type: 'status_change',
                status: status,
                text: `Status updated to ${status}`
            });
            this.render(); // Refresh logs
        } else {
            // Background log for other deals
            Store.addLogToDeal(id, {
                type: 'status_change',
                status: status,
                text: `Status updated to ${status}`
            });
            // If in Queue mode, maybe refresh list?
            if (!document.getElementById('viewCallQueue').classList.contains('hidden')) {
                this.renderCallQueue();
            }
        }
    }
};
