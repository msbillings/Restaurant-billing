import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import TableDropdown from './TableDropdown';
import { Trash2, Plus, Minus, Search, User, Users, Clipboard, X, CheckCircle, UserCheck, ChevronUp, ChevronDown, PieChart, Loader2 } from 'lucide-react';

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
  hasUnprintedItems = true
}) => {
  const { t, language } = useLanguage();
  const isLocked = orderStatus === 'Paid' || orderStatus === 'Cancelled';
  const isCaptain = userRole === 'Captain';

  const cartEndRef = React.useRef(null);
  useEffect(() => {
    if (cartEndRef.current) {
      cartEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cart.length]);

  const [isPaid, setIsPaid] = useState(false);
  const [useLoyalty, setUseLoyalty] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [pax, setPax] = useState(4);
  const [showCharges, setShowCharges] = useState(false);
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');

  const [showPaxModal, setShowPaxModal] = useState(false);
  const [paxInput, setPaxInput] = useState('');

  const [showWaiterModal, setShowWaiterModal] = useState(false);
  const [waiterInput, setWaiterInput] = useState('');

  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [selectedCartItemForNote, setSelectedCartItemForNote] = useState(null);

  const [showSplitCalcModal, setShowSplitCalcModal] = useState(false);
  const [splitWays, setSplitWays] = useState(pax > 1 ? pax : 2);

  useEffect(() => {
    if (total > 0) {
      setSettlementAmount(total.toFixed(2));
    } else {
      setSettlementAmount('');
    }
  }, [total]);

  const handleBogoOffer = () => {
    let bogoDiscount = 0;
    cart.forEach((item) => {
      if (item.quantity >= 2) {
        // For every 2 items, 1 is free
        const freeItems = Math.floor(item.quantity / 2);
        bogoDiscount += freeItems * item.price;
      }
    });

    if (bogoDiscount > 0) {
      setDiscount({ type: 'flat', value: bogoDiscount });
      setShowCharges(true);
      setShowDiscountInput(true);
    } else {
      alert("No eligible items for BOGO. Add at least 2 quantities of the same item.");
    }
  };

  const currencySymbol = localStorage.getItem('primaryCurrency') === 'USD' ? '$' : '₹';

  const handlePaxClick = () => {
    setPaxInput(pax.toString());
    setShowPaxModal(true);
  };

  const submitPax = () => {
    if (paxInput && !isNaN(paxInput) && Number(paxInput) > 0) {
      setPax(Number(paxInput));
    }
    setShowPaxModal(false);
  };

  const handleWaiterClick = () => {
    setShowWaiterModal(true);
  };

  const submitWaiter = () => {
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
    if (onTransferTable) {
      onTransferTable();
    }
  };


  return (
    <div className="flex flex-col h-full bg-white overflow-x-auto overflow-y-auto border-l border-gray-300 w-full max-w-full">

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

      {/* Delivery Platform Selection */}
      {billType === 'Delivery' && (
        <div className="flex w-[calc(100%-24px)] mx-3 mt-1 mb-1 items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <select
            value={['Direct', 'Swiggy', 'Zomato'].includes(orderSource) ? orderSource : 'Custom'}
            onChange={(e) => {
              if (e.target.value === 'Custom') {
                setOrderSource('');
              } else {
                setOrderSource(e.target.value);
              }
            }}
            disabled={isLocked}
            className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-sm"
          >
            <option value="Direct">{t("Direct Delivery")}</option>
            <option value="Swiggy">{t("Swiggy")}</option>
            <option value="Zomato">{t("Zomato")}</option>
            <option value="Custom">{t("Custom / Other")}</option>
          </select>

          {!['Direct', 'Swiggy', 'Zomato'].includes(orderSource) && (
            <input
              type="text"
              placeholder={t("Platform Name")}
              value={orderSource}
              onChange={(e) => setOrderSource(e.target.value)}
              disabled={isLocked}
              className="flex-1 bg-white border border-gray-200 text-gray-800 text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-sm"
              autoFocus
            />
          )}
        </div>
      )}

      {/* Info Bar */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-0.5">
          <div onClick={handleTableClick} className="flex flex-col items-center justify-center w-8 h-8 bg-red-50 border border-red-100 rounded-lg text-red-600 overflow-hidden px-0.5 shadow-sm cursor-pointer hover:bg-red-100 transition-colors">
            <span className="text-[6px] font-bold opacity-80 leading-tight">{t("TABLE")}</span>
            <span className="text-[10px] font-black whitespace-nowrap truncate w-full text-center leading-tight">
              {activeTable ? (() => {
                const p = activeTable.includes('-') ? activeTable.split('-').pop().trim() : activeTable;
                const m = p.match(/^([a-zA-Z]+).*?(\d+)$/);
                return m ? `${m[1][0].toUpperCase()}${m[2]}` : p.substring(0, 3);
              })() : '--'}
            </span>
          </div>
          <div onClick={handlePaxClick} className="flex flex-col items-center justify-center w-8 h-8 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 cursor-pointer hover:bg-gray-100 shadow-sm transition-colors">
            <Users size={11} className="mb-0.5 opacity-80" />
            <span className="text-[8px] font-bold leading-none">{pax}</span>
          </div>
          <div onClick={handleWaiterClick} className="flex items-center justify-center w-8 h-8 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 cursor-pointer hover:bg-gray-100 shadow-sm transition-colors">
            <UserCheck size={12} className="opacity-80" />
          </div>
          <div onClick={handleNoteClick} className="flex items-center justify-center w-8 h-8 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 cursor-pointer hover:bg-gray-100 shadow-sm transition-colors">
            <Clipboard size={12} className="opacity-80" />
          </div>
        </div>

        <div className="flex-1 flex justify-end min-w-0">
          {activeTable ?
            <div className="flex flex-col items-end">
              <span className="text-[7px] font-bold text-gray-400 uppercase tracking-wider">{t("Current Table")}</span>
              <span className="text-[10px] font-black text-gray-700 truncate max-w-[100px]" title={activeTable}>{activeTable}</span>
            </div> :
            <div className="relative h-7 w-full min-w-[100px] max-w-[140px]">
              <TableDropdown
                floors={floors}
                activeTable={null}
                align="right"
                onSelect={(val) => onSelectTable && onSelectTable(val)}
                customButton={
                  <button className="w-full h-full bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white rounded-lg text-[10px] font-bold transition-all shadow-md flex items-center justify-center px-1.5 animate-pulse gap-0.5">
                    {t("Select Table")}
                    <ChevronDown size={11} />
                  </button>
                }
              />
            </div>
          }
        </div>
      </div>

      {/* Table Headers */}
      <div className="flex items-center px-3 py-0.5 bg-gray-100 border-b border-gray-200 text-gray-500 text-[8px] font-bold uppercase tracking-wider shrink-0">
        <div className="w-[42%]">{t("Items")}</div>
        <div className="w-[16%] text-center hidden sm:block">{t("Check")}</div>
        <div className="w-[26%] text-center">{t("Qty.")}</div>
        <div className="w-[16%] text-right pr-1">{t("Price")}</div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto bg-white p-0.5 relative">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-12 gap-2.5">
            <Loader2 className="animate-spin text-primary" size={26} />
            <span className="text-xs font-bold text-gray-600 animate-pulse">{t("Loading table order...")}</span>
          </div>
        ) : cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
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

                    const unitStatuses = Array.isArray(item.unitStatuses) && item.unitStatuses.length === totalQty && totalQty > 0
                      ? item.unitStatuses
                      : Array.from({ length: effectiveQty }, () => item.status || 'Pending');

                    const preparedCount = unitStatuses.filter(s => s === 'Ready' || s === 'Prepared').length;
                    const preparingCount = unitStatuses.filter(s => s === 'Preparing').length;
                    const pendingCount = unitStatuses.filter(s => s === 'Pending' || (!s && s !== 'Cancelled')).length;

                    const hasMixedStatus = effectiveQty > 1 && (
                      (preparedCount > 0 && (preparingCount > 0 || pendingCount > 0)) ||
                      (preparingCount > 0 && pendingCount > 0)
                    );

                    if (item.isCancelled) {
                      return <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold">{t("Cancelled")}</span>;
                    }
                    if (item.cancellationRejected) {
                      return <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded font-bold">{t("Rejected")}</span>;
                    }
                    if (item.cancellationRequested) {
                      return <span className="text-[9px] bg-orange-100 text-orange-600 px-1 py-0.5 rounded font-bold">{t("Pending")}</span>;
                    }
                    if (item.cancelledQuantity > 0) {
                      return <span className="text-[9px] bg-red-100 text-red-600 px-1 py-0.5 rounded font-bold whitespace-nowrap">(-{item.cancelledQuantity})</span>;
                    }

                    if (hasMixedStatus) {
                      return (
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
                    }

                    if (item.status === 'Preparing') {
                      return (
                        <span className="text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold border border-amber-200 shadow-2xs inline-flex items-center gap-1">
                          <Loader2 size={10} className="animate-spin text-amber-600 shrink-0" />
                          <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}👨‍🍳 {t("Preparing")}</span>
                        </span>
                      );
                    }

                    if (item.status === 'Ready' || item.status === 'Prepared') {
                      return (
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold border border-emerald-200 shadow-2xs inline-flex items-center gap-1">
                          <CheckCircle size={10} className="text-emerald-600 shrink-0" />
                          <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}✅ {t("Prepared")}</span>
                        </span>
                      );
                    }

                    if (item.status === 'Pending' || ((item.printedQuantity || 0) > 0 && !item.status)) {
                      return (
                        <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-100 inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0"></span>
                          <span>{effectiveQty > 1 ? `${effectiveQty}x ` : ''}⏳ {t("Pending")}</span>
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
              <div className="flex items-center gap-0 w-[72px] shrink-0 bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                <button
                  onClick={() => updateQuantity(item._id || item.name, -1)}
                  disabled={isLocked || item.isCancelled}
                  className="flex-1 h-6 flex items-center justify-center text-gray-600 hover:bg-white hover:text-red-500 disabled:opacity-50 transition-colors">
                  <Minus size={11} />
                </button>
                <span className={`font-bold text-[11px] text-gray-800 shrink-0 w-5 text-center ${item.isCancelled ? 'line-through' : ''}`}>{item.quantity - (item.cancelledQuantity || 0)}</span>
                <button
                  onClick={() => updateQuantity(item._id || item.name, 1)}
                  disabled={isLocked || item.isCancelled}
                  className="flex-1 h-6 flex items-center justify-center text-gray-600 hover:bg-white hover:text-green-600 disabled:opacity-50 transition-colors">
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

      {/* Bottom Action Area */}
      <div className="shrink-0 flex flex-col w-full bg-white shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-20">

        {/* Collapsible Charges Section */}
        <div className="bg-gray-50 flex flex-col relative w-full border-b border-gray-200">
          <button
            className="w-full h-7 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors border-t border-gray-200"
            onClick={() => setShowCharges(!showCharges)}>

            {showCharges ? <ChevronUp size={18} className="text-primary stroke-[2.5]" /> : <ChevronDown size={18} className="text-primary stroke-[2.5]" />}
          </button>

          {showCharges &&
            <div className="flex flex-col px-4 py-3 space-y-3 text-sm text-gray-700">
              <div className="flex items-center justify-between font-bold">
                <span className="w-1/3">{t("Sub Total")}</span>
                <span className="w-1/3 text-center">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
                <span className="w-1/3 text-right">{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="w-1/3 flex items-center gap-1">{t("Discount")}<button className="text-primary underline text-[11px] ml-1 hover:text-red-700" onClick={() => setShowDiscountInput(!showDiscountInput)}>{showDiscountInput ? t("Less") : t("More")}</button></span>
                <span className="w-1/3 text-center"></span>
                <span className="w-1/3 text-right text-green-600">({discountAmount.toFixed(2)})</span>
              </div>
              {showDiscountInput &&
                <div className="flex items-center justify-between bg-gray-200/50 p-2 rounded-lg gap-2 border border-gray-200">
                  <select
                    className={`${discount?.type === 'complimentary' ? 'w-full' : 'w-1/2'} bg-white border border-gray-300 rounded text-[12px] h-7 outline-none focus:border-primary px-1`}
                    value={discount?.type || 'percentage'}
                    onChange={(e) => setDiscount({ ...(discount || {}), type: e.target.value })}>

                    <option value="percentage">{t("% Percent")}</option>
                    <option value="flat">{currencySymbol}{t("Flat")}</option>
                    <option value="complimentary">{t("Complimentary")}</option>
                  </select>
                  {discount?.type !== 'complimentary' && (
                    <input
                      type="number"
                      className="w-1/2 bg-white border border-gray-300 text-gray-800 text-right px-2 rounded h-7 outline-none focus:border-primary text-[12px] font-bold"
                      placeholder={t('Value')}
                      value={discount?.value || ''}
                      onChange={(e) => setDiscount({ ...(discount || {}), value: e.target.value })} />
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
                  <input type="number" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} className="w-[80px] bg-white border border-gray-300 text-gray-800 text-right px-1 rounded h-7 outline-none focus:border-primary" />
                </span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="w-2/3 flex items-center gap-1"><span className="w-3 h-3 border border-gray-400 bg-gray-100 rounded-full inline-block"></span>{t("Container Charge")}</span>
                <span className="w-1/3 text-right">
                  <input type="number" value={containerCharge} onChange={(e) => setContainerCharge(e.target.value)} className="w-[80px] bg-white border border-gray-300 text-gray-800 text-right px-1 rounded h-7 outline-none focus:border-primary" />
                </span>
              </div>
            </div>
          }
          {showCharges &&
            <div className="w-full h-3 bg-gray-50 flex items-center justify-center text-gray-500 border-t border-gray-200">
            </div>
          }
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 overflow-x-auto no-scrollbar w-full">
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleBogoOffer} className="bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors">{t("Bogo Offer")}</button>
            <button
              onClick={() => {
                setSplitWays(pax > 1 ? pax : 2);
                setShowSplitCalcModal(true);
              }}
              className="bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors">{t("Split")}
            </button>
            <button
              onClick={() => {
                if (discount?.type === 'complimentary') {
                  setDiscount({ type: 'flat', value: '' });
                } else {
                  setDiscount({ type: 'complimentary', value: '' });
                }
              }}
              className={`${discount?.type === 'complimentary' ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'} px-2.5 py-1 rounded-md text-xs font-bold border transition-colors whitespace-nowrap`}>
              {t("Complimentary")}
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider">{t("Total")}</span>
            <span className="text-primary text-xl font-black">{currencySymbol}{total.toFixed(0)}</span>
          </div>
        </div>

        {/* Row 3: Settlement */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 overflow-x-auto no-scrollbar w-full">
          <span className="text-gray-600 text-[11px] font-bold uppercase tracking-wider shrink-0">{t("Settlement Amount")}</span>
          <div className="flex items-center gap-2 ml-1 shrink-0">
            <input
              type="number"
              value={settlementAmount}
              onChange={(e) => setSettlementAmount(e.target.value)}
              disabled={isLocked || cart.length === 0}
              className="w-[90px] h-8 bg-white border border-gray-200 text-gray-800 text-right px-2 rounded-lg outline-none focus:border-primary font-bold text-sm disabled:opacity-50" />
            <button
              onClick={(e) => {
                e.preventDefault();
                setIsPaid(true);
                if (onSettleBill) onSettleBill();
              }}
              disabled={cart.length === 0 || orderStatus === 'Paid' || loading}
              className="bg-gradient-to-r from-red-600 to-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:shadow-md active:scale-95 transition-all whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-1">
              {actionLoading === 'settle' ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>{t("Settling...")}</span>
                </>
              ) : (
                t("Settle")
              )}
            </button>
          </div>
        </div>

        {/* Row 4: Checkboxes */}
        <div className="flex items-center justify-center gap-6 py-2 bg-gray-50/30 w-full overflow-x-auto no-scrollbar">
          <label className="flex items-center gap-1.5 text-gray-600 text-xs font-bold cursor-pointer">
            <div className={`w-4 h-4 flex items-center justify-center rounded border-2 transition-colors ${isPaid ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
              {isPaid && <CheckCircle size={10} className="text-white shrink-0" strokeWidth={3} />}
            </div>
            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="hidden" />{t("It's Paid")}
          </label>
        </div>

        {/* Row 5: Action Buttons */}
        <div className="grid grid-cols-3 gap-3 px-3 py-4 bg-white border-t border-gray-100 w-full overflow-x-auto no-scrollbar">
          <button
            onClick={onSaveOrder}
            disabled={loading || cart.length === 0 || orderStatus === 'Paid'}
            className="col-span-1 bg-red-50 text-red-600 py-3.5 rounded-xl text-sm font-black tracking-wide hover:bg-red-100 active:scale-95 transition-all shadow-sm border border-red-100 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {actionLoading === 'save' ? (
              <>
                <Loader2 size={16} className="animate-spin text-red-600" />
                <span>{orderId ? t("Updating...") : t("Saving...")}</span>
              </>
            ) : (
              orderId ? t("UPDATE") : t("SAVE")
            )}
          </button>
          <button
            onClick={onHoldOrder}
            disabled={loading || cart.length === 0 || orderStatus === 'Paid'}
            className="col-span-1 bg-orange-50 text-orange-600 py-3.5 rounded-xl text-sm font-black tracking-wide hover:bg-orange-100 active:scale-95 transition-all shadow-sm border border-orange-100 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {actionLoading === 'hold' ? (
              <>
                <Loader2 size={16} className="animate-spin text-orange-600" />
                <span>{t("Holding...")}</span>
              </>
            ) : (
              t("HOLD")
            )}
          </button>
          <button
            onClick={onGenerateBill}
            disabled={loading || cart.length === 0 || orderStatus === 'Paid'}
            className="col-span-1 bg-gradient-to-r from-red-600 to-orange-500 text-white py-3.5 rounded-xl text-xs sm:text-sm font-black tracking-wide hover:shadow-lg active:scale-95 transition-all shadow-md disabled:opacity-50 flex items-center justify-center text-center gap-1.5">
            {actionLoading === 'print' ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>{t("Printing...")}</span>
              </>
            ) : (
              t("SAVE & PRINT")
            )}
          </button>
          <button
            onClick={onPrintKOT}
            disabled={loading || cart.length === 0 || !hasUnprintedItems || orderStatus === 'Paid'}
            title={!hasUnprintedItems && cart.length > 0 ? t("All items already sent to kitchen. No changes detected.") : t("KOT")}
            className={`col-span-1 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-sm flex items-center justify-center text-center gap-1.5 ${
              hasUnprintedItems 
                ? 'bg-amber-500 hover:bg-amber-600 text-white font-black hover:shadow-lg cursor-pointer border border-amber-600' 
                : 'bg-gray-100 text-gray-400 border border-gray-200 disabled:opacity-50'
            }`}>
            {actionLoading === 'kot' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t("Sending...")}</span>
              </>
            ) : (
              t("KOT")
            )}
          </button>
          <button
            onClick={onReopenOrder}
            disabled={loading || orderStatus === 'Open' || (!orderId && cart.length === 0)}
            className="col-span-1 bg-blue-50 text-blue-600 py-3.5 rounded-xl text-sm font-bold hover:bg-blue-100 active:scale-95 transition-all shadow-sm border border-blue-100 disabled:opacity-50 flex items-center justify-center gap-1.5">
            {actionLoading === 'edit' ? (
              <>
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span>{t("Opening...")}</span>
              </>
            ) : (
              t("EDIT")
            )}
          </button>
          <button
            onClick={() => onCancelOrder && onCancelOrder('Cancelled by user')}
            disabled={loading || cart.length === 0}
            className="col-span-1 bg-white text-gray-400 border border-gray-200 py-3.5 rounded-xl text-sm font-bold hover:bg-gray-50 hover:text-red-500 active:scale-95 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5">
            {actionLoading === 'cancel' ? (
              <>
                <Loader2 size={16} className="animate-spin text-red-500" />
                <span>{t("Cancelling...")}</span>
              </>
            ) : (
              t("CANCEL")
            )}
          </button>
        </div>
      </div>

      {/* --- MODALS --- */}
      {showPaxModal &&
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Users size={18} className="text-primary" />{t("Number of Persons (PAX)")}

              </h3>
              <button onClick={() => setShowPaxModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <input
                type="number"
                value={paxInput}
                onChange={(e) => setPaxInput(e.target.value)}
                placeholder={t('Enter PAX')}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all text-center text-2xl font-black text-gray-800"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && submitPax()} />

              <button
                onClick={submitPax}
                className="w-full mt-6 bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md shadow-primary/20">{t("Confirm")}


              </button>
            </div>
          </div>
        </div>
      }

      {showWaiterModal &&
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <UserCheck size={18} className="text-primary" />{t("Assign Waiter / Captain")}

              </h3>
              <button onClick={() => setShowWaiterModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <input
                type="text"
                value={waiterInput}
                onChange={(e) => setWaiterInput(e.target.value)}
                placeholder={t('Enter Name')}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all font-bold text-gray-800"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && submitWaiter()} />

              <button
                onClick={submitWaiter}
                className="w-full mt-6 bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md shadow-primary/20">{t("Confirm")}
              </button>
            </div>
          </div>
        </div>
      }

      {showNoteModal &&
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Clipboard size={18} className="text-primary" />
                {selectedCartItemForNote
                  ? `${t("Note for")} ${selectedCartItemForNote.name}`
                  : t("Special Note for Kitchen")}
              </h3>
              <button onClick={() => setShowNoteModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={t('Special requests, allergies...')}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all font-medium text-gray-800 min-h-[120px] resize-none"
                autoFocus />

              <button
                onClick={submitNote}
                className="w-full mt-6 bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md shadow-primary/20">{t("Save Note")}


              </button>
            </div>
          </div>
        </div>
      }



      {showSplitCalcModal &&
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-red-50 to-orange-50">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <PieChart size={18} className="text-primary" />{t("Split Bill Calculator")}

              </h3>
              <button onClick={() => setShowSplitCalcModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-white">
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
                    onClick={() => setSplitWays(Math.max(1, splitWays - 1))}
                    className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors active:scale-95">

                    <Minus size={20} />
                  </button>
                  <span className="text-3xl font-black w-16 text-center text-primary">{splitWays}</span>
                  <button
                    onClick={() => setSplitWays(splitWays + 1)}
                    className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors active:scale-95">

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

              <button
                onClick={() => setShowSplitCalcModal(false)}
                className="w-full mt-6 bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-primary-hover active:scale-[0.98] transition-all shadow-md shadow-primary/20">{t("Done")}

              </button>
            </div>
          </div>
        </div>
      }

    </div>);

};

export default BillSummary;