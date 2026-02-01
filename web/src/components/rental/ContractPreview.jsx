import React from 'react';
import { FaDownload, FaFileContract, FaCalendarAlt, FaMoneyBillWave, FaLock, FaHome, FaCheckCircle } from 'react-icons/fa';
import { authenticatedFetch } from '../../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ContractPreview({ contract, listing, tenant, landlord, onDownload }) {
  if (!contract) return null;

  const handleDownload = async () => {
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/api/rental/contracts/${contract.contractId || contract._id}/download`);

      if (!response.ok) {
        throw new Error('Failed to download contract');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rent_contract_${contract.contractId || contract._id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      if (onDownload) {
        onDownload();
      }
    } catch (error) {
      console.error('Error downloading contract:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
          <FaFileContract /> Contract Details
        </h2>
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <FaDownload /> Download PDF
        </button>
      </div>

      <div className="space-y-6">
        {/* Contract ID */}
        {/* Contract ID */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">Contract ID</p>
          <p className="font-mono font-semibold text-lg text-gray-800 dark:text-white">{contract.contractId || contract._id}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Status: <span className={`font-semibold ${contract.status === 'active' ? 'text-green-600 dark:text-green-400' :
              contract.status === 'pending_signature' ? 'text-yellow-600 dark:text-yellow-400' :
                contract.status === 'draft' ? 'text-gray-600 dark:text-gray-400' :
                  'text-red-600 dark:text-red-400'
              }`}>
              {contract.status?.replace('_', ' ').toUpperCase()}
            </span>
          </p>
        </div>

        {/* Property Details */}
        {listing && (
          <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-gray-800 dark:text-white">
              <FaHome className="text-blue-600 dark:text-blue-400" /> Property Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">Property Name</p>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{listing.name || 'N/A'}</p>
              </div>
              {listing.address && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Address</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{listing.address}</p>
                </div>
              )}
              {(listing.city || listing.state) && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Location</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{listing.city || ''}{listing.city && listing.state ? ', ' : ''}{listing.state || ''}</p>
                </div>
              )}
              {listing.bedrooms && (
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Bedrooms</p>
                  <p className="font-semibold text-gray-800 dark:text-gray-200">{listing.bedrooms} BHK</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Parties */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600">
          <h3 className="font-semibold text-lg mb-3 text-gray-800 dark:text-white">Parties</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-1">Landlord</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">{landlord?.username || landlord?.email || 'N/A'}</p>
              {landlord?.email && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{landlord.email}</p>
              )}
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400 mb-1">Tenant</p>
              <p className="font-semibold text-gray-800 dark:text-gray-200">{tenant?.username || tenant?.email || 'N/A'}</p>
              {tenant?.email && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{tenant.email}</p>
              )}
            </div>
          </div>
        </div>

        {/* Financial Terms */}
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-gray-800 dark:text-white">
            <FaMoneyBillWave className="text-green-600 dark:text-green-400" /> Financial Terms
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Monthly Rent (Locked)</p>
              <p className="font-semibold text-lg text-gray-800 dark:text-white">₹{contract.lockedRentAmount?.toLocaleString('en-IN') || contract.rentAmount?.toLocaleString('en-IN') || '0'}</p>
            </div>
            {contract.securityDeposit && (
              <div>
                <p className="text-gray-600 dark:text-gray-400">Security Deposit</p>
                <p className="font-semibold text-lg text-gray-800 dark:text-white">₹{contract.securityDeposit.toLocaleString('en-IN')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Status: {contract.securityDepositPaid ? (
                    <span className="text-green-600 dark:text-green-400 font-semibold">Paid</span>
                  ) : (
                    <span className="text-yellow-600 dark:text-yellow-400 font-semibold">Pending</span>
                  )}
                </p>
              </div>
            )}
            {contract.maintenanceCharges && contract.maintenanceCharges > 0 && (
              <div>
                <p className="text-gray-600 dark:text-gray-400">Maintenance Charges</p>
                <p className="font-semibold text-gray-800 dark:text-white">₹{contract.maintenanceCharges.toLocaleString('en-IN')}/month</p>
              </div>
            )}
            {contract.advanceRent && contract.advanceRent > 0 && (
              <div>
                <p className="text-gray-600 dark:text-gray-400">Advance Rent</p>
                <p className="font-semibold text-gray-800 dark:text-white">{contract.advanceRent} month(s)</p>
              </div>
            )}
          </div>
        </div>

        {/* Rent-Lock Details */}
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-gray-800 dark:text-white">
            <FaLock className="text-purple-600 dark:text-purple-400" /> Rent-Lock Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Lock Duration</p>
              <p className="font-semibold text-lg text-gray-800 dark:text-white">{contract.lockDuration} months</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Payment Frequency</p>
              <p className="font-semibold capitalize text-gray-800 dark:text-white">{contract.paymentFrequency || 'monthly'}</p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Due Date</p>
              <p className="font-semibold text-gray-800 dark:text-white">Day {contract.dueDate || 1} of each month</p>
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-gray-800 dark:text-white">
            <FaCalendarAlt className="text-indigo-600 dark:text-indigo-400" /> Important Dates
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Start Date</p>
              <p className="font-semibold text-gray-800 dark:text-white">
                {contract.startDate ? new Date(contract.startDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                }) : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">End Date</p>
              <p className="font-semibold text-gray-800 dark:text-white">
                {contract.endDate ? new Date(contract.endDate).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                }) : 'N/A'}
              </p>
            </div>
            {contract.moveInDate && (
              <div>
                <p className="text-gray-600 dark:text-gray-400">Move-In Date</p>
                <p className="font-semibold text-gray-800 dark:text-white">
                  {new Date(contract.moveInDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Terms */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h3 className="font-semibold text-lg mb-3 text-gray-800 dark:text-white">Payment Terms</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li>Rent must be paid on or before day {contract.dueDate || 1} of each month</li>
            {contract.lateFeePercentage && contract.lateFeePercentage > 0 && (
              <li>Late payment fee: {contract.lateFeePercentage}% of rent amount per day of delay</li>
            )}
            <li>All payments will be processed through UrbanSetu platform via escrow system</li>
            <li>Rent remains fixed at ₹{contract.lockedRentAmount?.toLocaleString('en-IN') || contract.rentAmount?.toLocaleString('en-IN') || '0'}/month for the entire {contract.lockDuration}-month lock period</li>
            {contract.earlyTerminationFee && contract.earlyTerminationFee > 0 && (
              <li>Early termination fee: ₹{contract.earlyTerminationFee.toLocaleString('en-IN')} if contract is terminated before end date</li>
            )}
          </ul>
        </div>

        {/* Custom Clauses (AI Drafted) */}
        {contract.customClauses && contract.customClauses.length > 0 && (
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-gray-800 dark:text-white">
              <FaFileContract className="text-purple-600 dark:text-purple-400" /> Additional Terms & Conditions
            </h3>
            <ul className="list-decimal list-inside space-y-2 text-sm text-gray-800 dark:text-gray-300">
              {contract.customClauses.map((clause, index) => (
                <li key={index} className="pl-2">{clause}</li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 border-t border-purple-200 dark:border-purple-800 pt-2">
              Drafted by SetuAI Legal Assistant
            </p>
          </div>
        )}

        {/* Signatures Status */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border dark:border-gray-600">
          <h3 className="font-semibold text-lg mb-3 text-gray-800 dark:text-white">Signatures Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-600">
              <div className="flex-1">
                <p className="font-semibold text-gray-800 dark:text-white mb-2">Tenant</p>
                {contract.tenantSignature?.signed && (
                  <>
                    {contract.tenantSignature.signatureData && (
                      <div className="mb-2 p-2 bg-white border border-gray-200 rounded max-w-[200px]">
                        <img
                          src={contract.tenantSignature.signatureData}
                          alt="Tenant Signature"
                          className="h-12 object-contain"
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Signed: {new Date(contract.tenantSignature.signedAt).toLocaleDateString('en-GB')}
                    </p>
                  </>
                )}
              </div>
              {contract.tenantSignature?.signed ? (
                <FaCheckCircle className="text-green-600 dark:text-green-400 text-2xl flex-shrink-0 ml-4" />
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400 font-semibold flex-shrink-0 ml-4">Pending</span>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-600">
              <div className="flex-1">
                <p className="font-semibold text-gray-800 dark:text-white mb-2">Landlord</p>
                {contract.landlordSignature?.signed && (
                  <>
                    {contract.landlordSignature.signatureData && (
                      <div className="mb-2 p-2 bg-white border border-gray-200 rounded max-w-[200px]">
                        <img
                          src={contract.landlordSignature.signatureData}
                          alt="Landlord Signature"
                          className="h-12 object-contain"
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Signed: {new Date(contract.landlordSignature.signedAt).toLocaleDateString('en-GB')}
                    </p>
                  </>
                )}
              </div>
              {contract.landlordSignature?.signed ? (
                <FaCheckCircle className="text-green-600 dark:text-green-400 text-2xl flex-shrink-0 ml-4" />
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400 font-semibold flex-shrink-0 ml-4">Pending</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

