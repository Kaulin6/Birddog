
/**
 * crm.js
 * Manages Deal CRM: Contacts, Interaction Logs, Timeline
 * Also handles Contact Directory and Contact Detail views (merged from contacts.js)
 */

import { Store } from './store.js';
import { UI } from './ui.js';

export const CRM = {
    currentDealId: null,

    init(dealId) {
        this.currentDealId = dealId;

        if (dealId) {
            this.switchTab('viewCurrentDeal');
        } else {
            this.switchTab('viewContactDirectory');
        }

        this.setupListeners();
        this.render();
    },

    render() {
        if (this.currentDealId) {
            this.renderDealView();
        } else {
            const container = document.getElementById('viewCurrentDeal');
            if (container && container.querySelector('.content-grid')) {
                // Don't destroy DOM, just show empty state message
            }
        }

        this.renderContactDirectory();
        this.renderCallQueue();
    },

    switchTab(viewId) {
        ['viewCurrentDeal', 'viewContactDirectory', 'viewContactDetail', 'viewCallQueue'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });

        ['tabCurrentDeal', 'tabContactDirectory', 'tabCallQueue'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });

        const target = document.getElementById(viewId);
        if (target) target.classList.remove('hidden');

        const map = {
            'viewCurrentDeal': 'tabCurrentDeal',
            'viewContactDirectory': 'tabContactDirectory',
            'viewContactDetail': 'tabContactDirectory', // keep directory tab highlighted
            'viewCallQueue': 'tabCallQueue'
        };
        const btn = document.getElementById(map[viewId]);
        if (btn) btn.classList.add('active');
    },

    // ==========================================
    // Sub-View: Current Deal
    // ==========================================
    renderDealView() {
        const deal = Store.getDeal(this.currentDealId);
        if (!deal) return;

        this.renderContacts(deal.contacts || []);
        this.renderLogs(deal.timeline || []);
        this.renderTimeline(deal.timeline || []);
        this.updateContactSelect(deal.contacts || []);

        // Highlight active status button
        document.querySelectorAll('#statusActions .btn-status').forEach(btn => {
            btn.classList.toggle('active-status', btn.dataset.status === deal.status);
        });
    },

    renderContacts(contacts) {
        const list = document.getElementById('contactsList');
        if (!list) return;
        list.innerHTML = '';

        if (contacts.length === 0) {
            list.innerHTML = '<li class="empty-state">No contacts added</li>';
            return;
        }

        // Get deal timeline for last-interaction lookup
        const deal = Store.getDeal(this.currentDealId);
        const timeline = (deal && deal.timeline) || [];

        contacts.forEach((contact, index) => {
            const li = document.createElement('li');
            li.className = 'contact-card';

            const initials = (contact.name || '?').charAt(0).toUpperCase();
            const roleClass = `role-${contact.role || 'other'}`;

            // Find last interaction with this contact
            const lastEntry = timeline.find(t =>
                t.contact && t.contact.toLowerCase().trim() === (contact.name || '').toLowerCase().trim()
            );
            const lastDate = lastEntry ? new Date(lastEntry.timestamp).toLocaleDateString() : null;

            // Find global contact ID for detail link
            const globalContact = Store.findContactByNamePhone(contact.name, contact.phone);

            li.innerHTML = `
                <div class="contact-card-left">
                    <div class="contact-avatar ${roleClass}">${initials}</div>
                    <div class="contact-card-info">
                        <strong class="contact-card-name" ${globalContact ? `data-contact-id="${globalContact.id}"` : ''}>${contact.name}</strong>
                        <span class="role-badge ${roleClass}">${contact.role || 'other'}</span>
                        <div class="contact-card-links">
                            ${contact.phone ? `<a href="tel:${contact.phone}" class="contact-link" title="Call">📞 ${contact.phone}</a>` : ''}
                            ${contact.email ? `<a href="mailto:${contact.email}" class="contact-link" title="Email">✉️ ${contact.email}</a>` : ''}
                        </div>
                        ${lastDate ? `<div class="contact-card-last">Last contact: ${lastDate}</div>` : ''}
                    </div>
                </div>
                <button class="delete-btn" data-index="${index}" title="Remove Contact">&times;</button>
            `;
            list.appendChild(li);
        });

        // Click contact name → open Contact Detail
        list.querySelectorAll('.contact-card-name[data-contact-id]').forEach(el => {
            el.addEventListener('click', () => {
                this.showContactDetail(parseInt(el.dataset.contactId));
            });
        });

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

        const logs = timeline.filter(t =>
            t.type === 'note' || t.type === 'call' || t.type === 'email' || t.type === 'text' || t.type === 'meeting'
        );

        if (logs.length === 0) {
            list.innerHTML = '<li class="empty-state">No interaction logs yet. Add a note above.</li>';
            return;
        }

        const iconMap = { call: '📞', email: '✉️', text: '💬', meeting: '📅', note: '📝' };
        const labelMap = { call: 'Call', email: 'Email', text: 'Text', meeting: 'Meeting', note: 'Note' };

        logs.forEach((log, index) => {
            const li = document.createElement('li');
            li.className = `log-entry log-type-${log.type || 'note'}`;
            const icon = iconMap[log.type] || '📝';
            const label = labelMap[log.type] || 'Note';
            const date = new Date(log.timestamp).toLocaleString();

            li.innerHTML = `
                <div class="log-header">
                    <span class="log-type">${icon} ${label}</span>
                    <div class="log-header-right">
                        <span class="log-date">${date}</span>
                        <button class="log-delete-btn" data-index="${index}" title="Delete entry">&times;</button>
                    </div>
                </div>
                ${log.contact ? `<div class="log-meta">with ${log.contact}</div>` : ''}
                <div class="log-content">${log.text}</div>
            `;
            list.appendChild(li);
        });

        // Delete log entries
        list.querySelectorAll('.log-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!confirm('Delete this log entry?')) return;

                const logIndex = parseInt(btn.dataset.index);
                const deal = Store.getDeal(this.currentDealId);
                if (!deal || !deal.timeline) return;

                // Find the actual timeline index (logs are filtered subset)
                const logTypes = ['note', 'call', 'email', 'text', 'meeting'];
                let count = -1;
                for (let i = 0; i < deal.timeline.length; i++) {
                    if (logTypes.includes(deal.timeline[i].type)) {
                        count++;
                        if (count === logIndex) {
                            deal.timeline.splice(i, 1);
                            Store.saveDeal(deal);
                            this.render();
                            return;
                        }
                    }
                }
            });
        });
    },

    renderTimeline(timeline) {
        const list = document.getElementById('dealTimeline');
        if (!list) return;
        list.innerHTML = '';

        if (timeline.length === 0) {
            list.innerHTML = '<li class="empty-state" style="border:none;">New Deal</li>';
            return;
        }

        const iconMap = {
            call: '📞', email: '✉️', text: '💬', meeting: '📅',
            note: '📝', status_change: '🔄', system: '⚙️'
        };

        timeline.forEach(item => {
            const li = document.createElement('li');
            li.className = `timeline-item timeline-type-${item.type || 'system'}`;
            const date = new Date(item.timestamp).toLocaleDateString();
            const icon = iconMap[item.type] || '📝';

            let content = '';
            if (item.type === 'status_change') {
                content = `Status changed to <span class="status-pill status-${item.status}">${(item.status || '').replace(/_/g, ' ')}</span>`;
            } else if (item.type === 'system') {
                content = item.text || '';
            } else {
                content = `${item.contact ? `<strong>${item.contact}:</strong> ` : ''}${item.text || ''}`;
            }

            li.innerHTML = `
                <div class="timeline-date">${icon} ${date}</div>
                <div class="timeline-content">${content}</div>
            `;
            list.appendChild(li);
        });
    },

    addLog(type, text, contactName) {
        if (!this.currentDealId) {
            alert('Please save a deal first before adding log entries.');
            return;
        }

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
        select.innerHTML = '<option value="">-- Select Contact --</option>';

        contacts.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = `${c.name} (${c.role})`;
            select.appendChild(opt);
        });

        select.value = currentVal;
    },

    addContact(contact) {
        if (!this.currentDealId) {
            alert('Please save a deal first before adding contacts.');
            return;
        }
        Store.addContactToDeal(this.currentDealId, contact);

        Store.addLogToDeal(this.currentDealId, {
            type: 'system',
            text: `Added contact: ${contact.name} (${contact.role})`
        });

        // Sync to global directory
        Store.syncContactToGlobal(contact, this.currentDealId);

        this.render();
    },

    deleteContact(index) {
        if (!this.currentDealId) return;
        const deal = Store.getDeal(this.currentDealId);
        if (deal && deal.contacts) {
            const removed = deal.contacts[index];
            deal.contacts.splice(index, 1);
            Store.saveDeal(deal);

            Store.addLogToDeal(this.currentDealId, {
                type: 'system',
                text: `Removed contact: ${removed.name}`
            });

            this.render();
        }
    },

    // ==========================================
    // Sub-View: Contact Directory (merged from contacts.js)
    // ==========================================
    renderContactDirectory() {
        const tbody = document.getElementById('crmContactsTableBody');
        if (!tbody) return;

        let contacts = Store.getContacts();
        const search = (document.getElementById('crmContactSearch')?.value || '').toLowerCase();
        const roleFilter = document.getElementById('crmContactRoleFilter')?.value || 'all';

        if (search) {
            contacts = contacts.filter(c =>
                (c.name || '').toLowerCase().includes(search) ||
                (c.email || '').toLowerCase().includes(search) ||
                (c.phone || '').includes(search)
            );
        }
        if (roleFilter !== 'all') {
            contacts = contacts.filter(c => c.role === roleFilter);
        }

        if (contacts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No contacts found</td></tr>';
            return;
        }

        tbody.innerHTML = contacts.map(contact => {
            const dealChips = (contact.dealIds || []).map(dealId => {
                const deal = Store.getDeal(dealId);
                const label = deal ? (deal.propertyAddress || 'Untitled').substring(0, 20) : `#${dealId}`;
                return `<span class="deal-chip" data-deal-id="${dealId}" title="${deal ? deal.propertyAddress : ''}">${label}</span>`;
            }).join('');

            return `
                <tr data-contact-id="${contact.id}">
                    <td>
                        <strong class="contact-name-link" data-contact-id="${contact.id}">${contact.name}</strong>
                    </td>
                    <td><span class="role-badge role-${contact.role || 'other'}">${contact.role || 'other'}</span></td>
                    <td>${contact.phone ? `<a href="tel:${contact.phone}" class="contact-link">${contact.phone}</a>` : '-'}</td>
                    <td>${contact.email ? `<a href="mailto:${contact.email}" class="contact-link">${contact.email}</a>` : '-'}</td>
                    <td><div class="contact-deals-list">${dealChips || '<span class="text-muted">-</span>'}</div></td>
                    <td>
                        <button class="btn-small view-contact-btn" data-contact-id="${contact.id}">View</button>
                        <button class="btn-danger delete-contact-btn" data-id="${contact.id}" style="margin-left:4px;">x</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Click contact name or View button -> contact detail
        tbody.querySelectorAll('.contact-name-link, .view-contact-btn').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                this.showContactDetail(parseInt(el.dataset.contactId));
            });
        });

        // Click deal chips -> load deal
        tbody.querySelectorAll('.deal-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const dealId = parseInt(chip.dataset.dealId);
                document.dispatchEvent(new CustomEvent('loadDeal', { detail: { id: dealId } }));
            });
        });

        // Delete contact
        tbody.querySelectorAll('.delete-contact-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this contact from the directory?')) {
                    Store.deleteGlobalContact(parseInt(btn.dataset.id));
                    this.renderContactDirectory();
                }
            });
        });
    },

    // ==========================================
    // Sub-View: Contact Detail (full timeline)
    // ==========================================
    showContactDetail(contactId) {
        const contact = Store.getContact(contactId);
        if (!contact) return;

        this.switchTab('viewContactDetail');

        document.getElementById('contactDetailName').textContent = contact.name;
        document.getElementById('contactDetailRole').textContent = contact.role || 'other';
        document.getElementById('contactDetailPhone').textContent = contact.phone || 'No phone';
        document.getElementById('contactDetailEmail').textContent = contact.email || 'No email';

        // Associated deals
        const dealsList = document.getElementById('contactDealsList');
        const deals = (contact.dealIds || []).map(id => Store.getDeal(id)).filter(Boolean);

        if (deals.length === 0) {
            dealsList.innerHTML = '<li class="empty-state" style="border:none;">No associated deals</li>';
        } else {
            dealsList.innerHTML = deals.map(deal => `
                <li class="contact-deal-item" data-deal-id="${deal.id}">
                    <span class="deal-address">${deal.propertyAddress || 'Untitled'}</span>
                    <span class="status-pill status-${deal.status}">${(deal.status || 'lead').replace(/_/g, ' ')}</span>
                    <span class="deal-profit">${deal.profit || '$0'}</span>
                </li>
            `).join('');

            dealsList.querySelectorAll('.contact-deal-item').forEach(li => {
                li.addEventListener('click', () => {
                    document.dispatchEvent(new CustomEvent('loadDeal', {
                        detail: { id: parseInt(li.dataset.dealId) }
                    }));
                });
            });
        }

        // Full cross-deal timeline
        const timelineEl = document.getElementById('contactFullTimeline');
        const fullTimeline = this.buildFullContactTimeline(contact, deals);

        if (fullTimeline.length === 0) {
            timelineEl.innerHTML = '<li class="empty-state" style="border:none;">No interactions recorded</li>';
        } else {
            timelineEl.innerHTML = fullTimeline.map(item => {
                const icon = item.type === 'call' ? '📞' : item.type === 'email' ? '✉️' :
                             item.type === 'text' ? '💬' : item.type === 'meeting' ? '📅' :
                             item.type === 'status_change' ? '🔄' : '📝';
                const date = new Date(item.timestamp).toLocaleString();
                return `
                    <li class="timeline-entry">
                        <span class="timeline-icon">${icon}</span>
                        <div class="timeline-body">
                            <div class="timeline-deal-label">${item.dealAddress || 'General'}</div>
                            <div class="timeline-text">${item.text || ''}</div>
                            <div class="timeline-date">${date}</div>
                        </div>
                    </li>
                `;
            }).join('');
        }
    },

    buildFullContactTimeline(contact, deals) {
        const timeline = [];

        deals.forEach(deal => {
            (deal.timeline || []).forEach(entry => {
                const isContactEntry = entry.contact &&
                    entry.contact.toLowerCase().trim() === contact.name.toLowerCase().trim();
                const isStatusChange = entry.type === 'status_change';
                const isSystemEvent = entry.type === 'system';

                if (isContactEntry || isStatusChange || isSystemEvent) {
                    timeline.push({
                        ...entry,
                        dealId: deal.id,
                        dealAddress: deal.propertyAddress
                    });
                }
            });
        });

        return timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    // ==========================================
    // Sub-View: Call Queue
    // ==========================================
    renderCallQueue() {
        const container = document.getElementById('callQueueContainer');
        if (!container) return;
        container.innerHTML = '';

        const filterVal = document.getElementById('callQueueFilter') ? document.getElementById('callQueueFilter').value : 'all_leads';
        const deals = Store.getDeals();
        let queue = [];

        const activeDeals = deals.filter(d => d.status === 'lead' || d.status === 'analyzed' || d.status === 'offer_sent');

        if (filterVal === 'fresh_leads') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            queue = activeDeals.filter(d => {
                const created = d.id ? new Date(d.id) : new Date();
                return created > sevenDaysAgo;
            });
        } else if (filterVal === 'follow_up_needed') {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            queue = activeDeals.filter(d => {
                if (!d.timeline || d.timeline.length === 0) return true;
                const lastLog = new Date(d.timeline[0].timestamp);
                return lastLog < threeDaysAgo;
            });
        } else {
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
                        <span class="status-pill status-${deal.status}">${(deal.status || '').replace(/_/g, ' ')}</span> • Seller: ${seller.name} • Last Activity: ${lastContact}
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

        container.querySelectorAll('.quick-log-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
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
                        this.renderCallQueue();
                    }
                }, 500);
            });
        });

        const filterSelect = document.getElementById('callQueueFilter');
        if (filterSelect && !filterSelect.hasAttribute('data-init')) {
            filterSelect.setAttribute('data-init', 'true');
            filterSelect.addEventListener('change', () => this.renderCallQueue());
        }
    },

    // ==========================================
    // Setup Listeners
    // ==========================================
    setupListeners() {
        // Tab Navigation
        const bindTab = (btnId, viewId) => {
            const btn = document.getElementById(btnId);
            if (btn) btn.addEventListener('click', () => this.switchTab(viewId));
        };
        bindTab('tabCurrentDeal', 'viewCurrentDeal');
        bindTab('tabContactDirectory', 'viewContactDirectory');
        bindTab('tabCallQueue', 'viewCallQueue');

        // Back to directory from contact detail
        const backBtn = document.getElementById('backToDirectoryBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.switchTab('viewContactDirectory'));
        }

        // Contact Directory search/filter
        const searchInput = document.getElementById('crmContactSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderContactDirectory());
        }
        const roleFilter = document.getElementById('crmContactRoleFilter');
        if (roleFilter) {
            roleFilter.addEventListener('change', () => this.renderContactDirectory());
        }

        // Add Contact button in directory -> open modal
        const addContactDirBtn = document.getElementById('crmAddContactBtn');
        if (addContactDirBtn) {
            addContactDirBtn.addEventListener('click', () => {
                document.getElementById('addGlobalContactModal').classList.remove('hidden');
            });
        }

        // Add Contact Modal - save
        const saveBtn = document.getElementById('saveGlobalContactBtn');
        if (saveBtn && !saveBtn.hasAttribute('data-init')) {
            saveBtn.setAttribute('data-init', 'true');
            saveBtn.addEventListener('click', () => {
                const name = document.getElementById('globalContactName').value.trim();
                if (!name) { alert('Name is required.'); return; }

                const contactData = {
                    name,
                    role: document.getElementById('globalContactRole').value,
                    phone: document.getElementById('globalContactPhone').value.trim(),
                    email: document.getElementById('globalContactEmail').value.trim(),
                    dealIds: [],
                    notes: ''
                };

                const existing = Store.findContactByNamePhone(name, contactData.phone);
                if (existing) {
                    alert('A contact with this name already exists.');
                    return;
                }

                Store.saveContact(contactData);
                document.getElementById('addGlobalContactModal').classList.add('hidden');
                document.getElementById('globalContactName').value = '';
                document.getElementById('globalContactPhone').value = '';
                document.getElementById('globalContactEmail').value = '';
                this.renderContactDirectory();
            });
        }

        // Close modal
        const closeBtn = document.getElementById('closeAddContactModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('addGlobalContactModal').classList.add('hidden');
            });
        }

        // CRM search (old globalContactSearch in All Contacts subview)
        const globalSearch = document.getElementById('globalContactSearch');
        if (globalSearch) {
            globalSearch.addEventListener('input', () => this.renderContactDirectory());
        }

        // Add Contact to Deal
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
                    document.getElementById('contactName').value = '';
                    document.getElementById('contactPhone').value = '';
                    document.getElementById('contactEmail').value = '';
                }
            });
        }

        // Type Selector Buttons
        this._selectedLogType = 'note';
        const typeSelector = document.getElementById('logTypeSelector');
        if (typeSelector && !typeSelector.hasAttribute('data-init')) {
            typeSelector.setAttribute('data-init', 'true');
            typeSelector.querySelectorAll('.type-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    typeSelector.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this._selectedLogType = btn.dataset.type;

                    const addLogBtn = document.getElementById('addLogBtn');
                    if (addLogBtn) {
                        const labels = { note: 'Add Note', call: 'Log Call', email: 'Log Email', text: 'Log Text', meeting: 'Log Meeting' };
                        addLogBtn.textContent = labels[this._selectedLogType] || 'Add Note';
                    }
                });
            });
        }

        // Template Selector
        this.populateTemplates();
        const templateSelect = document.getElementById('templateSelect');
        if (templateSelect && !templateSelect.hasAttribute('data-init')) {
            templateSelect.setAttribute('data-init', 'true');
            templateSelect.addEventListener('change', () => {
                const templateId = parseInt(templateSelect.value);
                if (!templateId) return;
                const template = Store.getTemplates().find(t => t.id === templateId);
                if (!template) return;

                const deal = this.currentDealId ? Store.getDeal(this.currentDealId) : {};
                const filled = Store.fillTemplate(template.text, deal || {});
                document.getElementById('logEntry').value = filled;
                templateSelect.value = '';
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
                    this.addLog(this._selectedLogType || 'note', text, contact);
                    document.getElementById('logEntry').value = '';
                }
            });
        }

        // Follow-Up Buttons
        const setFollowUpBtn = document.getElementById('setFollowUpBtn');
        const followUpForm = document.getElementById('followUpForm');
        if (setFollowUpBtn && !setFollowUpBtn.hasAttribute('data-init')) {
            setFollowUpBtn.setAttribute('data-init', 'true');
            setFollowUpBtn.addEventListener('click', () => {
                if (followUpForm) followUpForm.classList.toggle('hidden');
            });
        }

        const cancelFollowUpBtn = document.getElementById('cancelFollowUpBtn');
        if (cancelFollowUpBtn && !cancelFollowUpBtn.hasAttribute('data-init')) {
            cancelFollowUpBtn.setAttribute('data-init', 'true');
            cancelFollowUpBtn.addEventListener('click', () => {
                if (followUpForm) followUpForm.classList.add('hidden');
            });
        }

        const saveFollowUpBtn = document.getElementById('saveFollowUpBtn');
        if (saveFollowUpBtn && !saveFollowUpBtn.hasAttribute('data-init')) {
            saveFollowUpBtn.setAttribute('data-init', 'true');
            saveFollowUpBtn.addEventListener('click', () => {
                const dueDate = document.getElementById('followUpDate').value;
                const note = document.getElementById('followUpNote').value.trim();
                if (!dueDate) { alert('Please select a due date.'); return; }

                const deal = this.currentDealId ? Store.getDeal(this.currentDealId) : null;
                Store.saveTask({
                    text: note || 'Follow up',
                    dueDate,
                    dealId: this.currentDealId,
                    dealAddress: deal ? deal.propertyAddress : ''
                });

                if (this.currentDealId) {
                    Store.addLogToDeal(this.currentDealId, {
                        type: 'system',
                        text: `Follow-up set for ${new Date(dueDate).toLocaleDateString()}${note ? ': ' + note : ''}`
                    });
                }

                document.getElementById('followUpDate').value = '';
                document.getElementById('followUpNote').value = '';
                if (followUpForm) followUpForm.classList.add('hidden');
                this.render();
                alert('Follow-up saved!');
            });
        }

        // Status buttons in CRM
        document.querySelectorAll('#statusActions .btn-status').forEach(btn => {
            if (!btn.hasAttribute('data-crm-init')) {
                btn.setAttribute('data-crm-init', 'true');
                btn.addEventListener('click', () => {
                    if (!this.currentDealId) return;
                    const newStatus = btn.dataset.status;
                    Store.updateDealStatus(this.currentDealId, newStatus);

                    document.dispatchEvent(new CustomEvent('dealStatusChanged', {
                        detail: { id: this.currentDealId, status: newStatus }
                    }));

                    this.renderDealView();
                });
            }
        });

        // Status Timeline Event Listener
        document.removeEventListener('dealStatusChanged', this.handleStatusChange);
        document.addEventListener('dealStatusChanged', this.handleStatusChange.bind(this));
    },

    populateTemplates() {
        const select = document.getElementById('templateSelect');
        if (!select) return;
        const templates = Store.getTemplates();
        select.innerHTML = '<option value="">-- Use Template --</option>';
        templates.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
    },

    handleStatusChange(e) {
        const { id, status } = e.detail;
        if (this.currentDealId === id) {
            Store.addLogToDeal(id, {
                type: 'status_change',
                status: status,
                text: `Status updated to ${status}`
            });
            this.render();
        } else {
            Store.addLogToDeal(id, {
                type: 'status_change',
                status: status,
                text: `Status updated to ${status}`
            });
            if (!document.getElementById('viewCallQueue').classList.contains('hidden')) {
                this.renderCallQueue();
            }
        }
    }
};
