import CreditAccountDefault from '../models/CreditAccount.js';
import BillDefault from '../models/Bill.js';
import { getTenantModel } from '../utils/tenantHelper.js';

// ─────────────────────────────────────────────────────
// LEGACY: Get all credit accounts (basic list, no pagination)
// ─────────────────────────────────────────────────────
export const getCreditAccounts = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const accounts = await CreditAccount.find().sort({ updatedAt: -1 });
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching credit accounts', error: error.message });
  }
};

// ─────────────────────────────────────────────────────
// LEGACY: Create a new credit account manually
// ─────────────────────────────────────────────────────
export const createCreditAccount = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const { customerName, phoneNumber, initialBalance = 0 } = req.body;

    const existingAccount = await CreditAccount.findOne({ phoneNumber });
    if (existingAccount) {
      return res.status(400).json({ message: 'Account already exists for this phone number' });
    }

    const newAccount = new CreditAccount({
      customerName,
      phoneNumber,
      balance: initialBalance,
      transactions: initialBalance > 0 ? [{ type: 'credit', amount: initialBalance, note: 'Initial Balance' }] : []
    });

    await newAccount.save();
    res.status(201).json(newAccount);
  } catch (error) {
    res.status(500).json({ message: 'Error creating credit account', error: error.message });
  }
};

// ─────────────────────────────────────────────────────
// LEGACY: Add a transaction (payment or new credit) by account _id
// ─────────────────────────────────────────────────────
export const addTransaction = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const { id } = req.params;
    const { type, amount, note, billId } = req.body;

    const account = await CreditAccount.findById(id);
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    account.transactions.push({ type, amount, note, billId });

    if (type === 'credit') {
      account.balance += amount;
    } else if (type === 'payment') {
      account.balance -= amount;
    }

    await account.save();
    res.status(200).json(account);
  } catch (error) {
    res.status(500).json({ message: 'Error adding transaction', error: error.message });
  }
};


// ═══════════════════════════════════════════════════════
// KHATA BOOK API (new, paginated, full-featured)
// ═══════════════════════════════════════════════════════

// GET /api/credit-accounts/khata
// Derives accounts directly from ALL Unpaid bills in the Bill collection.
// This means existing unpaid bills show up immediately — no CreditAccount entry needed.
// Payments recorded in CreditAccount are then merged to give the adjusted balance.
export const getKhataAccounts = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const Bill = getTenantModel(req, 'Bill', BillDefault);

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = (req.query.search || '').trim();
    const skip = (page - 1) * limit;

    // Step 1: Aggregate all Unpaid bills grouped by customerPhone
    const matchFilter = { status: 'Unpaid', customerPhone: { $exists: true, $ne: null, $not: /^\s*$/ } };
    if (search) {
      matchFilter.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } }
      ];
    }

    const billGroups = await Bill.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$customerPhone',
          customerName: { $last: '$customerName' },
          phoneNumber: { $first: '$customerPhone' },
          billTotal: { $sum: '$total' },
          billCount: { $sum: 1 },
          lastUpdate: { $max: '$updatedAt' }
        }
      },
      { $sort: { lastUpdate: -1 } }
    ]);

    // Step 2: Balance = sum of remaining Unpaid bills (NO CreditAccount deduction needed
    // because settleKhataPayment already marks bills as Paid in the DB — so Unpaid sum
    // is always accurate and avoids stale CreditAccount payment double-deduction)
    const merged = billGroups.map(group => ({
      _id: group._id,
      customerName: group.customerName || 'Unknown Customer',
      phoneNumber: group.phoneNumber,
      balance: group.billTotal,      // ← pure sum of remaining Unpaid bills
      billTotal: group.billTotal,
      billCount: group.billCount,
      updatedAt: group.lastUpdate
    })).filter(a => a.balance > 0);

    // Step 4: Apply pagination manually (after merge)
    const totalDocs = merged.length;
    const paginated = merged.slice(skip, skip + limit);

    // Step 5: Compute total outstanding stats
    const totalOutstanding = merged.reduce((sum, a) => sum + a.balance, 0);
    const activeAccounts = merged.length;

    res.status(200).json({
      accounts: paginated,
      pagination: {
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit) || 1,
        currentPage: page,
        limit
      },
      stats: { totalOutstanding, activeAccounts }
    });
  } catch (error) {
    console.error('[Khata] Error fetching accounts:', error);
    res.status(500).json({ message: 'Error fetching Khata accounts', error: error.message });
  }
};


// GET /api/credit-accounts/khata/:phoneNumber/ledger
// Returns all unpaid bills for a customer by phone number
export const getKhataLedger = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const Bill = getTenantModel(req, 'Bill', BillDefault);

    const { phoneNumber } = req.params;
    const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);

    // Get all Unpaid bills for this customer — search by last 10 digits of phone
    const bills = await Bill.find({
      customerPhone: { $regex: cleanPhone, $options: 'i' },
      status: 'Unpaid'
    })
      .sort({ createdAt: -1 })
      .select('billNumber billType status paymentMode total createdAt updatedAt customerName customerPhone tableNo');

    // Balance = pure sum of remaining Unpaid bills (no CreditAccount deduction)
    // Bills are marked Paid in DB when settlement happens, so Unpaid sum is always accurate
    const balance = bills.reduce((sum, b) => sum + (b.total || 0), 0);

    // Get CreditAccount for payment history display only (not for balance calculation)
    const account = await CreditAccount.findOne({
      phoneNumber: { $regex: cleanPhone, $options: 'i' }
    }).lean();

    res.status(200).json({
      account: account || {
        customerName: bills[0]?.customerName || 'Unknown',
        phoneNumber: cleanPhone,
        balance
      },
      bills,
      transactions: account?.transactions?.sort((a, b) => new Date(b.date) - new Date(a.date)) || []
    });
  } catch (error) {
    console.error('[Khata] Error fetching ledger:', error);
    res.status(500).json({ message: 'Error fetching Khata ledger', error: error.message });
  }
};


