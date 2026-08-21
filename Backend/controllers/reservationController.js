import ReservationDefault from '../models/Reservation.js';
import { getTenantModel } from '../utils/tenantHelper.js';

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

    const newReservation = new Reservation(req.body);
    await newReservation.save();
    
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
