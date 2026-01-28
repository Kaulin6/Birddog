/**
 * ui.js
 * Shared UI utilities
 */

export const UI = {
    formatCurrency(num) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(num);
    },

    formatNumber(num) {
        if (num === undefined || num === null || isNaN(num)) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    parseInput(elementOrValue) {
        const val = typeof elementOrValue === 'object' ? elementOrValue.value : elementOrValue;
        if (!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '')) || 0;
    },

    // Helper to toggle visibility
    show(element) {
        if (element) element.classList.remove('hidden');
    },

    hide(element) {
        if (element) element.classList.add('hidden');
    },

    // Helper to attach number formatter to inputs
    attachNumberFormatter(element) {
        if (!element) return;

        element.addEventListener('blur', () => {
            const val = this.parseInput(element);
            if (val !== 0 || element.value !== '') {
                element.value = this.formatNumber(val);
            }
        });

        element.addEventListener('focus', () => {
            const val = this.parseInput(element);
            if (val !== 0 || element.value !== '') {
                element.value = val.toString();
            }
        });
    },

    setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    setVal(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    },

    lockField(id) {
        const el = document.getElementById(id);
        if (el) {
            el.readOnly = true;
            el.style.backgroundColor = 'rgba(255,255,255,0.1)';
            el.style.color = 'var(--text-disabled)';
            el.style.cursor = 'not-allowed';
        }
    },

    initAccordions() {
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const item = header.parentElement;
                const isOpen = item.classList.contains('open');

                item.classList.toggle('open');

                const toggle = header.querySelector('.accordion-toggle');
                if (toggle) {
                    toggle.textContent = isOpen ? '+' : '−';
                }
            });
        });
    }
};
