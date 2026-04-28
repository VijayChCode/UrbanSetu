import crypto from 'crypto';

/**
 * Generates a unique SHA-256 hash for a rental agreement to ensure immutability.
 * This hash acts as a digital fingerprint of the contract terms.
 * 
 * @param {Object} contractData - The contract data to hash
 * @returns {string} - Hex string of the SHA-256 hash
 */
export const generateAgreementHash = (contractData) => {
    // We pick the most critical immutable fields to create the fingerprint
    const criticalData = {
        contractId: contractData.contractId,
        tenantId: contractData.tenantId?.toString() || contractData.tenantId,
        landlordId: contractData.landlordId?.toString() || contractData.landlordId,
        listingId: contractData.listingId?.toString() || contractData.listingId,
        startDate: new Date(contractData.startDate).toISOString(),
        endDate: new Date(contractData.endDate).toISOString(),
        rentAmount: contractData.lockedRentAmount,
        securityDeposit: contractData.securityDeposit,
        customClauses: contractData.customClauses || [],
        // We include the signature timestamps to lock the execution time
        tenantSignedAt: contractData.tenantSignature?.signedAt,
        landlordSignedAt: contractData.landlordSignature?.signedAt
    };

    const dataString = JSON.stringify(criticalData);
    return crypto.createHash('sha256').update(dataString).digest('hex');
};

/**
 * Simulates an on-chain transaction hash for the agreement proof.
 * In a real production environment, this would be the actual Polygon/Ethereum TX hash.
 * 
 * @returns {string} - A simulated 66-character hex string (0x...)
 */
export const simulateOnChainTxHash = () => {
    return '0x' + crypto.randomBytes(32).toString('hex');
};
