import nodemailer from 'nodemailer';
import fs from 'fs';

export const sendLicenseEmail = async (clientName, email, licenseKey, invoicePath) => {
  return new Promise((resolve, reject) => {
    try {
      // Create a transporter using Gmail
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD, // Use a 16-character App Password here
        },
      });

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-w-md; margin: 0 auto; color: #333;">
          <div style="background-color: #ff5c35; padding: 20px; text-align: center; color: white;">
            <h1>Welcome to mstechhive!</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
            <p>Dear <strong>${clientName}</strong>,</p>
            <p>Thank you for purchasing msbilling - Restaurant Management software! Your payment was successful.</p>
            
            <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #ff5c35; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #666;">Your Exclusive License Key</p>
              <h2 style="margin: 5px 0 0 0; color: #333; letter-spacing: 2px;">${licenseKey}</h2>
            </div>

            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Download the msbilling setup file (if you haven't already).</li>
              <li>Install and open the software on your restaurant computer.</li>
              <li>When prompted, paste your License Key to permanently unlock the software.</li>
            </ol>

            <p>We have attached your official invoice to this email.</p>
            
            <p>If you need any assistance, feel free to reply to this email.</p>
            
            <p>Best regards,<br/><strong>The mstechhive Team</strong></p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: '"mstechhive Support" <' + process.env.GMAIL_USER + '>',
        to: email,
        subject: 'Your msbilling License Key & Invoice',
        html: htmlContent,
        attachments: [
          {
            filename: 'mstechhive_invoice.pdf',
            path: invoicePath
          }
        ]
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Email send error:", error);
          reject(error);
        } else {
          console.log('Email sent: ' + info.response);
          // Optional: Clean up the temporary invoice PDF file after sending
          if (fs.existsSync(invoicePath)) {
            fs.unlinkSync(invoicePath);
          }
          resolve(info);
        }
      });
    } catch (error) {
      console.error("Email service setup error:", error);
      reject(error);
    }
  });
};
