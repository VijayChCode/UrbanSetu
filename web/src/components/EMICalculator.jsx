import React, { useState, useEffect } from 'react';
import { FaCalculator, FaChartLine, FaMoneyBillWave, FaCalendarAlt, FaPercent } from 'react-icons/fa';

const EMICalculator = ({ propertyPrice = 0, propertyName = "Property" }) => {
  const [loanAmount, setLoanAmount] = useState(propertyPrice * 0.8); // 80% of property price as default
  const [interestRate, setInterestRate] = useState(8.5);
  const [loanTenure, setLoanTenure] = useState(20);
  const [downPayment, setDownPayment] = useState(propertyPrice * 0.2); // 20% down payment
  const [emi, setEmi] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);

  // Calculate EMI whenever inputs change
  useEffect(() => {
    if (loanAmount > 0 && interestRate > 0 && loanTenure > 0) {
      const monthlyRate = interestRate / 12 / 100;
      const months = loanTenure * 12;
      const calculatedEmi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, months)) / 
                           (Math.pow(1 + monthlyRate, months) - 1);
      
      setEmi(Math.round(calculatedEmi));
      setTotalAmount(Math.round(calculatedEmi * months));
      setTotalInterest(Math.round((calculatedEmi * months) - loanAmount));
    }
  }, [loanAmount, interestRate, loanTenure]);

  // Update loan amount when down payment changes
  useEffect(() => {
    setLoanAmount(propertyPrice - downPayment);
  }, [downPayment, propertyPrice]);

  const formatINR = (amount) => {
    return `₹${Number(amount).toLocaleString("en-IN")}`;
  };

  const formatNumber = (num) => {
    return Number(num).toLocaleString("en-IN");
  };

  return (
    <div className="space-y-6">
      {/* Property Info */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 p-4 rounded-lg">
        <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Property Information</h4>
        <p className="text-sm text-gray-650 dark:text-gray-300">Property: {propertyName}</p>
        <p className="text-sm text-gray-650 dark:text-gray-300">Price: {formatINR(propertyPrice)}</p>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Down Payment */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-305">
            <FaMoneyBillWave className="inline mr-1" />
            Down Payment
          </label>
          <input
            type="number"
            value={downPayment}
            onChange={(e) => setDownPayment(Number(e.target.value))}
            className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-905 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter down payment amount"
          />
          <p className="text-xs text-gray-550 dark:text-gray-400">
            {formatINR(downPayment)} ({(downPayment / propertyPrice * 100).toFixed(1)}% of property price)
          </p>
        </div>

        {/* Loan Amount */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-305">
            <FaChartLine className="inline mr-1" />
            Loan Amount
          </label>
          <input
            type="number"
            value={loanAmount}
            onChange={(e) => setLoanAmount(Number(e.target.value))}
            className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-905 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter loan amount"
          />
          <p className="text-xs text-gray-550 dark:text-gray-400">
            {formatINR(loanAmount)} ({(loanAmount / propertyPrice * 100).toFixed(1)}% of property price)
          </p>
        </div>

        {/* Interest Rate */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-305">
            <FaPercent className="inline mr-1" />
            Interest Rate (% per annum)
          </label>
          <input
            type="number"
            step="0.1"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value))}
            className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-905 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter interest rate"
          />
          <p className="text-xs text-gray-550 dark:text-gray-400">Current market rate: 8.5% - 12%</p>
        </div>

        {/* Loan Tenure */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-305">
            <FaCalendarAlt className="inline mr-1" />
            Loan Tenure (years)
          </label>
          <input
            type="number"
            value={loanTenure}
            onChange={(e) => setLoanTenure(Number(e.target.value))}
            className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-905 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter loan tenure"
          />
          <p className="text-xs text-gray-550 dark:text-gray-400">Common tenure: 15-30 years</p>
        </div>
      </div>

      {/* EMI Results */}
      <div className="bg-green-55/60 dark:bg-green-95/20 border border-green-150 dark:border-green-905/30 p-6 rounded-lg">
        <h4 className="font-semibold text-green-800 dark:text-green-400 mb-4 flex items-center gap-2">
          <FaCalculator /> EMI Calculation Results
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-650 dark:text-gray-300 mb-1">Monthly EMI</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatINR(emi)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-650 dark:text-gray-300 mb-1">Total Amount</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatINR(totalAmount)}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-650 dark:text-gray-300 mb-1">Total Interest</p>
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatINR(totalInterest)}</p>
          </div>
        </div>
      </div>

      {/* EMI Breakdown */}
      <div className="bg-gray-50 dark:bg-gray-850/50 border border-gray-200 dark:border-gray-700/50 p-4 rounded-lg">
        <h5 className="font-semibold text-gray-805 dark:text-gray-200 mb-3">EMI Breakdown</h5>
        <div className="space-y-2 text-sm text-gray-650 dark:text-gray-350">
          <div className="flex justify-between">
            <span>Principal Amount:</span>
            <span className="font-medium text-gray-805 dark:text-gray-200">{formatINR(loanAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Interest Amount:</span>
            <span className="font-medium text-gray-805 dark:text-gray-200">{formatINR(totalInterest)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
            <span className="font-semibold text-gray-805 dark:text-gray-200">Total Payment:</span>
            <span className="font-semibold text-gray-905 dark:text-white">{formatINR(totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span>EMI per month:</span>
            <span className="font-semibold text-green-600 dark:text-green-400">{formatINR(emi)}</span>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="bg-yellow-50 dark:bg-amber-955/20 border border-yellow-100 dark:border-amber-900/30 p-4 rounded-lg">
        <h5 className="font-semibold text-yellow-800 dark:text-amber-400 mb-2">Important Notes</h5>
        <ul className="text-sm text-yellow-750 dark:text-amber-300 space-y-1">
          <li>• EMI calculation is approximate and may vary based on bank policies</li>
          <li>• Interest rates may change during loan tenure</li>
          <li>• Additional charges like processing fees, insurance are not included</li>
          <li>• Down payment percentage may vary based on property type and location</li>
          <li>• Consult with your bank for exact EMI calculations</li>
        </ul>
      </div>
    </div>
  );
};

export default EMICalculator;