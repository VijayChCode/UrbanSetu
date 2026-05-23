
import PDFDocument from 'pdfkit';

/**
 * Generates a PDF receipt for a payment
 * @param {Object} payment - Populated payment object
 * @returns {Promise<Buffer>} - PDF Buffer
 */
export const generateReceiptPdf = (payment) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // --- Header ---
            doc.fillColor('#444444')
                .fontSize(20)
                .text('UrbanSetu', 50, 57)
                .fontSize(10)
                .text('Real Estate Excellence', 50, 80)
                .text('123, Tech Park, Bangalore, India', 200, 65, { align: 'right' })
                .text('urbansetu.noreply@gmail.com', 200, 80, { align: 'right' })
                .moveDown();

            // --- Receipt Title ---
            doc.fillColor('#000000')
                .fontSize(25)
                .text('PAYMENT RECEIPT', 50, 160, { width: 495, align: 'center' });

            // --- Payment Details Box ---
            doc.rect(50, 200, 495, 280).stroke('#cccccc');

            const leftX = 70;
            const rightX = 300;
            let y = 220;
            const invalid = 'N/A';

            // Rows
            const addRow = (label, value) => {
                doc.fontSize(10)
                    .fillColor('#555555')
                    .text(label, leftX, y)
                    .fillColor('#000000')
                    .text(value, rightX, y);
                y += 25;
            };

            addRow('Receipt Number:', payment.receiptNumber || payment._id.toString().slice(-8).toUpperCase());
            addRow('Payment ID:', payment.paymentId || invalid);
            addRow('Payment Date:', new Date(payment.createdAt).toLocaleString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
            }));
            addRow('Payment Status:', (payment.status || 'Completed').toUpperCase());

            // Tenant/Payer
            const tenantName = payment.userId?.username || payment.userId?.firstName || payment.contractId?.tenantId?.username || 'Valued Customer';
            addRow('Paid By:', tenantName);

            // Property
            const propertyName = payment.listingId?.name || payment.appointmentId?.propertyName || payment.contractId?.listingId?.name || 'Property';
            addRow('Property:', propertyName);

            // Purpose (Added)
            if (payment.paymentType === 'emi' || payment.emiDetails) {
                addRow('Purpose:', 'Loan EMI Installment');
            } else if (payment.rentMonth && payment.rentYear) {
                addRow('Purpose:', 'Monthly Rent');
            }

            // Rent/EMI Period
            if (payment.emiDetails?.month && payment.emiDetails?.year) {
                addRow('EMI Period:', `${payment.emiDetails.month}/${payment.emiDetails.year}`);
            } else if (payment.metadata?.get && payment.metadata.get('month') && payment.metadata.get('year')) {
                addRow('EMI Period:', `${payment.metadata.get('month')}/${payment.metadata.get('year')}`);
            } else if (payment.metadata?.month && payment.metadata?.year) {
                addRow('EMI Period:', `${payment.metadata.month}/${payment.metadata.year}`);
            } else if (payment.rentMonth && payment.rentYear) {
                addRow('Rent Period:', `${payment.rentMonth}/${payment.rentYear}`);
            }

            // Payment Method
            addRow('Payment Method:', (payment.gateway || 'Online').toUpperCase());

            // --- Payment Breakdown (for EMI) ---
            if (payment.paymentType === 'emi') {
                y += 5;
                const getVal = (field) => {
                    if (payment.emiDetails && payment.emiDetails[field] !== undefined) return payment.emiDetails[field];
                    if (payment.metadata?.get) return payment.metadata.get(field);
                    return payment.metadata ? payment.metadata[field] : undefined;
                };

                const baseAmount = getVal('baseAmount') || getVal('emiAmount') || 0;
                const penaltyAmount = getVal('penaltyAmount') || 0;
                const discount = getVal('discountApplied') || 0;

                if (baseAmount > 0) addRow('Base EMI Amount:', `INR ${baseAmount.toLocaleString('en-IN')}`);
                if (penaltyAmount > 0) addRow('Late Fee / Penalty:', `INR ${penaltyAmount.toLocaleString('en-IN')}`);
                if (discount > 0) addRow('SetuCoins Discount:', `- INR ${discount.toLocaleString('en-IN')}`);
            }

            // --- Amount Section ---
            doc.rect(50, y + 20, 495, 50).fillAndStroke('#f0f9ff', '#cccccc');
            doc.fillColor('#000000')
                .fontSize(14)
                .text('Total Amount Paid', 70, y + 37)
                .fontSize(16)
                .font('Helvetica-Bold')
                .text(`INR ${payment.amount?.toLocaleString('en-IN') || '0.00'}`, 300, y + 36, { align: 'right', width: 220 });

            // --- Footer ---
            doc.fontSize(10)
                .font('Helvetica')
                .fillColor('#777777')
                .text('Thank you for your business.', 50, 700, { align: 'center', width: 500 });

            doc.text('This is a computer generated receipt and does not require physical signature.', 50, 715, { align: 'center', width: 500 });

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};
