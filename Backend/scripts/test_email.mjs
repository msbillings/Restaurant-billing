import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
dotenv.config();

const t = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_APP_PASS }
});

try {
  await t.verify();
  console.log('SMTP OK - credentials valid');
  const info = await t.sendMail({
    from: process.env.MAIL_USER,
    to: process.env.MAIL_USER,
    subject: 'Test from MS Billings',
    text: 'This is a test email from your backend'
  });
  console.log('EMAIL SENT:', info.messageId);
} catch(e) {
  console.error('EMAIL ERROR:', e.message, e.code);
}
