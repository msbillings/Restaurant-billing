import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export const generateInvoicePDF = async (clientName, email, amount, planType, licenseKey) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const invoicePath = path.join('/tmp', `Invoice-${Date.now()}.pdf`);
      const stream = fs.createWriteStream(invoicePath);
      
      doc.pipe(stream);

      // Header
      doc.fillColor('#ff5c35').fontSize(28).text('mstechhive', { align: 'right' });
      doc.fillColor('#333333').fontSize(10).text('123 Tech Lane, Innovation City', { align: 'right' });
      doc.text('contact@mstechhive.com', { align: 'right' });
      doc.moveDown();

      // Invoice Title
      doc.fontSize(20).text('INVOICE', { align: 'left' });
      doc.fontSize(10).text(`Date: ${new Date().toLocaleDateString()}`);
      doc.text(`Invoice #: INV-${Math.floor(Math.random() * 1000000)}`);
      doc.moveDown();

      // Billed To
      doc.fontSize(12).text('Billed To:');
      doc.fontSize(10).text(clientName);
      doc.text(email);
      doc.moveDown(2);

      // Table Header
      const tableTop = 250;
      doc.font('Helvetica-Bold');
      doc.text('Description', 50, tableTop);
      doc.text('Amount', 400, tableTop, { width: 90, align: 'right' });
      doc.moveTo(50, tableTop + 15).lineTo(500, tableTop + 15).stroke();
      
      // Table Content
      doc.font('Helvetica');
      doc.text(`msbilling Restaurant Management - ${planType} Plan`, 50, tableTop + 25);
      doc.text(`₹${amount}`, 400, tableTop + 25, { width: 90, align: 'right' });
      
      // Total
      doc.moveTo(50, tableTop + 50).lineTo(500, tableTop + 50).stroke();
      doc.font('Helvetica-Bold');
      doc.text('Total:', 300, tableTop + 65, { width: 90, align: 'right' });
      doc.text(`₹${amount}`, 400, tableTop + 65, { width: 90, align: 'right' });

      // License Key Info
      doc.moveDown(4);
      doc.fontSize(14).fillColor('#ff5c35').text('Your License Key:', 50);
      doc.fontSize(12).fillColor('#000000').text(licenseKey);
      
      // Footer
      doc.moveDown(3);
      doc.fontSize(10).fillColor('#888888').text('Thank you for choosing mstechhive. For support, please contact us.', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve(invoicePath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};
