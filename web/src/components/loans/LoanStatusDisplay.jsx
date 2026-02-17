import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { FaCheckCircle, FaClock, FaTimesCircle, FaCreditCard, FaFile, FaDownload, FaHome, FaUser, FaMoneyBillWave, FaCalendarAlt } from 'react-icons/fa';
import { authenticatedFetch } from '../../utils/auth';

export default function LoanStatusDisplay({ loan, currentUser, onUpdate, STATUS_COLORS, STATUS_LABELS, LOAN_TYPE_LABELS, onPayEMI }) {
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'rootadmin';
  const contract = loan.contractId;

  const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN') || 0} `;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDownloadDocument = async (docUrl, docName) => {
    try {
      if (!docUrl) return;

      const response = await authenticatedFetch(docUrl, { mode: 'cors' });
      if (!response.ok) throw new Error('Failed to fetch document');

      const contentType = response.headers.get('content-type') || '';
      let extension = 'pdf';

      try {
        const urlPath = docUrl.split('?')[0];
        const lastSegment = urlPath.substring(urlPath.lastIndexOf('/') + 1);
        if (lastSegment.includes('.')) {
          extension = lastSegment.split('.').pop();
        }
      } catch (e) {
        console.warn('URL parsing failed', e);
      }

      if ((!extension || extension === 'file') && contentType && !contentType.includes('octet-stream')) {
        const mimeMap = {
          'application/pdf': 'pdf',
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'application/msword': 'doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
          'text/plain': 'txt'
        };
        extension = mimeMap[contentType.toLowerCase()] || 'pdf';
      }

      const filename = `${docName || 'document'} -${new Date().getTime()}.${extension}`;
      const blob = await response.blob();

      const finalBlob = extension === 'pdf' && contentType.includes('octet-stream')
        ? new Blob([blob], { type: 'application/pdf' })
        : blob;

      const blobUrl = window.URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

    } catch (error) {
      console.error('Error downloading document:', error);
      window.open(docUrl, '_blank');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
      case 'disbursed':
      case 'repaid':
        return <FaCheckCircle className="text-green-600" />;
      case 'pending':
        return <FaClock className="text-yellow-600" />;
      case 'rejected':
        return <FaTimesCircle className="text-red-600" />;
      case 'defaulted':
        return <FaTimesCircle className="text-orange-600" />;
      default:
        return <FaClock className="text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Loan Info */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
          {LOAN_TYPE_LABELS[loan.loanType] || loan.loanType}
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-400 font-mono">Loan ID: {loan.loanId}</p>
        <p className="text-sm text-blue-700 dark:text-blue-400">Applicant: <span className="font-semibold text-blue-800 dark:text-blue-300">{loan.userId?.username || 'N/A'}</span> ({loan.userId?.email || 'N/A'})</p>
        {contract && (
          <>
            <p className="text-sm text-blue-700 dark:text-blue-400">Property: {contract.listingId?.name || 'Unknown'}</p>
            <p className="text-sm text-blue-700 dark:text-blue-400">Contract: {contract.contractId || 'Unknown'}</p>
          </>
        )}
      </div>

      {/* Status Badge */}
      <div className={`p-4 rounded-lg border-2 ${STATUS_COLORS[loan.status] || STATUS_COLORS.pending}`}>
        <div className="flex items-center gap-3">
          {getStatusIcon(loan.status)}
          <div>
            <div className="font-bold text-lg dark:text-gray-200">Status: {STATUS_LABELS[loan.status] || loan.status}</div>
            {loan.approvedAt && (
              <div className="text-sm mt-1 dark:text-gray-300">
                Approved on: {formatDate(loan.approvedAt)}
              </div>
            )}
            {loan.rejectedAt && (
              <div className="text-sm mt-1 dark:text-gray-300">
                Rejected on: {formatDate(loan.rejectedAt)}
              </div>
            )}
            {loan.disbursedAt && (
              <div className="text-sm mt-1 dark:text-gray-300">
                Disbursed on: {formatDate(loan.disbursedAt)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loan Details */}
      <div>
        <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
          <FaCreditCard /> Loan Details
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Loan Amount</p>
            <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(loan.loanAmount)}</p>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">EMI Amount</p>
            <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(loan.emiAmount)}</p>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Interest Rate</p>
            <p className="font-bold text-gray-800 dark:text-gray-200">{loan.interestRate}% p.a.</p>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tenure</p>
            <p className="font-bold text-gray-800 dark:text-gray-200">{loan.tenure} months</p>
          </div>
        </div>
      </div>

      {/* Disbursement Details */}
      {loan.status === 'disbursed' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">Disbursement Details</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-green-700 dark:text-green-400">Disbursed Amount:</span>
              <span className="font-semibold text-green-800 dark:text-green-300">{formatCurrency(loan.disbursedAmount || loan.loanAmount)}</span>
            </div>
            {loan.disbursementReference && (
              <div className="flex justify-between">
                <span className="text-green-700 dark:text-green-400">Reference:</span>
                <span className="font-mono text-green-800 dark:text-green-300">{loan.disbursementReference}</span>
              </div>
            )}
            {loan.totalRemaining > 0 && (
              <div className="flex justify-between">
                <span className="text-green-700 dark:text-green-400">Outstanding:</span>
                <span className="font-semibold text-green-800 dark:text-green-300">{formatCurrency(loan.totalRemaining)}</span>
              </div>
            )}
            {loan.totalPaid > 0 && (
              <div className="flex justify-between">
                <span className="text-green-700 dark:text-green-400">Total Paid:</span>
                <span className="font-semibold text-green-800 dark:text-green-300">{formatCurrency(loan.totalPaid)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Reason */}
      {loan.status === 'rejected' && loan.rejectionReason && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2">Rejection Reason</h4>
          <p className="text-sm text-red-700 dark:text-red-400">{loan.rejectionReason}</p>
        </div>
      )}

      {/* Eligibility Check */}
      {loan.eligibilityCheck && (
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <FaCheckCircle /> Eligibility Check
          </h3>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Eligibility Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${loan.eligibilityCheck.passed ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                }`}>
                {loan.eligibilityCheck.passed ? 'Passed' : 'Pending'}
              </span>
            </div>
            {loan.eligibilityCheck.creditScore && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Credit Score:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{loan.eligibilityCheck.creditScore}</span>
              </div>
            )}
            {loan.eligibilityCheck.eligibilityScore && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Eligibility Score:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{loan.eligibilityCheck.eligibilityScore}/100</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Income Verified:</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${loan.eligibilityCheck.incomeVerified ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                }`}>
                {loan.eligibilityCheck.incomeVerified ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Employment Verified:</span>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${loan.eligibilityCheck.employmentVerified ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                }`}>
                {loan.eligibilityCheck.employmentVerified ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* EMI Schedule */}
      {loan.emiSchedule && loan.emiSchedule.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <FaCalendarAlt /> EMI Schedule
          </h3>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left">Month</th>
                    <th className="px-4 py-2 text-left">Due Date</th>
                    <th className="px-4 py-2 text-right">EMI Amount</th>
                    <th className="px-4 py-2 text-right">Penalty</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800 dark:text-white">
                  {loan.emiSchedule.map((emi, index) => (
                    <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="px-4 py-2">{emi.month}/{emi.year}</td>
                      <td className="px-4 py-2">{formatDate(emi.dueDate)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(loan.emiAmount)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(emi.penaltyAmount || 0)}</td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${emi.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                          emi.status === 'overdue' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                            emi.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                              'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}>
                          {emi.status || 'pending'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {emi.status !== 'completed' && emi.status !== 'processing' && (loan.status === 'approved' || loan.status === 'disbursed') && !isAdmin ? (
                          <button
                            onClick={() => onPayEMI && onPayEMI(emi, index)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors font-medium flex items-center gap-1 mx-auto"
                          >
                            <FaCreditCard className="text-[10px]" /> Pay Now
                          </button>
                        ) : emi.status === 'processing' ? (
                          <span className="text-xs text-blue-600 flex items-center justify-center gap-1">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div> Processing
                          </span>
                        ) : emi.status === 'completed' ? (
                          <span className="text-xs text-green-600 flex items-center justify-center gap-1">
                            <FaCheckCircle /> Paid
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Documents */}
      {loan.documents && loan.documents.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
            <FaFile /> Documents
          </h3>
          <div className="space-y-2">
            {loan.documents.map((doc, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <FaFile className="text-gray-600 dark:text-gray-400" />
                {doc._id ? (
                  <Link
                    to={isAdmin ? `/admin/view/${doc._id}` : `/user/view/${doc._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline capitalize font-medium cursor-pointer"
                  >
                    {doc.type.replace('_', ' ')}
                  </Link>
                ) : (
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 capitalize">{doc.type.replace('_', ' ')}</span>
                )}
                <button
                  onClick={() => handleDownloadDocument(doc.url, doc.type)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center gap-1 cursor-pointer"
                >
                  <FaDownload /> Download
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin Notes */}
      {loan.adminNotes && isAdmin && (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Admin Notes</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300">{loan.adminNotes}</p>
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>Created: {formatDate(loan.createdAt)}</div>
        <div>Last Updated: {formatDate(loan.updatedAt)}</div>
      </div>
    </div>
  );
}

