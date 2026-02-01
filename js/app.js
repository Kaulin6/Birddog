/**
 * app.js
 * Main Application Entry Point
 */

import { Store } from './store.js';
import { UI } from './ui.js';
import { Calculator } from './calculator.js';
import { Pipeline } from './pipeline.js';
import { CRM } from './crm.js';
import { Dashboard } from './dashboard.js';
import { PropertyService } from './PropertyService.js';
import { PermitService } from './PermitService.js';
import { PropertyAppraiserService } from './PropertyAppraiserService.js';
import { DbfService } from './DbfService.js';

console.log('App: Script loaded.');

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

const App = {
    currentDealId: null,
    activeRepairs: {},
    _viewHistory: [],
    _forwardHistory: [],

    init() {
        console.log('App v15 loaded');

        // Initialize Sub-modules
        Pipeline.init();

        // Setup Global Listeners
        this.setupNavigation();
        this.setupCalculatorListeners();
        this.setupGlobalEvents();
        this.setupSearchFilter();
        this.setupExportImport();
        this.setupCSVImport();
        this.setupOfferListeners();

        // UI Components
        UI.initAccordions();

        // Deal Summary Toggle
        const summaryToggle = document.getElementById('toggleDealSummary');
        const summaryPanel = document.getElementById('dealSummaryPanel');
        if (summaryToggle && summaryPanel) {
            summaryToggle.addEventListener('click', () => {
                summaryPanel.classList.toggle('hidden');
                summaryToggle.classList.toggle('open');
                summaryToggle.textContent = summaryPanel.classList.contains('hidden')
                    ? '▼ Deal Summary'
                    : '▲ Deal Summary';
            });
        }

        // Initial Render
        this.renderSavedDeals();
        this.runCalculator();
        this.syncCalcStatusButtons();

        // Default View
        this.switchView('calculator');

        // Handle ?deal= query param (from Outreach page links)
        const urlParams = new URLSearchParams(window.location.search);
        const dealParam = urlParams.get('deal');
        if (dealParam) {
            const dealId = parseInt(dealParam);
            if (dealId && Store.getDeal(dealId)) {
                this.loadDeal(dealId);
            }
        }

        // Start loading DBF in background
        DbfService.init();
    },

    // --- Navigation ---
    setupNavigation() {
        // Global back/forward buttons
        const globalBackBtn = document.getElementById('globalBackBtn');
        if (globalBackBtn) {
            globalBackBtn.addEventListener('click', () => this.goBack());
        }
        const globalForwardBtn = document.getElementById('globalForwardBtn');
        if (globalForwardBtn) {
            globalForwardBtn.addEventListener('click', () => this.goForward());
        }

        document.getElementById('navCalculator').addEventListener('click', () => this.switchView('calculator'));
        document.getElementById('navOffer').addEventListener('click', () => this.switchView('offer'));
        document.getElementById('navPipeline').addEventListener('click', () => this.switchView('pipeline'));
        document.getElementById('navCrm').addEventListener('click', () => this.switchView('crm'));
        document.getElementById('navDashboard').addEventListener('click', () => this.switchView('dashboard'));

        // Deal bar actions
        const dealBarDetails = document.getElementById('dealBarDetails');
        const dealBarCrm = document.getElementById('dealBarCrm');
        const dealBarClear = document.getElementById('dealBarClear');
        if (dealBarDetails) dealBarDetails.addEventListener('click', () => this.switchView('calculator'));
        if (dealBarCrm) dealBarCrm.addEventListener('click', () => this.switchView('crm'));
        if (dealBarClear) dealBarClear.addEventListener('click', () => this.clearForm());

        // Deal bar name editing
        const dealBarAddress = document.getElementById('dealBarAddress');
        const dealBarInput = document.getElementById('dealBarAddressInput');
        if (dealBarAddress && dealBarInput) {
            dealBarAddress.addEventListener('click', () => {
                if (!this.currentDealId) return;
                dealBarAddress.classList.add('hidden');
                dealBarInput.classList.remove('hidden');
                dealBarInput.value = dealBarAddress.textContent;
                dealBarInput.focus();
                dealBarInput.select();
            });

            const saveName = () => {
                const newName = dealBarInput.value.trim();
                dealBarInput.classList.add('hidden');
                dealBarAddress.classList.remove('hidden');
                if (newName && this.currentDealId) {
                    const deal = Store.getDeal(this.currentDealId);
                    if (deal) {
                        deal.propertyAddress = newName;
                        Store.saveDeal(deal);
                        dealBarAddress.textContent = newName;
                        document.getElementById('propertyAddress').value = newName;
                        this.renderSavedDeals();
                    }
                }
            };

            dealBarInput.addEventListener('blur', saveName);
            dealBarInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); dealBarInput.blur(); }
                if (e.key === 'Escape') {
                    dealBarInput.value = dealBarAddress.textContent;
                    dealBarInput.blur();
                }
            });
        }

        const backBtn = document.getElementById('backToCalcBtn');
        if (backBtn) backBtn.addEventListener('click', () => this.switchView('calculator'));

        const crmSwitchBtn = document.getElementById('crmSwitchBtn');
        if (crmSwitchBtn) {
            crmSwitchBtn.addEventListener('click', () => {
                this.saveDeal();
                if (this.currentDealId) {
                    this.switchView('crm');
                } else {
                    alert('Please enter an address first to save the deal.');
                }
            });
        }

        const offerSwitchBtn = document.getElementById('offerSwitchBtn');
        if (offerSwitchBtn) {
            offerSwitchBtn.addEventListener('click', () => {
                this.saveDeal();
                if (this.currentDealId) {
                    this.switchView('offer');
                } else {
                    alert('Please enter an address first to save the deal.');
                }
            });
        }
    },

    goBack() {
        if (this._viewHistory.length > 0) {
            this._forwardHistory.push(this._currentView);
            const prevView = this._viewHistory.pop();
            this.switchView(prevView, 'back');
        }
    },

    goForward() {
        if (this._forwardHistory.length > 0) {
            this._viewHistory.push(this._currentView);
            const nextView = this._forwardHistory.pop();
            this.switchView(nextView, 'forward');
        }
    },

    switchView(viewName, navType = false) {
        // Track history
        if (!navType && this._currentView && this._currentView !== viewName) {
            this._viewHistory.push(this._currentView);
            this._forwardHistory = []; // Clear forward on new navigation
        }
        this._currentView = viewName;

        // Hide all views
        const views = ['calculatorView', 'offerView', 'pipelineView', 'crmView', 'dashboardView'];
        views.forEach(v => {
            const el = document.getElementById(v);
            if (el) el.classList.add('hidden');
        });
        document.getElementById('calculatorSidebar').classList.add('hidden');

        // Deactivate Nav
        document.querySelectorAll('.main-nav .nav-btn').forEach(b => b.classList.remove('active'));

        // Show Selected
        if (viewName === 'calculator') {
            document.getElementById('calculatorView').classList.remove('hidden');
            document.getElementById('calculatorSidebar').classList.remove('hidden');
            document.getElementById('navCalculator').classList.add('active');
        } else if (viewName === 'offer') {
            document.getElementById('offerView').classList.remove('hidden');
            document.getElementById('calculatorSidebar').classList.remove('hidden');
            document.getElementById('navOffer').classList.add('active');
            this.renderOfferView();
        } else if (viewName === 'pipeline') {
            document.getElementById('pipelineView').classList.remove('hidden');
            document.getElementById('navPipeline').classList.add('active');
            Pipeline.render();
        } else if (viewName === 'crm') {
            document.getElementById('crmView').classList.remove('hidden');
            document.getElementById('calculatorSidebar').classList.remove('hidden');
            document.getElementById('navCrm').classList.add('active');
            CRM.init(this.currentDealId);
        } else if (viewName === 'dashboard') {
            document.getElementById('dashboardView').classList.remove('hidden');
            document.getElementById('navDashboard').classList.add('active');
            Dashboard.init();
        }
    },

    // --- Search & Filter ---
    setupSearchFilter() {
        const searchInput = document.getElementById('dealSearchInput');
        const filterStatus = document.getElementById('dealFilterStatus');
        const sortBy = document.getElementById('dealSortBy');

        if (searchInput) {
            searchInput.addEventListener('input', () => this.renderSavedDeals());
        }
        if (filterStatus) {
            filterStatus.addEventListener('change', () => this.renderSavedDeals());
        }
        if (sortBy) {
            sortBy.addEventListener('change', () => this.renderSavedDeals());
        }
    },

    // --- Export / Import ---
    setupExportImport() {
        const exportBtn = document.getElementById('exportDataBtn');
        const importBtn = document.getElementById('importDataBtn');
        const importInput = document.getElementById('importFileInput');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                const data = Store.exportData();
                const blob = new Blob([data], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `birddog_backup_${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            });
        }

        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => importInput.click());
            importInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        if (!confirm('This will replace all existing data. Continue?')) return;
                        const result = Store.importData(event.target.result);
                        alert(`Import complete!\nDeals: ${result.deals}\nContacts: ${result.contacts}\nTasks: ${result.tasks}\nTemplates: ${result.templates}`);
                        this.renderSavedDeals();
                        Pipeline.render();
                    } catch (err) {
                        alert('Error importing data: ' + err.message);
                    }
                };
                reader.readAsText(file);
                importInput.value = '';
            });
        }
    },

    // --- CSV Import with Column Mapping ---
    setupCSVImport() {
        const csvUpload = document.getElementById('csvUpload');
        if (!csvUpload) return;

        csvUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                const lines = text.split('\n').map(l => l.split(',').map(c => c.trim().replace(/^"(.*)"$/, '$1')));
                if (lines.length < 2) { alert('CSV must have a header row and at least one data row.'); return; }

                this._csvHeaders = lines[0];
                this._csvRows = lines.slice(1).filter(r => r.some(c => c));

                this.showCSVMappingModal();
            };
            reader.readAsText(file);
            csvUpload.value = '';
        });

        // Close CSV modal
        const closeBtn = document.getElementById('closeCsvModal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('csvMappingModal').classList.add('hidden');
            });
        }

        // Import CSV button
        const importBtn = document.getElementById('importCsvBtn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                const columnMap = {};
                const fields = ['address', 'sellerName', 'phone', 'arv', 'source'];

                fields.forEach(field => {
                    const select = document.getElementById(`csvMap_${field}`);
                    if (select && select.value !== '') {
                        columnMap[field] = parseInt(select.value);
                    }
                });

                if (columnMap.address === undefined) {
                    alert('You must map the Address column.');
                    return;
                }

                const result = Store.importDealsFromCSV(this._csvRows, columnMap);
                alert(`CSV Import complete!\nImported: ${result.imported}\nSkipped (duplicates): ${result.skipped}`);

                document.getElementById('csvMappingModal').classList.add('hidden');
                this.renderSavedDeals();
                Pipeline.render();
            });
        }
    },

    showCSVMappingModal() {
        const modal = document.getElementById('csvMappingModal');
        const grid = document.getElementById('csvMappingGrid');
        const preview = document.getElementById('csvPreviewTable');

        // Build mapping selects
        const fields = [
            { key: 'address', label: 'Address (Required)' },
            { key: 'sellerName', label: 'Seller Name' },
            { key: 'phone', label: 'Phone' },
            { key: 'arv', label: 'ARV' },
            { key: 'source', label: 'Lead Source' }
        ];

        const options = this._csvHeaders.map((h, i) => `<option value="${i}">${h}</option>`).join('');

        grid.innerHTML = fields.map(f => `
            <label>${f.label}</label>
            <select id="csvMap_${f.key}">
                <option value="">-- Skip --</option>
                ${options}
            </select>
        `).join('');

        // Auto-map by header name
        this._csvHeaders.forEach((header, i) => {
            const h = header.toLowerCase();
            if (h.includes('address') || h.includes('addr')) {
                const sel = document.getElementById('csvMap_address');
                if (sel) sel.value = i;
            }
            if (h.includes('seller') || h.includes('owner') || h.includes('name')) {
                const sel = document.getElementById('csvMap_sellerName');
                if (sel && sel.value === '') sel.value = i;
            }
            if (h.includes('phone') || h.includes('tel')) {
                const sel = document.getElementById('csvMap_phone');
                if (sel) sel.value = i;
            }
            if (h.includes('arv') || h.includes('value')) {
                const sel = document.getElementById('csvMap_arv');
                if (sel) sel.value = i;
            }
            if (h.includes('source')) {
                const sel = document.getElementById('csvMap_source');
                if (sel) sel.value = i;
            }
        });

        // Preview table
        const previewRows = this._csvRows.slice(0, 5);
        preview.innerHTML = `
            <thead><tr>${this._csvHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${previewRows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody>
        `;

        modal.classList.remove('hidden');
    },

    // --- Calculator Integration ---
    setupCalculatorListeners() {
        const inputIds = [
            'arv', 'repairCosts', 'assignmentFee', 'agentCommission',
            'closingCosts', 'investorProfit', 'costBuffer', 'sqft', 'condition'
        ];

        inputIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                UI.attachNumberFormatter(el);
                el.addEventListener('input', () => this.runCalculator());
            }
        });

        document.getElementById('saveDealBtn').addEventListener('click', () => this.saveDeal());
        document.getElementById('clearFormBtn').addEventListener('click', () => this.clearForm());

        // Repair Modal
        const repairModal = document.getElementById('repairModal');
        const openRepairModalBtn = document.getElementById('openRepairModalBtn');
        const closeRepairModalBtn = document.getElementById('closeRepairModal');
        const applyRepairsBtn = document.getElementById('applyRepairsBtn');

        if (openRepairModalBtn) {
            openRepairModalBtn.addEventListener('click', () => {
                repairModal.classList.remove('hidden');
                this.generateRepairGrid();
            });
        }

        if (closeRepairModalBtn) {
            closeRepairModalBtn.addEventListener('click', () => {
                repairModal.classList.add('hidden');
            });
        }

        if (applyRepairsBtn) {
            applyRepairsBtn.addEventListener('click', () => {
                const total = this.calculateRepairTotal();
                document.getElementById('repairCosts').value = UI.formatNumber(total);

                const conditionSelect = document.getElementById('condition');
                if (conditionSelect) conditionSelect.value = 'custom';

                const helperText = document.getElementById('repairHelperText');
                if (helperText) helperText.textContent = 'Custom Estimate Applied';

                repairModal.classList.add('hidden');
                this.runCalculator();
                console.log(`App: Applied repair estimate: $${total}`);
            });
        }

        // Property Data Auto-Fill
        const fetchBtn = document.getElementById('fetchDataBtn');
        if (fetchBtn) {
            fetchBtn.addEventListener('click', () => this.fetchPropertyData());
        }

        // Enter key on address
        document.addEventListener('keydown', (e) => {
            if (e.target && e.target.id === 'propertyAddress') {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.fetchPropertyData();
                }
            }
        });

        // Permit Check
        const permitBtn = document.getElementById('checkPermitsBtn');
        if (permitBtn) {
            permitBtn.addEventListener('click', () => this.checkPermits());
        }

        // Official Data
        const officialBtn = document.getElementById('fetchOfficialBtn');
        if (officialBtn) {
            officialBtn.addEventListener('click', () => this.fetchOfficialData());
        }

        // Repair Cost Logic
        const conditionSelect = document.getElementById('condition');
        const sqftInput = document.getElementById('sqft');

        if (conditionSelect && sqftInput) {
            const updateRepairs = () => this.updateRepairCosts();
            conditionSelect.addEventListener('change', updateRepairs);
            sqftInput.addEventListener('input', updateRepairs);
        }
    },

    updateRepairCosts() {
        const condition = document.getElementById('condition').value;
        const sqft = UI.parseInput(document.getElementById('sqft'));
        const repairInput = document.getElementById('repairCosts');
        const helperText = document.getElementById('repairHelperText');

        if (!sqft || condition === 'custom') {
            helperText.textContent = '';
            return;
        }

        let costPerSqft = 0;
        if (condition === 'light') costPerSqft = 15;
        else if (condition === 'medium') costPerSqft = 30;
        else if (condition === 'heavy') costPerSqft = 60;

        if (costPerSqft > 0) {
            const total = sqft * costPerSqft;
            repairInput.value = UI.formatNumber(total);
            helperText.textContent = `Auto-calculated: ${sqft} sqft x $${costPerSqft} = $${UI.formatNumber(total)}`;
            this.runCalculator();
        }
    },

    runCalculator() {
        const inputs = {
            arv: UI.parseInput(document.getElementById('arv')),
            repairCosts: UI.parseInput(document.getElementById('repairCosts')),
            assignmentFee: UI.parseInput(document.getElementById('assignmentFee')),
            agentCommission: UI.parseInput(document.getElementById('agentCommission')),
            closingCosts: UI.parseInput(document.getElementById('closingCosts')),
            investorProfit: UI.parseInput(document.getElementById('investorProfit')),
            costBuffer: UI.parseInput(document.getElementById('costBuffer')),
        };

        const result = Calculator.calculate(inputs);

        UI.setText('buyerRoi', result.results.buyerRoi.toFixed(1) + '%');
        UI.setText('profitToInvestor', UI.formatCurrency(result.results.investorProfitAmt));
        UI.setText('yourProfit', UI.formatCurrency(result.results.assignmentFee));
        UI.setText('suggestedOffer', UI.formatCurrency(result.results.mao));
        UI.setText('salePriceToInvestor', UI.formatCurrency(result.results.salePriceToInvestor));

        UI.setText('offerHigh', UI.formatCurrency(result.results.offerHigh));
        UI.setText('offerMedium', UI.formatCurrency(result.results.offerMedium));
        UI.setText('offerLow', UI.formatCurrency(result.results.offerLow));

        this.renderList('deductionsList', result.deductions);
        this.renderList('yourNumbersList', result.yourNumbers);
    },

    // --- Offer View ---
    renderOfferView() {
        const noDeal = document.getElementById('offerNoDeal');
        const content = document.getElementById('offerContent');

        if (!this.currentDealId) {
            noDeal.classList.remove('hidden');
            content.classList.add('hidden');
            return;
        }

        noDeal.classList.add('hidden');
        content.classList.remove('hidden');

        const deal = Store.getDeal(this.currentDealId);
        const address = deal ? deal.propertyAddress : document.getElementById('propertyAddress').value;

        // Run calculator to get current numbers
        const inputs = {
            arv: UI.parseInput(document.getElementById('arv')),
            repairCosts: UI.parseInput(document.getElementById('repairCosts')),
            assignmentFee: UI.parseInput(document.getElementById('assignmentFee')),
            agentCommission: UI.parseInput(document.getElementById('agentCommission')),
            closingCosts: UI.parseInput(document.getElementById('closingCosts')),
            investorProfit: UI.parseInput(document.getElementById('investorProfit')),
            costBuffer: UI.parseInput(document.getElementById('costBuffer')),
        };
        const result = Calculator.calculate(inputs);

        // Populate offer summary
        UI.setText('offerPropertyAddr', address || '--');
        UI.setText('offerSeller', document.getElementById('sellerName').value || '--');
        UI.setText('offerMao', UI.formatCurrency(result.results.mao));
        UI.setText('offerSalePrice', UI.formatCurrency(result.results.salePriceToInvestor));
        UI.setText('offerAssignment', UI.formatCurrency(result.results.assignmentFee));
        UI.setText('offerInvestorProfit', UI.formatCurrency(result.results.investorProfitAmt));
        UI.setText('offerInvestorRoi', result.results.buyerRoi.toFixed(1) + '%');

        // Motivation prices
        UI.setText('offerHighPrice', UI.formatCurrency(result.results.offerHigh));
        UI.setText('offerMediumPrice', UI.formatCurrency(result.results.offerMedium));
        UI.setText('offerLowPrice', UI.formatCurrency(result.results.offerLow));

        // Show deal summary from property page
        const dealSummaryDisplay = document.getElementById('offerDealSummaryDisplay');
        const summaryText = document.getElementById('dealSummary').value;
        if (dealSummaryDisplay) {
            if (summaryText && summaryText.trim()) {
                dealSummaryDisplay.innerHTML = `<p>${summaryText.replace(/\n/g, '<br>')}</p>`;
            } else {
                dealSummaryDisplay.innerHTML = `<p class="text-muted">No deal summary added yet. Add one from the Property page.</p>`;
            }
        }

        // Pre-fill offer price with MAO if empty
        const offerPriceInput = document.getElementById('offerPrice');
        if (!offerPriceInput.value || offerPriceInput.value === '$0') {
            offerPriceInput.value = UI.formatCurrency(result.results.mao);
        }

        // Pre-fill earnest from property page
        const earnestVal = document.getElementById('earnestMoney').value;
        if (earnestVal) {
            document.getElementById('offerEarnest').value = UI.formatCurrency(parseFloat(earnestVal) || 100);
        }

        // Pre-fill days to close
        const daysVal = document.getElementById('daysToClose').value;
        if (daysVal) {
            document.getElementById('offerCloseDate').value = daysVal;
        }
    },

    setupOfferListeners() {
        const backBtn = document.getElementById('offerBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.switchView('calculator'));
        }

        const pdfBtn = document.getElementById('generateOfferPdf');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this.generateOfferPdf());
        }

        const aiBtn = document.getElementById('aiGenerateOffer');
        if (aiBtn) {
            aiBtn.addEventListener('click', () => {
                alert('AI Offer Generation is under construction. Coming soon!');
            });
        }
    },

    generateOfferPdf() {
        if (!this.currentDealId) {
            alert('Please save a deal first.');
            return;
        }

        const { jsPDF } = window.jspdf;
        if (!jsPDF) {
            alert('PDF library not loaded.');
            return;
        }

        const doc = new jsPDF();
        const address = document.getElementById('offerPropertyAddr').textContent;
        const seller = document.getElementById('offerSeller').textContent;
        const offerPrice = document.getElementById('offerPrice').value;
        const earnest = document.getElementById('offerEarnest').value;
        const daysToClose = document.getElementById('offerCloseDate').value;
        const contingency = document.getElementById('offerContingency').value;
        const includeContingency = document.getElementById('offerIncludeContingency').checked;
        const notes = document.getElementById('offerNotes').value;

        let y = 20;
        doc.setFontSize(18);
        doc.text('Purchase Offer', 105, y, { align: 'center' });
        y += 15;

        doc.setFontSize(11);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y);
        y += 10;
        doc.text(`Property: ${address}`, 20, y);
        y += 8;
        doc.text(`Seller: ${seller}`, 20, y);
        y += 15;

        doc.setFontSize(13);
        doc.text('Offer Terms', 20, y);
        y += 10;

        doc.setFontSize(11);
        doc.text(`Offer Price: ${offerPrice}`, 20, y);
        y += 8;
        doc.text(`Earnest Money Deposit: ${earnest}`, 20, y);
        y += 8;
        doc.text(`Closing Timeline: ${daysToClose} days`, 20, y);
        y += 12;

        if (includeContingency && contingency) {
            doc.setFontSize(13);
            doc.text('Contingencies', 20, y);
            y += 10;
            doc.setFontSize(10);
            const lines = doc.splitTextToSize(contingency, 170);
            doc.text(lines, 20, y);
            y += lines.length * 6 + 10;
        }

        if (notes) {
            doc.setFontSize(13);
            doc.text('Notes', 20, y);
            y += 10;
            doc.setFontSize(10);
            const noteLines = doc.splitTextToSize(notes, 170);
            doc.text(noteLines, 20, y);
            y += noteLines.length * 6 + 10;
        }

        y += 10;
        doc.setFontSize(10);
        doc.text('Generated by Bird Dog OS', 105, y, { align: 'center' });

        const filename = `Offer_${address.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30)}.pdf`;
        doc.save(filename);
    },

    renderList(elementId, items) {
        const el = document.getElementById(elementId);
        if (el) {
            el.innerHTML = items.map(item => `
                <li>
                    <span>${item.label}</span>
                    <span>${UI.formatCurrency(item.value)}</span>
                </li>
            `).join('');
        }
    },

    renderComps(comps) {
        const container = document.getElementById('compsContainer');
        if (!container) return;

        if (!comps || comps.length === 0) {
            container.innerHTML = '<p class="empty-state">No comparable sales found.</p>';
            return;
        }

        const html = `
            <table class="comps-table" style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="text-align: left; border-bottom: 1px solid #333;">
                        <th style="padding: 8px;">Address</th>
                        <th style="padding: 8px;">Date</th>
                        <th style="padding: 8px;">Price</th>
                        <th style="padding: 8px;">Sqft</th>
                        <th style="padding: 8px;">Distance</th>
                    </tr>
                </thead>
                <tbody>
                    ${comps.map(comp => `
                        <tr style="border-bottom: 1px solid #222;">
                            <td style="padding: 8px;">${comp.addressLine1}</td>
                            <td style="padding: 8px;">${new Date(comp.lastSaleDate).toLocaleDateString()}</td>
                            <td style="padding: 8px;">${UI.formatCurrency(comp.lastSalePrice)}</td>
                            <td style="padding: 8px;">${comp.squareFootage}</td>
                            <td style="padding: 8px;">${comp.distance ? comp.distance.toFixed(2) + ' mi' : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    },

    // --- Data Integration ---
    async fetchPropertyData() {
        const addressInput = document.getElementById('propertyAddress');
        const address = addressInput.value;

        if (!address) {
            alert('Please enter an address first.');
            return;
        }

        const btn = document.getElementById('fetchDataBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Loading...';
        btn.disabled = true;

        try {
            if (!PropertyService.getApiKey()) {
                const key = prompt('Enter your RentCast API Key (free at rentcast.io):');
                if (key) {
                    PropertyService.setApiKey(key);
                } else {
                    throw new Error('API Key required.');
                }
            }

            const result = await PropertyService.getPropertyDetails(address);
            console.log('App: Received data from PropertyService:', result);
            const data = result.property;
            const comps = result.comps;

            if (data) {
                console.log('App: Mapping data to deal...');
                const deal = PropertyService.mapDataToDeal(data);

                if (deal.features) {
                    console.log('App: Property Features:', deal.features);
                }
                if (deal.rawData) {
                    console.log('App: Tax History:', deal.rawData.propertyTaxes);
                    console.log('App: Sale History:', deal.rawData.history);
                }

                const features = deal.features || {};
                const raw = deal.rawData || {};

                UI.setText('featType', raw.propertyType || '-');
                UI.setText('featYear', deal.yearBuilt || '-');
                UI.setText('featLot', features.lotSize ? `${UI.formatNumber(features.lotSize)} sqft` : '-');
                UI.setText('featZoning', raw.zoning || '-');
                UI.setText('featCounty', raw.county || '-');

                UI.setText('featCooling', features.coolingType || (features.cooling ? 'Yes' : '-'));
                UI.setText('featHeating', features.heatingType || (features.heating ? 'Yes' : '-'));
                UI.setText('featPool', features.poolType || (features.pool ? 'Yes' : '-'));
                UI.setText('featGarage', features.garageSpaces ? `${features.garageSpaces} Spaces` : (features.garage ? 'Yes' : '-'));
                UI.setText('featRoof', features.roofType || '-');

                const lastSale = deal.lastSaleDate ? `${new Date(deal.lastSaleDate).toLocaleDateString()} (${UI.formatCurrency(deal.lastSalePrice)})` : '-';
                UI.setText('featLastSale', lastSale);
                UI.setText('featSubdivision', raw.subdivision || '-');
                UI.setText('featParcel', raw.assessorID || '-');

                if (deal.beds) {
                    UI.setVal('beds', deal.beds);
                    UI.setVal('detailsBeds', deal.beds);
                    UI.lockField('beds');
                    UI.lockField('detailsBeds');
                }
                if (deal.baths) {
                    UI.setVal('baths', deal.baths);
                    UI.setVal('detailsBaths', deal.baths);
                    UI.lockField('baths');
                    UI.lockField('detailsBaths');
                }
                if (deal.sqft) {
                    UI.setVal('sqft', deal.sqft);
                    UI.setVal('detailsSqft', deal.sqft);
                    UI.lockField('sqft');
                    UI.lockField('detailsSqft');
                }
                if (deal.yearBuilt) {
                    UI.setVal('yearBuilt', deal.yearBuilt);
                    UI.lockField('yearBuilt');
                }

                if (deal.ownerOccupied !== undefined) {
                    const val = deal.ownerOccupied ? 'yes' : 'no';
                    UI.setVal('ownerOccupied', val);
                    UI.lockField('ownerOccupied');
                }
                if (deal.hoaFee) {
                    UI.setVal('hoaFee', deal.hoaFee);
                    UI.lockField('hoaFee');
                }
                if (deal.propertyTax) {
                    UI.setVal('propertyTax', deal.propertyTax);
                    UI.lockField('propertyTax');
                }

                if (deal.ownerName) {
                    UI.setVal('sellerName', deal.ownerName);
                    UI.lockField('sellerName');
                }

                // Smart Dropdown Mapping: Roof
                if (features.roofType) {
                    const roofLower = features.roofType.toLowerCase();
                    const roofSelect = document.getElementById('roofMaterial');
                    if (roofLower.includes('shingle') || roofLower.includes('composition')) {
                        roofSelect.value = 'shingle';
                    } else if (roofLower.includes('metal')) {
                        roofSelect.value = 'metal';
                    } else if (roofLower.includes('tile') || roofLower.includes('concrete') || roofLower.includes('clay')) {
                        roofSelect.value = 'tile';
                    }
                    if (roofSelect.value) {
                        roofSelect.disabled = true;
                        roofSelect.title = "Auto-selected from API data";
                    }
                }

                if (deal.estimatedValue) {
                    document.getElementById('arv').value = UI.formatNumber(deal.estimatedValue);
                }

                this.renderComps(comps);
                this.runCalculator();

                const newUsage = PropertyService.getUsage();
                alert(`Property data loaded! (API Usage: ${newUsage}/50)`);
            } else {
                alert('No data found for this address.');
            }
        } catch (error) {
            console.error(error);
            alert(error.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    },

    async fetchOfficialData() {
        const addressInput = document.getElementById('propertyAddress');
        const address = addressInput.value;

        if (!address) {
            alert('Please enter an address first.');
            return;
        }

        const btn = document.getElementById('fetchOfficialBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Loading...';
        btn.disabled = true;

        try {
            const data = await PropertyAppraiserService.searchByAddress(address);

            if (data) {
                if (data.ownerName) document.getElementById('sellerName').value = data.ownerName;
                if (data.beds) document.getElementById('beds').value = data.beds;
                if (data.baths) document.getElementById('baths').value = data.baths;
                if (data.sqft) document.getElementById('sqft').value = data.sqft;
                if (data.yearBuilt) document.getElementById('yearBuilt').value = data.yearBuilt;

                if (data.beds) document.getElementById('detailsBeds').value = data.beds;
                if (data.baths) document.getElementById('detailsBaths').value = data.baths;
                if (data.sqft) document.getElementById('detailsSqft').value = data.sqft;

                if (data.marketValue) {
                    if (!document.getElementById('arv').value) {
                        document.getElementById('arv').value = UI.formatNumber(data.marketValue);
                    }
                }

                if (data.taxValue) {
                    const estTax = Math.round(data.taxValue * 0.015);
                    document.getElementById('propertyTax').value = estTax;
                }

                this.runCalculator();

                let alertMsg = `Official data loaded from Hillsborough County!\n\nOwner: ${data.ownerName}\nFolio: ${data.folio}\nMarket Value: ${UI.formatCurrency(data.marketValue)}`;

                if (data.folioFormatted) {
                    const permits = await PermitService.fetchPermits(data.folioFormatted);
                    this.renderPermits(permits);
                    if (permits.length > 0) {
                        alertMsg += `\n\nFound ${permits.length} permits! Check the history below.`;
                    }
                }

                if (data.nbhc) {
                    console.log('App: Fetching DBF Comps for NBHC:', data.nbhc);
                    const comps = DbfService.getCompsByNeighborhood(data.nbhc, {
                        qualifiedOnly: true,
                        minDate: '20240101'
                    });

                    if (comps.length > 0) {
                        alertMsg += `\n\nFound ${comps.length} qualified comps in neighborhood ${data.nbhc}.`;
                        this.renderDbfComps(comps);
                    } else {
                        console.log('App: No DBF Comps found for this neighborhood.');
                    }
                }

                alert(alertMsg);
            } else {
                alert('No official records found for this address in Hillsborough County.');
            }

        } catch (error) {
            console.error(error);
            alert('Error fetching official data. See console for details.');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    },

    renderPermits(permits) {
        const container = document.getElementById('permitHistoryContainer');
        const list = document.getElementById('permitList');

        if (!permits || permits.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        list.innerHTML = permits.map(p => `
            <li style="margin-bottom: 8px; padding: 8px; background: #333; border-radius: 4px; font-size: 0.9em;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-weight: bold; color: #fff;">${p.type}</span>
                    <span style="color: #888;">${p.date}</span>
                </div>
                <div style="color: #ccc;">${p.description}</div>
                <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 0.85em;">
                    <span style="color: ${p.status === 'FINAL' ? '#4caf50' : '#ff9800'}">${p.status}</span>
                    <span>${p.permitNumber}</span>
                </div>
            </li>
        `).join('');
    },

    renderDbfComps(comps) {
        const container = document.getElementById('compsContainer');
        if (!container) return;

        if (!comps || comps.length === 0) {
            container.innerHTML = '<p class="empty-state">No neighborhood sales found in DBF.</p>';
            return;
        }

        const html = `
            <div style="background: #2a2a2a; padding: 10px; border-radius: 4px; margin-bottom: 10px;">
                <h4 style="margin: 0 0 5px 0;">Official Sales (Same Neighborhood)</h4>
                <table class="comps-table" style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                    <thead>
                        <tr style="text-align: left; border-bottom: 1px solid #444; color: #aaa;">
                            <th style="padding: 4px;">Date</th>
                            <th style="padding: 4px;">Price</th>
                            <th style="padding: 4px;">Buyer</th>
                            <th style="padding: 4px;">V/I</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${comps.map(c => `
                            <tr style="border-bottom: 1px solid #333;">
                                <td style="padding: 4px;">${this.formatDbfDate(c.S_DATE)}</td>
                                <td style="padding: 4px;">${UI.formatCurrency(c.S_AMT)}</td>
                                <td style="padding: 4px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.GRANTEE}">${c.GRANTEE}</td>
                                <td style="padding: 4px;">${c.VI}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    },

    formatDbfDate(dateStr) {
        if (!dateStr || dateStr.length !== 8) return dateStr;
        return `${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}/${dateStr.slice(0, 4)}`;
    },

    checkPermits() {
        const address = document.getElementById('propertyAddress').value;
        if (!address) {
            alert('Please enter an address first.');
            return;
        }

        const parsed = PermitService.parseAddress(address);
        const jurisdiction = PermitService.getJurisdiction(parsed.city, parsed.zip);
        PermitService.savePermitSearch(address, jurisdiction.name);

        const message = `Open ${jurisdiction.name} permit portal?\n\nAddress: ${address}\nJurisdiction: ${jurisdiction.name}\n\nTip: Search for "${parsed.street}" in the portal's address field.`;

        if (confirm(message)) {
            window.open(jurisdiction.searchUrl, '_blank');
        }
    },

    // --- Deal Management ---
    saveDeal() {
        const address = document.getElementById('propertyAddress').value || 'Untitled Deal';
        if (address === 'Untitled Deal') {
            alert('Please enter a property address first.');
            return;
        }

        const isNew = !this.currentDealId;

        const dealData = {
            id: this.currentDealId,
            propertyAddress: address,
            arv: document.getElementById('arv').value,
            repairCosts: document.getElementById('repairCosts').value,
            assignmentFee: document.getElementById('assignmentFee').value,
            mao: document.getElementById('suggestedOffer').textContent,
            profit: document.getElementById('yourProfit').textContent,
            source: document.getElementById('source').value,
            summary: document.getElementById('dealSummary').value,
            waitingOn: document.getElementById('waitingOnSelect').value
        };

        const savedDeal = Store.saveDeal(dealData);
        this.currentDealId = savedDeal.id;

        // Sync any existing contacts to global directory
        if (savedDeal.contacts) {
            savedDeal.contacts.forEach(contact => {
                Store.syncContactToGlobal(contact, savedDeal.id);
            });
        }

        this.renderSavedDeals();
        this.updateDealBar();
        this.syncCalcStatusButtons();
        Pipeline.render();

        if (isNew) {
            alert(`Deal saved! "${address}" has been added to your Pipeline as a Lead.`);
        } else {
            alert('Deal updated!');
        }
    },

    loadDeal(id) {
        const deal = Store.getDeal(id);
        if (!deal) return;

        this.currentDealId = deal.id;

        document.getElementById('propertyAddress').value = deal.propertyAddress || '';
        if (deal.arv) document.getElementById('arv').value = deal.arv;
        if (deal.repairCosts) document.getElementById('repairCosts').value = deal.repairCosts;
        if (deal.assignmentFee) document.getElementById('assignmentFee').value = deal.assignmentFee;

        // Restore deal summary and waiting-on
        const summaryEl = document.getElementById('dealSummary');
        if (summaryEl) summaryEl.value = deal.summary || '';
        const waitingOnEl = document.getElementById('waitingOnSelect');
        if (waitingOnEl) waitingOnEl.value = deal.waitingOn || '';

        this.runCalculator();
        this.updateDealBar();
        this.syncCalcStatusButtons();
        this.switchView('calculator');
    },

    clearForm() {
        this.currentDealId = null;
        document.querySelectorAll('input').forEach(i => i.value = '');
        const summaryEl = document.getElementById('dealSummary');
        if (summaryEl) summaryEl.value = '';
        const waitingOnEl = document.getElementById('waitingOnSelect');
        if (waitingOnEl) waitingOnEl.value = '';
        this.runCalculator();
        this.updateDealBar();
        this.syncCalcStatusButtons();
    },

    updateDealBar() {
        const bar = document.getElementById('activeDealBar');
        if (!bar) return;

        if (!this.currentDealId) {
            bar.classList.add('hidden');
            return;
        }

        const deal = Store.getDeal(this.currentDealId);
        if (!deal) {
            bar.classList.add('hidden');
            return;
        }

        bar.classList.remove('hidden');
        document.getElementById('dealBarAddress').textContent = deal.propertyAddress || 'Untitled';
        const statusEl = document.getElementById('dealBarStatus');
        statusEl.textContent = (deal.status || 'lead').replace(/_/g, ' ');
        statusEl.className = `deal-bar-status status-pill status-${deal.status || 'lead'}`;
        document.getElementById('dealBarProfit').textContent = deal.profit || '$0';
    },

    renderSavedDeals() {
        const list = document.getElementById('savedDealsList');

        // Get search/filter/sort values
        const searchQuery = (document.getElementById('dealSearchInput')?.value || '').trim();
        const filterStatus = document.getElementById('dealFilterStatus')?.value || 'all';
        const sortBy = document.getElementById('dealSortBy')?.value || 'newest';

        // Apply search
        let deals = searchQuery ? Store.searchDeals(searchQuery) : Store.getDeals();

        // Apply filter
        if (filterStatus !== 'all') {
            deals = deals.filter(d => d.status === filterStatus);
        }

        // Apply sort
        deals = Store.sortDeals(deals, sortBy);

        // Show top 20
        deals = deals.slice(0, 20);

        if (deals.length === 0) {
            if (deals.length === 0) {
                list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <p>No saved deals found.</p>
                </div>`;
                return;
            }
        }

        const allTasks = Store.getTasks();

        list.innerHTML = deals.map(deal => {
            const status = (deal.status || 'lead').replace(/_/g, ' ');
            const waitingOn = deal.waitingOn ? deal.waitingOn.replace(/_/g, ' ') : '';

            // Last activity: most recent timeline entry
            let lastActivity = '';
            if (deal.timeline && deal.timeline.length > 0) {
                const latest = deal.timeline[0];
                const dateStr = new Date(latest.timestamp).toLocaleDateString();
                const typeLabel = latest.type === 'status_change' ? 'Status change' : (latest.type || 'note');
                lastActivity = `${typeLabel} — ${dateStr}`;
            }

            // Next follow-up: earliest incomplete task for this deal
            const dealTasks = allTasks
                .filter(t => t.dealId === deal.id && !t.completed && t.dueDate)
                .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
            const nextFollowUp = dealTasks.length > 0
                ? new Date(dealTasks[0].dueDate).toLocaleDateString()
                : '';

            const summarySnip = deal.summary ? deal.summary.substring(0, 60) + (deal.summary.length > 60 ? '...' : '') : '';
            return `
                <li data-id="${deal.id}">
                    <div class="deal-info">
                        <span class="deal-addr" title="${deal.propertyAddress}">${deal.propertyAddress || 'Untitled'}</span>
                        <div class="deal-card-row">
                            <span class="status-pill status-${deal.status || 'lead'}" style="font-size:0.65rem; padding:2px 6px;">${status}</span>
                            ${waitingOn ? `<span class="waiting-on-badge">⏳ ${waitingOn}</span>` : ''}
                        </div>
                        <span class="deal-metrics">MAO: ${deal.mao || '$0'} | Profit: ${deal.profit || '$0'}</span>
                        ${lastActivity ? `<span class="deal-activity">Last: ${lastActivity}</span>` : ''}
                        ${nextFollowUp ? `<span class="deal-followup">Follow-up: ${nextFollowUp}</span>` : ''}
                        ${summarySnip ? `<span class="deal-summary-snip">${summarySnip}</span>` : ''}
                    </div>
                    <button class="delete-btn">&times;</button>
                </li>
            `;
        }).join('');

        list.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', () => this.loadDeal(parseInt(li.dataset.id)));
        });

        list.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(e.target.closest('li').dataset.id);
                if (confirm('Delete?')) {
                    Store.deleteDeal(id);
                    this.renderSavedDeals();
                    Pipeline.render();
                    if (this.currentDealId === id) this.clearForm();
                }
            });
        });
    },

    setupGlobalEvents() {
        document.addEventListener('loadDeal', (e) => {
            this.loadDeal(e.detail.id);
        });

        document.addEventListener('dealStatusChanged', () => {
            this.updateDealBar();
            this.renderSavedDeals();
            this.syncCalcStatusButtons();
        });

        // Property page status buttons
        document.querySelectorAll('#calcStatusActions .btn-status').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.currentDealId) {
                    alert('Please save a deal first.');
                    return;
                }
                const newStatus = btn.dataset.status;
                Store.updateDealStatus(this.currentDealId, newStatus);

                // Immediate visual feedback
                document.querySelectorAll('#calcStatusActions .btn-status').forEach(b => {
                    b.classList.toggle('active-status', b.dataset.status === newStatus);
                });

                document.dispatchEvent(new CustomEvent('dealStatusChanged', {
                    detail: { id: this.currentDealId, status: newStatus }
                }));
            });
        });
    },

    syncCalcStatusButtons() {
        const deal = this.currentDealId ? Store.getDeal(this.currentDealId) : null;
        const status = deal ? deal.status : '';
        document.querySelectorAll('#calcStatusActions .btn-status').forEach(btn => {
            btn.classList.toggle('active-status', btn.dataset.status === status);
        });
    },

    generateRepairGrid() {
        const repairCategories = {
            roof: { label: 'Roof', low: 3000, medium: 8000, high: 15000 },
            hvac: { label: 'HVAC', low: 2000, medium: 5000, high: 10000 },
            plumbing: { label: 'Plumbing', low: 1500, medium: 4000, high: 8000 },
            electrical: { label: 'Electrical', low: 1500, medium: 3500, high: 7000 },
            kitchen: { label: 'Kitchen', low: 5000, medium: 15000, high: 30000 },
            bathrooms: { label: 'Bathrooms', low: 3000, medium: 8000, high: 15000 },
            flooring: { label: 'Flooring', low: 2000, medium: 5000, high: 10000 },
            paint: { label: 'Paint (Interior)', low: 1500, medium: 3000, high: 6000 },
            exterior: { label: 'Exterior/Siding', low: 2000, medium: 6000, high: 12000 },
            windows: { label: 'Windows/Doors', low: 2000, medium: 5000, high: 10000 }
        };

        const grid = document.getElementById('repairGrid');
        const levels = ['none', 'low', 'medium', 'high'];
        const levelLabels = ['None', 'Light', 'Medium', 'Heavy'];

        grid.innerHTML = Object.keys(repairCategories).map(key => {
            const cat = repairCategories[key];
            const currentLevel = this.activeRepairs[key] || 'none';
            const currentIndex = levels.indexOf(currentLevel);

            let currentCost = 0;
            if (currentLevel !== 'none') currentCost = cat[currentLevel];

            return `
                <div class="repair-category-slider">
                    <div class="slider-header">
                        <h4>${cat.label}</h4>
                        <span class="repair-value" id="val-${key}">
                            ${levelLabels[currentIndex]} ${currentCost > 0 ? `($${UI.formatNumber(currentCost)})` : ''}
                        </span>
                    </div>
                    <div class="slider-container">
                        <input type="range" min="0" max="3" step="1" value="${currentIndex}"
                               class="repair-slider" data-category="${key}">
                        <div class="slider-ticks">
                            <span>None</span>
                            <span>Light</span>
                            <span>Med</span>
                            <span>Heavy</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.repair-slider').forEach(input => {
            input.addEventListener('input', (e) => {
                const category = e.target.dataset.category;
                const index = parseInt(e.target.value);
                const level = levels[index];
                const cat = repairCategories[category];

                this.activeRepairs[category] = level;

                const labelEl = document.getElementById(`val-${category}`);
                let cost = 0;
                if (level !== 'none') cost = cat[level];

                labelEl.textContent = `${levelLabels[index]} ${cost > 0 ? `($${UI.formatNumber(cost)})` : ''}`;
                if (cost > 0) {
                    labelEl.classList.add('active');
                } else {
                    labelEl.classList.remove('active');
                }

                const total = this.calculateRepairTotal();
                document.getElementById('modalTotalRepairs').textContent = UI.formatCurrency(total);
            });
        });

        const total = this.calculateRepairTotal();
        document.getElementById('modalTotalRepairs').textContent = UI.formatCurrency(total);
    },

    calculateRepairTotal() {
        const repairCosts = {
            roof: { low: 3000, medium: 8000, high: 15000 },
            hvac: { low: 2000, medium: 5000, high: 10000 },
            plumbing: { low: 1500, medium: 4000, high: 8000 },
            electrical: { low: 1500, medium: 3500, high: 7000 },
            kitchen: { low: 5000, medium: 15000, high: 30000 },
            bathrooms: { low: 3000, medium: 8000, high: 15000 },
            flooring: { low: 2000, medium: 5000, high: 10000 },
            paint: { low: 1500, medium: 3000, high: 6000 },
            exterior: { low: 2000, medium: 6000, high: 12000 },
            windows: { low: 2000, medium: 5000, high: 10000 }
        };

        let total = 0;
        for (const [category, level] of Object.entries(this.activeRepairs)) {
            if (level !== 'none' && repairCosts[category] && repairCosts[category][level]) {
                total += repairCosts[category][level];
            }
        }
        return total;
    }
};
