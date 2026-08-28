import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { Plus, ArrowLeft, ArrowUpRight, ArrowDownLeft, Search, UserCheck } from 'lucide-react';

const DuePayment = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);

  const [accountFormData, setAccountFormData] = useState({
    customerName: '',
    phoneNumber: '',
    initialBalance: ''
  });

  const [transactionFormData, setTransactionFormData] = useState({
    type: 'payment',
    amount: '',
    note: ''
  });

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/credit-accounts`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setAccounts(response.data);
    } catch (error) {
      console.error('Error fetching credit accounts', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${getApiUrl()}/credit-accounts`, accountFormData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setIsNewAccountModalOpen(false);
      setAccountFormData({ customerName: '', phoneNumber: '', initialBalance: '' });
      fetchAccounts();
    } catch (error) {
      console.error('Error creating account', error);
      alert(error.response?.data?.message || 'Error creating account');
    }
  };

  const handleAddTransaction = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${getApiUrl()}/credit-accounts/${selectedAccount._id}/transactions`, transactionFormData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setIsTransactionModalOpen(false);
      setTransactionFormData({ type: 'payment', amount: '', note: '' });
      setSelectedAccount(null);
      fetchAccounts();
    } catch (error) {
      console.error('Error adding transaction', error);
      alert('Error adding transaction');
    }
  };

  const filteredAccounts = accounts.filter((acc) =>
  acc.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
  acc.phoneNumber.includes(searchTerm)
  );

  const totalOutstanding = accounts.reduce((sum, acc) => sum + (acc.balance > 0 ? acc.balance : 0), 0);

  return (
    <div className="h-full flex flex-col bg-gray-50 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 sm:mb-2.5 gap-2.5">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-bold text-gray-800">{t("Due Payment (Khata)")}</h1>
            <p className="text-xs text-gray-500">{t("Manage customer credit accounts and dues")}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-between sm:justify-end">
          <div className="bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">{t("Total Outstanding:")}</span>
            <span className="text-sm sm:text-base font-bold text-red-600">
              ₹{totalOutstanding.toFixed(2)}
            </span>
          </div>
          <button
            onClick={() => setIsNewAccountModalOpen(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3 py-2 rounded-lg transition-colors text-xs sm:text-sm font-bold shadow-sm">
            
            <UserCheck size={16} />{t("New Customer Khata")}
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center gap-3">
        <Search className="text-gray-400" size={20} />
        <input
          type="text" placeholder={t("Search by customer name or phone number...")}

          className="flex-1 outline-none text-gray-700 bg-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)} />
        
      </div>

      {loading ?
      <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAccounts.length === 0 ?
        <div className="col-span-full text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-100">{t("No credit accounts found.")}

        </div> :

        filteredAccounts.map((account) =>
        <div key={account._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{account.customerName}</h3>
                    <p className="text-gray-500 text-sm font-medium">{account.phoneNumber}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${account.balance > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    ₹{account.balance.toFixed(2)} {account.balance > 0 ? 'Due' : 'Cleared'}
                  </div>
                </div>
                
                <div className="text-xs text-gray-400 mb-4">{t("Last updated:")}
            {new Date(account.updatedAt).toLocaleDateString()}
                </div>

                <div className="flex gap-2">
                  <button
              onClick={() => {
                setSelectedAccount(account);
                setTransactionFormData({ type: 'payment', amount: '', note: '' });
                setIsTransactionModalOpen(true);
              }}
              className="flex-1 py-2 text-sm font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-colors flex items-center justify-center gap-1">
              
                    <ArrowDownLeft size={16} />{t("Collect")}
            </button>
                  <button
              onClick={() => {
                setSelectedAccount(account);
                setTransactionFormData({ type: 'credit', amount: '', note: '' });
                setIsTransactionModalOpen(true);
              }}
              className="flex-1 py-2 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors flex items-center justify-center gap-1">
              
                    <ArrowUpRight size={16} />{t("Give Credit")}
            </button>
                </div>
              </div>
        )
        }
        </div>
      }

      {/* New Account Modal */}
      {isNewAccountModalOpen &&
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">{t("New Khata Account")}</h2>
              <button onClick={() => setIsNewAccountModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Customer Name")}</label>
                <input
                type="text" required
                value={accountFormData.customerName}
                onChange={(e) => setAccountFormData({ ...accountFormData, customerName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder={t("Rahul Kumar")} />

              
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Phone Number")}</label>
                <input
                type="tel" required
                value={accountFormData.phoneNumber}
                onChange={(e) => setAccountFormData({ ...accountFormData, phoneNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder="9876543210" />
              
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Previous Balance (if any)")}</label>
                <input
                type="number" min="0" step="1"
                value={accountFormData.initialBalance}
                onChange={(e) => setAccountFormData({ ...accountFormData, initialBalance: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder="0" />
              
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsNewAccountModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">{t("Cancel")}</button>
                <button type="submit" className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-medium shadow-lg shadow-primary/30 transition-all">{t("Create Account")}</button>
              </div>
            </form>
          </div>
        </div>
      }

      {/* Transaction Modal */}
      {isTransactionModalOpen && selectedAccount &&
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {transactionFormData.type === 'payment' ? 'Collect Payment' : 'Give Credit'}
                </h2>
                <p className="text-sm text-gray-500">{t("For")}{selectedAccount.customerName}</p>
              </div>
              <button onClick={() => setIsTransactionModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleAddTransaction} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Amount (₹)")}</label>
                <input
                type="number" required min="1" step="1"
                value={transactionFormData.amount}
                onChange={(e) => setTransactionFormData({ ...transactionFormData, amount: e.target.value })}
                className="w-full px-4 py-3 text-lg font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder="500" />
              
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Note (Optional)")}</label>
                <input
                type="text"
                value={transactionFormData.note}
                onChange={(e) => setTransactionFormData({ ...transactionFormData, note: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                placeholder={transactionFormData.type === 'payment' ? 'e.g. Paid via UPI' : 'e.g. Took 2 teas on credit'} />
              
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsTransactionModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">{t("Cancel")}</button>
                <button type="submit" className={`flex-1 py-3 text-white rounded-xl font-medium shadow-lg transition-all ${
              transactionFormData.type === 'payment' ? 'bg-green-600 hover:bg-green-700 shadow-green-600/30' : 'bg-red-600 hover:bg-red-700 shadow-red-600/30'}`
              }>{t("Confirm")}
                {transactionFormData.type === 'payment' ? 'Collection' : 'Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>);

};

export default DuePayment;