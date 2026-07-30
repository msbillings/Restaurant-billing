import express from 'express';
import { getUsers, createUser, updateUser, deleteUser } from '../controllers/adminController.js';
import { authenticateToken as protect, requireAdmin as admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/users')
  .get(protect, admin, getUsers)
  .post(protect, admin, createUser);

router.route('/users/:id')
  .put(protect, admin, updateUser)
  .delete(protect, admin, deleteUser);

export default router;
