import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { getApiUrl } from '../config.js';
import { getCachedMenuItems } from '../db/offlineDb';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, Plus, Minus, Search, User, Users, Clipboard, X, CheckCircle, UserCheck, ChevronUp, ChevronDown, PieChart, Loader2, Gift, Tags, Clock, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';

const BillSummary = ({
  orderId,
  cart,
  updateQuantity,
  updateItemNote,
  subtotal,
  taxAmount,
  discountAmount,
  total,
  orderStatus,
  activeTable,
  onSaveOrder,
  onHoldOrder,
  onGenerateBill,
  onSettleBill,
  onPrintKOT,
  onPrintBill,
  onReopenOrder,
  onCancelOrder,
  onTransferTable,
  floors = [],
  onSelectTable,
  discount,
  setDiscount,
  taxRate,
  setTaxRate,
  billType,
  setBillType,
  loading,
  actionLoading,
  orderSource,
  setOrderSource,
  userRole = 'Admin',
  customerPhone,
  setCustomerPhone,
  customerName,
  setCustomerName,
  customerInfo,
  deliveryCharge,
  setDeliveryCharge,
  containerCharge,
  setContainerCharge,
  hasUnprintedItems = true,
  hasPendingChanges = false,
  openOrders = [],
  reservations = [],
  onOpenCustomerModal
}) => {
  const { t, language } = useLanguage();
  const isBilledLocked = orderStatus === 'Billed' && !hasPendingChanges;
  const isLocked = orderStatus === 'Paid' || orderStatus === 'Cancelled' || isBilledLocked;
  const isCaptain = userRole === 'Captain';

  const cartEndRef = React.useRef(null);
  useEffect(() => {
    if (cartEndRef.current) {
      cartEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [cart.length]);

  const [isPaid, setIsPaid] = useState(false);
  const [useLoyalty, setUseLoyalty] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [pax, setPax] = useState(1);
  const [isSplitActive, setIsSplitActive] = useState(false);
  const [showCharges, setShowCharges] = useState(false);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');

  const [showPaxModal, setShowPaxModal] = useState(false);
  const [paxInput, setPaxInput] = useState('1');

  const [waiter, setWaiter] = useState('');
  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [waiterInput, setWaiterInput] = useState('');

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [selectedCartItemForNote, setSelectedCartItemForNote] = useState(null);

  const [showSplitCalcModal, setShowSplitCalcModal] = useState(false);
  const [splitWays, setSplitWays] = useState(2);

  // Custom Delivery Platforms State (Full CRUD per shop)
  const [customPlatforms, setCustomPlatforms] = useState(() => {
    try {
      const saved = localStorage.getItem('msbillings_custom_delivery_platforms');
      return saved ? JSON.parse(saved) : ['Dunzo', 'Magicpin', 'Shadowfax'];
    } catch {
      return ['Dunzo', 'Magicpin', 'Shadowfax'];
    }
  });
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');

  const handleAddPlatform = (e) => {
    if (e) e.preventDefault();
    const cleanName = (newPlatformName || '').trim();
    if (!cleanName) return;

    const allPlatforms = ['Direct', 'Swiggy', 'Zomato', ...customPlatforms];
    const exists = allPlatforms.some(p => p.toLowerCase() === cleanName.toLowerCase());
    if (exists) {
      alert(t('Platform already exists!'));
      return;
    }

    const updated = [...customPlatforms, cleanName];
    setCustomPlatforms(updated);
    localStorage.setItem('msbillings_custom_delivery_platforms', JSON.stringify(updated));
    setOrderSource(cleanName);
    setNewPlatformName('');
    setShowPlatformModal(false);
  };

  const handleDeletePlatform = (platformToDelete) => {
    const updated = customPlatforms.filter(p => p !== platformToDelete);
    setCustomPlatforms(updated);
    localStorage.setItem('msbillings_custom_delivery_platforms', JSON.stringify(updated));
    if (orderSource === platformToDelete) {
      setOrderSource('Direct');
    }
  };

  const [tenantDiscounts, setTenantDiscounts] = useState([]);
  const [showOffersModal, setShowOffersModal] = useState(false);
  const [cachedMenuMap, setCachedMenuMap] = useState({});

  useEffect(() => {
    getCachedMenuItems().then((items) => {
      if (items && Array.isArray(items)) {
        const map = {};
        items.forEach(i => {
          const catName = typeof i.category === 'object' && i.category !== null ? i.category.name : i.category;
          if (i.name) map[i.name.trim().toLowerCase()] = catName || '';
        });
        setCachedMenuMap(map);
      }
    }).catch(() => {});
  }, []);

  const checkCategoryMatch = (item, targetCategory) => {
    if (!targetCategory) return true;
    const targetNorm = String(targetCategory).trim().toLowerCase();

    // 1. Direct category on item (name or _id)
    let itemCat = '';
    if (item.category) {
      itemCat = typeof item.category === 'object' && item.category !== null ? (item.category.name || item.category._id) : item.category;
    }

    // 2. Cached menu lookup by item name (fallback for legacy order items)
    if (!itemCat && item.name && cachedMenuMap[item.name.trim().toLowerCase()]) {
      itemCat = cachedMenuMap[item.name.trim().toLowerCase()];
    }

    if (itemCat) {
      const itemCatNorm = String(itemCat).trim().toLowerCase();
      if (itemCatNorm === targetNorm || itemCatNorm.includes(targetNorm) || targetNorm.includes(itemCatNorm)) {
        return true;
      }
    }

    // 3. Fallback: check if item name contains the target category words (e.g., "Fish Fry Mandi (Full)" matches "Fish Mandi")
    if (item.name) {
      const itemNameNorm = item.name.toLowerCase();
      const targetWords = targetNorm.split(/\s+/).filter(w => w.length > 2);
      if (targetWords.length > 0 && targetWords.every(w => itemNameNorm.includes(w))) {
        return true;
      }
    }

    return false;
  };

  const isOfferValid = (d) => {
    if (!d || d.isActive === false) return false;
    if (d.hasTimeline && d.endDate) {
      const endStr = `${d.endDate.split('T')[0]}T${d.endTime || '23:59'}:59`;
      const startStr = `${(d.startDate || d.endDate).split('T')[0]}T${d.startTime || '00:00'}:00`;
      const now = new Date();
      const end = new Date(endStr);
      const start = new Date(startStr);
      if (now > end || now < start) return false;
    }
    return true;
  };

  const getOfferValidityStatus = (d) => {
    if (!d || d.isActive === false) return { label: 'Inactive', timeRemaining: '' };
    if (d.hasTimeline && d.endDate) {
      const endStr = `${d.endDate.split('T')[0]}T${d.endTime || '23:59'}:59`;
      const now = new Date();
      const end = new Date(endStr);
      if (now > end) {
        return { label: 'Expired', isExpired: true };
      }
      const diffMs = end - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return {
        label: 'Active',
        timeRemaining: diffDays > 0 ? `${diffDays}d ${diffHours}h left` : `${diffHours}h left`
      };
    }
    return { label: 'Active', timeRemaining: 'Ongoing' };
  };

  const applyPresetOffer = (rule) => {
    if (!rule) return;
    if (!isOfferValid(rule)) {
      alert(t("This offer has expired or is not currently active."));
      return;
    }

    if (rule.type === 'bogo') {
      const buyQty = Math.max(1, Number(rule.buyQty) || 2);
      const getQty = Math.max(1, Number(rule.getQty) || 1);

      let bogoDiscount = 0;
      cart.forEach((item) => {
        const isCategoryMatch = rule.applicableTo === 'category'
          ? checkCategoryMatch(item, rule.targetCategory)
          : true;

        if (isCategoryMatch && item.quantity >= buyQty) {
          const freeSets = Math.floor(item.quantity / buyQty);
          const freeItems = freeSets * getQty;
          bogoDiscount += freeItems * (item.price || 0);
        }
      });

      if (bogoDiscount > 0) {
        setDiscount({
          type: 'flat',
          value: bogoDiscount,
          name: rule.name,
          offerName: rule.name,
          applicableTo: rule.applicableTo || 'all',
          targetCategory: rule.targetCategory || ''
        });
        setShowCharges(true);
        setShowOffersModal(false);
      } else {
        const catMsg = rule.applicableTo === 'category' ? ` on Category "${rule.targetCategory}"` : '';
        alert(`${t("No eligible items for")} "${rule.name}" (${t("Buy")} ${buyQty} ${t("Get")} ${getQty} ${t("Free")}${catMsg}). ${t("Add required quantities to cart.")}`);
      }
    } else {
      setDiscount({
        type: rule.type,
        value: rule.value,
        name: rule.name,
        offerName: rule.name,
        applicableTo: rule.applicableTo || 'all',
        targetCategory: rule.targetCategory || ''
      });
      setShowCharges(true);
      setShowOffersModal(false);
    }
  };

  useEffect(() => {
    const fetchTenantDiscounts = async () => {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${getApiUrl()}/discounts`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (Array.isArray(res.data)) {
          setTenantDiscounts(res.data);
        }
      } catch (err) {
        console.error('Error loading tenant discounts in BillSummary:', err);
      }
    };
    fetchTenantDiscounts();
  }, []);

  useEffect(() => {
    if (total > 0) {
      setSettlementAmount(total.toFixed(2));
    } else {
      setSettlementAmount('');
    }
  }, [total]);

  // Keep applied BOGO offer discount amount synchronized dynamically as cart items change
  useEffect(() => {
    if (discount?.name && tenantDiscounts && tenantDiscounts.length > 0 && cart && cart.length > 0) {
      const matchedBogo = tenantDiscounts.find(d => d.type === 'bogo' && d.name === discount.name && isOfferValid(d));
      if (matchedBogo) {
        const buyQty = Math.max(1, Number(matchedBogo.buyQty) || 2);
        const getQty = Math.max(1, Number(matchedBogo.getQty) || 1);
        let bogoDiscount = 0;
        cart.forEach((item) => {
          const isCategoryMatch = matchedBogo.applicableTo === 'category'
            ? checkCategoryMatch(item, matchedBogo.targetCategory)
            : true;

          if (isCategoryMatch && item.quantity >= buyQty) {
            const freeSets = Math.floor(item.quantity / buyQty);
            const freeItems = freeSets * getQty;
            bogoDiscount += freeItems * (item.price || 0);
          }
        });
        if (bogoDiscount !== discount.value) {
          setDiscount(prev => ({
            ...prev,
            type: 'flat',
            value: bogoDiscount,
            name: matchedBogo.name,
            offerName: matchedBogo.name,
            applicableTo: matchedBogo.applicableTo || 'all',
            targetCategory: matchedBogo.targetCategory || ''
          }));
        }
      }
    }
  }, [cart, tenantDiscounts]);

  const handleBogoOffer = () => {
    if (!cart || cart.length === 0) {
      alert(t("Cart is empty. Please add items to calculate BOGO offer."));
      return;
    }

    const activeBogoRules = (tenantDiscounts || []).filter(d => d.type === 'bogo' && isOfferValid(d));

    let bogoDiscount = 0;
    let appliedRuleNames = [];

    if (activeBogoRules.length > 0) {
      // Apply configured tenant BOGO rules
      activeBogoRules.forEach((rule) => {
        const buyQty = Math.max(1, Number(rule.buyQty) || 2);
        const getQty = Math.max(1, Number(rule.getQty) || 1);

        cart.forEach((item) => {
          const isCategoryMatch = rule.applicableTo === 'category'
            ? checkCategoryMatch(item, rule.targetCategory)
            : true;

          if (isCategoryMatch && item.quantity >= buyQty) {
            const freeSets = Math.floor(item.quantity / buyQty);
            const freeItems = freeSets * getQty;
            const itemDiscount = freeItems * (item.price || 0);
            bogoDiscount += itemDiscount;
            if (itemDiscount > 0 && !appliedRuleNames.includes(rule.name)) {
              appliedRuleNames.push(rule.name);
            }
          }
        });
      });
    } else {
      // Universal fallback: Buy 2 get 1 free on all items
      cart.forEach((item) => {
        if (item.quantity >= 2) {
          const freeItems = Math.floor(item.quantity / 2);
          bogoDiscount += freeItems * (item.price || 0);
        }
      });
      appliedRuleNames.push("Buy 2 Get 1 Free");
    }

    if (bogoDiscount > 0) {
      setDiscount({ type: 'flat', value: bogoDiscount, name: appliedRuleNames.join(', '), offerName: appliedRuleNames.join(', ') });
      setShowCharges(true);
      setShowDiscountInput(true);
    } else {
      if (activeBogoRules.length > 0) {
        const ruleDescriptions = activeBogoRules.map(r => `• ${r.name}: Buy ${r.buyQty} Get ${r.getQty} Free ${r.applicableTo === 'category' ? `(${r.targetCategory})` : '(All Items)'}`).join('\n');
        alert(`${t("No eligible items for active BOGO offer(s):")}\n${ruleDescriptions}`);
      } else {
        alert(t("No eligible items for BOGO. Add at least 2 quantities of the same item."));
      }
    }
  };

  const currencySymbol = localStorage.getItem('primaryCurrency') === 'USD' ? '$' : '₹';

  const handlePaxClick = () => {
    setPaxInput(pax.toString());
    setShowPaxModal(true);
  };

  const submitPax = (applySplit = false) => {
    if (paxInput && !isNaN(paxInput) && Number(paxInput) > 0) {
      const val = Number(paxInput);
      setPax(val);
      setSplitWays(val);
      if (val > 1) {
        setIsSplitActive(true);
        if (total > 0) {
          setSettlementAmount((total / val).toFixed(2));
        }
      } else {
        setIsSplitActive(false);
        if (total > 0) {
          setSettlementAmount(total.toFixed(2));
        }
      }
    }
    setTimeout(() => setShowPaxModal(false), 50);
  };

  const handleCancelSplit = () => {
    setPax(1);
    setPaxInput('1');
    setSplitWays(1);
    setIsSplitActive(false);
    if (total > 0) {
      setSettlementAmount(total.toFixed(2));
    }
    setTimeout(() => {
      setShowSplitCalcModal(false);
      setShowPaxModal(false);
    }, 50);
  };

  const handleWaiterClick = () => {
    setWaiterInput(waiter || '');
    setShowWaiterModal(true);
  };

  const submitWaiter = () => {
    const trimmed = (waiterInput || '').trim();
    setWaiter(trimmed);
    setShowWaiterModal(false);
  };

  const handleClearWaiter = () => {
    setWaiter('');
    setWaiterInput('');
    setShowWaiterModal(false);
  };

  const handleItemNoteClick = (item) => {
    setSelectedCartItemForNote(item);
    setNoteInput(item.specialNote || '');
    setShowNoteModal(true);
  };

  const handleNoteClick = () => {
    if (cart && cart.length > 0) {
      const target = cart[cart.length - 1];
      setSelectedCartItemForNote(target);
      setNoteInput(target.specialNote || '');
    } else {
      setSelectedCartItemForNote(null);
      setNoteInput('');
    }
    setShowNoteModal(true);
  };

  const submitNote = () => {
    if (selectedCartItemForNote) {
      updateItemNote(selectedCartItemForNote.name || selectedCartItemForNote._id, noteInput);
    } else if (cart && cart.length > 0) {
      updateItemNote(cart[0].name || cart[0]._id, noteInput);
    }
    setSelectedCartItemForNote(null);
    setShowNoteModal(false);
  };

  const handleTableClick = () => {
    if (billType === 'Delivery' || billType === 'Takeaway' || activeTable?.startsWith('DEL-') || activeTable?.startsWith('TAK-')) {
      return;
    }
    if (onTransferTable) {
      onTransferTable();
    }
  };


  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-300 w-full max-w-full overflow-hidden">

      {/* Top Tabs */}
      <div className="flex w-[calc(100%-12px)] mx-1.5 mt-1.5 mb-0.5 bg-gray-100 h-7 shrink-0 p-0.5 gap-0.5 rounded-lg shadow-inner overflow-x-auto no-scrollbar">
        <button
          onClick={() => !isLocked && setBillType('Dine-In')}
          className={`flex-1 font-bold text-[10px] flex items-center justify-center transition-all rounded-md ${billType === 'Dine-In' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`
          }>{t("Dine In")}
        </button>
        <button
          onClick={() => !isLocked && setBillType('Delivery')}
          className={`flex-1 font-bold text-[10px] flex items-center justify-center transition-all rounded-md ${billType === 'Delivery' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`
          }>{t("Delivery")}
        </button>
        <button
          onClick={() => !isLocked && setBillType('Takeaway')}
          className={`flex-1 font-bold text-[10px] flex items-center justify-center transition-all rounded-md ${billType === 'Takeaway' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`
          }>{t("Pick Up")}
        </button>
      </div>

      {/* Delivery Platform Selection with Full CRUD */}
      {billType === 'Delivery' && (
        <div className="flex w-[calc(100%-24px)] mx-3 mt-1 mb-1 items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
          <select
            value={orderSource || 'Direct'}
            onChange={(e) => {
              if (e.target.value === '__ADD_NEW__') {
                setShowPlatformModal(true);
              } else {
                setOrderSource(e.target.value);
              }
            }}
            disabled={isLocked}
            className="flex-1 bg-gray-50 border border-gray-200 text-gray-800 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-2xs cursor-pointer"
          >
            <option value="Direct">{t("Direct Delivery")}</option>
            <option value="Swiggy">{t("Swiggy")}</option>
            <option value="Zomato">{t("Zomato")}</option>
            
            {customPlatforms.length > 0 && (
              <optgroup label={t("Custom Platforms")}>
                {customPlatforms.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </optgroup>
            )}

            {orderSource && !['Direct', 'Swiggy', 'Zomato', ...customPlatforms].includes(orderSource) && (
              <option value={orderSource}>{orderSource}</option>
            )}

            <option value="__ADD_NEW__" className="text-orange-600 font-bold">
              + {t("Add Custom Platform...")}
            </option>
          </select>

          {/* Manage / Add / Delete Platforms Button */}
          <button
            type="button"
            onClick={() => setShowPlatformModal(true)}
            disabled={isLocked}
            className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-lg transition-all shadow-2xs cursor-pointer shrink-0"
            title={t("Manage Delivery Platforms (Add / Delete)")}
          >
            <Plus size={14} />
          </button>
        </div>
      )}

      {/* Info Bar */}
      <div className="flex items-center gap-1 px-2.5 sm:px-3 py-1 border-b border-gray-100 bg-white overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 shrink-0">
          {(() => {
            let catName = 'TABLE';
            let displayVal = activeTable || '--';

            if (activeTable) {
              const tablePart = activeTable.includes(' - ') ? activeTable.split(' - ').slice(1).join(' - ').trim() : activeTable.trim();
              displayVal = tablePart;

              let foundType = null;
              if (floors && Array.isArray(floors)) {
                for (const floor of floors) {
                  for (const key of ['tables', 'cabins', 'sofas', 'spaces']) {
                    const matched = (floor[key] || []).find(item => 
                      item.name?.trim().toLowerCase() === tablePart.toLowerCase() ||
                      `${floor.name} - ${item.name}`.trim().toLowerCase() === activeTable.trim().toLowerCase()
                    );
                    if (matched) {
                      foundType = matched.type || key.replace(/s$/, '');
                      break;
                    }
                  }
                  if (foundType) break;
                }
              }

              if (foundType) {
                catName = foundType;
              } else if (tablePart.startsWith('DEL-') || billType === 'Delivery') {
                catName = 'DELIVERY';
                displayVal = tablePart.startsWith('DEL-') ? `#${tablePart.replace('DEL-', '')}` : tablePart;
              } else if (tablePart.startsWith('TAK-') || billType === 'Takeaway') {
                catName = 'PICK UP';
                displayVal = tablePart.startsWith('TAK-') ? `#${tablePart.replace('TAK-', '')}` : tablePart;
              } else {
                const wordMatch = tablePart.match(/^([A-Za-z]+)/);
                if (wordMatch) {
                  catName = wordMatch[1];
                }
              }
            }

            const isDineIn = billType !== 'Delivery' && billType !== 'Takeaway' && !activeTable?.startsWith('DEL-') && !activeTable?.startsWith('TAK-');
            return (
              <div 
                onClick={isDineIn ? handleTableClick : undefined} 
                title={isDineIn ? `${t(catName)} - ${displayVal} (${t("Click to Transfer")})` : `${t(catName)} - ${displayVal}`} 
                className={`flex flex-col items-center justify-center min-w-[28px] max-w-[56px] h-7 bg-red-50 border border-red-100 rounded-lg text-red-600 overflow-hidden px-1 shadow-sm transition-colors ${
                  isDineIn ? 'cursor-pointer hover:bg-red-100' : 'cursor-default'
                }`}
              >
                <span className="text-[5.5px] font-bold opacity-80 leading-tight uppercase truncate max-w-full text-center">
                  {t(catName)}
                </span>
                <span className="text-[9px] font-black whitespace-nowrap truncate w-full text-center leading-tight">
                  {displayVal}
                </span>
              </div>
            );
          })()}

          {/* PAX Badge */}
          <div 
            onClick={handlePaxClick} 
            title={`${t("Number of Persons (PAX)")}: ${pax}`}
            className={`flex items-center justify-center gap-1 min-w-[30px] h-7 px-1.5 rounded-lg cursor-pointer shadow-2xs transition-all shrink-0 ${
              pax > 1 
                ? 'bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-black' 
                : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold'
            }`}
          >
            <Users size={11} className="opacity-80 shrink-0" />
            <span className="text-[9px] leading-none">{pax}</span>
          </div>

          {/* Waiter / Captain Badge */}
          <div 
            onClick={handleWaiterClick} 
            title={waiter ? `${t("Waiter")}: ${waiter} (${t("Click to change")})` : t("Assign Waiter / Captain")}
            className={`flex items-center justify-center gap-1 min-w-[30px] max-w-[85px] h-7 px-1.5 rounded-lg cursor-pointer shadow-2xs transition-all shrink-0 ${
              waiter 
                ? 'bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-bold' 
                : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500'
            }`}
          >
            <UserCheck size={11} className="opacity-80 shrink-0" />
            <span className="text-[9px] font-bold truncate">{waiter || t("Waiter")}</span>
          </div>

          {/* Customer CRM Badge */}
          <div 
            onClick={onOpenCustomerModal} 
            title={customerPhone || customerName ? `${customerName || 'Customer'} (${customerPhone || 'CRM'}) - ${t("Click to edit")}` : t("Customer CRM - Link Phone & Name")}
            className={`flex items-center justify-center gap-1 min-w-[30px] max-w-[85px] sm:max-w-[100px] h-7 px-1.5 rounded-lg cursor-pointer shadow-2xs transition-all active:scale-95 shrink-0 ${
              customerPhone || customerName 
                ? 'bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 font-bold' 
                : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-800'
            }`}
          >
            <User size={11} className={`shrink-0 ${customerPhone || customerName ? 'text-orange-600' : 'opacity-80'}`} />
            <span className="text-[9px] font-bold truncate">
              {customerName || customerPhone || t("CRM")}
            </span>
          </div>

          {/* Special Note Badge */}
          {(() => {
            const hasAnyNote = (cart || []).some(item => !!item.specialNote) || (selectedCartItemForNote && selectedCartItemForNote.specialNote);
            return (
              <div 
                onClick={handleNoteClick} 
                title={hasAnyNote ? t("Special Notes Active (Click to edit)") : t("Add Special Note")}
                className={`flex items-center justify-center gap-1 min-w-[30px] max-w-[75px] h-7 px-1.5 rounded-lg cursor-pointer shadow-2xs transition-all shrink-0 ${
                  hasAnyNote 
                    ? 'bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-bold' 
                    : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500'
                }`}
              >
                <Clipboard size={11} className="opacity-80 shrink-0" />
                <span className="text-[9px] font-bold truncate">{hasAnyNote ? `📝 ${t("Note")}` : t("Note")}</span>
              </div>
            );
          })()}

          {/* Instant Stat Badge */}
          {cart.length > 0 && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 border border-orange-200 rounded-md text-orange-700 text-[9px] font-bold shadow-2xs ml-0.5 shrink-0 animate-in fade-in duration-150">
              <span>{cart.length} {cart.length === 1 ? t("Item") : t("Items")}</span>
              <span className="text-orange-300 font-normal">|</span>
              <span>{cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0)} {t("Qty")}</span>
            </div>
          )}
          {orderStatus === 'Billed' && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 border border-amber-300 rounded-md text-amber-800 text-[9px] font-black uppercase tracking-wider shadow-2xs ml-0.5 shrink-0 animate-in fade-in duration-150">
              <span>{t("BILLED")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Active Split Strip */}
      {isSplitActive && pax > 1 && total > 0 && (
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50/50 border-b border-orange-200 text-orange-900 shadow-2xs shrink-0 animate-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
            </span>
            <span className="text-[11px] font-extrabold text-orange-900 truncate">
              {t("Split Bill")}: <span className="text-orange-600 font-black text-xs">{currencySymbol}{(total / pax).toFixed(2)}</span> <span className="font-normal text-[10px] text-orange-700">/ {t("person")}</span>
            </span>
            <span className="text-[9px] font-bold text-orange-600 bg-orange-100 px-1 py-0.2 rounded shrink-0">({pax} PAX)</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                const perPerson = (total / pax).toFixed(2);
                setSettlementAmount(perPerson);
              }}
              className="px-2 py-0.5 bg-orange-600 hover:bg-orange-700 active:scale-95 text-white rounded text-[10px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
              title={t("Set Settlement Amount to this split share")}
            >
              <span>{t("Apply to Settle")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSplitWays(pax);
                setShowSplitCalcModal(true);
              }}
              className="p-1 bg-white hover:bg-orange-100 border border-orange-200 text-orange-700 rounded text-[10px] font-bold transition-all cursor-pointer"
              title={t("Open Split Calculator")}
            >
              <PieChart size={12} />
            </button>
            <button
              type="button"
              onClick={handleCancelSplit}
              className="p-1 bg-white hover:bg-red-50 border border-red-200 text-red-500 hover:text-red-700 rounded text-[10px] font-bold transition-all cursor-pointer"
              title={t("Cancel Split (Reset to Full Bill)")}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Assigned Waiter Strip */}
      {waiter && (
        <div className="flex items-center justify-between px-2.5 py-1 bg-blue-50 border-b border-blue-100 text-[10px] font-bold text-blue-800 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <UserCheck size={12} className="text-blue-600 shrink-0" />
            <span className="text-gray-500 font-semibold">{t("Assigned Waiter")}:</span>
            <span className="text-blue-700 font-extrabold truncate">{waiter}</span>
          </div>
          <button
            type="button"
            onClick={handleClearWaiter}
            className="text-blue-400 hover:text-red-500 transition-colors p-0.5 rounded cursor-pointer"
            title={t("Clear Waiter")}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Table Headers */}
      <div className="flex items-center px-2 py-1 bg-gray-100 border-b border-gray-200 text-gray-500 text-[8px] font-bold uppercase tracking-wider shrink-0">
        <div className="w-[44%] flex items-center gap-1.5 min-w-0">
          <span className="shrink-0">{t("Items")}</span>
          {cart.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[8px] font-black bg-orange-100 text-orange-700 border border-orange-200 shadow-2xs truncate">
              {cart.length} ({cart.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0)} {t("Qty")})
            </span>
          )}
        </div>
        <div className="w-[14%] text-center hidden xl:block">{t("Check")}</div>
        <div className="w-[26%] text-center">{t("Qty.")}</div>
        <div className="w-[16%] text-right pr-1">{t("Price")}</div>
      </div>

      {/* Single scrollable area: Cart Items + Bottom charges/totals (action buttons pinned below) */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-white">

      {/* Cart Items List */}
      <div className="bg-white p-0.5 relative">
        {loading ? (
          <div className="p-3 space-y-2.5 animate-in fade-in duration-150">
            {/* Dynamic Status Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                <span className="text-[11px] font-bold text-gray-700 animate-pulse tracking-wide">
                  {t("Loading order items...")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>

            {/* Dynamic Shimmering Item Rows */}
            {[1, 2, 3].map((rowIdx) => (
              <div
                key={rowIdx}
                className="flex items-center justify-between py-2 px-2.5 rounded-xl bg-gradient-to-r from-gray-50 via-orange-50/20 to-gray-50 border border-gray-100 animate-pulse"
                style={{ animationDelay: `${rowIdx * 120}ms` }}
              >
                <div className="flex-1 min-w-0 pr-2 space-y-1.5">
                  <div
                    className="h-3.5 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-md"
                    style={{ width: rowIdx === 1 ? '70%' : rowIdx === 2 ? '50%' : '60%' }}
                  />
                  <div className="h-2 bg-gray-200/70 rounded-md w-1/3" />
                </div>
                <div className="w-12 h-5 bg-gray-200/80 rounded-lg mx-2 shrink-0" />
                <div className="w-10 h-4 bg-gray-200 rounded shrink-0" />
              </div>
            ))}
          </div>
        ) : cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-10">
            <span className="text-xs">{t("No items added")}</span>
          </div>
        ) : (
          cart.map((item, index) => (
            <div key={item._id || item.name || index} className={`flex items-start py-1.5 px-1.5 border-b border-gray-100 hover:bg-gray-50 transition-colors group ${item.isCancelled ? 'opacity-50' : ''}`}>
              {/* Delete Icon */}
              <button
                onClick={() => updateQuantity(item._id || item.name, -item.quantity)}
                disabled={isLocked || item.isCancelled}
                className="w-5 h-5 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center shrink-0 mt-0.5 mr-1 transition-all disabled:opacity-50">
                <X size={12} strokeWidth={3} />
              </button>

              {/* Item Name */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className={`text-[11px] text-gray-700 font-medium leading-tight ${item.isCancelled ? 'line-through' : ''}`}>{(language !== 'en' && item.nameTranslations?.[language]) || item.name}</span>
                  {(() => {
                    const rawQty = parseInt(item.quantity || 0, 10) || 0;
                    const cancelledQty = parseInt(item.cancelledQuantity || 0, 10) || 0;
                    const effectiveQty = Math.max(0, rawQty - cancelledQty);
                    const totalQty = Math.max(0, rawQty);

                    // Use only the first `effectiveQty` slots so cancelled units don't inflate status counts
                    const rawUnitStatuses = Array.isArray(item.unitStatuses) && item.unitStatuses.length === totalQty && totalQty > 0
                      ? item.unitStatuses
                      : Array.from({ length: totalQty }, () => item.status || 'Pending');
                    const unitStatuses = rawUnitStatuses.slice(0, effectiveQty);

                    const preparedCount = unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
                    const preparingCount = unitStatuses.filter(s => s === 'Preparing').length;
                    const pendingCount = unitStatuses.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

                    const hasMixedStatus = effectiveQty > 1 && (
                      (preparedCount > 0 && (preparingCount > 0 || pendingCount > 0)) ||
                      (preparingCount > 0 && pendingCount > 0)
                    );

                    // If item has zero effective quantity (cancelled or removed), show Cancelled — don't run status logic
                    if (effectiveQty === 0) {
                      return <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">{t("Cancelled")}</span>;
                    }

                    if (item.isCancelled) {
                      return <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">{t("Cancelled")}</span>;
                    }
                    if (item.cancellationRejected) {
                      return <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded font-bold">{t("Rejected")}</span>;
                    }
                    if (item.cancellationRequested) {
                      return <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-bold">{t("Pending")}</span>;
                    }

                    const reducedBadge = (item.cancelledQuantity > 0 || item.reducedQuantity > 0) ? (
                      <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold whitespace-nowrap">
                        (-{item.cancelledQuantity || item.reducedQuantity})
                      </span>
                    ) : null;

                    let statusNode = null;

                    if (hasMixedStatus) {
                      statusNode = (
                        <span className="inline-flex items-center gap-1 flex-wrap">
                          {preparedCount > 0 && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200 shadow-2xs inline-flex items-center gap-1">
                              <CheckCircle size={10} className="text-emerald-600 shrink-0" />
                              <span>{preparedCount}x {t("Prepared")}</span>
                            </span>
                          )}
                          {preparingCount > 0 && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200 shadow-2xs inline-flex items-center gap-1">
                              <Loader2 size={10} className="animate-spin text-amber-600 shrink-0" />
                              <span>{preparingCount}x 👨‍🍳 {t("Preparing")}</span>
                            </span>
                          )}
                          {pendingCount > 0 && (
                            <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-100 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                              <span>{pendingCount}x ⏳ {t("Pending")}</span>
                            </span>
                          )}
                        </span>
                      );
                    } else if (item.status === 'Preparing' || preparingCount > 0) {
                      statusNode = (
                        <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200 shadow-2xs inline-flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin text-amber-600 shrink-0" />
                          <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}👨‍🍳 {t("Preparing")}</span>
                        </span>
                      );
                    } else if (effectiveQty > 0 && (item.status === 'Ready' || item.status === 'Prepared' || preparedCount === effectiveQty)) {
                      statusNode = (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200 shadow-2xs inline-flex items-center gap-1">
                          <CheckCircle size={10} className="text-emerald-600 shrink-0" />
                          <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}✅ {t("Prepared")}</span>
                        </span>
                      );
                    } else if (item.status === 'Pending' || ((item.printedQuantity || 0) > 0 && !item.status)) {
                      statusNode = (
                        <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-100 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                          <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}⏳ {t("Pending")}</span>
                        </span>
                      );
                    }

                    if (statusNode || reducedBadge) {
                      return (
                        <span className="inline-flex items-center gap-1">
                          {statusNode}
                          {reducedBadge}
                        </span>
                      );
                    }

                    return null;
                  })()}
                  <button
                    onClick={() => handleItemNoteClick(item)}
                    disabled={isLocked || item.isCancelled}
                    className="text-gray-400 hover:text-orange-500 transition-colors p-0.5"
                    title={t("Add special note for this item")}
                  >
                    <Clipboard size={10} />
                  </button>
                </div>
                {(item.orderedAt || item.createdAt || item.time || item.addedAt) && (
                  <div className="text-[8.5px] text-gray-400 font-semibold mt-0.5 flex items-center gap-0.5">
                    <span>🕒 {(() => {
                      const d = new Date(item.orderedAt || item.createdAt || item.time || item.addedAt);
                      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    })()}</span>
                  </div>
                )}
                {item.specialNote ? (
                  <div
                    onClick={() => handleItemNoteClick(item)}
                    className="text-[9px] text-amber-600 font-bold cursor-pointer hover:underline mt-0.5 flex items-center gap-0.5 truncate"
                  >
                    <span>📝 {item.specialNote}</span>
                  </div>
                ) : null}
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-0 w-[78px] shrink-0 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                <button
                  type="button"
                  onClick={() => updateQuantity(item._id || item.name, -1)}
                  disabled={isLocked || item.isCancelled}
                  className="w-5 h-6 flex items-center justify-center text-gray-600 hover:bg-white hover:text-red-500 disabled:opacity-50 transition-colors shrink-0">
                  <Minus size={11} />
                </button>
                <input
                  type="number"
                  min="1"
                  disabled={isLocked || item.isCancelled}
                  value={item.quantity - (item.cancelledQuantity || 0)}
                  onWheel={(e) => e.target.blur()}
                  onKeyDown={(e) => {
                    if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === '.') e.preventDefault();
                  }}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') return;
                    const parsed = parseInt(raw, 10);
                    if (!isNaN(parsed) && parsed >= 0) {
                      const currentActive = item.quantity - (item.cancelledQuantity || 0);
                      const delta = parsed - currentActive;
                      if (delta !== 0) {
                        updateQuantity(item._id || item.name, delta);
                      }
                    }
                  }}
                  className={`w-7 h-6 bg-white text-center font-bold text-[11px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-primary border-x border-gray-200 p-0 ${item.isCancelled ? 'line-through text-gray-400' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => updateQuantity(item._id || item.name, 1)}
                  disabled={isLocked || item.isCancelled}
                  className="w-5 h-6 flex items-center justify-center text-gray-600 hover:bg-white hover:text-green-600 disabled:opacity-50 transition-colors shrink-0">
                  <Plus size={11} />
                </button>
              </div>

              {/* Price */}
              <div className="w-[50px] shrink-0 text-right flex flex-col justify-center h-6 pr-1">
                <div className={`text-[11px] font-bold text-gray-700 ${item.isCancelled ? 'line-through text-gray-400' : ''}`}>{(item.price * (item.quantity - (item.cancelledQuantity || 0))).toFixed(0)}</div>
              </div>
            </div>
          ))
        )}
        <div ref={cartEndRef} />
      </div>
      {/* END Cart Items */}

      {/* Bottom Action Area - inside the single scrollable wrapper */}
      <div className="flex flex-col w-full bg-white shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-20">

        {/* Collapsible Charges Section - scrollable so buttons stay visible */}
        <div className="bg-gray-50 flex flex-col relative w-full border-b border-gray-200">
          <button
            className="w-full h-7 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors border-t border-gray-200"
            onClick={() => setShowCharges(!showCharges)}>

            {showCharges ? <ChevronUp size={18} className="text-primary stroke-[2.5]" /> : <ChevronDown size={18} className="text-primary stroke-[2.5]" />}
          </button>

          {showCharges &&
            <div className="flex flex-col px-4 py-3 space-y-3 text-sm text-gray-700 overflow-y-auto max-h-[42vh]">
              <div className="flex items-center justify-between font-bold">
                <span className="w-1/3">{t("Sub Total")}</span>
                <span className="w-1/3 text-center">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
                <span className="w-1/3 text-right">{subtotal.toFixed(2)}</span>
              </div>
              <div className={`flex items-center justify-between ${discountAmount > 0 ? 'font-black text-emerald-700 bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-200/60' : 'font-bold'}`}>
                <span className="w-1/2 flex items-center gap-1 min-w-0">
                  <span className="truncate">
                    {t("Discount")}
                    {discount?.name ? (
                      <span className="text-[10px] font-bold text-emerald-800 ml-1 bg-emerald-100/90 px-1.5 py-0.5 rounded-md border border-emerald-300/70 inline-block truncate max-w-[140px]" title={discount.name}>
                        {discount.name}{discount.type === 'percentage' && discount.value ? ` (${discount.value}%)` : (discount.type === 'flat' && discount.value ? ` (${currencySymbol}${discount.value})` : '')}
                      </span>
                    ) : (
                      discount?.type === 'percentage' && discount?.value ? ` (${discount.value}%)` : (discount?.type === 'complimentary' ? ' (100%)' : '')
                    )}
                  </span>
                  <button disabled={isLocked} className="text-primary underline text-[11px] ml-1 hover:text-red-700 font-bold disabled:opacity-50 cursor-pointer shrink-0" onClick={() => setShowDiscountInput(!showDiscountInput)}>{showDiscountInput ? t("Less") : t("More")}</button>
                  {discountAmount > 0 && !isLocked && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDiscount({ type: 'flat', value: '', name: '' });
                      }}
                      className="text-red-500 hover:text-red-700 p-0.5 rounded-full hover:bg-red-100 transition-colors ml-1 cursor-pointer shrink-0"
                      title={t("Remove Discount / Offer")}
                    >
                      <X size={12} />
                    </button>
                  )}
                </span>
                <span className={`w-1/2 text-right ${discountAmount > 0 ? 'text-emerald-700 font-black text-sm' : 'text-green-600'}`}>
                  {discountAmount > 0 ? `-${currencySymbol}${discountAmount.toFixed(2)}` : `(${discountAmount.toFixed(2)})`}
                </span>
              </div>
              {showDiscountInput &&
                <div className="flex items-center justify-between bg-gray-200/50 p-2 rounded-lg gap-2 border border-gray-200">
                  <select
                    disabled={isLocked}
                    className={`${discount?.type === 'complimentary' ? 'w-full' : 'w-1/2'} bg-white border border-gray-300 rounded text-[12px] h-7 outline-none focus:border-primary px-1 disabled:opacity-50`}
                    value={discount?.type || 'percentage'}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      if (selectedVal.startsWith('preset_')) {
                        const presetId = selectedVal.replace('preset_', '');
                        const found = (tenantDiscounts || []).find(d => d._id === presetId);
                        if (found) {
                          applyPresetOffer(found);
                        }
                      } else {
                        let currentVal = discount?.value;
                        if (selectedVal === 'percentage' && Number(currentVal) > 100) {
                          currentVal = '';
                        }
                        setDiscount({ ...(discount || {}), type: selectedVal, value: currentVal, applicableTo: 'all', targetCategory: '', name: '' });
                      }
                    }}>

                    <option value="percentage">{t("% Percent")}</option>
                    <option value="flat">{currencySymbol}{t("Flat")}</option>
                    <option value="complimentary">{t("Complimentary")}</option>
                    {(tenantDiscounts || []).filter(d => isOfferValid(d)).length > 0 && (
                      <optgroup label={t("Active Store Offers")}>
                        {(tenantDiscounts || []).filter(d => isOfferValid(d)).map(d => {
                          const catLabel = d.applicableTo === 'category' && d.targetCategory ? ` on ${d.targetCategory}` : '';
                          const statusInfo = getOfferValidityStatus(d);
                          const timeStr = statusInfo.timeRemaining ? ` • ${statusInfo.timeRemaining}` : '';
                          return (
                            <option key={d._id} value={`preset_${d._id}`}>
                              {d.name} ({d.type === 'percentage' ? `${d.value}%` : (d.type === 'bogo' ? 'BOGO' : `${currencySymbol}${d.value}`)}{catLabel}{timeStr})
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                  {discount?.type !== 'complimentary' && (
                    <input
                      type="number"
                      min="0"
                      max={discount?.type === 'percentage' ? '100' : undefined}
                      disabled={isLocked}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                      className="w-1/2 bg-white border border-gray-300 text-gray-800 text-right px-2 rounded h-7 outline-none focus:border-primary text-[12px] font-bold disabled:opacity-50"
                      placeholder={discount?.type === 'percentage' ? t('0-100%') : t('Value')}
                      value={discount?.value ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setDiscount({ ...(discount || {}), value: '' });
                          return;
                        }
                        let num = parseFloat(raw);
                        if (isNaN(num)) num = 0;
                        if (discount?.type === 'percentage') {
                          num = Math.min(100, Math.max(0, num));
                        } else {
                          num = Math.max(0, num);
                        }
                        setDiscount({ ...(discount || {}), value: num });
                      }} />
                  )}
                </div>
              }
              <div className="flex items-center justify-between font-bold">
                <span className="w-1/3">{t("GST")} {taxRate ? `(${taxRate}%)` : ''}</span>
                <span className="w-1/3 text-center"></span>
                <span className="w-1/3 text-right">{(taxAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="w-2/3">{t("Delivery Charge")}</span>
                <span className="w-1/3 text-right">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    disabled={isLocked}
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    value={deliveryCharge === '0' || deliveryCharge === 0 ? '' : deliveryCharge}
                    onChange={(e) => setDeliveryCharge && setDeliveryCharge(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-[80px] bg-white border border-gray-300 text-gray-800 text-right px-1 rounded h-7 outline-none focus:border-primary font-bold text-xs disabled:opacity-50" />
                </span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="w-2/3 flex items-center gap-1"><span className="w-3 h-3 border border-gray-400 bg-gray-100 rounded-full inline-block"></span>{t("Container Charge")}</span>
                <span className="w-1/3 text-right">
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    disabled={isLocked}
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
                    value={containerCharge === '0' || containerCharge === 0 ? '' : containerCharge}
                    onChange={(e) => setContainerCharge && setContainerCharge(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-[80px] bg-white border border-gray-300 text-gray-800 text-right px-1 rounded h-7 outline-none focus:border-primary font-bold text-xs disabled:opacity-50" />
                </span>
              </div>
            </div>
          }
          {showCharges &&
            <div className="w-full h-3 bg-gray-50 flex items-center justify-center text-gray-500 border-t border-gray-200">
            </div>
          }
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-100 overflow-x-auto no-scrollbar w-full gap-1">
          <div className="flex items-center gap-1 shrink-0">
            <button
              disabled={isLocked}
              onClick={() => setShowOffersModal(true)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors whitespace-nowrap disabled:opacity-50 flex items-center gap-1 cursor-pointer ${
                discount?.name
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs hover:bg-emerald-700'
                  : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
              }`}
              title={t("Browse & apply active discounts, percentage offers, and BOGO deals")}
            >
              <Tags size={12} />
              <span>{discount?.name ? `${discount.name}` : t("Offers")}</span>
            </button>
            <button
              disabled={isLocked}
              onClick={() => {
                setSplitWays(pax > 1 ? pax : 2);
                setShowSplitCalcModal(true);
              }}
              className="bg-red-50 text-red-600 px-2 py-0.5 rounded-md text-[11px] font-bold border border-red-100 hover:bg-red-100 transition-colors whitespace-nowrap disabled:opacity-50">{t("Split")}
            </button>
            <button
              disabled={isLocked}
              onClick={() => {
                if (discount?.type === 'complimentary') {
                  setDiscount({ type: 'flat', value: '', name: '' });
                } else {
                  setDiscount({ type: 'complimentary', value: '', name: 'Complimentary' });
                }
              }}
              className={`${discount?.type === 'complimentary' ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'} px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors whitespace-nowrap disabled:opacity-50`}>
              {t("Complimentary")}
            </button>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <span className="text-gray-500 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">{t("Total")}</span>
            {loading ? (
              <div className="h-5 w-14 bg-orange-100/80 rounded-md animate-pulse" />
            ) : (
              <span className="text-primary text-base sm:text-lg font-black">{currencySymbol}{total.toFixed(0)}</span>
            )}
          </div>
        </div>

        {/* Row 3: Settlement */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-gray-100 overflow-x-auto no-scrollbar w-full gap-1">
          <div className="flex flex-col min-w-0">
            <span className="text-gray-600 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider shrink-0">{t("Settlement Amount")}</span>
            {total > 0 && pax > 1 && (
              <button
                type="button"
                onClick={() => setSettlementAmount((total / pax).toFixed(2))}
                className="text-[9px] text-orange-600 hover:text-orange-700 font-bold text-left hover:underline cursor-pointer flex items-center gap-0.5"
                title={t("Click to set split amount for this person")}
              >
                <span>👥 {currencySymbol}{(total / pax).toFixed(2)}/person ({pax} PAX)</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-1 shrink-0">
            <input
              type="number"
              min="0"
              onWheel={(e) => e.target.blur()}
              onKeyDown={(e) => { if (e.key === '-' || e.key === 'e' || e.key === 'E') e.preventDefault(); }}
              value={settlementAmount}
              onChange={(e) => setSettlementAmount(Math.max(0, parseFloat(e.target.value) || 0))}
              disabled={isLocked || cart.length === 0}
              className="w-[75px] sm:w-[85px] h-7 bg-white border border-gray-200 text-gray-800 text-right px-1.5 rounded-lg outline-none focus:border-primary font-bold text-xs sm:text-sm disabled:opacity-50" />
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsPaid(true);
                if (onSettleBill) onSettleBill();
              }}
              disabled={cart.length === 0 || orderStatus === 'Paid' || loading}
              className="bg-gradient-to-r from-red-600 to-orange-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm hover:shadow-md active:scale-95 transition-all whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer">
              {actionLoading === 'settle' ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  <span>{t("Settling...")}</span>
                </>
              ) : (
                t("Settle")
              )}
            </button>
          </div>
        </div>

        {/* Row 4: Checkboxes */}
        <div className="flex items-center justify-center gap-4 py-1.5 bg-gray-50/30 w-full overflow-x-auto no-scrollbar">
          <label className="flex items-center gap-1.5 text-gray-600 text-xs font-bold cursor-pointer">
            <div className={`w-3.5 h-3.5 flex items-center justify-center rounded border-2 transition-colors ${isPaid ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
              {isPaid && <CheckCircle size={9} className="text-white shrink-0" strokeWidth={3} />}
            </div>
            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="hidden" />{t("It's Paid")}
          </label>
        </div>

        {/* User-friendly Unsaved Items & Navigation Reminder */}
        {isBilledLocked && (
          <div className="mx-2 my-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-amber-800 text-[10px] sm:text-[11px] font-bold shadow-2xs animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-600 font-bold text-xs">🔒</span>
              <span>{t("Billed order is locked. Click EDIT to modify.")}</span>
            </div>
            <button
              type="button"
              onClick={onReopenOrder}
              disabled={loading}
              className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold transition-all shadow-2xs cursor-pointer ml-1.5"
            >
              {t("EDIT")}
            </button>
          </div>
        )}
        {cart.length > 0 && !isLocked && (
          <div className="mx-2 my-1 px-2 py-1.5 bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 border border-amber-200/90 rounded-lg flex items-start gap-1.5 text-[9.5px] sm:text-[10px] text-amber-900 shadow-2xs animate-in fade-in duration-200">
            <span className="text-amber-600 font-bold shrink-0 text-[11px] leading-tight">⚠️</span>
            <span className="leading-tight font-medium">
              {t("Please stay on this page & Save or Fire KOT before navigating away, or unsaved items will be cleared.")}
            </span>
          </div>
        )}
      </div>
      {/* END: Bottom action area + unified scrollable area */}
      </div>

      {/* Action Buttons - ALWAYS PINNED at bottom, outside scroll area */}
      <div className="grid grid-cols-3 gap-1.5 px-2 py-2 bg-white border-t border-gray-200 w-full shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <button
          onClick={onSaveOrder}
          disabled={loading || cart.length === 0 || orderStatus === 'Paid' || isBilledLocked}
          className="col-span-1 bg-red-50 text-red-600 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black tracking-wide hover:bg-red-100 active:scale-95 transition-all shadow-sm border border-red-100 disabled:opacity-50 flex items-center justify-center gap-1">
          {actionLoading === 'save' ? (
            <>
              <Loader2 size={14} className="animate-spin text-red-600" />
              <span>{orderId ? t("Updating...") : t("Saving...")}</span>
            </>
          ) : (
            orderId ? t("UPDATE") : t("SAVE")
          )}
        </button>
        <button
          onClick={onHoldOrder}
          disabled={loading || cart.length === 0 || orderStatus === 'Paid' || isBilledLocked}
          className="col-span-1 bg-orange-50 text-orange-600 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-black tracking-wide hover:bg-orange-100 active:scale-95 transition-all shadow-sm border border-orange-100 disabled:opacity-50 flex items-center justify-center gap-1">
          {actionLoading === 'hold' ? (
            <>
              <Loader2 size={14} className="animate-spin text-orange-600" />
              <span>{t("Holding...")}</span>
            </>
          ) : (
            t("HOLD")
          )}
        </button>
        <button
          onClick={onGenerateBill}
          disabled={loading || cart.length === 0 || orderStatus === 'Paid'}
          className="col-span-1 bg-gradient-to-r from-red-600 to-orange-500 text-white py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black tracking-wide hover:shadow-lg active:scale-95 transition-all shadow-md disabled:opacity-50 flex items-center justify-center text-center gap-1">
          {actionLoading === 'print' ? (
            <>
              <Loader2 size={14} className="animate-spin text-white" />
              <span>{t("Printing...")}</span>
            </>
          ) : (
            (orderStatus === 'Billed' && !hasPendingChanges) ? t("PRINT BILL") : t("SAVE & PRINT")
          )}
        </button>
        {(() => {
          const isKotAlreadyFired = (cart || []).some(item => (item.printedQuantity || 0) > 0);
          return (
            <button
              onClick={onPrintKOT}
              disabled={loading || cart.length === 0 || !hasUnprintedItems || orderStatus === 'Paid'}
              title={!hasUnprintedItems && cart.length > 0 ? t("All items already sent to kitchen. No changes detected.") : (isKotAlreadyFired ? t("KOT UPDATE", { defaultValue: "KOT UPDATE" }) : t("KOT"))}
              className={`col-span-1 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center text-center gap-1 ${
                hasUnprintedItems
                  ? 'bg-amber-500 hover:bg-amber-600 text-white font-black hover:shadow-lg cursor-pointer border border-amber-600'
                  : 'bg-gray-100 text-gray-400 border border-gray-200 disabled:opacity-50'
              }`}>
              {actionLoading === 'kot' ? (
                <>
                  <Loader2 size={14} className="animate-spin text-white" />
                  <span>{isKotAlreadyFired ? t("Updating...", { defaultValue: "Updating..." }) : t("Sending...")}</span>
                </>
              ) : (
                isKotAlreadyFired ? t("KOT UPDATE", { defaultValue: "KOT UPDATE" }) : t("KOT")
              )}
            </button>
          );
        })()}
        <button
          onClick={onReopenOrder}
          disabled={loading || orderStatus === 'Open' || (!orderId && cart.length === 0)}
          className="col-span-1 bg-blue-50 text-blue-600 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-bold hover:bg-blue-100 active:scale-95 transition-all shadow-sm border border-blue-100 disabled:opacity-50 flex items-center justify-center gap-1">
          {actionLoading === 'edit' ? (
            <>
              <Loader2 size={14} className="animate-spin text-blue-600" />
              <span>{t("Editing...")}</span>
            </>
          ) : (
            t("EDIT")
          )}
        </button>
        <button
          onClick={onCancelOrder}
          disabled={loading || orderStatus === 'Paid' || (!orderId && cart.length === 0)}
          className="col-span-1 bg-gray-50 text-gray-600 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs font-bold hover:bg-gray-100 active:scale-95 transition-all shadow-sm border border-gray-200 disabled:opacity-50 flex items-center justify-center gap-1">
          {actionLoading === 'cancel' ? (
            <>
              <Loader2 size={14} className="animate-spin text-gray-600" />
              <span>{t("Cancelling...")}</span>
            </>
          ) : (
            t("CANCEL")
          )}
        </button>
      </div>


      {showPaxModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-portal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setShowPaxModal(false);
          }}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Users size={18} className="text-primary" />{t("Number of Persons (PAX)")}
              </h3>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPaxModal(false);
                }} 
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <input
                type="number"
                min="1"
                onWheel={(e) => e.target.blur()}
                value={paxInput}
                onChange={(e) => setPaxInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={t('Enter PAX')}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all text-center text-2xl font-black text-gray-800"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === '-' || e.key === 'e' || e.key === '+' || e.key === '.') e.preventDefault();
                  if (e.key === 'Enter') submitPax(Number(paxInput) > 1);
                }} 
              />

              {total > 0 && Number(paxInput) > 1 && (
                <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-xl text-center shadow-2xs animate-in fade-in duration-150">
                  <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-0.5">{t("Split Amount Per Person")}</span>
                  <span className="text-2xl font-black text-orange-600">
                    {currencySymbol}{(total / Number(paxInput)).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-gray-500 block mt-0.5">({currencySymbol}{total.toFixed(2)} ÷ {paxInput} {t("PAX")})</span>
                </div>
              )}

              <div className="flex flex-col gap-2 mt-6">
                {Number(paxInput) > 1 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      submitPax(true);
                    }}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold py-3.5 rounded-xl hover:shadow-lg active:scale-[0.98] transition-all shadow-md text-sm cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>👥 {t("Apply Split to Settlement")} ({currencySymbol}{(total / Number(paxInput)).toFixed(2)})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      submitPax(false);
                    }}
                    className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md shadow-primary/20 cursor-pointer text-sm"
                  >
                    {t("Confirm PAX")}
                  </button>
                )}

                {(isSplitActive || pax > 1) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCancelSplit();
                    }}
                    className="w-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold py-2.5 rounded-xl active:scale-[0.98] transition-all cursor-pointer text-xs"
                  >
                    {t("Cancel Split (Reset to 1 PAX)")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showWaiterModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-portal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setShowWaiterModal(false);
          }}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <UserCheck size={18} className="text-primary" />{t("Assign Waiter / Captain")}
              </h3>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowWaiterModal(false);
                }} 
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <input
                type="text"
                value={waiterInput}
                onChange={(e) => setWaiterInput(e.target.value)}
                placeholder={t('Enter Waiter / Captain Name')}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all font-bold text-gray-800 text-center text-lg"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') submitWaiter();
                }} 
              />

              {waiter && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-xl text-center flex items-center justify-between px-3">
                  <span className="text-[11px] font-bold text-blue-700">{t("Currently Assigned")}: <span className="font-black">{waiter}</span></span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearWaiter();
                    }}
                    className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                  >
                    {t("Remove")}
                  </button>
                </div>
              )}

              <div className="flex gap-2 mt-6">
                {waiter && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearWaiter();
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 font-bold py-3.5 rounded-xl hover:bg-gray-200 active:scale-[0.98] transition-all cursor-pointer text-xs"
                  >
                    {t("Clear")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    submitWaiter();
                  }}
                  className="flex-1 bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md shadow-primary/20 cursor-pointer text-xs sm:text-sm"
                >
                  {t("Confirm Waiter")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showNoteModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-portal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setShowNoteModal(false);
          }}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Clipboard size={18} className="text-primary" />
                {selectedCartItemForNote
                  ? `${t("Note for")} ${selectedCartItemForNote.name}`
                  : t("Special Note for Kitchen")}
              </h3>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNoteModal(false);
                }} 
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={t('Special requests, allergies...')}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all font-medium text-gray-800 min-h-[120px] resize-none"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  submitNote();
                }}
                className="w-full mt-6 bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md shadow-primary/20 cursor-pointer"
              >
                {t("Save Note")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showSplitCalcModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-portal-overlay fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            e.stopPropagation();
            setShowSplitCalcModal(false);
          }}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-red-50 to-orange-50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <PieChart size={18} className="text-primary" />{t("Split Bill Calculator")}
              </h3>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSplitCalcModal(false);
                }} 
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <span className="text-gray-500 font-semibold">{t("Total Amount")}</span>
                <span className="text-xl font-black text-gray-800">{currencySymbol}{total.toFixed(2)}</span>
              </div>

              <div className="mb-8">
                <label className="block text-gray-500 font-semibold mb-3 text-center">{t("Split equally by how many people?")}</label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSplitWays(Math.max(1, splitWays - 1));
                    }}
                    className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors active:scale-95 cursor-pointer">
                    <Minus size={20} />
                  </button>
                  <span className="text-3xl font-black w-16 text-center text-primary">{splitWays}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSplitWays(splitWays + 1);
                    }}
                    className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors active:scale-95 cursor-pointer">
                    <Plus size={20} />
                  </button>
                </div>
              </div>

              <div className="bg-red-50 border border-red-100 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                <span className="text-red-600/80 font-bold text-xs uppercase tracking-wider mb-1">{t("Each Person Pays")}</span>
                <span className="text-4xl font-black text-red-600">
                  {currencySymbol}{(total / splitWays).toFixed(2)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-6">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (total > 0 && splitWays > 0) {
                      setSettlementAmount((total / splitWays).toFixed(2));
                      setIsSplitActive(splitWays > 1);
                      setPax(splitWays);
                    }
                    setShowSplitCalcModal(false);
                  }}
                  className="col-span-1 bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md shadow-primary/20 cursor-pointer text-xs flex items-center justify-center text-center">
                  {t("Apply")}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelSplit();
                  }}
                  className="col-span-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 font-bold py-3 rounded-xl active:scale-[0.98] transition-all cursor-pointer text-xs flex items-center justify-center text-center">
                  {t("Cancel Split")}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSplitCalcModal(false);
                  }}
                  className="col-span-1 bg-gray-100 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-200 active:scale-[0.98] transition-all cursor-pointer text-xs flex items-center justify-center text-center">
                  {t("Close")}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delivery Platforms Manager Modal (Full CRUD) */}
      {showPlatformModal && typeof document !== 'undefined' && createPortal(
        <div 
          className="modal-portal-overlay fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setShowPlatformModal(false);
            setNewPlatformName('');
          }}
        >
          <div 
            className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl border border-gray-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gradient-to-r from-orange-500/10 to-amber-500/10">
              <div>
                <h3 className="font-black text-sm text-gray-900 dark:text-white flex items-center gap-2">
                  <span>🛵</span> {t("Delivery Platforms")}
                </h3>
                <p className="text-[11px] text-gray-500">{t("Add, select, or delete custom delivery channels")}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPlatformModal(false);
                  setNewPlatformName('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Add New Platform Form */}
              <form onSubmit={handleAddPlatform} className="space-y-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  {t("Add New Platform Name")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Dunzo, Magicpin, UberEats"
                    value={newPlatformName}
                    onChange={(e) => setNewPlatformName(e.target.value)}
                    autoFocus
                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-gray-900 dark:text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20"
                  />
                  <button
                    type="submit"
                    disabled={!newPlatformName.trim()}
                    className="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus size={14} />
                    <span>{t("Add")}</span>
                  </button>
                </div>
              </form>

              {/* List of Platforms with Delete buttons */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  {t("Active Platforms")}
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {/* Built-in Platforms */}
                  {['Direct Delivery', 'Swiggy', 'Zomato'].map((name) => {
                    const rawVal = name.startsWith('Direct') ? 'Direct' : name;
                    const isSelected = orderSource === rawVal;
                    return (
                      <div
                        key={name}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderSource(rawVal);
                          setShowPlatformModal(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-orange-50 border-orange-200 text-orange-700'
                            : 'bg-gray-50/50 hover:bg-gray-100/80 border-gray-200 text-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span>{t(name)}</span>
                          <span className="text-[9px] text-gray-400 font-normal">({t("Default")})</span>
                        </div>
                        {isSelected && <span className="text-[10px] text-orange-600 font-bold">✓ {t("Active")}</span>}
                      </div>
                    );
                  })}

                  {/* Custom Added Platforms with Delete button */}
                  {customPlatforms.map((p) => {
                    const isSelected = orderSource === p;
                    return (
                      <div
                        key={p}
                        className={`flex items-center justify-between p-2 rounded-xl border text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-orange-50 border-orange-200 text-orange-700'
                            : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800'
                        }`}
                      >
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderSource(p);
                            setShowPlatformModal(false);
                          }}
                          className="flex-1 flex items-center gap-2 cursor-pointer truncate mr-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                          <span className="truncate">{p}</span>
                          {isSelected && <span className="text-[10px] text-orange-600 font-bold">✓ {t("Active")}</span>}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`${t("Delete custom platform")} "${p}"?`)) {
                              handleDeletePlatform(p);
                            }
                          }}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer shrink-0"
                          title={t("Delete Platform")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Available Offers & Discounts Modal */}
      {showOffersModal &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up border border-gray-200 flex flex-col max-h-[85vh]">
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-orange-500/10 to-amber-500/10 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-orange-500 text-white rounded-xl shadow-xs">
                    <Tags size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-gray-900">{t("Available Offers & Discounts")}</h2>
                    <p className="text-[11px] text-gray-500">{t("Select an active store offer to apply to this bill")}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowOffersModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar flex-1">
                {tenantDiscounts.filter(d => isOfferValid(d)).length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Tags size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="font-bold text-sm text-gray-700">{t("No active offers available")}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t("Configure discounts and BOGO rules in the Discounts & Offers page.")}</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {tenantDiscounts.filter(d => isOfferValid(d)).map((offer) => {
                      const isCurrent = discount?.name === offer.name;
                      const statusInfo = getOfferValidityStatus(offer);
                      return (
                        <div
                          key={offer._id}
                          className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                            isCurrent
                              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-white hover:bg-orange-50/40 border-gray-200 shadow-2xs'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                              offer.type === 'bogo'
                                ? 'bg-amber-100 text-amber-700'
                                : offer.type === 'percentage'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {offer.type === 'bogo' ? <Gift size={16} /> : <Tags size={16} />}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-sm text-gray-900 truncate">{offer.name}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                  offer.type === 'bogo'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : offer.type === 'percentage'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                  {offer.type === 'bogo'
                                    ? `Buy ${offer.buyQty || 2} Get ${offer.getQty || 1} Free`
                                    : offer.type === 'percentage'
                                    ? `${offer.value}% Off`
                                    : `${currencySymbol}${offer.value} Flat`}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500 flex-wrap">
                                <span className="font-medium text-gray-600">
                                  {offer.applicableTo === 'category'
                                    ? `${t("Applies to")}: ${typeof offer.targetCategory === 'object' && offer.targetCategory !== null ? offer.targetCategory.name : (offer.targetCategory || t("Category"))}`
                                    : `${t("Applies to")}: ${t("All Menu Items")}`}
                                </span>
                                {statusInfo.timeRemaining && (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-bold">
                                    <Clock size={10} />
                                    {statusInfo.timeRemaining}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => applyPresetOffer(offer)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer ${
                              isCurrent
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'bg-primary hover:bg-primary-hover text-white shadow-xs'
                            }`}
                          >
                            {isCurrent ? t("Applied ✓") : t("Apply")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Expired Offers List */}
                {tenantDiscounts.filter(d => !isOfferValid(d) && d.hasTimeline).length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                      {t("Expired / Scheduled Offers (Not Currently Applicable)")}
                    </span>
                    <div className="space-y-1.5">
                      {tenantDiscounts.filter(d => !isOfferValid(d) && d.hasTimeline).map((expired) => (
                        <div key={expired._id} className="p-2 rounded-lg bg-gray-50 border border-gray-200/60 flex items-center justify-between opacity-60">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <AlertTriangle size={13} className="text-red-400" />
                            <span className="font-medium line-through">{expired.name}</span>
                            <span className="text-[10px] text-red-600 font-bold bg-red-50 px-1.5 rounded">
                              {t("Expired")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-2 shrink-0">
                {discount?.name || discountAmount > 0 ? (
                  <button
                    onClick={() => {
                      setDiscount({ type: 'flat', value: '', name: '' });
                      setShowOffersModal(false);
                    }}
                    className="text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    {t("Remove Applied Offer")}
                  </button>
                ) : <div />}
                <button
                  onClick={() => setShowOffersModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {t("Close")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
};

export default BillSummary;