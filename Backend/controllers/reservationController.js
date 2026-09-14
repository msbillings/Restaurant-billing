import ReservationDefault from '../models/Reservation.js';
import { getTenantModel } from '../utils/tenantHelper.js';
import { resolveTenantInfo } from './whatsappController.js';
import { getTenantModels } from '../utils/tenantManager.js';

const formatTime12Hour = (time24) => {
  if (!time24) return '';
  const [h, m] = String(time24).split(':');
  const hours = parseInt(h, 10);
  if (isNaN(hours)) return time24;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12.toString().padStart(2, '0')}:${m || '00'} ${ampm}`;
};

const formatDateFriendly = (dateInput) => {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(dateInput);
  }
};

export const sendReservationWhatsAppAlert = async (req, reservation, type = 'confirmed') => {
  try {
    if (!reservation?.phoneNumber) return false;
    const { tenantId, restaurantName: rName, whatsappService } = await resolveTenantInfo(req);
    if (!whatsappService) return false;

    const wsStatus = whatsappService.getStatus();
    if (wsStatus.status !== 'CONNECTED' && !whatsappService.connectedNumber) {
      console.log(`[Reservation WA] WhatsApp not connected for tenant ${tenantId} - skipping auto-send`);
      return false;
    }

    // Retrieve restaurant details for address & phone
    let restaurantName = rName || 'Restaurant';
    let restaurantAddress = '';
    let restaurantPhone = '';

    try {
      const models = req.models || (await getTenantModels(tenantId));
      if (models?.Setting) {
        const settingsDoc = await models.Setting.findOne({ key: 'restaurantSettings' }).lean();
        let s = settingsDoc?.value;
        if (typeof s === 'string') {
          try { s = JSON.parse(s); } catch (e) {}
        }
        if (s) {
          if (s.restaurantName) restaurantName = s.restaurantName;
          if (s.address) restaurantAddress = s.address;
          if (s.phone || s.contactNumber || s.phone1) restaurantPhone = s.phone || s.contactNumber || s.phone1;
        }
      }
    } catch (e) {}

    const formattedDate = formatDateFriendly(reservation.date);
    const formattedTime = formatTime12Hour(reservation.time);
    const customerName = reservation.customerName || 'Valued Guest';
    const guests = reservation.guests || 2;
    const tableType = reservation.tableType || 'Reserved Space';
    const specialRequests = reservation.specialRequests ? reservation.specialRequests.trim() : '';

    let text = '';
    if (type === 'confirmed') {
      text = `📅 *Table Reservation Confirmed!*\n\n` +
        `Dear *${customerName}*, your table reservation at *${restaurantName}* is confirmed:\n\n` +
        `👥 *Guests:* ${guests} Persons\n` +
        `🗓 *Date:* ${formattedDate}\n` +
        `⏰ *Time:* ${formattedTime}\n` +
        `🪑 *Table / Area:* ${tableType}\n` +
        (specialRequests ? `📝 *Special Request:* ${specialRequests}\n` : '') +
        (restaurantAddress ? `📍 *Address:* ${restaurantAddress}\n` : '') +
        (restaurantPhone ? `📞 *Contact:* ${restaurantPhone}\n` : '') +
        `\nWe look forward to hosting you! 🎉`;
    } else if (type === 'updated') {
      text = `✏️ *Table Reservation Updated!*\n\n` +
        `Dear *${customerName}*, your reservation details at *${restaurantName}* have been updated:\n\n` +
        `👥 *Guests:* ${guests} Persons\n` +
        `🗓 *Date:* ${formattedDate}\n` +
        `⏰ *Time:* ${formattedTime}\n` +
        `🪑 *Table / Area:* ${tableType}\n` +
        (specialRequests ? `📝 *Special Request:* ${specialRequests}\n` : '') +
        (restaurantAddress ? `📍 *Address:* ${restaurantAddress}\n` : '') +
        (restaurantPhone ? `📞 *Contact:* ${restaurantPhone}\n` : '') +
        `\nSee you soon! 🥂`;
    } else if (type === 'cancelled') {
      text = `❌ *Table Reservation Cancelled*\n\n` +
        `Dear *${customerName}*, your table reservation for *${formattedDate}* at *${formattedTime}* at *${restaurantName}* has been cancelled.\n\n` +
        (restaurantPhone ? `If this was a mistake or you wish to re-book, please contact us at ${restaurantPhone}.\n` : '') +
        `We hope to welcome you again soon! ✨`;
    } else if (type === 'reminder') {
      text = `⏰ *Reservation Reminder — ${restaurantName}*\n\n` +
        `Hi *${customerName}*, gentle reminder about your table reservation today:\n\n` +
        `👥 *Guests:* ${guests} Persons\n` +
        `⏰ *Time:* ${formattedTime}\n` +
        `🪑 *Table / Area:* ${tableType}\n` +
        (specialRequests ? `📝 *Special Request:* ${specialRequests}\n` : '') +
        (restaurantAddress ? `📍 *Address:* ${restaurantAddress}\n` : '') +
        (restaurantPhone ? `📞 *Contact:* ${restaurantPhone}\n\nNeed to adjust time or running late? Call us at ${restaurantPhone}.\n` : '\n') +
        `See you shortly! 🍽️`;
    }

    console.log(`[Reservation WA] Sending ${type} alert to ${reservation.phoneNumber}...`);
    await whatsappService.sendMessage(reservation.phoneNumber, text);
    console.log(`[Reservation WA] Successfully sent ${type} alert to ${reservation.phoneNumber}`);

    // Update reservation record with whatsapp sent flag
    try {
      const ReservationModel = getTenantModel(req, 'Reservation', ReservationDefault);
      const updateFields = {
        whatsappSent: true,
        whatsappSentAt: new Date()
      };
      if (type === 'reminder') {
        updateFields.whatsappReminderSent = true;
      }
      await ReservationModel.findByIdAndUpdate(reservation._id, updateFields);
    } catch (dbErr) {
      console.warn('[Reservation WA] DB update tracking warning:', dbErr?.message);
    }

    return true;
  } catch (err) {
    console.warn(`[Reservation WA] Failed to send WhatsApp alert:`, err?.message || err);
    return false;
  }
};

// Get reservations (optional filters by date or status)
export const getReservations = async (req, res) => {
  try {
    const Reservation = getTenantModel(req, 'Reservation', ReservationDefault);
    const { date, status } = req.query;
    let query = {};
    
    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
    }
    
    if (status) {
      query.status = status;
    }

    const reservations = await Reservation.find(query).sort({ date: 1, time: 1 });
    res.status(200).json(reservations);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching reservations', error: error.message });
  }
};

// Helper to check for overlapping reservations
const checkOverlap = async (ReservationModel, tableType, dateStr, timeStr, endDateStr, endTimeStr, excludeId = null) => {
  if (!tableType || tableType === 'Any' || tableType === 'Any Space' || tableType.startsWith('Entire') || tableType.startsWith('All')) return false;

  const startDateTime = new Date(`${new Date(dateStr).toISOString().split('T')[0]}T${timeStr}`);
  const endDateTime = new Date(`${new Date(endDateStr).toISOString().split('T')[0]}T${endTimeStr}`);

  const query = {
    tableType: tableType,
    status: { $in: ['pending', 'confirmed', 'seated'] }
  };
  if (excludeId) query._id = { $ne: excludeId };

  const existingReservations = await ReservationModel.find(query);

  for (const res of existingReservations) {
    const resStart = new Date(`${new Date(res.date).toISOString().split('T')[0]}T${res.time}`);
    const resEnd = new Date(`${new Date(res.endDate).toISOString().split('T')[0]}T${res.endTime}`);

    if (resStart < endDateTime && resEnd > startDateTime) {
      return true;
    }
  }
  return false;
};

// Create a new reservation
export const createReservation = async (req, res) => {
  try {
    const Reservation = getTenantModel(req, 'Reservation', ReservationDefault);
    const { tableType, date, time, endDate, endTime } = req.body;
    
    if (await checkOverlap(Reservation, tableType, date, time, endDate, endTime)) {
      return res.status(409).json({ message: 'Table is already booked for this time slot.' });
    }

    const payload = { ...req.body };
    if (!payload.status) {
      payload.status = 'confirmed';
    }

    const newReservation = new Reservation(payload);
    await newReservation.save();
    
    // Asynchronously send WhatsApp confirmation if phone is present and not explicitly disabled
    if (newReservation.phoneNumber && req.body.sendWhatsApp !== false) {
      sendReservationWhatsAppAlert(req, newReservation, 'confirmed').catch(err => {
        console.warn('[Reservation WA Create Alert Warning]:', err?.message);
      });
    }

    // Notify clients to refresh
    const io = req.app?.locals?.io;
    const tenantDb = req.headers['x-tenant-db'] || req.query?.tenant || 'default';
    if (io) {
      if (tenantDb) io.to(tenantDb).emit('reservationUpdated');
      else io.emit('reservationUpdated');
    }

    res.status(201).json(newReservation);
  } catch (error) {
    res.status(500).json({ message: 'Error creating reservation', error: error.message });
  }
};

// Update a reservation (e.g., status changes)
export const updateReservation = async (req, res) => {
  try {
    const Reservation = getTenantModel(req, 'Reservation', ReservationDefault);
    const { id } = req.params;
    
    const prevReservation = await Reservation.findById(id).lean();
    if (!prevReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Check overlap if updating time or table
    if (req.body.date && req.body.time && req.body.endDate && req.body.endTime && req.body.tableType) {
       // Ignore overlap check if status is being changed to cancelled/completed
       if (!req.body.status || ['pending', 'confirmed', 'seated'].includes(req.body.status)) {
         if (await checkOverlap(Reservation, req.body.tableType, req.body.date, req.body.time, req.body.endDate, req.body.endTime, id)) {
           return res.status(409).json({ message: 'Table is already booked for this time slot.' });
         }
       }
    }

    const updatedReservation = await Reservation.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Trigger WhatsApp notification on relevant status or detail changes
    if (updatedReservation.phoneNumber && req.body.sendWhatsApp !== false) {
      if (req.body.status === 'confirmed' && prevReservation.status !== 'confirmed') {
        // Do NOT send WhatsApp confirmation again if already sent
        if (!prevReservation.whatsappSent) {
          sendReservationWhatsAppAlert(req, updatedReservation, 'confirmed').catch(() => {});
        }
      } else if (req.body.status === 'cancelled' && prevReservation.status !== 'cancelled') {
        sendReservationWhatsAppAlert(req, updatedReservation, 'cancelled').catch(() => {});
      } else if (
        (req.body.date && String(req.body.date) !== String(prevReservation.date)) ||
        (req.body.time && req.body.time !== prevReservation.time) ||
        (req.body.guests && Number(req.body.guests) !== Number(prevReservation.guests)) ||
        (req.body.tableType && req.body.tableType !== prevReservation.tableType)
      ) {
        sendReservationWhatsAppAlert(req, updatedReservation, 'updated').catch(() => {});
      }
    }

    // Notify clients to refresh
    const io = req.app?.locals?.io;
    const tenantDb = req.headers['x-tenant-db'] || req.query?.tenant || 'default';
    if (io) {
      if (tenantDb) io.to(tenantDb).emit('reservationUpdated');
      else io.emit('reservationUpdated');
    }

    res.status(200).json(updatedReservation);
  } catch (error) {
    res.status(500).json({ message: 'Error updating reservation', error: error.message });
  }
};

// Delete a reservation
export const deleteReservation = async (req, res) => {
  try {
    const Reservation = getTenantModel(req, 'Reservation', ReservationDefault);
    const { id } = req.params;
    const deletedReservation = await Reservation.findByIdAndDelete(id);
    if (!deletedReservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    // Notify clients to refresh
    const io = req.app?.locals?.io;
    const tenantDb = req.headers['x-tenant-db'] || req.query?.tenant || 'default';
    if (io) {
      if (tenantDb) io.to(tenantDb).emit('reservationUpdated');
      else io.emit('reservationUpdated');
    }

    res.status(200).json({ message: 'Reservation deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting reservation', error: error.message });
  }
};

// Manual / On-demand trigger to send WhatsApp confirmation, reminder, update, or cancellation
export const sendManualReservationWhatsApp = async (req, res) => {
  try {
    const Reservation = getTenantModel(req, 'Reservation', ReservationDefault);
    const { id } = req.params;
    const { type = 'confirmed' } = req.body;

    const reservation = await Reservation.findById(id);
    if (!reservation) {
      return res.status(404).json({ message: 'Reservation not found' });
    }

    if (!reservation.phoneNumber) {
      return res.status(400).json({ message: 'Customer phone number is missing from this reservation' });
    }

    // Check one-time reminder constraint
    if (type === 'reminder') {
      if (reservation.whatsappReminderSent) {
        return res.status(400).json({ message: 'Reminder has already been sent for this reservation.' });
      }

      // Check minimum 1 hour elapsed since confirmation message
      if (reservation.whatsappSentAt) {
        const elapsedMs = Date.now() - new Date(reservation.whatsappSentAt).getTime();
        const oneHourMs = 60 * 60 * 1000;
        if (elapsedMs < oneHourMs) {
          const remainingMin = Math.ceil((oneHourMs - elapsedMs) / (60 * 1000));
          return res.status(400).json({
            message: `Reminder can only be sent at least 1 hour after confirmation message. Please wait ${remainingMin} more minute(s).`
          });
        }
      }
    }

    // Prevent duplicate confirmation alerts
    if (type === 'confirmed' && reservation.whatsappSent) {
      return res.status(400).json({ message: 'Confirmation alert has already been sent to this customer.' });
    }

    const sent = await sendReservationWhatsAppAlert(req, reservation, type);
    if (!sent) {
      return res.status(503).json({
        message: 'Could not send WhatsApp message. Please check that WhatsApp is connected in Settings.'
      });
    }

    res.status(200).json({
      success: true,
      message: `WhatsApp ${type} alert sent successfully to ${reservation.phoneNumber}`
    });
  } catch (error) {
    res.status(500).json({ message: 'Error sending WhatsApp alert', error: error.message });
  }
};
