import Razorpay from 'razorpay';
import crypto from 'crypto';
import Client from '../models/Client.js';
import { generateInvoicePDF } from '../services/invoiceService.js';
import { sendLicenseEmail } from '../services/emailService.js';

// Initialize Razorpay
const getRazorpayInstance = () => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay keys not configured in .env');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
};

const generateLicenseKey = () => {
  const segment = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MSBILL-${segment()}-${segment()}-${segment()}`;
};

const generatePlainPassword = () => {
  return Math.random().toString(36).slice(-8); // Generate an 8 char random password
};

export const createOrder = async (req, res) => {
  try {
    const { amount, restaurantName, email, planType } = req.body;

    if (!amount || !restaurantName || !email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const instance = getRazorpayInstance();

    const options = {
      amount: amount * 100, // Amount is in currency subunits. Default currency is INR. Hence, 50000 refers to 50000 paise
      currency: "INR",
      receipt: `receipt_order_${Math.floor(Math.random() * 10000)}`,
      notes: {
        restaurantName,
        email,
        planType: planType || 'Lifetime'
      }
    };

    const order = await instance.orders.create(options);
    if (!order) return res.status(500).json({ message: 'Some error occured with Razorpay' });

    res.status(200).json(order);
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      restaurantName,
      email,
      amount,
      planType
    } = req.body;

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      // Payment is successful!
      console.log(`Payment Verified for ${restaurantName} (${email}). Generating license...`);

      // 1. Generate License & Client Entry
      const newLicenseKey = generateLicenseKey();
      const plainPassword = generatePlainPassword();
      
      const newClient = new Client({
        restaurantName,
        email,
        licenseKey: newLicenseKey,
        hardwareId: null, // To be bound upon first login
        status: 'Active',
        plainPassword: plainPassword
      });

      await newClient.save();

      // 2. Generate PDF Invoice
      const invoicePath = await generateInvoicePDF(restaurantName, email, amount, planType, newLicenseKey);

      // 3. Send Email
      await sendLicenseEmail(restaurantName, email, newLicenseKey, invoicePath);

      return res.status(200).json({ 
        message: 'Payment verified successfully. Email sent with License Key.', 
        success: true 
      });

    } else {
      return res.status(400).json({ message: 'Invalid payment signature!' });
    }
  } catch (error) {
    console.error("Verify payment error:", error);
    res.status(500).json({ message: error.message });
  }
};
