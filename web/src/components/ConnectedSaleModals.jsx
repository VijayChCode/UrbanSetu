import React, { useState, useEffect } from 'react';
import { saleModalStore } from '../utils/saleModalStore';
import TokenPaidModal from './TokenPaidModal';
import SaleCompleteModal from './SaleCompleteModal';
import ReopenDealModal from './ReopenDealModal';

/**
 * Connected component that listens to the external saleModalStore.
 * It triggers actions via the store's registered callbacks, completely decoupling it
 * from the parent's prop scope.
 */
const ConnectedSaleModals = () => {
    const [state, setState] = useState(saleModalStore.get());

    useEffect(() => {
        return saleModalStore.subscribe((newState) => {
            setState(newState);
        });
    }, []);

    const handleClose = () => {
        saleModalStore.close();
    };

    const handleConfirmToken = () => {
        if (state.id) {
            saleModalStore.executeTokenPaid(state.id);
        }
    };

    const handleConfirmSale = () => {
        if (state.id) {
            saleModalStore.executeSaleComplete(state.id);
        }
    };

    const handleConfirmReopen = () => {
        if (state.id) {
            saleModalStore.executeReopenSale(state.id);
        }
    };

    return (
        <>
            <TokenPaidModal
                isOpen={state.type === 'token'}
                onClose={handleClose}
                onConfirm={handleConfirmToken}
            />
            <SaleCompleteModal
                isOpen={state.type === 'complete'}
                onClose={handleClose}
                onConfirm={handleConfirmSale}
            />
            <ReopenDealModal
                isOpen={state.type === 'reopen'}
                onClose={handleClose}
                onConfirm={handleConfirmReopen}
            />
        </>
    );
};

export default ConnectedSaleModals;
