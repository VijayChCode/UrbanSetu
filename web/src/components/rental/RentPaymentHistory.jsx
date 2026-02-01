import React, { useState, useMemo } from "react";
import { FaHistory, FaDownload, FaFilter, FaSearch, FaCheckCircle, FaTimesCircle, FaClock, FaExclamationTriangle, FaFileExcel, FaFilePdf } from "react-icons/fa";
import { toast } from 'react-toastify';
import jsPDF from 'jspdf';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function RentPaymentHistory({ wallet, contract }) {
  // No status filter needed as we only show completed payments
  const [searchTerm, setSearchTerm] = useState('');

  const payments = useMemo(() => {
    if (!wallet?.paymentSchedule) return [];

    // Only show completed/paid payments in history
    let filtered = wallet.paymentSchedule.filter(p => p.status === 'completed' || p.status === 'paid');

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        const dateStr = new Date(p.dueDate).toLocaleDateString('en-GB').toLowerCase();
        const amountStr = p.amount.toString();
        const statusStr = p.status.toLowerCase();
        return dateStr.includes(term) || amountStr.includes(term) || statusStr.includes(term);
      });
    }

    return filtered.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate)); // Show most recent first in history
  }, [wallet, searchTerm]);

  const getStatusIcon = (payment) => {
    switch (payment.status) {
      case 'completed':
      case 'paid':
        return <FaCheckCircle className="text-green-600" />;
      case 'failed':
        return <FaTimesCircle className="text-red-600" />;
      case 'overdue':
        return <FaExclamationTriangle className="text-red-600" />;
      case 'processing':
        return <FaClock className="text-blue-600 animate-pulse" />;
      default:
        return <FaClock className="text-gray-400" />;
    }
  };

  const getStatusColor = (payment) => {
    switch (payment.status) {
      case 'completed':
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'overdue':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
    }
  };

  const handleDownloadReceipt = async (payment) => {
    if (!payment.paymentId) {
      toast.warning("Receipt not available for this payment.");
      return;
    }

    try {
      const receiptId = typeof payment.paymentId === 'object'
        ? payment.paymentId.paymentId
        : payment.paymentId;

      if (!receiptId) {
        toast.error("Receipt ID missing.");
        return;
      }

      const receiptUrl = `${API_BASE_URL}/api/payments/${receiptId}/receipt`;
      window.open(receiptUrl, '_blank');
    } catch (error) {
      console.error("Error downloading receipt:", error);
      toast.error("Failed to download receipt.");
    }
  };

  const exportToCSV = () => {
    try {
      if (!payments || payments.length === 0) {
        toast.warning("No payments to export.");
        return;
      }

      // Prepare CSV headers
      const headers = ['Date', 'Due Date', 'Amount (₹)', 'Penalty (₹)', 'Total (₹)', 'Status', 'Paid Date', 'Payment ID', 'Remarks'];

      // Prepare CSV rows
      const rows = payments.map(payment => {
        const dueDate = new Date(payment.dueDate);
        const paidDate = payment.paidAt ? new Date(payment.paidAt) : null;

        return [
          dueDate.toLocaleDateString('en-GB'),
          dueDate.toLocaleDateString('en-GB'),
          payment.amount.toFixed(2),
          (payment.penaltyAmount || 0).toFixed(2),
          (payment.amount + (payment.penaltyAmount || 0)).toFixed(2),
          payment.status,
          paidDate ? paidDate.toLocaleDateString('en-GB') + ' ' + paidDate.toLocaleTimeString('en-GB') : '',
          typeof payment.paymentId === 'object' ? (payment.paymentId?.paymentId || '') : (payment.paymentId || ''),
          payment.remarks || ''
        ];
      });

      // Escape CSV values
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      // Build CSV content
      const csvContent = [
        headers.map(escapeCSV).join(','),
        ...rows.map(row => row.map(escapeCSV).join(','))
      ].join('\n');

      // Add BOM for UTF-8 Excel compatibility
      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      const contractIdStr = contract?.contractId || contract?._id || 'rent-wallet';
      const fileName = `rent_payment_history_${contractIdStr}_${new Date().toISOString().split('T')[0]}.csv`;
      link.download = fileName;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Payment history exported to CSV successfully!");
    } catch (error) {
      console.error("Error exporting to CSV:", error);
      toast.error("Failed to export payment history to CSV.");
    }
  };

  const exportToPDF = () => {
    try {
      if (!payments || payments.length === 0) {
        toast.warning("No payments to export.");
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Helper function to add a new page if needed
      const checkPageBreak = (requiredHeight) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Rent Payment History', margin, yPosition);
      yPosition += 10;

      // Contract information
      if (contract) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const contractInfo = `Contract ID: ${contract.contractId || contract._id || 'N/A'}`;
        if (contract.listingId?.name) {
          doc.text(`Property: ${contract.listingId.name}`, margin, yPosition);
          yPosition += 6;
        }
        doc.text(contractInfo, margin, yPosition);
        yPosition += 6;

        const exportDate = `Exported on: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB')}`;
        doc.text(exportDate, margin, yPosition);
        yPosition += 10;
      }

      // Statistics
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', margin, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Payments: ${stats.total}`, margin, yPosition);
      yPosition += 6;
      doc.text(`Completed: ${stats.completed}`, margin, yPosition);
      yPosition += 6;
      doc.text(`Pending: ${stats.pending}`, margin, yPosition);
      yPosition += 6;
      doc.text(`Total Paid: ₹${stats.totalPaid.toLocaleString('en-IN')}`, margin, yPosition);
      yPosition += 6;
      doc.text(`Total Due: ₹${stats.totalDue.toLocaleString('en-IN')}`, margin, yPosition);
      yPosition += 10;

      // Table header
      checkPageBreak(10);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment Details', margin, yPosition);
      yPosition += 8;

      // Table headers
      const colWidths = [25, 25, 25, 25, 25, 25, 40];
      const headers = ['Date', 'Amount', 'Penalty', 'Total', 'Status', 'Paid Date', 'Payment ID'];
      let xPosition = margin;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      headers.forEach((header, index) => {
        doc.text(header, xPosition, yPosition);
        xPosition += colWidths[index];
      });
      yPosition += 6;

      // Table rows
      doc.setFont('helvetica', 'normal');
      payments.forEach((payment) => {
        checkPageBreak(20);

        const dueDate = new Date(payment.dueDate);
        const paidDate = payment.paidAt ? new Date(payment.paidAt) : null;
        const maintenance = contract?.maintenanceCharges || 0;
        const amount = payment.amount.toFixed(2);
        const penalty = (payment.penaltyAmount || 0).toFixed(2);
        const total = (payment.amount + (payment.penaltyAmount || 0) + maintenance).toFixed(2);
        const status = payment.status.charAt(0).toUpperCase() + payment.status.slice(1);
        const paidDateStr = paidDate ? paidDate.toLocaleDateString('en-GB') : '-';
        const paymentId = typeof payment.paymentId === 'object' ? (payment.paymentId?.paymentId || '-') : (payment.paymentId || '-');

        xPosition = margin;
        const rowData = [
          dueDate.toLocaleDateString('en-GB'),
          `₹${amount}`,
          `₹${penalty}`,
          `₹${total}`,
          status,
          paidDateStr,
          paymentId.substring(0, 10) + (paymentId.length > 10 ? '...' : '')
        ];

        doc.setFontSize(7);
        rowData.forEach((cell, colIndex) => {
          const text = doc.splitTextToSize(String(cell), colWidths[colIndex] - 2);
          doc.text(text, xPosition, yPosition);
          xPosition += colWidths[colIndex];
        });
        yPosition += 6;

        // Add remarks if present
        if (payment.remarks) {
          checkPageBreak(8);
          doc.setFontSize(6);
          doc.setTextColor(128, 128, 128);
          const remarks = doc.splitTextToSize(`Note: ${payment.remarks}`, pageWidth - 2 * margin);
          doc.text(remarks, margin + 5, yPosition);
          yPosition += remarks.length * 3;
          doc.setTextColor(0, 0, 0);
        }

        yPosition += 2;
      });

      // Save PDF
      const contractIdStr = contract?.contractId || contract?._id || 'rent-wallet';
      const fileName = `rent_payment_history_${contractIdStr}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      toast.success("Payment history exported to PDF successfully!");
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast.error("Failed to export payment history to PDF.");
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    if (!wallet?.paymentSchedule) return { total: 0, completed: 0, pending: 0, totalPaid: 0, totalDue: 0 };

    const completed = wallet.paymentSchedule.filter(p => p.status === 'completed' || p.status === 'paid');
    const pending = wallet.paymentSchedule.filter(p => p.status === 'pending' || p.status === 'overdue');
    const maintenance = contract?.maintenanceCharges || 0;

    return {
      total: wallet.paymentSchedule.length,
      completed: completed.length,
      pending: pending.length,
      totalPaid: completed.reduce((sum, p) => sum + p.amount + (p.penaltyAmount || 0) + maintenance, 0),
      totalDue: pending.reduce((sum, p) => sum + p.amount + (p.penaltyAmount || 0) + maintenance, 0)
    };
  }, [wallet, contract]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-6">
        <FaHistory className="inline mr-2" />
        Payment History
      </h2>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Completed Payments</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Rent Paid</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ₹{stats.totalPaid.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        {/* Status Filter */}

        {/* Search */}
        <div className="w-full">
          <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">
            <FaSearch className="inline mr-2" />
            Search
          </label>
          <input
            type="text"
            placeholder="Search by date, amount, status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
          />
        </div>
      </div>

      {/* Payment List */}
      <div className="space-y-3">
        {payments.length > 0 ? (
          payments.map((payment, index) => {
            const dueDate = new Date(payment.dueDate);
            const isOverdue = payment.status === 'pending' && dueDate < new Date();
            const maintenance = contract?.maintenanceCharges || 0;

            return (
              <div
                key={index}
                className={`border-2 rounded-lg p-4 transition ${getStatusColor(payment)}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 flex-1 w-full">
                    <div className="text-2xl flex-shrink-0">
                      {getStatusIcon(payment)}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="font-semibold text-lg dark:text-gray-200">
                          {dueDate.toLocaleDateString('en-GB', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                        <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${getStatusColor(payment)}`}>
                          {payment.status}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-1 bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-xs font-semibold rounded">
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="text-sm space-y-1 text-gray-800 dark:text-gray-300">
                        {payment.paidAt && (
                          <p>
                            Paid: <span className="font-semibold">
                              {new Date(payment.paidAt).toLocaleDateString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </p>
                        )}
                        {payment.remarks && (
                          <p className="text-gray-600 dark:text-gray-400">Note: {payment.remarks}</p>
                        )}
                        {payment.paymentId && (
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Payment ID: {typeof payment.paymentId === 'object' ? payment.paymentId.paymentId : payment.paymentId}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4">
                    <div className="text-left md:text-right text-gray-800 dark:text-gray-200">
                      <p className="text-xl font-bold mb-1">
                        ₹{payment.amount.toLocaleString('en-IN')}
                      </p>
                      {maintenance > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          + Maintenance: ₹{maintenance.toLocaleString('en-IN')}
                        </p>
                      )}
                      {payment.penaltyAmount > 0 && (
                        <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                          Penalty: ₹{payment.penaltyAmount.toLocaleString('en-IN')}
                        </p>
                      )}
                      <p className="text-lg font-semibold">
                        Total: ₹{(payment.amount + (payment.penaltyAmount || 0) + (maintenance || 0)).toLocaleString('en-IN')}
                      </p>
                    </div>
                    {payment.status === 'completed' && (
                      <button
                        onClick={() => handleDownloadReceipt(payment)}
                        className="w-full md:w-auto px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold transition flex items-center justify-center gap-2"
                      >
                        <FaDownload />
                        Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <FaHistory className="text-6xl text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No payments found.</p>
          </div>
        )}
      </div>

      {/* Export Buttons */}
      {payments.length > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <button
            onClick={exportToCSV}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition flex items-center gap-2"
            title="Export to Excel (CSV)"
          >
            <FaFileExcel />
            Export to Excel
          </button>
          <button
            onClick={exportToPDF}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold transition flex items-center gap-2"
            title="Export to PDF"
          >
            <FaFilePdf />
            Export to PDF
          </button>
        </div>
      )}
    </div>
  );
}

