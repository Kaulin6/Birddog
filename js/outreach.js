/**
 * outreach.js
 * Outreach System — List Management, Cadence Engine, Stats Dashboard
 */

import { Store, CADENCE_STEPS } from './store.js';

const SOURCE_LABELS = {
    driving_dollars: 'Driving for Dollars',
    facebook: 'Facebook',
    mls: 'MLS',
    county_data: 'County Data',
    cold_call: 'Cold Call List',
    other: 'Other'
};

function esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const Outreach = {
    _currentView: 'lists',
    _currentListId: null,
    _currentCadenceId: null,
    _parsedImport: null,
    _parsedPasteBack: null,

    // ==========================================
    // INIT + NAVIGATION
    // ==========================================
    init() {
        this.setupListeners();
        this.showView('lists');
    },

    showView(viewName) {
        this._currentView = viewName;
        const views = ['listsView', 'listDetailView', 'cadenceQueueView', 'statsView'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.classList.add('hidden');
        });

        const navBtns = ['navLists', 'navCadenceQueue', 'navStats'];
        navBtns.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('active');
        });

        switch (viewName) {
            case 'lists':
                document.getElementById('listsView').classList.remove('hidden');
                document.getElementById('navLists').classList.add('active');
                this.renderListsView();
                break;
            case 'listDetail':
                document.getElementById('listDetailView').classList.remove('hidden');
                document.getElementById('navLists').classList.add('active');
                this.renderListDetail();
                break;
            case 'cadenceQueue':
                document.getElementById('cadenceQueueView').classList.remove('hidden');
                document.getElementById('navCadenceQueue').classList.add('active');
                this.renderCadenceQueue();
                break;
            case 'stats':
                document.getElementById('statsView').classList.remove('hidden');
                document.getElementById('navStats').classList.add('active');
                this.renderStatsView();
                break;
        }
    },

    // ==========================================
    // LISTS VIEW
    // ==========================================
    renderListsView() {
        const container = document.getElementById('listsGrid');
        const lists = Store.getLists();

        if (lists.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px; text-align: center;">
                    <h3 style="margin-bottom: 8px;">No lists yet</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 16px;">Import a lead list from Google Sheets to get started.</p>
                    <button class="btn-primary" id="emptyImportBtn">+ Import New List</button>
                </div>
            `;
            const btn = document.getElementById('emptyImportBtn');
            if (btn) btn.addEventListener('click', () => this.openImportModal());
            return;
        }

        container.innerHTML = lists.map(list => {
            const s = list.stats || {};
            const sourceLabel = SOURCE_LABELS[list.source] || list.source || 'Unknown';
            const createdDate = list.createdAt ? new Date(list.createdAt).toLocaleDateString() : '';

            // Stage progress: imported → skip traced → in cadence
            const total = s.total || 0;
            const traced = s.skipTraced || 0;
            const cadenced = s.cadenceStarted || 0;
            const stageImported = total > 0;
            const stageTraced = traced > 0;
            const stageCadenced = cadenced > 0;

            return `
                <div class="card list-card" data-list-id="${list.id}">
                    <div class="list-card-header">
                        <h3>${esc(list.name || 'Untitled List')}</h3>
                        <div class="list-stage-tracker">
                            <div class="list-stage ${stageImported ? 'stage-done' : ''}">
                                <span class="list-stage-dot"></span>
                                <span class="list-stage-label">Imported</span>
                            </div>
                            <div class="list-stage-line ${stageTraced ? 'line-done' : ''}"></div>
                            <div class="list-stage ${stageTraced ? 'stage-done' : ''}">
                                <span class="list-stage-dot"></span>
                                <span class="list-stage-label">Skip Traced</span>
                            </div>
                            <div class="list-stage-line ${stageCadenced ? 'line-done' : ''}"></div>
                            <div class="list-stage ${stageCadenced ? 'stage-done' : ''}">
                                <span class="list-stage-dot"></span>
                                <span class="list-stage-label">In Cadence</span>
                            </div>
                        </div>
                    </div>
                    <div class="list-card-meta">
                        <span>Source: ${esc(sourceLabel)}</span>
                        ${list.listType ? `<span>Type: ${list.listType === 'owner' ? 'Owner' : list.listType === 'agent' ? 'Agent' : 'Mixed'}</span>` : ''}
                        ${list.market ? `<span>Market: ${esc(list.market)}</span>` : ''}
                        ${list.assignedTo ? `<span>VA: ${esc(list.assignedTo)}</span>` : ''}
                        <span>${createdDate}</span>
                    </div>
                    <div class="pipeline-stats-bar list-card-stats">
                        <div class="pipeline-stat"><h4>Total</h4><div class="stat-num">${total}</div></div>
                        <div class="pipeline-stat"><h4>Skip Traced</h4><div class="stat-num">${traced}</div></div>
                        <div class="pipeline-stat"><h4>In Cadence</h4><div class="stat-num">${cadenced}</div></div>
                        <div class="pipeline-stat"><h4>Interested</h4><div class="stat-num" style="color: var(--accent-green);">${s.interested || 0}</div></div>
                        <div class="pipeline-stat"><h4>Dead</h4><div class="stat-num" style="color: var(--accent-red);">${s.dead || 0}</div></div>
                    </div>
                    <div class="list-card-actions">
                        <button class="btn-primary start-cadences-btn" data-list-id="${list.id}">Start Cadences</button>
                        <button class="btn-secondary view-list-btn" data-list-id="${list.id}">View Deals</button>
                        <button class="btn-secondary paste-back-btn" data-list-id="${list.id}">Paste Back</button>
                        <button class="btn-ghost assign-va-btn" data-list-id="${list.id}">Assign VA</button>
                    </div>
                </div>
            `;
        }).join('');

        this.bindListsEvents();
    },

    bindListsEvents() {
        document.querySelectorAll('.view-list-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this._currentListId = parseInt(e.currentTarget.dataset.listId);
                this.showView('listDetail');
            });
        });

        document.querySelectorAll('.start-cadences-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const listId = parseInt(e.currentTarget.dataset.listId);
                const deals = Store.getListDeals(listId);
                const withPhone = deals.filter(d => (d.contacts || []).some(c => c.phone));
                const alreadyCadenced = deals.filter(d => Store.getCadenceByDeal(d.id));
                const eligible = withPhone.length - alreadyCadenced.length;
                if (withPhone.length === 0) {
                    alert('No leads with phone numbers found. Import or paste back skip trace data first.');
                    return;
                }
                if (eligible <= 0) {
                    alert('All leads with phone numbers already have active cadences.');
                    return;
                }
                if (!confirm(`Start 7-touch cadences for ${eligible} leads with phone numbers?`)) return;
                const started = Store.startCadencesForList(listId);
                alert(`Started ${started} cadences.`);
                this.renderListsView();
            });
        });

        document.querySelectorAll('.paste-back-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this._currentListId = parseInt(e.currentTarget.dataset.listId);
                this.openPasteBackModal();
            });
        });

        document.querySelectorAll('.assign-va-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this._currentListId = parseInt(e.currentTarget.dataset.listId);
                this.openAssignVAModal();
            });
        });
    },

    // ==========================================
    // LIST DETAIL VIEW
    // ==========================================
    renderListDetail() {
        const list = Store.getList(this._currentListId);
        if (!list) { this.showView('lists'); return; }

        document.getElementById('listDetailTitle').textContent = `List: ${list.name || 'Untitled'}`;

        // Stats bar
        const deals = Store.getListDeals(this._currentListId);
        const cadences = Store.getCadences().filter(c => c.listId === this._currentListId);
        const statsContainer = document.getElementById('listDetailStats');
        statsContainer.innerHTML = `
            <div class="pipeline-stat"><h4>Total</h4><div class="stat-num">${deals.length}</div></div>
            <div class="pipeline-stat"><h4>Skip Traced</h4><div class="stat-num">${deals.filter(d => d.skipTraced).length}</div></div>
            <div class="pipeline-stat"><h4>In Cadence</h4><div class="stat-num">${cadences.filter(c => c.status === 'active').length}</div></div>
            <div class="pipeline-stat"><h4>Interested</h4><div class="stat-num" style="color: var(--accent-green);">${cadences.filter(c => c.status === 'responded').length}</div></div>
            <div class="pipeline-stat"><h4>Dead</h4><div class="stat-num" style="color: var(--accent-red);">${cadences.filter(c => c.status === 'dead').length}</div></div>
        `;

        // Deals table
        const tbody = document.getElementById('listDealsTableBody');
        tbody.innerHTML = deals.map(deal => {
            const owner = (deal.contacts || []).find(c => c.role === 'seller' || c.role === 'owner');
            const agent = (deal.contacts || []).find(c => c.role === 'agent');
            const cadence = cadences.find(c => c.dealId === deal.id);

            let cadenceStatus = '--';
            if (cadence) {
                if (cadence.status === 'active') {
                    cadenceStatus = `Step ${cadence.currentStep + 1}/7`;
                } else {
                    cadenceStatus = `<span class="list-status-pill status-${cadence.status === 'responded' ? 'active' : 'completed'}">${cadence.status}</span>`;
                }
            }

            return `
                <tr>
                    <td>${esc(deal.propertyAddress)}</td>
                    <td>${owner ? esc(owner.name) : '--'}</td>
                    <td>${owner && owner.phone ? esc(owner.phone) : '--'}</td>
                    <td>${agent ? esc(agent.name) : '--'}</td>
                    <td>${agent && agent.email ? esc(agent.email) : '--'}</td>
                    <td><span class="skip-status ${deal.skipTraced ? 'traced' : 'pending'}">${deal.skipTraced ? 'Done' : 'Pending'}</span></td>
                    <td>${cadenceStatus}</td>
                </tr>
            `;
        }).join('');
    },

    exportListToSheets(listId) {
        const deals = Store.getListDeals(listId);
        const header = ['Address', 'Owner Name', 'Owner Phone', 'Agent Name', 'Agent Email'].join('\t');
        const rows = deals.map(d => {
            const owner = (d.contacts || []).find(c => c.role === 'seller' || c.role === 'owner') || {};
            const agent = (d.contacts || []).find(c => c.role === 'agent') || {};
            return [d.propertyAddress || '', owner.name || '', owner.phone || '', agent.name || '', agent.email || ''].join('\t');
        });
        const text = [header, ...rows].join('\n');
        navigator.clipboard.writeText(text).then(() => {
            alert(`Copied ${deals.length} rows to clipboard. Paste into Google Sheets.`);
        }).catch(() => {
            // Fallback: show in a prompt
            prompt('Copy this text:', text);
        });
    },

    // ==========================================
    // IMPORT
    // ==========================================
    openImportModal() {
        document.getElementById('importModal').classList.remove('hidden');
        document.getElementById('importListName').value = '';
        document.getElementById('importSource').value = 'driving_dollars';
        document.getElementById('importListType').value = 'owner';
        document.getElementById('importAssignVA').value = '';
        document.getElementById('importMarket').value = '';
        document.getElementById('importData').value = '';
        document.getElementById('importColMap').classList.add('hidden');
        document.getElementById('importPreview').classList.add('hidden');
        document.getElementById('importExecuteBtn').classList.add('hidden');
        this._parsedImport = null;
    },

    parseSheetData(rawText) {
        const lines = rawText.trim().split('\n').filter(l => l.trim());
        if (lines.length === 0) return { headers: [], rows: [] };

        // Detect delimiter: if tabs exist use tabs, else use commas
        const hasTab = lines[0].includes('\t');
        const delimiter = hasTab ? '\t' : ',';

        const allRows = lines.map(line => {
            if (delimiter === ',') {
                // Simple CSV parse handling quoted fields
                const row = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const ch = line[i];
                    if (ch === '"') { inQuotes = !inQuotes; continue; }
                    if (ch === ',' && !inQuotes) { row.push(current.trim()); current = ''; continue; }
                    current += ch;
                }
                row.push(current.trim());
                return row;
            }
            return line.split('\t').map(c => c.trim());
        });

        const firstRow = allRows[0];
        const isHeader = firstRow.some(cell => {
            const lower = cell.toLowerCase();
            return lower.includes('address') || lower.includes('name') || lower.includes('phone')
                || lower.includes('email') || lower.includes('owner') || lower.includes('agent')
                || lower.includes('property') || lower.includes('street') || lower.includes('mail')
                || lower.includes('bed') || lower.includes('bath') || lower.includes('sqft')
                || lower.includes('type') || lower.includes('lot') || lower.includes('zip');
        });

        if (isHeader) {
            return { headers: firstRow, rows: allRows.slice(1) };
        } else {
            return { headers: firstRow.map((_, i) => `Column ${i + 1}`), rows: allRows };
        }
    },

    _renderColMapping(containerId, headers, prefix) {
        const container = document.getElementById(containerId);
        const listType = document.getElementById('importListType')?.value || 'owner';

        // Build fields based on list type
        const fields = [
            { key: 'address', label: 'Property Address', required: true },
            { key: 'mailingAddress', label: 'Mailing Address' }
        ];

        if (listType === 'owner' || listType === 'mixed') {
            fields.push({ key: 'ownerName', label: 'Owner/Seller Name' });
            fields.push({ key: 'ownerPhone', label: 'Owner Phone' });
            fields.push({ key: 'ownerEmail', label: 'Owner Email' });
        }
        if (listType === 'agent' || listType === 'mixed') {
            fields.push({ key: 'agentName', label: 'Agent Name' });
            fields.push({ key: 'agentPhone', label: 'Agent Phone' });
            fields.push({ key: 'agentEmail', label: 'Agent Email' });
        }
        if (listType === 'agent') {
            // For agent lists, also allow mapping a generic contact name/phone
            fields.push({ key: 'ownerName', label: 'Property Owner (if available)' });
            fields.push({ key: 'ownerPhone', label: 'Owner Phone (if available)' });
        }

        fields.push(
            { key: 'propertyType', label: 'Property Type' },
            { key: 'beds', label: 'Beds' },
            { key: 'baths', label: 'Baths' },
            { key: 'sqft', label: 'Sq Ft' },
            { key: 'lotSize', label: 'Lot Size' },
            { key: 'yearBuilt', label: 'Year Built' },
            { key: 'notes', label: 'Notes' }
        );

        container.innerHTML = `
            <h4 style="margin-bottom: 8px;">Map Columns</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                ${fields.map(f => {
                    const autoIdx = headers.findIndex(h => {
                        const lower = h.toLowerCase();
                        if (f.key === 'address') return (lower.includes('property') && lower.includes('address')) || lower === 'address' || lower.includes('street address') || (lower.includes('address') && !lower.includes('mail'));
                        if (f.key === 'mailingAddress') return lower.includes('mail') && lower.includes('address');
                        if (f.key === 'ownerName') return (lower.includes('owner') && lower.includes('name')) || lower === 'owner' || lower === 'owner name' || lower === 'seller';
                        if (f.key === 'ownerPhone') return (lower.includes('owner') || lower.includes('seller')) && (lower.includes('phone') || lower.includes('cell'));
                        if (f.key === 'ownerEmail') return (lower.includes('owner') || lower.includes('seller')) && lower.includes('email');
                        if (f.key === 'agentName') return lower.includes('agent') && (lower.includes('name') || lower === 'agent');
                        if (f.key === 'agentPhone') return lower.includes('agent') && lower.includes('phone');
                        if (f.key === 'agentEmail') return lower.includes('agent') && lower.includes('email');
                        if (f.key === 'propertyType') return lower.includes('type') || lower.includes('prop type') || lower === 'property type';
                        if (f.key === 'beds') return lower.includes('bed') || lower === 'br';
                        if (f.key === 'baths') return lower.includes('bath') || lower === 'ba';
                        if (f.key === 'sqft') return lower.includes('sqft') || lower.includes('sq ft') || lower.includes('square');
                        if (f.key === 'lotSize') return lower.includes('lot');
                        if (f.key === 'yearBuilt') return lower.includes('year') && lower.includes('built');
                        if (f.key === 'notes') return lower.includes('note') || lower.includes('comment');
                        return false;
                    });
                    // Fallback: for phone/email without owner/agent prefix, match generic
                    const fallbackIdx = autoIdx >= 0 ? autoIdx : headers.findIndex(h => {
                        const lower = h.toLowerCase();
                        if (f.key === 'ownerPhone') return lower.includes('phone') || lower.includes('cell') || lower.includes('mobile');
                        if (f.key === 'ownerEmail') return lower === 'email' || lower === 'e-mail';
                        if (f.key === 'address') return lower.includes('address');
                        return false;
                    });
                    return `
                        <div class="input-group" style="margin-bottom: 0;">
                            <label style="font-size: 0.8rem;">${f.label}${f.required ? ' *' : ''}</label>
                            <select id="${prefix}_${f.key}" class="filter-select" style="font-size: 0.8rem;">
                                <option value="-1">-- Skip --</option>
                                ${headers.map((h, i) => `<option value="${i}" ${i === fallbackIdx ? 'selected' : ''}>${esc(h)}</option>`).join('')}
                            </select>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        container.classList.remove('hidden');
    },

    _renderPreviewTable(containerId, headers, rows) {
        const previewRows = rows.slice(0, 10);
        document.getElementById(containerId).innerHTML = `
            <table style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        ${headers.map(h => `<th style="text-align: left; padding: 4px 8px;">${esc(h)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${previewRows.map(r => `
                        <tr style="border-bottom: 1px solid var(--border-color);">
                            ${r.map(c => `<td style="padding: 4px 8px;">${esc(c)}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <p style="margin-top: 8px; color: var(--text-secondary);">${rows.length} rows${rows.length > 10 ? ' (showing first 10)' : ''}</p>
        `;
    },

    _getColVal(prefix, key) {
        const el = document.getElementById(`${prefix}_${key}`);
        return el ? parseInt(el.value) : -1;
    },

    previewImport() {
        const rawText = document.getElementById('importData').value;
        if (!rawText.trim()) return;

        const { headers, rows } = this.parseSheetData(rawText);
        if (rows.length === 0) {
            document.getElementById('importPreviewTable').innerHTML = '<p style="color: var(--accent-red);">No data rows found.</p>';
            document.getElementById('importPreview').classList.remove('hidden');
            return;
        }

        this._renderColMapping('importColMap', headers, 'colMap');
        this._renderPreviewTable('importPreviewTable', headers, rows);

        this._parsedImport = rows;
        document.getElementById('importPreview').classList.remove('hidden');
        document.getElementById('importExecuteBtn').classList.remove('hidden');
    },

    executeImport() {
        if (!this._parsedImport || this._parsedImport.length === 0) return;

        const listName = document.getElementById('importListName').value.trim() || `List ${new Date().toLocaleDateString()}`;
        const source = document.getElementById('importSource').value;
        const listType = document.getElementById('importListType').value;
        const assignVA = document.getElementById('importAssignVA').value.trim();
        const market = document.getElementById('importMarket').value.trim();

        const addrCol = this._getColVal('colMap', 'address');
        if (addrCol < 0) { alert('Please map the Address column.'); return; }

        const col = (key) => this._getColVal('colMap', key);

        // Create the list first
        const list = Store.saveList({
            name: listName,
            source,
            listType,
            market: market || '',
            assignedTo: assignVA || '',
            status: assignVA ? 'skip_tracing' : 'imported'
        });

        const rows = this._parsedImport.map(r => {
            const val = (idx) => idx >= 0 ? (r[idx] || '') : '';
            return {
                address: r[addrCol] || '',
                mailingAddress: val(col('mailingAddress')),
                ownerName: val(col('ownerName')),
                ownerPhone: val(col('ownerPhone')),
                ownerEmail: val(col('ownerEmail')),
                agentName: val(col('agentName')),
                agentPhone: val(col('agentPhone')),
                agentEmail: val(col('agentEmail')),
                propertyType: val(col('propertyType')),
                beds: val(col('beds')),
                baths: val(col('baths')),
                sqft: val(col('sqft')),
                lotSize: val(col('lotSize')),
                yearBuilt: val(col('yearBuilt')),
                notes: val(col('notes')),
                source: SOURCE_LABELS[source] || source
            };
        });

        const result = Store.addDealsToList(rows, list.id);
        alert(`Imported ${result.imported} leads into "${listName}". ${result.skipped} skipped (duplicate/empty).`);

        document.getElementById('importModal').classList.add('hidden');
        this._parsedImport = null;
        this.renderListsView();
    },

    // ==========================================
    // PASTE BACK (Skip Trace Return)
    // ==========================================
    openPasteBackModal() {
        document.getElementById('pasteBackModal').classList.remove('hidden');
        document.getElementById('pasteBackData').value = '';
        document.getElementById('pasteBackColMap').classList.add('hidden');
        document.getElementById('pasteBackPreview').classList.add('hidden');
        document.getElementById('pasteBackExecuteBtn').classList.add('hidden');
        this._parsedPasteBack = null;
    },

    previewPasteBack() {
        const rawText = document.getElementById('pasteBackData').value;
        if (!rawText.trim()) return;

        const { headers, rows } = this.parseSheetData(rawText);
        if (rows.length === 0) {
            document.getElementById('pasteBackPreviewTable').innerHTML = '<p style="color: var(--accent-red);">No data rows found.</p>';
            document.getElementById('pasteBackPreview').classList.remove('hidden');
            return;
        }

        this._renderColMapping('pasteBackColMap', headers, 'pb');

        // Show matched vs unmatched preview
        const addrColIdx = headers.findIndex(h => {
            const lower = h.toLowerCase();
            return lower.includes('address') || lower.includes('property') || lower.includes('street');
        });

        const list = Store.getList(this._currentListId);
        const deals = list ? Store.getListDeals(this._currentListId) : [];
        const addrSet = new Set(deals.map(d => (d.propertyAddress || '').toLowerCase().trim()));

        let matched = 0;
        const col = addrColIdx >= 0 ? addrColIdx : 0;
        rows.forEach(r => {
            if (addrSet.has((r[col] || '').toLowerCase().trim())) matched++;
        });

        this._renderPreviewTable('pasteBackPreviewTable', headers, rows);

        const previewEl = document.getElementById('pasteBackPreview');
        const matchInfo = document.createElement('p');
        matchInfo.style.cssText = 'margin-top: 8px; font-weight: 600;';
        matchInfo.textContent = `${matched} of ${rows.length} rows match existing deals in this list.`;
        previewEl.querySelector('#pasteBackPreviewTable').appendChild(matchInfo);

        this._parsedPasteBack = rows;
        previewEl.classList.remove('hidden');
        document.getElementById('pasteBackExecuteBtn').classList.remove('hidden');
    },

    executePasteBack() {
        if (!this._parsedPasteBack || !this._currentListId) return;

        const list = Store.getList(this._currentListId);
        if (!list) return;

        const deals = Store.getDeals();
        const listDeals = {};
        list.dealIds.forEach(id => {
            const d = deals.find(dd => dd.id === id);
            if (d) listDeals[(d.propertyAddress || '').toLowerCase().trim()] = d;
        });

        const addrCol = this._getColVal('pb', 'address');
        const ownerNameCol = this._getColVal('pb', 'ownerName');
        const ownerPhoneCol = this._getColVal('pb', 'ownerPhone');
        const agentNameCol = this._getColVal('pb', 'agentName');
        const agentEmailCol = this._getColVal('pb', 'agentEmail');

        if (addrCol < 0) { alert('Please map the Address column.'); return; }

        let matched = 0;
        let unmatched = 0;

        this._parsedPasteBack.forEach(row => {
            const addr = (row[addrCol] || '').toLowerCase().trim();
            const deal = listDeals[addr];
            if (!deal) { unmatched++; return; }

            if (ownerNameCol >= 0 && row[ownerNameCol]) {
                const existing = deal.contacts.find(c => c.role === 'seller' || c.role === 'owner');
                if (existing) {
                    existing.name = row[ownerNameCol] || existing.name;
                    if (ownerPhoneCol >= 0 && row[ownerPhoneCol]) existing.phone = row[ownerPhoneCol];
                } else {
                    deal.contacts.push({ name: row[ownerNameCol], role: 'seller', phone: ownerPhoneCol >= 0 ? (row[ownerPhoneCol] || '') : '', email: '' });
                }
            }
            if (agentNameCol >= 0 && row[agentNameCol]) {
                const existing = deal.contacts.find(c => c.role === 'agent');
                if (existing) {
                    existing.name = row[agentNameCol] || existing.name;
                    if (agentEmailCol >= 0 && row[agentEmailCol]) existing.email = row[agentEmailCol];
                } else {
                    deal.contacts.push({ name: row[agentNameCol], role: 'agent', phone: '', email: agentEmailCol >= 0 ? (row[agentEmailCol] || '') : '' });
                }
            }

            deal.skipTraced = true;
            deal.timeline.unshift({ type: 'system', text: 'Skip trace data merged', timestamp: new Date().toISOString() });
            matched++;

            deal.contacts.forEach(c => { if (c.name) Store.syncContactToGlobal(c, deal.id); });
        });

        Store.saveDeals(deals);

        // Update list status
        list.status = 'ready';
        Store.saveList(list);
        Store.recalcListStats(this._currentListId);

        alert(`Skip trace applied: ${matched} matched, ${unmatched} unmatched.`);
        document.getElementById('pasteBackModal').classList.add('hidden');
        this._parsedPasteBack = null;

        if (this._currentView === 'listDetail') {
            this.renderListDetail();
        } else {
            this.renderListsView();
        }
    },

    // ==========================================
    // ASSIGN VA
    // ==========================================
    openAssignVAModal() {
        const list = Store.getList(this._currentListId);
        document.getElementById('assignVAName').value = list ? (list.assignedTo || '') : '';
        document.getElementById('assignVAModal').classList.remove('hidden');
    },

    saveVAAssignment() {
        const vaName = document.getElementById('assignVAName').value.trim();
        const list = Store.getList(this._currentListId);
        if (!list) return;
        list.assignedTo = vaName;
        if (vaName && list.status === 'imported') list.status = 'skip_tracing';
        Store.saveList(list);
        document.getElementById('assignVAModal').classList.add('hidden');
        this.renderListsView();
    },

    // ==========================================
    // CADENCE QUEUE
    // ==========================================
    renderCadenceQueue() {
        this.renderCadenceStats();
        this.renderCadenceCards();
    },

    renderCadenceStats() {
        const container = document.getElementById('cadenceStats');
        const cadences = Store.getCadences();
        const today = new Date().toISOString().split('T')[0];

        const overdue = cadences.filter(c => c.status === 'active' && c.nextTouchDate < today).length;
        const dueToday = cadences.filter(c => c.status === 'active' && c.nextTouchDate === today).length;
        const upcoming = cadences.filter(c => c.status === 'active' && c.nextTouchDate > today).length;
        const active = cadences.filter(c => c.status === 'active').length;
        const completed = cadences.filter(c => c.status === 'completed').length;
        const responded = cadences.filter(c => c.status === 'responded').length;

        const currentFilter = document.getElementById('cadenceFilter').value;

        const statBtn = (filter, label, count, color) => {
            const isActive = currentFilter === filter;
            const style = `cursor:pointer;${isActive ? ' outline: 2px solid ' + color + '; outline-offset: -2px; border-radius: 8px;' : ''}`;
            return `<div class="pipeline-stat clickable-stat" data-filter="${filter}" style="${style}">
                <h4>${label}</h4><div class="stat-num" style="color: ${color};">${count}</div>
            </div>`;
        };

        container.innerHTML =
            statBtn('overdue', 'Overdue', overdue, 'var(--accent-red)') +
            statBtn('due_today', 'Due Today', dueToday, 'var(--accent-orange)') +
            statBtn('upcoming', 'Upcoming', upcoming, 'var(--accent-purple)') +
            statBtn('all_active', 'All Active', active, 'var(--accent-blue)') +
            statBtn('completed', 'Completed', completed, 'var(--text-secondary)') +
            statBtn('responded', 'Interested', responded, 'var(--accent-green)');

        container.querySelectorAll('.clickable-stat').forEach(stat => {
            stat.addEventListener('click', () => {
                document.getElementById('cadenceFilter').value = stat.dataset.filter;
                this.renderCadenceStats();
                this.renderCadenceCards();
            });
        });
    },

    renderCadenceCards() {
        const container = document.getElementById('cadenceQueue');
        const filterVal = document.getElementById('cadenceFilter').value;
        const sortVal = document.getElementById('cadenceSort').value;
        const searchVal = (document.getElementById('cadenceSearch').value || '').toLowerCase().trim();

        let cadences = Store.getCadences();
        const today = new Date().toISOString().split('T')[0];

        // Filter
        switch (filterVal) {
            case 'all_active':
                cadences = cadences.filter(c => c.status === 'active');
                break;
            case 'due_today':
                cadences = cadences.filter(c => c.status === 'active' && c.nextTouchDate <= today);
                break;
            case 'overdue':
                cadences = cadences.filter(c => c.status === 'active' && c.nextTouchDate < today);
                break;
            case 'upcoming':
                cadences = cadences.filter(c => c.status === 'active' && c.nextTouchDate > today);
                break;
            case 'completed':
                cadences = cadences.filter(c => c.status === 'completed' || c.status === 'dead');
                break;
            case 'responded':
                cadences = cadences.filter(c => c.status === 'responded');
                break;
        }

        // Search — matches address, contact name, phone, email, and list name
        if (searchVal) {
            cadences = cadences.filter(c => {
                const deal = Store.getDeal(c.dealId);
                if (!deal) return false;
                const addr = (deal.propertyAddress || '').toLowerCase();
                const contactStrs = (deal.contacts || []).map(ct =>
                    [ct.name, ct.phone, ct.email].filter(Boolean).join(' ').toLowerCase()
                ).join(' ');
                const list = c.listId ? Store.getList(c.listId) : null;
                const listName = list ? (list.name || '').toLowerCase() : '';
                return addr.includes(searchVal) || contactStrs.includes(searchVal) || listName.includes(searchVal);
            });
        }

        // Sort
        switch (sortVal) {
            case 'due_date':
                cadences.sort((a, b) => (a.nextTouchDate || '').localeCompare(b.nextTouchDate || ''));
                break;
            case 'step':
                cadences.sort((a, b) => a.currentStep - b.currentStep);
                break;
            case 'list':
                cadences.sort((a, b) => {
                    const listA = a.listId ? Store.getList(a.listId) : null;
                    const listB = b.listId ? Store.getList(b.listId) : null;
                    return (listA?.name || '').localeCompare(listB?.name || '');
                });
                break;
            case 'address':
                cadences.sort((a, b) => {
                    const dealA = Store.getDeal(a.dealId);
                    const dealB = Store.getDeal(b.dealId);
                    return (dealA?.propertyAddress || '').localeCompare(dealB?.propertyAddress || '');
                });
                break;
        }

        if (cadences.length === 0) {
            const totalCadences = Store.getCadences();
            const activeCount = totalCadences.filter(c => c.status === 'active').length;
            let hint = '';
            if (totalCadences.length === 0) {
                hint = 'No cadences started yet. Go to a list and click "Start Cadences" to begin outreach.';
            } else if (activeCount > 0) {
                hint = `No cadences match "${filterVal.replace(/_/g, ' ')}". Try switching to "All Active" (${activeCount} active).`;
            } else {
                hint = `All ${totalCadences.length} cadences are completed or exited. No active cadences remaining.`;
            }
            container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center;">
                <p style="margin-bottom: 8px; font-weight: 500;">No results</p>
                <p style="color: var(--text-secondary); font-size: 0.85rem;">${hint}</p>
            </div>`;
            return;
        }

        container.innerHTML = cadences.map(cadence => {
            const deal = Store.getDeal(cadence.dealId);
            if (!deal) return '';
            return this.renderCadenceCard(cadence, deal, today);
        }).join('');

        this.bindCadenceEvents();
    },

    _roleLabel(contact) {
        if (!contact) return '';
        const r = contact.role || '';
        if (r === 'agent') return 'Agent';
        if (r === 'seller' || r === 'owner') return 'Owner';
        return r || 'Contact';
    },

    _daysOverdue(nextTouchDate, today) {
        if (!nextTouchDate || nextTouchDate >= today) return 0;
        const d1 = new Date(nextTouchDate + 'T00:00:00');
        const d2 = new Date(today + 'T00:00:00');
        return Math.floor((d2 - d1) / 86400000);
    },

    renderCadenceCard(cadence, deal, today) {
        const contacts = deal.contacts || [];
        const owner = contacts.find(c => c.role === 'seller' || c.role === 'owner');
        const primary = owner || contacts[0];
        const step = CADENCE_STEPS[cadence.currentStep] || CADENCE_STEPS[0];
        const list = cadence.listId ? Store.getList(cadence.listId) : null;

        const isOverdue = cadence.nextTouchDate < today;
        const isDueToday = cadence.nextTouchDate === today;
        const daysOver = this._daysOverdue(cadence.nextTouchDate, today);
        let urgencyClass = '';
        if (isOverdue) urgencyClass = 'priority-overdue';
        else if (isDueToday) urgencyClass = 'priority-today';

        // Due date display
        let dueDateDisplay = '';
        if (cadence.status === 'active') {
            if (isOverdue) {
                dueDateDisplay = `<span class="cadence-due-badge overdue">${daysOver}d overdue</span>`;
            } else if (isDueToday) {
                dueDateDisplay = `<span class="cadence-due-badge due-today">Due today</span>`;
            } else {
                const d = new Date(cadence.nextTouchDate + 'T00:00:00');
                dueDateDisplay = `<span class="cadence-due-badge upcoming">Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>`;
            }
        }

        // Step progress dots
        const dots = CADENCE_STEPS.map((s, i) => {
            if (i < cadence.currentStep) return '<span class="step-dot completed"></span>';
            if (i === cadence.currentStep) return '<span class="step-dot current"></span>';
            return '<span class="step-dot"></span>';
        }).join('');

        // Action buttons — check which touches are already done for this step
        const touchesForStep = (cadence.touches || []).filter(t => t.step === cadence.currentStep);
        const completedTypes = new Set(touchesForStep.map(t => t.type));

        let actions = '';
        if (cadence.status === 'active') {
            step.types.forEach(type => {
                const done = completedTypes.has(type);
                if (done) {
                    actions += `<span class="btn-ghost" style="opacity: 0.5; pointer-events: none; text-decoration: line-through;">${type === 'call' ? 'Called' : 'Texted'}</span>`;
                } else if (type === 'call' && primary && primary.phone) {
                    actions += `<a href="tel:${esc(primary.phone)}" class="btn-primary cadence-action-btn" data-cadence-id="${cadence.id}" data-type="call" style="text-decoration:none; display:inline-flex; align-items:center;">Call</a>`;
                } else if (type === 'text' && primary && primary.phone) {
                    actions += `<a href="sms:${esc(primary.phone)}" class="btn-secondary cadence-action-btn" data-cadence-id="${cadence.id}" data-type="text" style="text-decoration:none; display:inline-flex; align-items:center;">Text</a>`;
                } else if (type === 'call' || type === 'text') {
                    actions += `<button class="btn-secondary cadence-action-btn" data-cadence-id="${cadence.id}" data-type="${type}" disabled style="opacity: 0.5;">No Phone</button>`;
                }
            });
            actions += `<button class="btn-ghost cadence-exit-btn" data-cadence-id="${cadence.id}" title="Exit cadence">Exit</button>`;
        } else {
            const exitLabel = cadence.exitReason === 'responded_interested' ? 'Interested' : cadence.exitReason === 'cadence_exhausted' ? 'Exhausted' : 'Dead';
            actions = `<span class="list-status-pill status-${cadence.status === 'responded' ? 'active' : 'completed'}">${exitLabel}</span>`;
        }

        // Build contacts list — show ALL contacts, not just primary
        const contactRows = contacts.map(ct => {
            const role = this._roleLabel(ct);
            const phone = ct.phone
                ? `<a href="tel:${esc(ct.phone)}" class="cadence-contact-phone">${esc(ct.phone)}</a>`
                : '<span class="cadence-contact-no-phone">No phone</span>';
            const email = ct.email ? `<span class="cadence-contact-email">${esc(ct.email)}</span>` : '';
            return `
                <div class="cadence-contact-row">
                    <span class="cadence-contact-name">${esc(ct.name || 'Unknown')}</span>
                    <span class="cadence-contact-role-tag">${role}</span>
                    ${phone}
                    ${email}
                </div>
            `;
        }).join('');

        const contactsBlock = contacts.length > 0
            ? `<div class="cadence-contacts-list">${contactRows}</div>`
            : '<div class="cadence-contacts-list"><span style="color: var(--text-muted); font-size: 0.8rem;">No contacts</span></div>';

        return `
            <div class="card outreach-card ${urgencyClass}" data-cadence-id="${cadence.id}">
                <div class="cadence-card-body">
                    <div class="cadence-card-header">
                        <div class="cadence-card-title-row">
                            <h3 class="cadence-card-address" data-deal-id="${deal.id}">${esc(deal.propertyAddress)}</h3>
                            ${dueDateDisplay}
                        </div>
                        <div class="cadence-card-meta">
                            <span class="cadence-step-label">${step.label}</span>
                            ${list ? `<span class="list-pill">${esc(list.name)}</span>` : ''}
                            ${list && list.market ? `<span class="cadence-market-tag">${esc(list.market)}</span>` : ''}
                        </div>
                    </div>
                    ${contactsBlock}
                    <div class="cadence-card-footer">
                        <div class="cadence-progress">${dots}</div>
                        <div class="cadence-card-actions">
                            ${actions}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    bindCadenceEvents() {
        document.querySelectorAll('.cadence-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cadenceId = parseInt(e.currentTarget.dataset.cadenceId);
                const type = e.currentTarget.dataset.type;
                setTimeout(() => this.openQuickLog(cadenceId, type), 500);
            });
        });

        document.querySelectorAll('.cadence-exit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cadenceId = parseInt(e.currentTarget.dataset.cadenceId);
                if (!confirm('Exit this cadence? The lead will stop receiving touches.')) return;
                Store.exitCadence(cadenceId, 'manual');
                this.renderCadenceQueue();
            });
        });

        // Navigate to deal in main app
        document.querySelectorAll('.cadence-card-address').forEach(el => {
            el.addEventListener('click', () => {
                const dealId = el.dataset.dealId;
                if (dealId) window.location.href = `app.html?deal=${dealId}`;
            });
        });
    },

    // ==========================================
    // QUICK LOG (Cadence-Aware)
    // ==========================================
    openQuickLog(cadenceId, touchType) {
        this._currentCadenceId = cadenceId;
        const cadence = Store.getCadence(cadenceId);
        if (!cadence) return;
        const deal = Store.getDeal(cadence.dealId);
        if (!deal) return;

        const contacts = deal.contacts || [];
        const owner = contacts.find(c => c.role === 'seller' || c.role === 'owner');
        const primary = owner || contacts[0];
        const list = cadence.listId ? Store.getList(cadence.listId) : null;

        document.getElementById('quickLogTitle').textContent = 'Log Interaction';

        // Lead info panel
        const leadInfo = document.getElementById('quickLogLeadInfo');
        const phoneDisplay = primary && primary.phone
            ? `<a href="tel:${esc(primary.phone)}" class="lead-info-phone">${esc(primary.phone)}</a>`
            : '<span style="color: var(--text-muted);">No phone</span>';

        leadInfo.innerHTML = `
            <div class="lead-info-address">${esc(deal.propertyAddress)}</div>
            <div class="lead-info-row">
                <div class="lead-info-item">
                    <span class="lead-info-label">Contact</span>
                    <span class="lead-info-value">${primary ? esc(primary.name) : 'Unknown'}</span>
                </div>
                <div class="lead-info-item">
                    <span class="lead-info-label">Phone</span>
                    <span class="lead-info-value">${phoneDisplay}</span>
                </div>
            </div>
            <div class="lead-info-row">
                <div class="lead-info-item">
                    <span class="lead-info-label">List</span>
                    <span class="lead-info-value">${list ? `<span class="list-pill">${esc(list.name)}</span>` : 'None'}</span>
                </div>
                <div class="lead-info-item">
                    <span class="lead-info-label">Source</span>
                    <span class="lead-info-value">${list ? esc(list.source.replace(/_/g, ' ')) : 'N/A'}</span>
                </div>
                ${primary && primary.email ? `<div class="lead-info-item"><span class="lead-info-label">Email</span><span class="lead-info-value">${esc(primary.email)}</span></div>` : ''}
            </div>
        `;
        leadInfo.classList.remove('hidden');

        // Show cadence step info
        const stepInfo = document.getElementById('cadenceStepInfo');
        const step = CADENCE_STEPS[cadence.currentStep];
        const dots = CADENCE_STEPS.map((s, i) => {
            if (i < cadence.currentStep) return '<span class="step-dot completed"></span>';
            if (i === cadence.currentStep) return '<span class="step-dot current"></span>';
            return '<span class="step-dot"></span>';
        }).join('');
        stepInfo.innerHTML = `<span>Step ${cadence.currentStep + 1} of ${CADENCE_STEPS.length}: ${step.label}</span><div class="cadence-progress" style="margin:0;">${dots}</div>`;
        stepInfo.classList.remove('hidden');

        const typeEl = document.getElementById('quickLogType');
        typeEl.value = touchType || 'call';
        document.getElementById('quickLogDirection').value = 'outbound';
        document.getElementById('quickLogNotes').value = '';
        this._updateOutcomeOptions(typeEl.value);
        document.getElementById('quickLogModal').classList.remove('hidden');
    },

    _updateOutcomeOptions(type) {
        const outcomeEl = document.getElementById('quickLogOutcome');
        if (type === 'text') {
            outcomeEl.innerHTML = `
                <option value="text_sent">Text Sent</option>
                <option value="interested">Interested (Exits Cadence)</option>
                <option value="not_interested">Not Interested (Mark Dead)</option>
            `;
        } else {
            outcomeEl.innerHTML = `
                <option value="connected">Connected</option>
                <option value="voicemail">Left Voicemail</option>
                <option value="no_answer">No Answer</option>
                <option value="interested">Interested (Exits Cadence)</option>
                <option value="not_interested">Not Interested (Mark Dead)</option>
            `;
        }
    },

    saveQuickLog() {
        if (!this._currentCadenceId) return;

        const type = document.getElementById('quickLogType').value;
        const outcome = document.getElementById('quickLogOutcome').value;
        const notes = document.getElementById('quickLogNotes').value;
        const justLoggedId = this._currentCadenceId;

        // Snapshot BEFORE logging: current step index and the due queue
        const cadenceBefore = Store.getCadence(justLoggedId);
        const stepBefore = cadenceBefore ? cadenceBefore.currentStep : -1;
        const dueQueueBefore = Store.getDueCadences().map(c => c.id);

        Store.logCadenceTouch(justLoggedId, { type, outcome, notes });

        if (outcome === 'not_interested') {
            Store.updateDealStatus(Store.getCadence(justLoggedId)?.dealId, 'dead');
        }

        document.getElementById('quickLogModal').classList.add('hidden');
        this._currentCadenceId = null;
        this.renderCadenceQueue();

        // Don't auto-advance on exit outcomes
        if (outcome === 'interested' || outcome === 'not_interested') return;

        // Check if this lead still has remaining touches for the ORIGINAL step
        const updated = Store.getCadence(justLoggedId);
        if (updated && updated.status === 'active' && updated.currentStep === stepBefore) {
            // Step didn't advance — still has remaining touches on the same step
            const currentStep = CADENCE_STEPS[stepBefore];
            const doneTouches = (updated.touches || []).filter(t => t.step === stepBefore);
            const doneTypes = new Set(doneTouches.map(t => t.type));
            const remaining = currentStep.types.filter(t => !doneTypes.has(t));

            if (remaining.length > 0) {
                // Same lead, next action (e.g. Call done → now Text)
                setTimeout(() => this.openQuickLog(justLoggedId, remaining[0]), 300);
                return;
            }
        }

        // Step completed (advanced) or cadence exited — move to next lead in queue
        const nextId = dueQueueBefore.find(id => id !== justLoggedId);
        if (nextId) {
            const next = Store.getCadence(nextId);
            if (next && next.status === 'active') {
                const step = CADENCE_STEPS[next.currentStep];
                setTimeout(() => this.openQuickLog(nextId, step.types[0]), 300);
            }
        }
    },

    // ==========================================
    // STATS DASHBOARD
    // ==========================================
    renderStatsView() {
        const range = document.getElementById('statsDateRange').value;
        const days = range === 'all' ? null : parseInt(range);
        const analytics = Store.getOutreachAnalytics(days);

        this.renderActivityMetrics(analytics);
        this.renderPipelineFunnel(analytics);
        this.renderActivityChart(analytics);
        this.renderListPerformance(analytics);
    },

    renderActivityMetrics(analytics) {
        const a = analytics.activity;
        document.getElementById('activityMetrics').innerHTML = `
            <div class="pipeline-stat"><h4>Calls Made</h4><div class="stat-num" style="color: var(--accent-blue);">${a.totalCalls}</div></div>
            <div class="pipeline-stat"><h4>Texts Sent</h4><div class="stat-num" style="color: var(--accent-purple);">${a.totalTexts}</div></div>
            <div class="pipeline-stat"><h4>Connected</h4><div class="stat-num" style="color: var(--accent-green);">${a.totalConnected}</div></div>
            <div class="pipeline-stat"><h4>Response Rate</h4><div class="stat-num">${a.responseRate}%</div></div>
            <div class="pipeline-stat"><h4>Active Cadences</h4><div class="stat-num">${analytics.cadences.active}</div></div>
        `;
    },

    renderPipelineFunnel(analytics) {
        const p = analytics.pipeline;
        const maxVal = Math.max(p.totalImported, 1);
        const steps = [
            { label: 'Imported', count: p.totalImported, color: 'var(--accent-blue)' },
            { label: 'Skip Traced', count: p.totalSkipTraced, color: 'var(--accent-purple)' },
            { label: 'Contacted', count: p.totalContacted, color: 'var(--accent-orange)' },
            { label: 'Interested', count: p.totalInterested, color: 'var(--accent-green)' },
            { label: 'Offer Sent', count: p.totalOfferSent, color: 'var(--accent-green)' },
            { label: 'Closed', count: p.totalClosed, color: 'var(--accent-green)' }
        ];

        document.getElementById('outreachFunnel').innerHTML = steps.map(s => {
            const width = Math.max((s.count / maxVal) * 100, 2);
            return `
                <div class="outreach-funnel-step">
                    <span class="funnel-label">${s.label}</span>
                    <div class="funnel-bar" style="width: ${width}%; background: ${s.color};"></div>
                    <span class="funnel-count">${s.count}</span>
                </div>
            `;
        }).join('');
    },

    renderActivityChart(analytics) {
        const data = analytics.activityByDate;
        const maxDay = Math.max(...data.map(d => d.calls + d.texts), 1);

        document.getElementById('activityChart').innerHTML = data.map(d => {
            const callH = Math.max((d.calls / maxDay) * 100, 0);
            const textH = Math.max((d.texts / maxDay) * 100, 0);
            const dayLabel = new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return `
                <div class="activity-bar" title="${dayLabel}: ${d.calls} calls, ${d.texts} texts">
                    <div style="display:flex; flex-direction:column; align-items:stretch; flex:1; justify-content:flex-end; width:100%;">
                        <div class="bar-calls" style="height: ${callH}%;"></div>
                        <div class="bar-texts" style="height: ${textH}%;"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    renderListPerformance(analytics) {
        const tbody = document.getElementById('listPerformanceBody');
        if (analytics.listBreakdowns.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No lists yet</td></tr>';
            return;
        }

        tbody.innerHTML = analytics.listBreakdowns.map(lb => {
            const convRate = lb.contacted > 0 ? Math.round((lb.interested / lb.contacted) * 100) : 0;
            return `
                <tr>
                    <td>${esc(lb.listName)}</td>
                    <td>${esc(SOURCE_LABELS[lb.source] || lb.source)}</td>
                    <td>${lb.total}</td>
                    <td>${lb.skipTraced}</td>
                    <td>${lb.contacted}</td>
                    <td style="color: var(--accent-green);">${lb.interested}</td>
                    <td style="color: var(--accent-red);">${lb.dead}</td>
                    <td>${convRate}%</td>
                </tr>
            `;
        }).join('');
    },

    // ==========================================
    // CLOSE HELPERS
    // ==========================================
    closeAllModals() {
        ['quickLogModal', 'importModal', 'pasteBackModal', 'assignVAModal'].forEach(id => {
            document.getElementById(id).classList.add('hidden');
        });
        this._currentCadenceId = null;
        this._parsedImport = null;
        this._parsedPasteBack = null;
    },

    // ==========================================
    // LISTENERS
    // ==========================================
    setupListeners() {
        // Nav
        document.getElementById('navLists').addEventListener('click', () => this.showView('lists'));
        document.getElementById('navCadenceQueue').addEventListener('click', () => this.showView('cadenceQueue'));
        document.getElementById('navStats').addEventListener('click', () => this.showView('stats'));

        // Lists view
        document.getElementById('newListImportBtn').addEventListener('click', () => this.openImportModal());

        // List detail
        document.getElementById('backToListsBtn').addEventListener('click', () => this.showView('lists'));
        document.getElementById('listPasteBackBtn').addEventListener('click', () => this.openPasteBackModal());
        document.getElementById('listStartCadencesBtn').addEventListener('click', () => {
            if (!this._currentListId) return;
            const deals = Store.getListDeals(this._currentListId);
            const withPhone = deals.filter(d => (d.contacts || []).some(c => c.phone));
            const alreadyCadenced = deals.filter(d => Store.getCadenceByDeal(d.id));
            const eligible = withPhone.length - alreadyCadenced.length;
            if (withPhone.length === 0) {
                alert('No leads with phone numbers. Import or paste back skip trace data first.');
                return;
            }
            if (eligible <= 0) {
                alert('All leads with phone numbers already have cadences.');
                return;
            }
            if (!confirm(`Start 7-touch cadences for ${eligible} leads with phone numbers?`)) return;
            const started = Store.startCadencesForList(this._currentListId);
            alert(`Started ${started} cadences.`);
            this.renderListDetail();
        });
        document.getElementById('listExportBtn').addEventListener('click', () => {
            if (this._currentListId) this.exportListToSheets(this._currentListId);
        });

        // Cadence queue
        document.getElementById('cadenceFilter').addEventListener('change', () => { this.renderCadenceStats(); this.renderCadenceCards(); });
        document.getElementById('cadenceSort').addEventListener('change', () => this.renderCadenceCards());
        let searchTimeout;
        document.getElementById('cadenceSearch').addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.renderCadenceCards(), 200);
        });

        // Stats
        document.getElementById('statsDateRange').addEventListener('change', () => this.renderStatsView());

        // Import modal
        document.getElementById('importPreviewBtn').addEventListener('click', () => this.previewImport());
        document.getElementById('importExecuteBtn').addEventListener('click', () => this.executeImport());
        document.getElementById('importCancelBtn').addEventListener('click', () => {
            document.getElementById('importModal').classList.add('hidden');
            this._parsedImport = null;
        });
        document.getElementById('importListType').addEventListener('change', () => {
            // Re-render column mapping if it's already visible
            const colMap = document.getElementById('importColMap');
            if (colMap && !colMap.classList.contains('hidden') && this._parsedImport) {
                const rawText = document.getElementById('importData').value;
                const { headers } = this.parseSheetData(rawText);
                this._renderColMapping('importColMap', headers, 'colMap');
            }
        });
        document.getElementById('importFileUpload').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('importData').value = ev.target.result;
                // Auto-fill list name from filename
                const nameInput = document.getElementById('importListName');
                if (!nameInput.value.trim()) {
                    nameInput.value = file.name.replace(/\.(csv|tsv|txt)$/i, '');
                }
                this.previewImport();
            };
            reader.readAsText(file);
            e.target.value = '';
        });

        // Paste back modal
        document.getElementById('pasteBackPreviewBtn').addEventListener('click', () => this.previewPasteBack());
        document.getElementById('pasteBackExecuteBtn').addEventListener('click', () => this.executePasteBack());
        document.getElementById('pasteBackCancelBtn').addEventListener('click', () => {
            document.getElementById('pasteBackModal').classList.add('hidden');
            this._parsedPasteBack = null;
        });

        // Assign VA modal
        document.getElementById('assignVASave').addEventListener('click', () => this.saveVAAssignment());
        document.getElementById('assignVACancel').addEventListener('click', () => {
            document.getElementById('assignVAModal').classList.add('hidden');
        });

        // Quick log
        document.getElementById('quickLogType').addEventListener('change', (e) => this._updateOutcomeOptions(e.target.value));
        document.getElementById('quickLogSave').addEventListener('click', () => this.saveQuickLog());
        document.getElementById('quickLogCancel').addEventListener('click', () => {
            document.getElementById('quickLogModal').classList.add('hidden');
            this._currentCadenceId = null;
        });

        // Backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                    this._currentCadenceId = null;
                    this._parsedImport = null;
                    this._parsedPasteBack = null;
                }
            });
        });

        // Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeAllModals();
        });
    }
};

document.addEventListener('DOMContentLoaded', () => Outreach.init());
