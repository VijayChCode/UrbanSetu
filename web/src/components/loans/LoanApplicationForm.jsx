import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { FaUpload, FaCheckCircle, FaFile } from 'react-icons/fa';
import UrbanSetuSpinner from '../UrbanSetuSpinner';
import { authenticatedFetch } from '../../utils/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const LOAN_TYPES = [
  { value: 'security_deposit', label: 'Security Deposit' },
  { value: 'first_month_rent', label: 'First Month Rent' },
  { value: 'maintenance_charges', label: 'Maintenance Charges' }
];

const LOAN_PARTNERS = [
  { value: 'UrbanSetu Finance Partner', label: 'UrbanSetu Finance Partner' },
  { value: 'NBFC Partner 1', label: 'NBFC Partner 1' },
  { value: 'NBFC Partner 2', label: 'NBFC Partner 2' },
  { value: 'Bank Partner 1', label: 'Bank Partner 1' }
];

export default function LoanApplicationForm({ contract, currentUser, onSuccess, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState({});
  const [formData, setFormData] = useState({
    loanType: 'security_deposit',
    loanAmount: 0,
    interestRate: 12, // Default 12% p.a.
    tenure: 12, // Default 12 months
    partnerName: 'UrbanSetu Finance Partner',
    documents: [],
    applicantIncome: '',
    creditScore: ''
  });

  // Calculate suggested loan amount based on contract
  const getSuggestedAmount = () => {
    if (!contract) return 0;

    if (formData.loanType === 'security_deposit') {
      // Security deposit is usually 2-3 months of rent
      const monthlyRent = contract.lockedRentAmount || 0;
      return monthlyRent * 2; // Default to 2 months
    } else if (formData.loanType === 'first_month_rent') {
      return contract.lockedRentAmount || 0;
    } else if (formData.loanType === 'maintenance_charges') {
      // Maintenance charges are usually small, let's suggest 10,000
      return 10000;
    }
    return 0;
  };

  // Calculate EMI preview
  const calculateEMI = () => {
    if (!formData.loanAmount || !formData.interestRate || !formData.tenure) return 0;

    const monthlyRate = formData.interestRate / 100 / 12;
    const months = formData.tenure;
    const principal = formData.loanAmount;

    if (monthlyRate === 0) {
      return principal / months;
    }

    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);

    return Math.round(emi);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'loanAmount' || name === 'interestRate' || name === 'tenure' || name === 'applicantIncome' || name === 'creditScore'
        ? (value === '' ? '' : Number(value))
        : value
    }));
  };

  const handleDocumentUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(prev => ({ ...prev, [type]: true }));

    try {
      const formDataObj = new FormData();
      formDataObj.append('document', file);

      const res = await authenticatedFetch(`${API_BASE_URL}/api/upload/document`, {
        method: 'POST',
        body: formDataObj
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      const documentUrl = data.documentUrl || data.url || data.imageUrl;

      setFormData(prev => ({
        ...prev,
        documents: [...prev.documents, {
          type,
          url: documentUrl
        }]
      }));

      toast.success('Document uploaded successfully');
    } catch (error) {
      toast.error('Failed to upload document');
      console.error(error);
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const removeDocument = (index) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.loanType) {
      toast.error('Please select a loan type');
      return;
    }

    if (!formData.loanAmount || formData.loanAmount <= 0) {
      toast.error('Please enter a valid loan amount');
      return;
    }

    if (!formData.interestRate || formData.interestRate <= 0 || formData.interestRate > 100) {
      toast.error('Please enter a valid interest rate (0-100%)');
      return;
    }

    if (!formData.tenure || formData.tenure < 1 || formData.tenure > 60) {
      toast.error('Please enter a valid tenure (1-60 months)');
      return;
    }

    try {
      setLoading(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/api/rental/loans/${contract._id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanType: formData.loanType,
          loanAmount: formData.loanAmount,
          interestRate: formData.interestRate,
          tenure: formData.tenure,
          partnerName: formData.partnerName,
          documents: formData.documents,
          applicantIncome: formData.applicantIncome || undefined,
          creditScore: formData.creditScore || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Loan application submitted successfully');
        if (onSuccess) onSuccess();
      } else {
        toast.error(data.message || 'Failed to submit loan application');
      }
    } catch (error) {
      console.error('Error submitting loan application:', error);
      toast.error('Failed to submit loan application');
    } finally {
      setLoading(false);
    }
  };

  const emiPreview = calculateEMI();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Contract Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
        <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">{contract.listingId?.name || 'Property'}</h3>
        <p className="text-sm text-blue-700 dark:text-blue-400">Contract ID: {contract.contractId}</p>
        <p className="text-sm text-blue-700 dark:text-blue-400">Monthly Rent: ₹{contract.lockedRentAmount?.toLocaleString()}</p>
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-300">
          <strong className="dark:text-yellow-200">Note:</strong> Please provide accurate information and upload required documents.
          Your loan application will be reviewed by our admin team. Approval typically takes 2-5 business days.
        </p>
      </div>

      {/* Loan Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Loan Type <span className="text-red-500">*</span>
        </label>
        <select
          name="loanType"
          value={formData.loanType}
          onChange={(e) => {
            handleInputChange(e);
            // Auto-fill suggested amount when loan type changes
            const suggested = getSuggestedAmount();
            if (suggested > 0 && formData.loanAmount === 0) {
              setFormData(prev => ({ ...prev, loanAmount: suggested }));
            }
          }}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        >
          {LOAN_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Loan Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Loan Amount (₹) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="loanAmount"
          value={formData.loanAmount || ''}
          onChange={handleInputChange}
          min="0"
          step="1000"
          placeholder={`Suggested: ₹${getSuggestedAmount().toLocaleString()}`}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          required
        />
        <button
          type="button"
          onClick={() => setFormData(prev => ({ ...prev, loanAmount: getSuggestedAmount() }))}
          className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Use Suggested Amount (₹{getSuggestedAmount().toLocaleString()})
        </button>
      </div>

      {/* Interest Rate */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Interest Rate (% p.a.) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="interestRate"
          value={formData.interestRate || ''}
          onChange={handleInputChange}
          min="0"
          max="100"
          step="0.1"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          required
        />
      </div>

      {/* Tenure */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tenure (Months) <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          name="tenure"
          value={formData.tenure || ''}
          onChange={handleInputChange}
          min="1"
          max="60"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          required
        />
      </div>

      {/* EMI Preview */}
      {emiPreview > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 dark:text-green-300 mb-2">EMI Preview</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-green-700 dark:text-green-400/80">Monthly EMI:</span>
              <span className="font-bold text-green-800 dark:text-green-300">₹{emiPreview.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700 dark:text-green-400/80">Total Interest:</span>
              <span className="font-semibold text-green-800 dark:text-green-300">
                ₹{((emiPreview * formData.tenure) - formData.loanAmount).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-700 dark:text-green-400/80">Total Amount:</span>
              <span className="font-semibold text-green-800 dark:text-green-300">
                ₹{(emiPreview * formData.tenure).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 text-xs text-green-700 dark:text-green-400">
            <span className="font-semibold">Penalty Clause:</span> Late payments will attract a penalty of 5% of the EMI amount per month of delay.
          </div>
        </div>
      )}

      {/* Partner Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Finance Partner
        </label>
        <select
          name="partnerName"
          value={formData.partnerName}
          onChange={handleInputChange}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        >
          {LOAN_PARTNERS.map(partner => (
            <option key={partner.value} value={partner.value}>{partner.label}</option>
          ))}
        </select>
      </div>

      {/* Applicant Income (Optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Monthly Income (₹) (Optional)
        </label>
        <input
          type="number"
          name="applicantIncome"
          value={formData.applicantIncome || ''}
          onChange={handleInputChange}
          min="0"
          step="1000"
          placeholder="Enter your monthly income"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
      </div>

      {/* Credit Score (Optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Credit Score (Optional)
        </label>
        <input
          type="number"
          name="creditScore"
          value={formData.creditScore || ''}
          onChange={handleInputChange}
          min="0"
          max="900"
          placeholder="Enter your credit score (300-900)"
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
        />
      </div>

      {/* Documents Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Documents (Optional)
        </label>
        <div className="space-y-3">
          {['identity', 'income', 'bank_statement', 'contract', 'other'].map((docType) => (
            <div key={docType} className="border dark:border-gray-700 rounded-lg p-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 capitalize">
                {docType.replace('_', ' ')} Document
              </label>
              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                {uploading[docType] ? (
                  <UrbanSetuSpinner size="md" />
                ) : (
                  <FaUpload className="text-blue-600" />
                )}
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  {uploading[docType] ? 'Uploading...' : 'Click to upload'}
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={(e) => handleDocumentUpload(e, docType)}
                  disabled={uploading[docType]}
                />
              </label>
            </div>
          ))}
        </div>

        {/* Uploaded Documents */}
        {formData.documents.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Uploaded Documents:</h4>
            {formData.documents.map((doc, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <FaFile className="text-green-600 dark:text-green-400" />
                <span
                  className="flex-1 text-sm text-blue-700 dark:text-blue-400 font-medium capitalize cursor-pointer hover:underline"
                  onClick={() => {
                    const getPreviewType = (url) => {
                      try {
                        const ext = url.split('.').pop().toLowerCase();
                        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
                        return 'document';
                      } catch (e) { return 'document'; }
                    };
                    const type = getPreviewType(doc.url);
                    const previewUrl = `/user/view/preview?url=${encodeURIComponent(doc.url)}&name=${encodeURIComponent((doc.type || 'Document').replace(/_/g, ' '))}&type=${type}`;
                    window.open(previewUrl, '_blank');
                  }}
                  title="Click to view document"
                >
                  {doc.type.replace('_', ' ')}
                </span>
                <button
                  type="button"
                  onClick={() => removeDocument(index)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? <UrbanSetuSpinner size="sm" isBright={true} /> : <FaCheckCircle />}
          {loading ? 'Submitting...' : 'Submit Application'}
        </button>
      </div>
    </form >
  );
}

