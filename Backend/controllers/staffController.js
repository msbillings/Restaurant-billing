import StaffSchema from '../models/Staff.js';
import { getTenantModel } from '../utils/tenantHelper.js';

export const getStaff = async (req, res) => {
  try {
    const Staff = getTenantModel(req, 'Staff', StaffSchema);
    const staff = await Staff.find({}).sort({ createdAt: -1 });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addStaff = async (req, res) => {
  try {
    const Staff = getTenantModel(req, 'Staff', StaffSchema);
    const newStaff = new Staff(req.body);
    await newStaff.save();
    res.status(201).json(newStaff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateStaff = async (req, res) => {
  try {
    const Staff = getTenantModel(req, 'Staff', StaffSchema);
    const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.json(staff);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteStaff = async (req, res) => {
  try {
    const Staff = getTenantModel(req, 'Staff', StaffSchema);
    const staff = await Staff.findByIdAndDelete(req.params.id);
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const clockInOut = async (req, res) => {
  try {
    const { pin, staffId, action, photo } = req.body; // action = 'clockIn' or 'clockOut'
    const Staff = getTenantModel(req, 'Staff', StaffSchema);
    
    let staff;
    if (staffId) {
      staff = await Staff.findById(staffId);
    } else if (pin) {
      staff = await Staff.findOne({ pin, status: 'Active' });
    }

    if (!staff || staff.status !== 'Active') {
      return res.status(404).json({ message: 'Invalid PIN or Staff is Inactive' });
    }

    // Normalize today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendanceRecord = staff.attendance.find(a => 
      new Date(a.date).getTime() === today.getTime()
    );

    if (action === 'clockIn') {
      if (attendanceRecord && attendanceRecord.clockIn) {
        return res.status(400).json({ message: 'Already clocked in for today' });
      }
      if (!attendanceRecord) {
        attendanceRecord = { date: today, clockIn: new Date(), status: 'Present' };
        if (photo) attendanceRecord.clockInPhoto = photo;
        staff.attendance.push(attendanceRecord);
      } else {
        attendanceRecord.clockIn = new Date();
        attendanceRecord.status = 'Present';
        if (photo) attendanceRecord.clockInPhoto = photo;
      }
    } else if (action === 'clockOut') {
      if (!attendanceRecord || !attendanceRecord.clockIn) {
        return res.status(400).json({ message: 'You must clock in first' });
      }
      if (attendanceRecord.clockOut) {
        return res.status(400).json({ message: 'Already clocked out for today' });
      }
      attendanceRecord.clockOut = new Date();
      if (photo) attendanceRecord.clockOutPhoto = photo;
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await staff.save();
    res.json({ message: `Successfully ${action === 'clockIn' ? 'clocked in' : 'clocked out'}`, staff });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPublicStaff = async (req, res) => {
  try {
    const Staff = getTenantModel(req, 'Staff', StaffSchema);
    const staff = await Staff.find({ status: 'Active' }).select('name faceDescriptor _id');
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
