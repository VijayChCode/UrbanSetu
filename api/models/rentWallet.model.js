import mongoose from "mongoose";

const rentWalletSchema = new mongoose.Schema({
  // Wallet Identification
  walletId: {
    type: String,
    unique: true,
    required: false, // Changed to false - pre-save hook will generate it
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  contractId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RentLockContract',
    required: true,
    unique: true
  },
  
  // Wallet Balance
  currentBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  pendingPayments: {
    type: Number,
    default: 0,
    min: 0
  },
  totalPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  totalDue: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Auto-debit Settings
  autoDebitEnabled: {
    type: Boolean,
    default: false
  },
  autoDebitMethod: {
    type: String,
    enum: ['razorpay', 'paypal', 'bank_account', 'upi'],
    default: null
  },
  autoDebitDay: {
    type: Number, // Day of month for auto-debit
    min: 1,
    max: 31,
    default: 1
  },
  paymentMethodToken: {
    type: String, // Encrypted payment method token
    default: null
  },
  paymentMethodDetails: {
    type: Object, // Stores display info like UPI ID or Card Last 4
    default: null
  },
  
  // Payment Schedule
  paymentSchedule: [{
    month: {
      type: Number, // 1-12
      required: true,
      min: 1,
      max: 12
    },
    year: {
      type: Number,
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    dueDate: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'scheduled', 'processing', 'completed', 'failed', 'overdue'],
      default: 'pending'
    },
    paidAt: Date,
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    },
    penaltyAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    remarks: String,
    reminderSent3Days: {
      type: Boolean,
      default: false
    },
    reminderSent1Day: {
      type: Boolean,
      default: false
    }
  }],
  
  // Notifications
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: Date,
  lastReminderDate: Date, // Track last reminder sent date
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
rentWalletSchema.index({ userId: 1, contractId: 1 });
rentWalletSchema.index({ 'paymentSchedule.dueDate': 1, 'paymentSchedule.status': 1 }); // For querying overdue payments

// Generate walletId before saving
rentWalletSchema.pre('save', async function(next) {
  if (!this.walletId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9).toUpperCase();
    this.walletId = `WALLET-${timestamp}-${random}`;
  }
  this.updatedAt = Date.now();
  next();
});

// Virtual for overdue payments
rentWalletSchema.virtual('overduePayments').get(function() {
  const now = new Date();
  return this.paymentSchedule.filter(payment => 
    payment.status === 'pending' || payment.status === 'overdue' &&
    new Date(payment.dueDate) < now
  );
});

// Virtual for upcoming payments (next 30 days)
rentWalletSchema.virtual('upcomingPayments').get(function() {
  const now = new Date();
  const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return this.paymentSchedule.filter(payment => 
    payment.status === 'pending' &&
    new Date(payment.dueDate) >= now &&
    new Date(payment.dueDate) <= nextMonth
  );
});

// Method to calculate total overdue amount
rentWalletSchema.methods.getTotalOverdue = function() {
  const overdue = this.overduePayments;
  return overdue.reduce((total, payment) => total + payment.amount + (payment.penaltyAmount || 0), 0);
};

// Method to generate payment schedule
rentWalletSchema.methods.generatePaymentSchedule = function(contract) {
  const schedule = [];
  const startDate = new Date(contract.startDate);
  const endDate = new Date(contract.endDate);
  const monthlyRent = contract.lockedRentAmount;
  const maintenanceCharges = contract.maintenanceCharges || 0;
  const totalMonthlyAmount = monthlyRent + maintenanceCharges;
  const dueDay = contract.dueDate;
  
  let currentDate = new Date(startDate);
  let monthIndex = 0;
  
  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    // Create due date for this month
    const dueDate = new Date(year, month - 1, dueDay);
    
    schedule.push({
      month: month,
      year: year,
      amount: totalMonthlyAmount,
      dueDate: dueDate,
      status: 'pending',
      penaltyAmount: 0
    });
    
    // Move to next month
    monthIndex++;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  this.paymentSchedule = schedule;
  this.pendingPayments = schedule.length * totalMonthlyAmount;
  this.totalDue = schedule.length * totalMonthlyAmount;
};

const RentWallet = mongoose.model("RentWallet", rentWalletSchema);

export default RentWallet;

