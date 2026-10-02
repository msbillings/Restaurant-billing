import { resolveTenantInfo } from './whatsappController.js';
import Client from '../models/Client.js';

/**
 * Sends a dynamic referral invite via WhatsApp.
 * Uses the existing WhatsApp Cloud API integration setup.
 */
export const sendReferralInvite = async (req, res) => {
  try {
    const { targetPhone, targetName, inviteLink: customInviteLink } = req.body;
    
    if (!targetPhone) {
      return res.status(400).json({ success: false, message: 'Target phone number is required.' });
    }

    // Reuse existing whatsapp setup to get the connected instance and restaurant name
    const { tenantId, restaurantName, whatsappService } = await resolveTenantInfo(req);

    // We no longer strictly check whatsappService.getStatus() here because 
    // whatsappService.sendMessage() automatically handles waking up and reconnecting 
    // dormant sessions when needed.

    // Fetch the referrer's (the owner's) referral code from the SuperAdmin Client DB.
    let referralCode = `REF-${restaurantName ? restaurantName.substring(0,4).toUpperCase() : 'USER'}-INVITE`;
    
    // We try to find the client record using databaseName (which matches tenantId)
    if (tenantId && tenantId !== 'default') {
      const clientRecord = await Client.findOne({ databaseName: tenantId });
      if (clientRecord && clientRecord.referralCode) {
        referralCode = clientRecord.referralCode;
      }
    }

    const inviteLink = customInviteLink || `https://msbillings.org/register?ref=${referralCode}`;
    const cleanPhone = targetPhone.replace(/\D/g, '');
    const jid = `${cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone}@s.whatsapp.net`;

    const friendDisplayName = targetName && targetName.trim() ? targetName.trim() : "Friend";
    const messageContent = `🎉 *Exclusive Invitation from ${restaurantName || 'Us'}* 🎉\n\nHi ${friendDisplayName}! We highly recommend using *MSBillings* for your restaurant management.\n\nUse our special invite link below to sign up and instantly get *Free Subscription Days* added to your account!\n\n👉 *Click here to claim:* ${inviteLink}\n\nGrow your restaurant with MSBillings today!`;

    // Send the message using the existing connected WhatsApp session
    await whatsappService.sendMessage(jid, messageContent);

    res.status(200).json({ 
      success: true, 
      message: 'Referral invite sent successfully via WhatsApp!' 
    });

  } catch (error) {
    console.error('[sendReferralInvite] Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send WhatsApp invite.', 
      error: error.message 
    });
  }
};
