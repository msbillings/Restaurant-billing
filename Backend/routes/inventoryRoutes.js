import express from 'express';
import {
  getItems,
  addItem,
  updateItem,
  deleteItem,
  stockIn,
  recordWastage,
  getRecipes,
  saveRecipe,
  deleteRecipe,
  getLogs,
  getRestockPredictions,
  staffWithdraw
} from '../controllers/inventoryController.js';

const router = express.Router();

// Stock Items & Raw Materials
router.get('/', getItems);
router.post('/', addItem);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

// Quick Operations
router.post('/:id/stock-in', stockIn);
router.post('/:id/wastage', recordWastage);
router.post('/:id/withdraw', staffWithdraw);

// Recipe Mapping (Bill of Materials)
router.get('/recipes', getRecipes);
router.post('/recipes', saveRecipe);
router.delete('/recipes/:id', deleteRecipe);

// Audit Logs
router.get('/logs', getLogs);

// AI Restock Predictions
router.get('/predictions', getRestockPredictions);

export default router;