// POST /api/credit-accounts/khata/settle
// Record a payment against a Khata account AND mark individual bills as Paid
// Body: { phoneNumber, amount, paymentMode, splitPayments, upiApp, note, targetBillId }
export const settleKhataPayment = async (req, res) => {
  try {
    const CreditAccount = getTenantModel(req, 'CreditAccount', CreditAccountDefault);
    const Bill = getTenantModel(req, 'Bill', BillDefault);
    const { phoneNumber, amount, paymentMode = 'Cash', splitPayments, upiApp, note, targetBillId } = req.body;

    if (!phoneNumber || !amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Valid phoneNumber and amount are required' });
    }

    const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);
    const paidAmount = Number(amount);

    // ── Step 1: Fetch all unpaid bills for this customer ──
    const unpaidBills = await Bill.find({
      customerPhone: { $regex: cleanPhone, $options: 'i' },
      status: 'Unpaid'
    }).sort({ createdAt: 1 }); // oldest first default

    // ── Step 2: Allocate payment bill by bill ──
    let remaining = paidAmount;
    let remCash = splitPayments?.cash || 0;
    let remUpi = splitPayments?.upi || 0;
    let remCard = splitPayments?.card || 0;
    
    const clearedBillIds = [];
    const now = new Date();

    const applyPaymentToBill = (tBill) => {
      tBill.status = 'Paid';
      tBill.paymentMode = paymentMode;
      tBill.amountPaid = tBill.total;
      tBill.clearedAt = now;
      if (upiApp) tBill.upiApp = upiApp;

      if (paymentMode === 'Mixed') {
        let bTotal = tBill.total;
        tBill.splitPayments = { cash: 0, upi: 0, card: 0 };
        
        const cTake = Math.min(bTotal, remCash);
        tBill.splitPayments.cash = cTake;
        remCash -= cTake;
        bTotal -= cTake;
        
        const uTake = Math.min(bTotal, remUpi);
        tBill.splitPayments.upi = uTake;
        remUpi -= uTake;
        bTotal -= uTake;
        
        const cdTake = Math.min(bTotal, remCard);
        tBill.splitPayments.card = cdTake;
        remCard -= cdTake;
      }
    };

    // If a specific target bill was provided (Clear Due on single row), process that first
    if (targetBillId) {
      const targetBillIndex = unpaidBills.findIndex(b => b._id.toString() === targetBillId);
      if (targetBillIndex !== -1) {
        const tBill = unpaidBills[targetBillIndex];
        if (tBill.total <= remaining) {
          applyPaymentToBill(tBill);
          await tBill.save();
          remaining -= tBill.total;
          clearedBillIds.push(tBill._id);
          unpaidBills.splice(targetBillIndex, 1); // Remove from list so we don't process it again
        }
      }
    }

    // Process remaining bills oldest-to-newest with any leftover amount
    for (const bill of unpaidBills) {
      if (remaining <= 0) break;
      if (bill.total <= remaining) {
        applyPaymentToBill(bill);
        await bill.save();
        remaining -= bill.total;
        clearedBillIds.push(bill._id);
      }
      // If the payment doesn't cover this bill fully, leave it as Unpaid
    }

    // ── Step 3: Recalculate true outstanding balance from remaining Unpaid bills ──
    const remainingBillAgg = await Bill.aggregate([
      { $match: { customerPhone: { $regex: cleanPhone, $options: 'i' }, status: 'Unpaid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const trueBalance = remainingBillAgg[0]?.total || 0;

    // ── Step 4: Upsert CreditAccount with correct balance and payment transaction ──
    let account = await CreditAccount.findOne({ phoneNumber: { $regex: cleanPhone, $options: 'i' } });
    const customerName = unpaidBills[0]?.customerName || account?.customerName || 'Unknown Customer';

    if (!account) {
      account = new CreditAccount({
        customerName,
        phoneNumber: cleanPhone,
        balance: trueBalance,
        transactions: [{
          type: 'payment',
          amount: paidAmount,
          note: note || `Cleared ${clearedBillIds.length} bill(s) via ${paymentMode}`,
          date: now
        }]
      });
      await account.save();
    } else {
      account.balance = trueBalance;
      account.transactions.push({
        type: 'payment',
        amount: paidAmount,
        note: note || `Cleared ${clearedBillIds.length} bill(s) via ${paymentMode}`,
        date: now
      });
      await account.save();
    }

    res.status(200).json({
      success: true,
      message: `Payment of ₹${paidAmount} recorded. ${clearedBillIds.length} bill(s) marked as Paid. Remaining due: ₹${trueBalance}`,
      clearedBills: clearedBillIds.length,
      account: {
        _id: account._id,
        customerName: account.customerName,
        phoneNumber: account.phoneNumber,
        balance: trueBalance,
        updatedAt: account.updatedAt
      }
    });
  } catch (error) {
    console.error('[Khata] Error settling payment:', error);
    res.status(500).json({ message: 'Error settling Khata payment', error: error.message });
  }
};


