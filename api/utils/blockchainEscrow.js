/**
 * Simulates a Smart Escrow locking transaction on the blockchain
 * @param {number} amount - Amount to lock in escrow
 * @returns {Object} - Simulation result with txHash and escrowAddress
 */
export const simulateEscrowLock = (amount) => {
  // Generate a mock transaction hash
  const txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  // Mock escrow contract address
  const escrowAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'; // Example contract address
  
  return {
    success: true,
    txHash,
    escrowAddress,
    amount,
    network: 'polygon',
    timestamp: new Date()
  };
};

/**
 * Simulates a Smart Escrow release transaction
 * @param {string} escrowAddress - The address holding the funds
 * @returns {Object} - Simulation result
 */
export const simulateEscrowRelease = (escrowAddress) => {
  const txHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('');
  
  return {
    success: true,
    txHash,
    escrowAddress,
    status: 'released',
    timestamp: new Date()
  };
};
