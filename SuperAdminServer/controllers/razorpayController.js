import crypto from 'crypto';
import Client from '../models/Client.js';
import License from '../models/License.js';

export const handleRazorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (expectedSignature !== signature) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    // Handle Subscription Auto-Debit Success
    if (event === 'subscription.charged') {
      const subscription = payload.subscription.entity;
      const clientEmail = subscription.customer_email; // Assuming we pass this when creating subs

      // Find the client
      const client = await Client.findOne({ email: clientEmail });
      if (client) {
        // Find their license
        const license = await License.findOne({ client: client._id });
        if (license) {
          // Extend validity by 1 month for successful auto-debit
          const currentValidity = new Date(license.validUntil);
          currentValidity.setMonth(currentValidity.getMonth() + 1);
          license.validUntil = currentValidity;
          await license.save();

          // Make sure status is Active
          client.status = 'Active';
          await client.save();
          console.log(`Auto-debit successful for ${clientEmail}. License extended.`);
        }
      }
    }

    // Handle Auto-Debit Failure (Insufficient funds, card expired)
    if (event === 'subscription.halted' || event === 'subscription.cancelled') {
      const subscription = payload.subscription.entity;
      const clientEmail = subscription.customer_email;

      const client = await Client.findOne({ email: clientEmail });
      if (client) {
        // Suspend the account
        client.status = 'Suspended';
        await client.save();
        console.log(`Auto-debit failed for ${clientEmail}. Account suspended.`);
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
