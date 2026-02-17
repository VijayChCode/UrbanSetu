import RentalLoan from '../models/rentalLoan.model.js';
import RentLockContract from '../models/rentLockContract.model.js';
import User from '../models/user.model.js';
import { sendLoanEMIDueReminderEmail, sendLoanEMIOverdueReminderEmail } from '../utils/emailService.js';

// Helper to format currency
const formatCurrency = (amount) => {
    return `₹${amount?.toLocaleString('en-IN') || 0}`;
};

// Main function to check and send reminders
export const checkAndSendLoanReminders = async () => {
    console.log('🔄 Starting loan reminder check...');
    let stats = {
        upcomingRemindersSent: 0,
        dueRemindersSent: 0,
        overdueRemindersSent: 0,
        errors: 0
    };

    try {
        // 1. Find all active loans (disbursed status)
        // We only care about loans that are active and disbursed
        const loans = await RentalLoan.find({
            status: 'disbursed'
        }).populate({
            path: 'contractId',
            select: 'listingId lateFeePercentage',
            populate: {
                path: 'listingId',
                select: 'name'
            }
        }).populate('userId', 'email username');

        console.log(`Found ${loans.length} active disbursed loans.`);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const loan of loans) {
            if (!loan.userId?.email || !loan.emiSchedule) continue;

            const propertyName = loan.contractId?.listingId?.name || 'Property';
            const loanUrl = `${process.env.CLIENT_URL || 'https://urbansetu.vercel.app'}/user/rental-loans?loanId=${loan._id}`;

            // Iterate through EMI schedule
            for (const emi of loan.emiSchedule) {
                // Skip completed or failed EMIs (unless we want to handle failed specifically, but failed usually goes to overdue)
                if (emi.status === 'completed') continue;

                const dueDate = new Date(emi.dueDate);
                dueDate.setHours(0, 0, 0, 0);

                // Calculate difference in days: (dueDate - today)
                // Positive = Due in future
                // Zero = Due today
                // Negative = Overdue
                const diffTime = dueDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Prepare email details
                const emailDetails = {
                    propertyName,
                    loanType: loan.loanType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    amount: formatCurrency(loan.emiAmount),
                    dueDate: new Date(emi.dueDate).toLocaleDateString('en-IN'),
                    month: `${emi.month}/${emi.year}`,
                    loanUrl,
                    daysOverdue: Math.abs(diffDays),
                    penalty: emi.penaltyAmount || 0,
                    totalAmount: formatCurrency(loan.emiAmount + (emi.penaltyAmount || 0))
                };

                try {
                    // Case 1: Upcoming Reminders (7, 3, 1 days before)
                    if ([7, 3, 1].includes(diffDays)) {
                        await sendLoanEMIDueReminderEmail(loan.userId.email, {
                            ...emailDetails,
                            type: 'upcoming'
                        });
                        stats.upcomingRemindersSent++;
                        console.log(`Sent upcoming reminder for Loan ${loan.loanId}, EMI due in ${diffDays} days.`);
                    }

                    // Case 2: Due Date Reminder (0 days)
                    else if (diffDays === 0) {
                        await sendLoanEMIDueReminderEmail(loan.userId.email, {
                            ...emailDetails,
                            type: 'due_today'
                        });
                        stats.dueRemindersSent++;
                        console.log(`Sent due date reminder for Loan ${loan.loanId}.`);
                    }

                    // Case 3: Overdue Reminders (1, 3, 7, 15, 30 days overdue)
                    else if (diffDays < 0) {
                        const overdueDays = Math.abs(diffDays);
                        const overdueMilestones = [1, 3, 7, 15, 30];

                        // Ensure overdue status and penalties are current
                        await loan.refreshOverdueStatus();

                        // Check if today matches one of the milestones OR every 30 days after first month
                        if (overdueMilestones.includes(overdueDays) || (overdueDays > 30 && overdueDays % 30 === 0)) {
                            // Update details with penalty
                            emailDetails.penalty = formatCurrency(emi.penaltyAmount);
                            emailDetails.totalAmount = formatCurrency(loan.emiAmount + (emi.penaltyAmount || 0));

                            await sendLoanEMIOverdueReminderEmail(loan.userId.email, emailDetails);
                            stats.overdueRemindersSent++;
                            console.log(`Sent overdue reminder for Loan ${loan.loanId}, overdue by ${overdueDays} days.`);
                        }
                    }
                } catch (emailError) {
                    console.error(`Failed to send email for Loan ${loan.loanId}:`, emailError);
                    stats.errors++;
                }
            }

            // Save loan if any EMI status was updated to overdue
            if (loan.isModified()) {
                await loan.save();
            }
        }

    } catch (error) {
        console.error('Error in checkAndSendLoanReminders:', error);
        stats.errors++;
    }

    console.log('✅ Loan reminder check completed.', stats);
    return stats;
};
