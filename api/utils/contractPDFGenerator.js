import PDFDocument from 'pdfkit';

/**
 * Generate a PDF contract for rent-lock agreement
 * @param {Object} contract - RentLockContract document
 * @param {Object} tenant - User document (tenant)
 * @param {Object} landlord - User document (landlord)
 * @param {Object} listing - Listing document
 * @param {Object} booking - Booking document
 * @returns {PDFDocument} PDF document stream
 */
export const generateRentLockContractPDF = (contract, tenant, landlord, listing, booking) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

  // Header
  doc.fontSize(24).fillColor('#1f2937').text('RENT-LOCK AGREEMENT', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).fillColor('#6b7280').text('Digital Rental Contract', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(12).fillColor('#9ca3af').text(`Contract ID: ${contract.contractId}`, { align: 'center' });
  doc.moveDown(1);

  // Parties Section
  doc.fontSize(16).fillColor('#1f2937').text('PARTIES', { underline: true });
  doc.moveDown(0.5);

  doc.fontSize(12).fillColor('#374151');
  doc.text(`LANDLORD (Owner):`, { continued: false });
  doc.moveDown(0.3);
  doc.text(`Name: ${landlord.username || landlord.firstName + ' ' + (landlord.lastName || '')}`, { indent: 20 });
  doc.text(`Email: ${landlord.email}`, { indent: 20 });
  if (landlord.mobileNumber) {
    doc.text(`Mobile: ${landlord.mobileNumber}`, { indent: 20 });
  }
  doc.moveDown(0.5);

  doc.text(`TENANT (Renter):`, { continued: false });
  doc.moveDown(0.3);
  doc.text(`Name: ${tenant.username || tenant.firstName + ' ' + (tenant.lastName || '')}`, { indent: 20 });
  doc.text(`Email: ${tenant.email}`, { indent: 20 });
  if (tenant.mobileNumber) {
    doc.text(`Mobile: ${tenant.mobileNumber}`, { indent: 20 });
  }
  doc.moveDown(1);

  // Property Details
  doc.fontSize(16).fillColor('#1f2937').text('PROPERTY DETAILS', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#374151');
  doc.text(`Property Name: ${listing.name || 'N/A'}`, { indent: 20 });
  if (listing.propertyNumber) {
    doc.text(`Property Number: ${listing.propertyNumber}`, { indent: 20 });
  }
  if (listing.address) {
    doc.text(`Address: ${listing.address}`, { indent: 20 });
  }
  if (listing.city || listing.state) {
    doc.text(`Location: ${listing.city || ''}${listing.city && listing.state ? ', ' : ''}${listing.state || ''}`, { indent: 20 });
  }
  if (listing.bedrooms) {
    doc.text(`Bedrooms: ${listing.bedrooms} BHK`, { indent: 20 });
  }
  if (listing.area) {
    doc.text(`Area: ${listing.area} sq ft`, { indent: 20 });
  }
  doc.moveDown(1);

  // Rent-Lock Terms
  doc.fontSize(16).fillColor('#1f2937').text('RENT-LOCK TERMS', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#374151');

  const lockPlanMap = {
    '1_year': '1 Year Rent-Lock',
    '3_year': '3 Year Rent-Lock',
    '5_year': '5 Year Secure Plan',
    'custom': 'Custom Duration'
  };

  doc.text(`Rent-Lock Plan: ${lockPlanMap[contract.rentLockPlan] || contract.rentLockPlan}`, { indent: 20 });
  doc.text(`Lock Duration: ${contract.lockDuration} months`, { indent: 20 });
  doc.text(`Start Date: ${new Date(contract.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, { indent: 20 });
  doc.text(`End Date: ${new Date(contract.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, { indent: 20 });
  doc.moveDown(1);

  // Financial Terms
  doc.fontSize(16).fillColor('#1f2937').text('FINANCIAL TERMS', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#374151');

  // Assume INR for now (can be extended later)
  const currency = 'INR';
  const currencySymbol = '₹';

  doc.text(`Monthly Rent (Locked): ${currencySymbol}${contract.lockedRentAmount?.toLocaleString('en-IN') || '0'}`, { indent: 20 });
  if (contract.securityDeposit) {
    doc.text(`Security Deposit: ${currencySymbol}${contract.securityDeposit.toLocaleString('en-IN')}`, { indent: 20 });
    doc.text(`Security Deposit Status: ${contract.securityDepositPaid ? 'Paid' : 'Pending'}`, { indent: 20 });
  }
  if (contract.maintenanceCharges && contract.maintenanceCharges > 0) {
    doc.text(`Maintenance Charges: ${currencySymbol}${contract.maintenanceCharges.toLocaleString('en-IN')}/month`, { indent: 20 });
  }
  if (contract.advanceRent && contract.advanceRent > 0) {
    doc.text(`Advance Rent: ${contract.advanceRent} month(s)`, { indent: 20 });
  }
  doc.text(`Payment Frequency: ${contract.paymentFrequency || 'monthly'}`, { indent: 20 });
  doc.text(`Payment Due Date: Day ${contract.dueDate || 1} of each month`, { indent: 20 });
  doc.moveDown(1);

  // Payment Terms
  doc.fontSize(16).fillColor('#1f2937').text('PAYMENT TERMS', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(12).fillColor('#374151');
  doc.text(`1. Rent must be paid on or before day ${contract.dueDate || 1} of each month.`, { indent: 20 });
  if (contract.lateFeePercentage && contract.lateFeePercentage > 0) {
    doc.text(`2. Late payment fee: ${contract.lateFeePercentage}% of rent amount (one-time penalty).`, { indent: 20 });
  } else {
    doc.text(`2. Late payment penalties apply as per UrbanSetu terms.`, { indent: 20 });
  }
  doc.text(`3. All payments will be processed through UrbanSetu platform via escrow system.`, { indent: 20 });
  doc.text(`4. Rent remains fixed at ${currencySymbol}${contract.lockedRentAmount?.toLocaleString('en-IN') || '0'}/month for the entire ${contract.lockDuration}-month lock period.`, { indent: 20 });
  if (contract.earlyTerminationFee && contract.earlyTerminationFee > 0) {
    doc.text(`5. Early termination fee: ${currencySymbol}${contract.earlyTerminationFee.toLocaleString('en-IN')} if contract is terminated before end date.`, { indent: 20 });
  }
  doc.moveDown(1);

  // Early Termination
  if (contract.earlyTerminationFee && contract.earlyTerminationFee > 0) {
    doc.fontSize(16).fillColor('#1f2937').text('EARLY TERMINATION', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#374151');
    doc.text(`If the contract is terminated before the end date, an early termination fee of ${currencySymbol}${contract.earlyTerminationFee.toLocaleString('en-IN')} will apply.`, { indent: 20, align: 'justify' });
    doc.moveDown(1);
  }

  // Move-In Details
  if (contract.moveInDate || (booking && booking.moveInDate)) {
    doc.fontSize(16).fillColor('#1f2937').text('MOVE-IN DETAILS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#374151');
    const moveInDate = contract.moveInDate || (booking && booking.moveInDate);
    if (moveInDate) {
      doc.text(`Move-In Date: ${new Date(moveInDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, { indent: 20 });
      doc.moveDown(1);
    }
  }

  // Custom Clauses (AI Drafted)
  if (contract.customClauses && contract.customClauses.length > 0) {
    doc.fontSize(16).fillColor('#1f2937').text('ADDITIONAL TERMS & CONDITIONS', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12).fillColor('#374151');

    contract.customClauses.forEach((clause, index) => {
      doc.text(`${index + 1}. ${clause}`, { indent: 20, align: 'justify' });
      doc.moveDown(0.5);
    });
    doc.moveDown(1);
  }

  // Signatures Section
  doc.addPage();
  doc.fontSize(16).fillColor('#1f2937').text('SIGNATURES', { underline: true });
  doc.moveDown(1);

  // Landlord Signature
  doc.fontSize(14).fillColor('#374151').text('LANDLORD SIGNATURE:', { continued: false });
  doc.moveDown(0.5);

  if (contract.landlordSignature?.signed) {
    if (contract.landlordSignature.signatureData) {
      try {
        const signatureImage = contract.landlordSignature.signatureData.split('base64,')[1];
        if (signatureImage) {
          doc.image(Buffer.from(signatureImage, 'base64'), { width: 150, height: 60 });
          doc.y += 65;
        }
      } catch (e) {
        console.error('Error adding landlord signature to PDF:', e);
      }
    }
    doc.fontSize(11).fillColor('#10b981').text('✓ Signed Electronically', { indent: 20 });
    doc.fontSize(10).fillColor('#6b7280');
    doc.text(`Signed At: ${new Date(contract.landlordSignature.signedAt).toLocaleString('en-GB')}`, { indent: 20 });
    if (contract.landlordSignature.ipAddress) {
      doc.text(`IP Address: ${contract.landlordSignature.ipAddress}`, { indent: 20 });
    }
  } else {
    doc.fontSize(11).fillColor('#ef4444').text('⏳ Pending Signature', { indent: 20 });
  }
  doc.moveDown(1);

  // Tenant Signature
  doc.fontSize(14).fillColor('#374151').text('TENANT SIGNATURE:', { continued: false });
  doc.moveDown(0.5);

  if (contract.tenantSignature?.signed) {
    if (contract.tenantSignature.signatureData) {
      try {
        const signatureImage = contract.tenantSignature.signatureData.split('base64,')[1];
        if (signatureImage) {
          doc.image(Buffer.from(signatureImage, 'base64'), { width: 150, height: 60 });
          doc.y += 65;
        }
      } catch (e) {
        console.error('Error adding tenant signature to PDF:', e);
      }
    }
    doc.fontSize(11).fillColor('#10b981').text('✓ Signed Electronically', { indent: 20 });
    doc.fontSize(10).fillColor('#6b7280');
    doc.text(`Signed At: ${new Date(contract.tenantSignature.signedAt).toLocaleString('en-GB')}`, { indent: 20 });
    if (contract.tenantSignature.ipAddress) {
      doc.text(`IP Address: ${contract.tenantSignature.ipAddress}`, { indent: 20 });
    }
  } else {
    doc.fontSize(11).fillColor('#ef4444').text('⏳ Pending Signature', { indent: 20 });
  }
  doc.moveDown(1.5);

  // Agreement Acknowledgment
  doc.fontSize(12).fillColor('#374151');
  doc.text('By signing this contract, both parties agree to the terms and conditions stated above.', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#6b7280');
  doc.text('This is a legally binding digital contract generated by UrbanSetu.', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#9ca3af');
  doc.text(`Contract generated on ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.text(`© ${new Date().getFullYear()} UrbanSetu. All rights reserved.`, { align: 'center' });

  return doc;
};

/**
 * Generate and save contract PDF to storage
 * @param {Object} contract - RentLockContract document
 * @param {Object} tenant - User document
 * @param {Object} landlord - User document
 * @param {Object} listing - Listing document
 * @param {Object} booking - Booking document
 * @returns {Promise<string>} URL to saved PDF
 */
export const generateAndSaveContractPDF = async (contract, tenant, landlord, listing, booking) => {
  // For now, return a URL that will be generated on-the-fly
  // In production, you would save to cloud storage (S3, Cloudinary, etc.)
  // and return the permanent URL
  const contractId = contract.contractId || contract._id.toString();
  const baseUrl = process.env.CLIENT_URL || process.env.API_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/api/rental/contracts/${contractId}/download`;
};

