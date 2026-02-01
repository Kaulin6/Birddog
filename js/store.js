/**
 * store.js
 * Centralized state management for Bird Dog OS
 */

const STORAGE_KEY = 'birdDogDeals';
const CONTACTS_KEY = 'birdDogContacts';
const TASKS_KEY = 'birdDogTasks';
const TEMPLATES_KEY = 'birdDogTemplates';
const LISTS_KEY = 'birdDogLists';
const CADENCES_KEY = 'birdDogCadences';

export const CADENCE_STEPS = [
    { day: 1,  types: ['call', 'text'], label: 'Day 1: Call + Text' },
    { day: 2,  types: ['call'],         label: 'Day 2: Call' },
    { day: 3,  types: ['text'],         label: 'Day 3: Text' },
    { day: 7,  types: ['call'],         label: 'Day 7: Call' },
    { day: 14, types: ['call', 'text'], label: 'Day 14: Call + Text' },
    { day: 21, types: ['call'],         label: 'Day 21: Call' },
    { day: 30, types: ['call'],         label: 'Day 30: Final Call' }
];

export const Store = {
    // ========================================
    // DEALS
    // ========================================
    getDeals() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    },

    saveDeals(deals) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
    },

    getDeal(id) {
        const deals = this.getDeals();
        return deals.find(d => d.id === id);
    },

    saveDeal(dealData) {
        const deals = this.getDeals();
        const existingIndex = deals.findIndex(d => d.id === dealData.id);

        if (!dealData.id) {
            dealData.id = Date.now();
        }

        dealData.savedAt = new Date().toISOString();

        if (existingIndex >= 0) {
            // Merge: preserve existing fields (contacts, timeline, status)
            // that may not be included in partial updates
            const existing = deals[existingIndex];
            dealData = { ...existing, ...dealData };
            deals[existingIndex] = dealData;
        } else {
            if (!dealData.contacts) dealData.contacts = [];
            if (!dealData.timeline) dealData.timeline = [];
            if (!dealData.status) dealData.status = 'lead';
            // Add "Deal created" as the first timeline entry
            dealData.timeline.push({
                type: 'system',
                text: 'Deal created',
                timestamp: new Date().toISOString()
            });
            deals.unshift(dealData);
        }

        this.saveDeals(deals);
        return dealData;
    },

    deleteDeal(id) {
        const deals = this.getDeals().filter(d => d.id !== id);
        this.saveDeals(deals);
    },

    updateDealStatus(id, newStatus) {
        const deals = this.getDeals();
        const deal = deals.find(d => d.id === id);
        if (deal) {
            deal.status = newStatus;
            this.saveDeals(deals);
            return deal;
        }
        return null;
    },

    addContactToDeal(dealId, contact) {
        const deals = this.getDeals();
        const deal = deals.find(d => d.id === dealId);
        if (deal) {
            if (!deal.contacts) deal.contacts = [];
            deal.contacts.push(contact);
            this.saveDeals(deals);
            return deal;
        }
        return null;
    },

    addLogToDeal(dealId, logEntry) {
        const deals = this.getDeals();
        const deal = deals.find(d => d.id === dealId);
        if (deal) {
            if (!deal.timeline) deal.timeline = [];
            deal.timeline.unshift({
                ...logEntry,
                timestamp: new Date().toISOString()
            });
            this.saveDeals(deals);
            return deal;
        }
        return null;
    },

    getAllContacts() {
        const deals = this.getDeals();
        const allContacts = [];

        deals.forEach(deal => {
            if (deal.contacts && deal.contacts.length > 0) {
                deal.contacts.forEach((contact, idx) => {
                    allContacts.push({
                        ...contact,
                        dealId: deal.id,
                        propertyAddress: deal.propertyAddress || 'Untitled Deal',
                        contactIndex: idx
                    });
                });
            }
        });

        return allContacts;
    },

    // ========================================
    // GLOBAL CONTACTS DIRECTORY
    // ========================================
    getContacts() {
        return JSON.parse(localStorage.getItem(CONTACTS_KEY) || '[]');
    },

    saveContacts(contacts) {
        localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    },

    getContact(id) {
        return this.getContacts().find(c => c.id === id);
    },

    saveContact(contactData) {
        const contacts = this.getContacts();
        const existingIndex = contacts.findIndex(c => c.id === contactData.id);

        if (!contactData.id) {
            contactData.id = Date.now();
        }
        if (!contactData.createdAt) {
            contactData.createdAt = new Date().toISOString();
        }
        if (!contactData.dealIds) contactData.dealIds = [];

        if (existingIndex >= 0) {
            contacts[existingIndex] = contactData;
        } else {
            contacts.unshift(contactData);
        }

        this.saveContacts(contacts);
        return contactData;
    },

    deleteGlobalContact(id) {
        const contacts = this.getContacts().filter(c => c.id !== id);
        this.saveContacts(contacts);
    },

    findContactByNamePhone(name, phone) {
        const contacts = this.getContacts();
        const nameLower = (name || '').toLowerCase().trim();
        return contacts.find(c => {
            const match = (c.name || '').toLowerCase().trim() === nameLower;
            if (phone && c.phone) {
                return match && c.phone.replace(/\D/g, '') === phone.replace(/\D/g, '');
            }
            return match;
        });
    },

    linkContactToDeal(contactId, dealId) {
        const contacts = this.getContacts();
        const contact = contacts.find(c => c.id === contactId);
        if (contact) {
            if (!contact.dealIds) contact.dealIds = [];
            if (!contact.dealIds.includes(dealId)) {
                contact.dealIds.push(dealId);
                this.saveContacts(contacts);
            }
            return contact;
        }
        return null;
    },

    syncContactToGlobal(dealContact, dealId) {
        let existing = this.findContactByNamePhone(dealContact.name, dealContact.phone);
        if (existing) {
            // Update fields if newer data
            if (dealContact.email && !existing.email) existing.email = dealContact.email;
            if (dealContact.role && !existing.role) existing.role = dealContact.role;
            if (dealContact.phone && !existing.phone) existing.phone = dealContact.phone;
            this.linkContactToDeal(existing.id, dealId);
            return existing;
        } else {
            return this.saveContact({
                name: dealContact.name,
                role: dealContact.role || 'other',
                phone: dealContact.phone || '',
                email: dealContact.email || '',
                dealIds: [dealId],
                notes: ''
            });
        }
    },

    getContactInteractionHistory(contactName) {
        const deals = this.getDeals();
        const history = [];
        deals.forEach(deal => {
            const hasContact = (deal.contacts || []).some(c =>
                c.name.toLowerCase().trim() === contactName.toLowerCase().trim()
            );
            if (hasContact && deal.timeline) {
                deal.timeline.forEach(entry => {
                    if (entry.contact && entry.contact.toLowerCase().trim() === contactName.toLowerCase().trim()) {
                        history.push({
                            ...entry,
                            dealId: deal.id,
                            dealAddress: deal.propertyAddress
                        });
                    }
                });
            }
        });
        return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    // ========================================
    // TASKS / FOLLOW-UPS
    // ========================================
    getTasks() {
        return JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
    },

    saveTasks(tasks) {
        localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    },

    saveTask(taskData) {
        const tasks = this.getTasks();
        const existingIndex = tasks.findIndex(t => t.id === taskData.id);

        if (!taskData.id) {
            taskData.id = Date.now();
        }
        if (!taskData.createdAt) {
            taskData.createdAt = new Date().toISOString();
        }
        if (taskData.completed === undefined) taskData.completed = false;

        if (existingIndex >= 0) {
            tasks[existingIndex] = taskData;
        } else {
            tasks.unshift(taskData);
        }

        this.saveTasks(tasks);
        return taskData;
    },

    completeTask(id) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = true;
            task.completedAt = new Date().toISOString();
            this.saveTasks(tasks);
            return task;
        }
        return null;
    },

    deleteTask(id) {
        const tasks = this.getTasks().filter(t => t.id !== id);
        this.saveTasks(tasks);
    },

    getTasksByDeal(dealId) {
        return this.getTasks().filter(t => t.dealId === dealId && !t.completed);
    },

    getOverdueTasks() {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        return this.getTasks().filter(t => {
            if (t.completed) return false;
            const due = new Date(t.dueDate);
            due.setHours(0, 0, 0, 0);
            return due < now;
        });
    },

    getDueTodayTasks() {
        const today = new Date().toISOString().split('T')[0];
        return this.getTasks().filter(t => {
            if (t.completed) return false;
            return t.dueDate && t.dueDate.startsWith(today);
        });
    },

    getUpcomingTasks(days = 7) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const future = new Date(now);
        future.setDate(future.getDate() + days);
        return this.getTasks().filter(t => {
            if (t.completed) return false;
            const due = new Date(t.dueDate);
            due.setHours(0, 0, 0, 0);
            return due >= now && due <= future;
        });
    },

    // ========================================
    // SEARCH & FILTER
    // ========================================
    searchDeals(query) {
        if (!query || !query.trim()) return this.getDeals();
        const q = query.toLowerCase().trim();
        return this.getDeals().filter(deal => {
            // Search address
            if ((deal.propertyAddress || '').toLowerCase().includes(q)) return true;
            // Search contacts
            if ((deal.contacts || []).some(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.phone || '').includes(q)
            )) return true;
            // Search timeline notes
            if ((deal.timeline || []).some(t =>
                (t.text || '').toLowerCase().includes(q)
            )) return true;
            return false;
        });
    },

    filterDeals({ status, minProfit, maxProfit, dateFrom, dateTo, source } = {}) {
        let deals = this.getDeals();

        if (status && status !== 'all') {
            deals = deals.filter(d => d.status === status);
        }
        if (minProfit !== undefined) {
            deals = deals.filter(d => {
                const profit = parseFloat((d.profit || '0').replace(/[^0-9.-]/g, ''));
                return profit >= minProfit;
            });
        }
        if (maxProfit !== undefined) {
            deals = deals.filter(d => {
                const profit = parseFloat((d.profit || '0').replace(/[^0-9.-]/g, ''));
                return profit <= maxProfit;
            });
        }
        if (dateFrom) {
            deals = deals.filter(d => d.savedAt >= dateFrom);
        }
        if (dateTo) {
            deals = deals.filter(d => d.savedAt <= dateTo);
        }
        if (source) {
            deals = deals.filter(d => d.source === source);
        }
        return deals;
    },

    sortDeals(deals, sortBy = 'newest') {
        const sorted = [...deals];
        switch (sortBy) {
            case 'newest':
                return sorted.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
            case 'oldest':
                return sorted.sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt));
            case 'profit_high':
                return sorted.sort((a, b) => {
                    const pa = parseFloat((a.profit || '0').replace(/[^0-9.-]/g, ''));
                    const pb = parseFloat((b.profit || '0').replace(/[^0-9.-]/g, ''));
                    return pb - pa;
                });
            case 'score':
                return sorted.sort((a, b) => this.scoreDeal(b) - this.scoreDeal(a));
            default:
                return sorted;
        }
    },

    // ========================================
    // DEAL SCORING
    // ========================================
    scoreDeal(deal) {
        let score = 0;

        // Profit margin (30 pts) - assignment fee as % of MAO
        const mao = parseFloat((deal.mao || '0').replace(/[^0-9.-]/g, ''));
        const fee = parseFloat((deal.profit || deal.assignmentFee || '0').toString().replace(/[^0-9.-]/g, ''));
        if (mao > 0 && fee > 0) {
            const margin = fee / mao;
            score += Math.min(30, margin * 300); // 10% margin = 30 pts
        }

        // Buyer ROI proxy (20 pts)
        const arv = parseFloat((deal.arv || '0').toString().replace(/[^0-9.-]/g, ''));
        const repairs = parseFloat((deal.repairCosts || '0').toString().replace(/[^0-9.-]/g, ''));
        if (arv > 0 && mao > 0) {
            const investorProfit = arv - mao - fee - repairs;
            const totalInvestment = mao + fee + repairs;
            if (totalInvestment > 0) {
                const roi = investorProfit / totalInvestment;
                score += Math.min(20, roi * 100); // 20% ROI = 20 pts
            }
        }

        // Freshness (20 pts) - more recent = higher score
        if (deal.savedAt) {
            const days = this.getDealAge(deal);
            if (days <= 3) score += 20;
            else if (days <= 7) score += 15;
            else if (days <= 14) score += 10;
            else if (days <= 30) score += 5;
        }

        // Has contacts (10 pts)
        if (deal.contacts && deal.contacts.length > 0) {
            score += Math.min(10, deal.contacts.length * 5);
        }

        // Has interaction logs (10 pts)
        if (deal.timeline) {
            const logs = deal.timeline.filter(t => t.type === 'note' || t.type === 'call' || t.type === 'email' || t.type === 'text' || t.type === 'meeting');
            score += Math.min(10, logs.length * 2);
        }

        // Low repair ratio (10 pts) - repairs as % of ARV, lower is better
        if (arv > 0 && repairs >= 0) {
            const repairRatio = repairs / arv;
            if (repairRatio <= 0.1) score += 10;
            else if (repairRatio <= 0.2) score += 7;
            else if (repairRatio <= 0.3) score += 4;
            else if (repairRatio <= 0.5) score += 2;
        }

        return Math.round(Math.min(100, score));
    },

    // ========================================
    // DEAL AGING
    // ========================================
    getDealAge(deal) {
        if (!deal.savedAt) return 0;
        const saved = new Date(deal.savedAt);
        const now = new Date();
        return Math.floor((now - saved) / (1000 * 60 * 60 * 24));
    },

    getDaysInStage(deal) {
        if (!deal.timeline || deal.timeline.length === 0) {
            return this.getDealAge(deal);
        }
        const lastStatusChange = deal.timeline.find(t => t.type === 'status_change');
        if (lastStatusChange) {
            const changed = new Date(lastStatusChange.timestamp);
            const now = new Date();
            return Math.floor((now - changed) / (1000 * 60 * 60 * 24));
        }
        return this.getDealAge(deal);
    },

    getStaleDeals(thresholdDays = 7) {
        return this.getDeals().filter(deal => {
            if (deal.status === 'closed' || deal.status === 'dead') return false;
            const lastActivity = this.getLastActivityDate(deal);
            const daysSince = Math.floor((new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24));
            return daysSince >= thresholdDays;
        }).map(deal => {
            const lastActivity = this.getLastActivityDate(deal);
            const daysSince = Math.floor((new Date() - new Date(lastActivity)) / (1000 * 60 * 60 * 24));
            return { ...deal, daysSinceActivity: daysSince };
        }).sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
    },

    getLastActivityDate(deal) {
        if (deal.timeline && deal.timeline.length > 0) {
            return deal.timeline[0].timestamp;
        }
        return deal.savedAt || new Date().toISOString();
    },

    // ========================================
    // ANALYTICS
    // ========================================
    getAnalytics() {
        const deals = this.getDeals();
        const stages = ['lead', 'analyzed', 'offer_sent', 'under_contract', 'closed', 'dead'];
        const stageCounts = {};
        const stageValues = {};

        stages.forEach(s => { stageCounts[s] = 0; stageValues[s] = 0; });

        deals.forEach(deal => {
            const status = deal.status || 'lead';
            stageCounts[status] = (stageCounts[status] || 0) + 1;
            const fee = parseFloat((deal.profit || deal.assignmentFee || '0').toString().replace(/[^0-9.-]/g, ''));
            stageValues[status] = (stageValues[status] || 0) + fee;
        });

        // Conversion rates
        const totalLeadsEver = deals.length;
        const analyzed = deals.filter(d => ['analyzed', 'offer_sent', 'under_contract', 'closed'].includes(d.status)).length;
        const offersSent = deals.filter(d => ['offer_sent', 'under_contract', 'closed'].includes(d.status)).length;
        const underContract = deals.filter(d => ['under_contract', 'closed'].includes(d.status)).length;
        const closed = stageCounts['closed'] || 0;
        const dead = stageCounts['dead'] || 0;

        const conversionFunnel = [
            { stage: 'Leads', count: totalLeadsEver, pct: 100 },
            { stage: 'Analyzed', count: analyzed, pct: totalLeadsEver ? Math.round((analyzed / totalLeadsEver) * 100) : 0 },
            { stage: 'Offer Sent', count: offersSent, pct: totalLeadsEver ? Math.round((offersSent / totalLeadsEver) * 100) : 0 },
            { stage: 'Under Contract', count: underContract, pct: totalLeadsEver ? Math.round((underContract / totalLeadsEver) * 100) : 0 },
            { stage: 'Closed', count: closed, pct: totalLeadsEver ? Math.round((closed / totalLeadsEver) * 100) : 0 }
        ];

        // Avg days per stage
        const avgDaysPerStage = {};
        stages.forEach(s => {
            const stageDeals = deals.filter(d => d.status === s);
            if (stageDeals.length > 0) {
                const totalDays = stageDeals.reduce((sum, d) => sum + this.getDaysInStage(d), 0);
                avgDaysPerStage[s] = Math.round(totalDays / stageDeals.length);
            } else {
                avgDaysPerStage[s] = 0;
            }
        });

        // Win rate
        const completedDeals = closed + dead;
        const winRate = completedDeals > 0 ? Math.round((closed / completedDeals) * 100) : 0;

        // Total revenue
        const totalRevenue = stageValues['closed'] || 0;

        // Pipeline value (excluding closed/dead)
        const pipelineValue = Object.entries(stageValues)
            .filter(([key]) => key !== 'closed' && key !== 'dead')
            .reduce((sum, [, val]) => sum + val, 0);

        const activeDealCount = deals.filter(d => d.status !== 'closed' && d.status !== 'dead').length;
        const avgDealSize = activeDealCount > 0 ? Math.round(pipelineValue / activeDealCount) : 0;

        return {
            totalDeals: deals.length,
            stageCounts,
            stageValues,
            conversionFunnel,
            avgDaysPerStage,
            winRate,
            totalRevenue,
            pipelineValue,
            avgDealSize,
            activeDealCount
        };
    },

    // ========================================
    // TEMPLATES
    // ========================================
    getTemplates() {
        const stored = localStorage.getItem(TEMPLATES_KEY);
        if (stored) return JSON.parse(stored);

        // Default templates
        const defaults = [
            { id: 1, name: 'Initial Outreach', text: 'Hi {ownerName}, I\'m reaching out regarding your property at {address}. I\'m a local investor and would love to discuss a potential offer. Would you be open to a quick conversation?' },
            { id: 2, name: 'Follow-Up Call', text: 'Following up on our conversation about {address}. I wanted to check in and see if you\'ve had a chance to think about our discussion. I\'m still very interested in working together.' },
            { id: 3, name: 'Offer Letter', text: 'I\'d like to present an offer of {mao} for the property at {address}. This is based on current market conditions and comparable sales in the area. I can close within 30 days with no contingencies.' },
            { id: 4, name: 'Under Contract Check-In', text: 'Quick update on {address} - we are currently under contract and everything is progressing smoothly. I\'ll keep you posted on the timeline.' }
        ];
        this.saveTemplates(defaults);
        return defaults;
    },

    saveTemplates(templates) {
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    },

    saveTemplate(templateData) {
        const templates = this.getTemplates();
        const existingIndex = templates.findIndex(t => t.id === templateData.id);

        if (!templateData.id) templateData.id = Date.now();

        if (existingIndex >= 0) {
            templates[existingIndex] = templateData;
        } else {
            templates.push(templateData);
        }

        this.saveTemplates(templates);
        return templateData;
    },

    deleteTemplate(id) {
        const templates = this.getTemplates().filter(t => t.id !== id);
        this.saveTemplates(templates);
    },

    fillTemplate(templateText, deal) {
        return templateText
            .replace(/\{ownerName\}/g, deal.ownerName || deal.sellerName || 'there')
            .replace(/\{address\}/g, deal.propertyAddress || 'the property')
            .replace(/\{mao\}/g, deal.mao || '$0')
            .replace(/\{profit\}/g, deal.profit || '$0')
            .replace(/\{arv\}/g, deal.arv || '$0');
    },

    // ========================================
    // EXPORT / IMPORT
    // ========================================
    exportData() {
        return JSON.stringify({
            version: 1,
            exportedAt: new Date().toISOString(),
            deals: this.getDeals(),
            contacts: this.getContacts(),
            tasks: this.getTasks(),
            templates: this.getTemplates()
        }, null, 2);
    },

    importData(jsonString) {
        const data = JSON.parse(jsonString);

        if (data.deals) {
            this.saveDeals(data.deals);
        }
        if (data.contacts) {
            this.saveContacts(data.contacts);
        }
        if (data.tasks) {
            this.saveTasks(data.tasks);
        }
        if (data.templates) {
            this.saveTemplates(data.templates);
        }

        return {
            deals: (data.deals || []).length,
            contacts: (data.contacts || []).length,
            tasks: (data.tasks || []).length,
            templates: (data.templates || []).length
        };
    },

    // ========================================
    // CONTACT FULL TIMELINE
    // ========================================
    getContactFullTimeline(contactName) {
        const deals = this.getDeals();
        const timeline = [];
        const nameLower = (contactName || '').toLowerCase().trim();

        deals.forEach(deal => {
            const hasContact = (deal.contacts || []).some(c =>
                (c.name || '').toLowerCase().trim() === nameLower
            );
            if (!hasContact) return;

            // Include all timeline entries for deals this contact is on
            (deal.timeline || []).forEach(entry => {
                timeline.push({
                    ...entry,
                    dealId: deal.id,
                    dealAddress: deal.propertyAddress || 'Untitled',
                    dealStatus: deal.status
                });
            });
        });

        return timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    // ========================================
    // OUTREACH QUEUE
    // ========================================
    getOutreachQueue() {
        const CONTACT_TYPES = ['call', 'email', 'text', 'meeting'];
        const deals = this.getDeals();
        const tasks = this.getTasks();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const queue = deals
            .filter(d => d.status !== 'closed' && d.status !== 'dead')
            .map(deal => {
                const timeline = deal.timeline || [];
                const interactions = timeline.filter(e => CONTACT_TYPES.includes(e.type));
                const sorted = [...interactions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

                const firstContact = sorted.length > 0 ? new Date(sorted[0].timestamp) : null;
                const lastContact = sorted.length > 0 ? new Date(sorted[sorted.length - 1].timestamp) : null;
                const daysSinceContact = lastContact ? Math.floor((now - lastContact) / 86400000) : null;

                // Follow-up date from tasks
                const dealTask = tasks.find(t => t.dealId === deal.id && t.dueDate && !t.completed);
                const followUpDate = dealTask ? new Date(dealTask.dueDate) : null;

                const isOverdue = followUpDate && followUpDate < today;
                const isDueToday = followUpDate && followUpDate.toDateString() === today.toDateString();
                const isUpcoming = followUpDate && followUpDate > today && followUpDate <= new Date(today.getTime() + 7 * 86400000);

                // Primary contact: prefer seller/owner, then agent
                const contacts = deal.contacts || [];
                const owner = contacts.find(c => c.role === 'seller' || c.role === 'owner');
                const agent = contacts.find(c => c.role === 'agent');
                const primaryContact = owner || agent || contacts[0] || null;
                const contactType = primaryContact ? (primaryContact.role === 'agent' ? 'agent' : 'owner') : null;

                // Priority score (lower = more urgent)
                let priority = 50;
                if (interactions.length === 0) priority = 5; // never contacted
                else if (isOverdue) priority = 10;
                else if (isDueToday) priority = 15;
                else if (daysSinceContact !== null && daysSinceContact >= 7) priority = 20;
                else if (isUpcoming) priority = 30;

                const dealAge = deal.savedAt ? Math.floor((now - new Date(deal.savedAt)) / 86400000) : 0;

                return {
                    deal,
                    primaryContact,
                    contactType,
                    firstContact,
                    lastContact,
                    daysSinceContact,
                    followUpDate,
                    isOverdue,
                    isDueToday,
                    isUpcoming,
                    totalInteractions: interactions.length,
                    dealAge,
                    priority
                };
            });

        return queue.sort((a, b) => a.priority - b.priority);
    },

    addDealsFromList(rows) {
        const deals = this.getDeals();
        const existingAddresses = new Set(deals.map(d => (d.propertyAddress || '').toLowerCase().trim()));
        let imported = 0;
        let skipped = 0;

        rows.forEach(row => {
            const address = (row.address || '').trim();
            if (!address) { skipped++; return; }
            if (existingAddresses.has(address.toLowerCase())) { skipped++; return; }

            const contacts = [];
            if (row.ownerName) {
                contacts.push({ name: row.ownerName, role: 'seller', phone: row.ownerPhone || '', email: row.ownerEmail || '' });
            }
            if (row.agentName) {
                contacts.push({ name: row.agentName, role: 'agent', phone: row.agentPhone || '', email: row.agentEmail || '' });
            }

            const dealData = {
                id: Date.now() + imported,
                propertyAddress: address,
                status: 'lead',
                contacts,
                timeline: [{
                    type: 'system',
                    text: 'Imported via lead list',
                    timestamp: new Date().toISOString()
                }],
                savedAt: new Date().toISOString(),
                source: row.source || 'import'
            };

            deals.unshift(dealData);
            existingAddresses.add(address.toLowerCase());
            imported++;

            // Sync contacts to global directory
            contacts.forEach(c => {
                if (c.name) this.syncContactToGlobal(c, dealData.id);
            });
        });

        this.saveDeals(deals);
        return { imported, skipped };
    },

    // ========================================
    // LISTS
    // ========================================
    getLists() {
        return JSON.parse(localStorage.getItem(LISTS_KEY) || '[]');
    },

    saveLists(lists) {
        localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
    },

    getList(id) {
        return this.getLists().find(l => l.id === id);
    },

    saveList(listData) {
        const lists = this.getLists();
        if (!listData.id) listData.id = Date.now();
        if (!listData.createdAt) listData.createdAt = new Date().toISOString();
        if (!listData.status) listData.status = 'imported';
        if (!listData.dealIds) listData.dealIds = [];
        if (!listData.stats) listData.stats = { total: 0, skipTraced: 0, cadenceStarted: 0, cadenceCompleted: 0, interested: 0, dead: 0 };
        const idx = lists.findIndex(l => l.id === listData.id);
        if (idx >= 0) { lists[idx] = listData; } else { lists.unshift(listData); }
        this.saveLists(lists);
        return listData;
    },

    deleteList(id) {
        this.saveLists(this.getLists().filter(l => l.id !== id));
    },

    getListDeals(listId) {
        const list = this.getList(listId);
        if (!list) return [];
        const deals = this.getDeals();
        return list.dealIds.map(did => deals.find(d => d.id === did)).filter(Boolean);
    },

    recalcListStats(listId) {
        const list = this.getList(listId);
        if (!list) return;
        const deals = this.getListDeals(listId);
        const cadences = this.getCadences().filter(c => c.listId === listId);
        list.stats = {
            total: deals.length,
            skipTraced: deals.filter(d => d.skipTraced).length,
            cadenceStarted: cadences.filter(c => c.status !== 'pending').length,
            cadenceCompleted: cadences.filter(c => c.status === 'completed').length,
            interested: cadences.filter(c => c.status === 'responded').length,
            dead: cadences.filter(c => c.status === 'dead').length
        };
        this.saveList(list);
        return list;
    },

    // ========================================
    // CADENCES
    // ========================================
    getCadences() {
        return JSON.parse(localStorage.getItem(CADENCES_KEY) || '[]');
    },

    saveCadences(cadences) {
        localStorage.setItem(CADENCES_KEY, JSON.stringify(cadences));
    },

    getCadence(id) {
        return this.getCadences().find(c => c.id === id);
    },

    getCadenceByDeal(dealId) {
        return this.getCadences().find(c => c.dealId === dealId && c.status === 'active');
    },

    saveCadence(cadenceData) {
        const cadences = this.getCadences();
        if (!cadenceData.id) cadenceData.id = Date.now();
        if (!cadenceData.touches) cadenceData.touches = [];
        if (!cadenceData.status) cadenceData.status = 'active';
        const idx = cadences.findIndex(c => c.id === cadenceData.id);
        if (idx >= 0) { cadences[idx] = cadenceData; } else { cadences.unshift(cadenceData); }
        this.saveCadences(cadences);
        return cadenceData;
    },

    startCadence(dealId, listId) {
        const now = new Date();
        const cadence = this.saveCadence({
            dealId,
            listId: listId || null,
            status: 'active',
            startedAt: now.toISOString(),
            currentStep: 0,
            touches: [],
            nextTouchDate: now.toISOString().split('T')[0],
            nextTouchType: 'call+text',
            completedAt: null,
            exitReason: null
        });
        const deal = this.getDeal(dealId);
        if (deal) { deal.cadenceId = cadence.id; this.saveDeal(deal); }
        return cadence;
    },

    logCadenceTouch(cadenceId, touchData) {
        const cadence = this.getCadence(cadenceId);
        if (!cadence || cadence.status !== 'active') return null;

        const step = CADENCE_STEPS[cadence.currentStep];
        cadence.touches.push({
            step: cadence.currentStep,
            type: touchData.type,
            scheduledDate: cadence.nextTouchDate,
            completedAt: new Date().toISOString(),
            outcome: touchData.outcome || 'no_answer',
            notes: touchData.notes || ''
        });

        // Check if all required types for this step are done
        const touchesForStep = cadence.touches.filter(t => t.step === cadence.currentStep);
        const completedTypes = new Set(touchesForStep.map(t => t.type));
        const stepComplete = step.types.every(t => completedTypes.has(t));

        if (stepComplete) {
            if (touchData.outcome === 'interested') {
                cadence.status = 'responded';
                cadence.exitReason = 'responded_interested';
                cadence.completedAt = new Date().toISOString();
            } else if (touchData.outcome === 'not_interested') {
                cadence.status = 'dead';
                cadence.exitReason = 'marked_dead';
                cadence.completedAt = new Date().toISOString();
            } else if (cadence.currentStep >= CADENCE_STEPS.length - 1) {
                cadence.status = 'completed';
                cadence.exitReason = 'cadence_exhausted';
                cadence.completedAt = new Date().toISOString();
            } else {
                cadence.currentStep += 1;
                const nextStep = CADENCE_STEPS[cadence.currentStep];
                const startDate = new Date(cadence.startedAt);
                const nextDate = new Date(startDate);
                nextDate.setDate(nextDate.getDate() + nextStep.day - 1);
                cadence.nextTouchDate = nextDate.toISOString().split('T')[0];
                cadence.nextTouchType = nextStep.types.join('+');
            }
        }

        this.saveCadence(cadence);

        // Also log to deal timeline
        this.addLogToDeal(cadence.dealId, {
            type: touchData.type,
            direction: 'outbound',
            text: `[Cadence Step ${cadence.currentStep + 1}/${CADENCE_STEPS.length}] ${touchData.notes || touchData.outcome}`,
            outcome: touchData.outcome
        });

        // Recalc list stats if linked
        if (cadence.listId) this.recalcListStats(cadence.listId);

        return cadence;
    },

    exitCadence(cadenceId, reason) {
        const cadence = this.getCadence(cadenceId);
        if (!cadence) return null;
        cadence.status = reason === 'responded_interested' ? 'responded' : 'dead';
        cadence.exitReason = reason;
        cadence.completedAt = new Date().toISOString();
        this.saveCadence(cadence);
        if (cadence.listId) this.recalcListStats(cadence.listId);
        return cadence;
    },

    getDueCadences() {
        const today = new Date().toISOString().split('T')[0];
        return this.getCadences().filter(c => c.status === 'active' && c.nextTouchDate <= today);
    },

    getUpcomingCadences(days) {
        days = days || 7;
        const today = new Date();
        const future = new Date(today);
        future.setDate(future.getDate() + days);
        const todayStr = today.toISOString().split('T')[0];
        const futureStr = future.toISOString().split('T')[0];
        return this.getCadences().filter(c => c.status === 'active' && c.nextTouchDate > todayStr && c.nextTouchDate <= futureStr);
    },

    startCadencesForList(listId) {
        const list = this.getList(listId);
        if (!list) return 0;
        const deals = this.getListDeals(listId);
        let started = 0;
        deals.forEach(deal => {
            if (!deal.skipTraced) return;
            const existing = this.getCadenceByDeal(deal.id);
            if (existing) return;
            this.startCadence(deal.id, listId);
            started++;
        });
        list.status = 'active';
        this.saveList(list);
        this.recalcListStats(listId);
        return started;
    },

    // ========================================
    // LIST-BASED IMPORT
    // ========================================
    addDealsToList(rows, listId) {
        const deals = this.getDeals();
        const existingAddresses = new Set(deals.map(d => (d.propertyAddress || '').toLowerCase().trim()));
        let imported = 0;
        let skipped = 0;
        const newDealIds = [];

        rows.forEach(row => {
            const address = (row.address || '').trim();
            if (!address) { skipped++; return; }
            if (existingAddresses.has(address.toLowerCase())) { skipped++; return; }

            const contacts = [];
            if (row.ownerName) {
                contacts.push({ name: row.ownerName, role: 'seller', phone: row.ownerPhone || '', email: row.ownerEmail || '' });
            }
            if (row.agentName) {
                contacts.push({ name: row.agentName, role: 'agent', phone: row.agentPhone || '', email: row.agentEmail || '' });
            }

            const hasSkipData = !!(row.ownerName && row.ownerPhone);

            const dealData = {
                id: Date.now() + imported,
                propertyAddress: address,
                status: 'lead',
                contacts,
                timeline: [{ type: 'system', text: 'Imported via lead list', timestamp: new Date().toISOString() }],
                savedAt: new Date().toISOString(),
                source: row.source || 'import',
                listId: listId || null,
                skipTraced: hasSkipData,
                cadenceId: null
            };

            deals.unshift(dealData);
            existingAddresses.add(address.toLowerCase());
            newDealIds.push(dealData.id);
            imported++;

            contacts.forEach(c => { if (c.name) this.syncContactToGlobal(c, dealData.id); });
        });

        this.saveDeals(deals);

        if (listId) {
            const list = this.getList(listId);
            if (list) {
                list.dealIds = [...list.dealIds, ...newDealIds];
                list.stats.total = list.dealIds.length;
                list.stats.skipTraced = this.getListDeals(listId).filter(d => d.skipTraced).length;
                this.saveList(list);
            }
        }

        return { imported, skipped, dealIds: newDealIds };
    },

    // ========================================
    // OUTREACH ANALYTICS
    // ========================================
    getOutreachAnalytics(days) {
        const cadences = this.getCadences();
        const lists = this.getLists();
        const deals = this.getDeals();

        const allTouches = cadences.flatMap(c => c.touches);

        // Filter by date range if specified
        let filteredTouches = allTouches;
        if (days && days !== 'all') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            const cutoffStr = cutoff.toISOString();
            filteredTouches = allTouches.filter(t => t.completedAt && t.completedAt >= cutoffStr);
        }

        const calls = filteredTouches.filter(t => t.type === 'call');
        const texts = filteredTouches.filter(t => t.type === 'text');
        const connected = filteredTouches.filter(t => t.outcome === 'connected' || t.outcome === 'interested');

        // Pipeline funnel (all time)
        const totalImported = deals.filter(d => d.listId).length;
        const totalSkipTraced = deals.filter(d => d.listId && d.skipTraced).length;
        const totalContacted = cadences.filter(c => c.touches.length > 0).length;
        const totalInterested = cadences.filter(c => c.status === 'responded').length;
        const totalOfferSent = deals.filter(d => d.listId && ['offer_sent', 'under_contract', 'closed'].includes(d.status)).length;
        const totalClosed = deals.filter(d => d.listId && d.status === 'closed').length;

        const responseRate = totalContacted > 0 ? Math.round((connected.length / totalContacted) * 100) : 0;
        const activeCadences = cadences.filter(c => c.status === 'active').length;

        // Per-list breakdown
        const listBreakdowns = lists.map(list => {
            const lc = cadences.filter(c => c.listId === list.id);
            const ld = this.getListDeals(list.id);
            return {
                listId: list.id, listName: list.name, source: list.source,
                total: ld.length,
                skipTraced: ld.filter(d => d.skipTraced).length,
                contacted: lc.filter(c => c.touches.length > 0).length,
                interested: lc.filter(c => c.status === 'responded').length,
                dead: lc.filter(c => c.status === 'dead').length,
                active: lc.filter(c => c.status === 'active').length
            };
        });

        // Activity by day (last 30 days)
        const activityByDate = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayTouches = allTouches.filter(t => t.completedAt && t.completedAt.startsWith(dateStr));
            activityByDate.push({
                date: dateStr,
                calls: dayTouches.filter(t => t.type === 'call').length,
                texts: dayTouches.filter(t => t.type === 'text').length
            });
        }

        return {
            activity: { totalCalls: calls.length, totalTexts: texts.length, totalConnected: connected.length, responseRate },
            pipeline: { totalImported, totalSkipTraced, totalContacted, totalInterested, totalOfferSent, totalClosed },
            cadences: { active: activeCadences, total: cadences.length },
            listBreakdowns,
            activityByDate
        };
    },

    // CSV Import with dedup
    importDealsFromCSV(rows, columnMap) {
        const deals = this.getDeals();
        const existingAddresses = new Set(deals.map(d => (d.propertyAddress || '').toLowerCase().trim()));
        let imported = 0;
        let skipped = 0;

        rows.forEach(row => {
            const address = (row[columnMap.address] || '').trim();
            if (!address) { skipped++; return; }
            if (existingAddresses.has(address.toLowerCase())) { skipped++; return; }

            const dealData = {
                id: Date.now() + imported,
                propertyAddress: address,
                status: 'lead',
                contacts: [],
                timeline: [{
                    type: 'system',
                    text: 'Imported via CSV bulk upload',
                    timestamp: new Date().toISOString()
                }],
                savedAt: new Date().toISOString()
            };

            // Map optional columns
            if (columnMap.sellerName && row[columnMap.sellerName]) dealData.sellerName = row[columnMap.sellerName];
            if (columnMap.phone && row[columnMap.phone]) dealData.sellerPhone = row[columnMap.phone];
            if (columnMap.arv && row[columnMap.arv]) dealData.arv = row[columnMap.arv];
            if (columnMap.source && row[columnMap.source]) dealData.source = row[columnMap.source];

            deals.unshift(dealData);
            existingAddresses.add(address.toLowerCase());
            imported++;
        });

        this.saveDeals(deals);
        return { imported, skipped };
    }
};
