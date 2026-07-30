import CreditAccount from '../models/CreditAccount.js';

// Get all credit accounts
export const getCreditAccounts = async (req, res) => {
  try {
    const accounts = await CreditAccount.find().sort({ updatedAt: -1 });
    res.status(200).json(accounts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching credit accounts', error: error.message });
  }
};

// Create a new credit account
export const createCreditAccount = async (req, res) => {
  try {
    const { customerName, phoneNumber, initialBalance = 0 } = req.body;
    
    // Check if account already exists for this phone number
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

// Add a transaction (payment or new credit)
export const addTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, note, billId } = req.body;

    const account = await CreditAccount.findById(id);
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Add transaction
    account.transactions.push({ type, amount, note, billId });

    // Update balance
    if (type === 'credit') {
      account.balance += amount; // Customer owes more
    } else if (type === 'payment') {
      account.balance -= amount; // Customer paid off some debt
    }

    await account.save();
    res.status(200).json(account);
  } catch (error) {
    res.status(500).json({ message: 'Error adding transaction', error: error.message });
  }
};
