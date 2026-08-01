// Simple event-based store to bypass React closure scope issues in large files
// This allows triggering modals from anywhere without relying on local state scope

const listeners = new Set();
// Unified state: type can be 'token' | 'complete' | 'dispute' | null
// 'reason' is specific to dispute
let currentState = { type: null, id: null, reason: '' };
let callbacks = { onToken: null, onSale: null, onDispute: null };

export const saleModalStore = {
    // Get current value
    get: () => currentState,

    // Subscribe to changes
    subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },

    // Actions
    openTokenModal: (id) => {
        currentState = { type: 'token', id, reason: '' };
        listeners.forEach(l => l(currentState));
    },

    openSaleModal: (id) => {
        currentState = { type: 'complete', id, reason: '' };
        listeners.forEach(l => l(currentState));
    },

    openDisputeModal: (id) => {
        currentState = { type: 'dispute', id, reason: '' };
        listeners.forEach(l => l(currentState));
    },

    openReopenModal: (id) => {
        currentState = { type: 'reopen', id, reason: '' };
        listeners.forEach(l => l(currentState));
    },

    setDisputeReason: (reason) => {
        if (currentState.type === 'dispute') {
            currentState = { ...currentState, reason };
            listeners.forEach(l => l(currentState));
        }
    },

    close: () => {
        currentState = { type: null, id: null, reason: '' };
        listeners.forEach(l => l(currentState));
    },

    // Teleportation Logic: Register callbacks from Parent to be used by Child
    registerCallbacks: ({ onToken, onSale, onDispute, onReopen }) => {
        callbacks = { onToken, onSale, onDispute, onReopen };
    },

    executeTokenPaid: (id) => {
        if (callbacks.onToken) return callbacks.onToken(id);
    },

    executeSaleComplete: (id) => {
        if (callbacks.onSale) return callbacks.onSale(id);
    },

    executeDisputeSubmit: (id, reason) => {
        if (callbacks.onDispute) return callbacks.onDispute(id, reason);
    },

    executeReopenSale: (id) => {
        if (callbacks.onReopen) return callbacks.onReopen(id);
    }
};
