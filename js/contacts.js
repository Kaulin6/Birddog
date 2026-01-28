/**
 * contacts.js
 * Global Contacts Directory Module
 */

import { Store } from './store.js';
import { UI } from './ui.js';

export const Contacts = {
    searchQuery: '',
    roleFilter: 'all',

    init() {
        this.setupListeners();
        this.render();
    },

    render() {
        this.renderTable();
    },

    renderTable() {
        const tbody = document.getElementById('contactsTableBody');
        if (!tbody) return;

        let contacts = Store.getContacts();

        // Apply search
        if (this.searchQuery) {
            const q = this.searchQuery.toLowerCase();
            contacts = contacts.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.phone || '').includes(q)
            );
        }

        // Apply role filter
        if (this.roleFilter !== 'all') {
            contacts = contacts.filter(c => c.role === this.roleFilter);
        }

        if (contacts.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No contacts found</td></tr>`;
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
                        <strong class="contact-name-link" data-name="${contact.name}">${contact.name}</strong>
                    </td>
                    <td><span class="role-badge">${contact.role || 'other'}</span></td>
                    <td>${contact.phone ? `<a href="tel:${contact.phone}" class="contact-link">${contact.phone}</a>` : '-'}</td>
                    <td>${contact.email ? `<a href="mailto:${contact.email}" class="contact-link">${contact.email}</a>` : '-'}</td>
                    <td><div class="contact-deals-list">${dealChips || '<span class="text-muted">-</span>'}</div></td>
                    <td><button class="btn-danger delete-contact-btn" data-id="${contact.id}">x</button></td>
                </tr>
            `;
        }).join('');

        // Add click listeners for contact names
        tbody.querySelectorAll('.contact-name-link').forEach(el => {
            el.addEventListener('click', () => {
                this.showContactHistory(el.dataset.name);
            });
        });

        // Add click listeners for deal chips
        tbody.querySelectorAll('.deal-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const dealId = parseInt(chip.dataset.dealId);
                const event = new CustomEvent('loadDeal', { detail: { id: dealId } });
                document.dispatchEvent(event);
            });
        });

        // Delete buttons
        tbody.querySelectorAll('.delete-contact-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                if (confirm('Delete this contact from the directory?')) {
                    Store.deleteGlobalContact(id);
                    this.render();
                }
            });
        });
    },

    showContactHistory(contactName) {
        const panel = document.getElementById('contactHistoryPanel');
        const nameEl = document.getElementById('contactHistoryName');
        const listEl = document.getElementById('contactHistoryList');

        if (!panel || !nameEl || !listEl) return;

        nameEl.textContent = `History: ${contactName}`;
        const history = Store.getContactInteractionHistory(contactName);

        if (history.length === 0) {
            listEl.innerHTML = '<p class="empty-state">No interaction history found for this contact.</p>';
        } else {
            listEl.innerHTML = history.map(item => {
                const icon = item.type === 'call' ? '📞' : item.type === 'email' ? '✉️' : item.type === 'text' ? '💬' : item.type === 'meeting' ? '📅' : '📝';
                const date = new Date(item.timestamp).toLocaleString();
                return `
                    <div class="contact-history-item">
                        <div class="history-deal">${item.dealAddress || 'Unknown Deal'}</div>
                        <div>${icon} ${item.text}</div>
                        <div class="history-date">${date}</div>
                    </div>
                `;
            }).join('');
        }

        panel.classList.remove('hidden');
    },

    setupListeners() {
        // Search
        const searchInput = document.getElementById('contactSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value;
                this.renderTable();
            });
        }

        // Role filter
        const roleFilter = document.getElementById('contactRoleFilter');
        if (roleFilter) {
            roleFilter.addEventListener('change', (e) => {
                this.roleFilter = e.target.value;
                this.renderTable();
            });
        }

        // Add global contact button
        const addBtn = document.getElementById('addGlobalContactBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                document.getElementById('addGlobalContactModal').classList.remove('hidden');
            });
        }

        // Close add contact modal
        const closeBtn = document.getElementById('closeAddContactModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('addGlobalContactModal').classList.add('hidden');
            });
        }

        // Save global contact
        const saveBtn = document.getElementById('saveGlobalContactBtn');
        if (saveBtn) {
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

                // Dedup check
                const existing = Store.findContactByNamePhone(name, contactData.phone);
                if (existing) {
                    alert('A contact with this name already exists.');
                    return;
                }

                Store.saveContact(contactData);
                document.getElementById('addGlobalContactModal').classList.add('hidden');

                // Clear form
                document.getElementById('globalContactName').value = '';
                document.getElementById('globalContactPhone').value = '';
                document.getElementById('globalContactEmail').value = '';

                this.render();
            });
        }
    }
};
