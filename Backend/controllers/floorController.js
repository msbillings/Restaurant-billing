import FloorDefault from '../models/Floor.js';
import { getTenantModel, handleTenantError } from '../utils/tenantHelper.js';
import { emitSocketEvent } from '../utils/socket.js';

// Get all floors and tables
export const getFloors = async (req, res) => {
  try {
    const Floor = getTenantModel(req, 'Floor', FloorDefault);
    const floors = await Floor.find().sort({ createdAt: 1 });
    res.status(200).json(floors);
  } catch (error) {
    handleTenantError(error, res);
  }
};

// Replace all floors (Bulk Update/Create from settings migration)
export const saveFloors = async (req, res) => {
  try {
    const Floor = getTenantModel(req, 'Floor', FloorDefault);
    const newFloors = req.body.spaces; // Assuming body is { spaces: [...] }
    
    if (!Array.isArray(newFloors)) {
      return res.status(400).json({ message: 'Invalid spaces format.' });
    }

    // Replace all existing floors with the new ones.
    // In a fully robust system, we would merge, but for Phase 1 migration from localStorage,
    // total replacement works perfectly.
    await Floor.deleteMany({});
    const savedFloors = await Floor.insertMany(newFloors);
    
    emitSocketEvent(req, 'spacesUpdated', savedFloors);
    
    res.status(200).json({ message: 'Floors saved successfully', spaces: savedFloors });
  } catch (error) {
    handleTenantError(error, res);
  }
};

// Update a specific table's status manually (e.g. reserving a table)
export const updateTableStatus = async (req, res) => {
  try {
    const Floor = getTenantModel(req, 'Floor', FloorDefault);
    const { floorId, tableId } = req.params;
    const { status, currentOrderId } = req.body;

    const floor = await Floor.findOne({ id: floorId });
    if (!floor) return res.status(404).json({ message: 'Floor not found' });

    let itemFound = false;
    const arraysToCheck = ['tables', 'cabins', 'sofas'];
    
    for (let arrayName of arraysToCheck) {
      if (floor[arrayName]) {
        for (let item of floor[arrayName]) {
          if (item.id === tableId) {
            if (status) item.status = status;
            if (currentOrderId !== undefined) item.currentOrderId = currentOrderId;
            itemFound = true;
            break;
          }
        }
      }
      if (itemFound) break;
    }

    if (!itemFound) return res.status(404).json({ message: 'Table not found on this floor' });

    await floor.save();
    
    // Broadcast the change!
    emitSocketEvent(req, 'tableStatusChanged', { floorId, tableId, status, currentOrderId });

    res.status(200).json(floor);
  } catch (error) {
    handleTenantError(error, res);
  }
};

// Helper function for other controllers to update table status
export const updateTableStatusHelper = async (req, tableIdentifier, status, currentOrderId = null) => {
  try {
    const Floor = getTenantModel(req, 'Floor', FloorDefault);
    const floors = await Floor.find();
    
    let tableFound = false;
    let targetFloorId = null;
    let targetTableId = null;

    // We only have the table name string like "Ground Floor - Table 1" OR just "Table 1"
    for (let floor of floors) {
      const arraysToCheck = ['tables', 'cabins', 'sofas'];
      for (let arrayName of arraysToCheck) {
        if (floor[arrayName]) {
          for (let item of floor[arrayName]) {
            const uniqueSpaceName = `${floor.name} - ${item.name}`;
            // Match exactly or uniquely
            if (item.name === tableIdentifier || uniqueSpaceName === tableIdentifier || item.id === tableIdentifier) {
              item.status = status;
              item.currentOrderId = currentOrderId;
              tableFound = true;
              targetFloorId = floor.id;
              targetTableId = item.id;
              break;
            }
          }
        }
        if (tableFound) break;
      }
      if (tableFound) {
        await floor.save();
        break;
      }
    }

    if (tableFound) {
      emitSocketEvent(req, 'tableStatusChanged', { floorId: targetFloorId, tableId: targetTableId, status, currentOrderId });
    }
  } catch (error) {
    console.error('Error updating table status via helper:', error);
  }
};
