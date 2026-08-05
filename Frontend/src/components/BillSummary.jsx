import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Trash2, Plus, Minus, Search, User, Users, Clipboard, X, CheckCircle, UserCheck, ChevronUp, ChevronDown, PieChart } from 'lucide-react';

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
  setContainerCharge
}) => {
  const { t, language } = useLanguage();
  const isLocked = orderStatus !== 'Open';
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
      updateItemNote(selectedCartItemForNote._id || selectedCartItemForNote.name, noteInput);
    } else if (cart && cart.length > 0) {
      updateItemNote(cart[0]._id || cart[0].name, noteInput);
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
    <div className="flex flex-col h-full bg-white overflow-hidden border-l border-gray-300">

      {/* Top Tabs */}
      <div className="flex w-[calc(100%-24px)] mx-3 mt-3 mb-1 bg-gray-100 h-10 shrink-0 p-1 gap-1 rounded-xl shadow-inner">
        <button
          onClick={() => !isLocked && setBillType('Dine-In')}
          className={`flex-1 font-bold text-[13px] flex items-center justify-center transition-all rounded-lg ${billType === 'Dine-In' ? 'bg-white text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]' : 'text-gray-500 hover:text-gray-700'}`
          }>{t("Dine In")}


        </button>
        <button
          onClick={() => !isLocked && setBillType('Delivery')}
          className={`flex-1 font-bold text-[13px] flex items-center justify-center transition-all rounded-lg ${billType === 'Delivery' ? 'bg-white text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]' : 'text-gray-500 hover:text-gray-700'}`
          }>{t("Delivery")}


        </button>
        <button
          onClick={() => !isLocked && setBillType('Takeaway')}
          className={`flex-1 font-bold text-[13px] flex items-center justify-center transition-all rounded-lg ${billType === 'Takeaway' ? 'bg-white text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)]' : 'text-gray-500 hover:text-gray-700'}`
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
      <div className="flex items-center gap-2 p-3 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-1.5">
          <div onClick={handleTableClick} className="flex flex-col items-center justify-center w-12 h-12 bg-red-50 border border-red-100 rounded-xl text-red-600 overflow-hidden px-1 shadow-sm cursor-pointer hover:bg-red-100 transition-colors">
            <span className="text-[9px] font-bold opacity-80 leading-tight">{t("TABLE")}</span>
            <span className="text-[13px] font-black whitespace-nowrap truncate w-full text-center leading-tight">
              {activeTable ? (() => {
                const p = activeTable.includes('-') ? activeTable.split('-').pop().trim() : activeTable;
                const m = p.match(/^([a-zA-Z]+).*?(\d+)$/);
                return m ? `${m[1][0].toUpperCase()} ${m[2]}` : p.substring(0, 4);
              })() : '--'}
            </span>
          </div>
          <div onClick={handlePaxClick} className="flex flex-col items-center justify-center w-12 h-12 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 cursor-pointer hover:bg-gray-100 shadow-sm transition-colors">
            <Users size={16} className="mb-0.5 opacity-80" />
            <span className="text-[10px] font-bold leading-none">{pax}</span>
          </div>
          <div onClick={handleWaiterClick} className="flex items-center justify-center w-12 h-12 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 cursor-pointer hover:bg-gray-100 shadow-sm transition-colors">
            <UserCheck size={18} className="opacity-80" />
          </div>
          <div onClick={handleNoteClick} className="flex items-center justify-center w-12 h-12 bg-gray-50 border border-gray-100 rounded-xl text-gray-500 cursor-pointer hover:bg-gray-100 shadow-sm transition-colors">
            <Clipboard size={18} className="opacity-80" />
          </div>
        </div>

        <div className="flex-1 flex justify-end">
          {activeTable ?
            <div className="flex flex-col items-end mr-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t("Current Table")}</span>
              <span className="text-[13px] font-black text-gray-700 truncate max-w-[180px]" title={activeTable}>{activeTable}</span>
            </div> :
            <div className="relative h-10">
              <button className="w-full h-full bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 text-white rounded-xl text-[13px] font-bold transition-all shadow-md flex items-center justify-center px-4 animate-pulse gap-1.5">
                {t("Select Table")}
                <ChevronDown size={16} />
              </button>
              <select
                value=""
                onChange={(e) => onSelectTable && onSelectTable(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              >
                <option value="" disabled>{t("Select Table")}</option>
                {floors.map((floor, index) => {
                  const hasItems = floor.tables?.length > 0 || floor.cabins?.length > 0 || floor.sofas?.length > 0 || floor.spaces?.length > 0;
                  if (!hasItems) return null;
                  return (
                    <optgroup key={`f-${index}`} label={floor.name}>
                      {floor.tables?.map((tObj, i) => <option key={`t-${i}`} value={`${floor.name} - ${tObj.name}`}>{tObj.name} {t("(Table)")}</option>)}
                      {floor.cabins?.map((cObj, i) => <option key={`c-${i}`} value={`${floor.name} - ${cObj.name}`}>{cObj.name} {t("(Cabin)")}</option>)}
                      {floor.sofas?.map((sObj, i) => <option key={`s-${i}`} value={`${floor.name} - ${sObj.name}`}>{sObj.name} {t("(Sofa)")}</option>)}
                      {floor.spaces?.map((spObj, i) => <option key={`sp-${i}`} value={`${floor.name} - ${spObj.name}`}>{spObj.name} {t(`(${spObj.type || 'Space'})`)}</option>)}
                    </optgroup>
                  );
                })}
                {!floors.some(f => f.tables?.length > 0 || f.cabins?.length > 0 || f.sofas?.length > 0 || f.spaces?.length > 0) && [...Array(20)].map((_, i) => (
                  <option key={i} value={`TBL-${String(i + 1).padStart(2, '0')}`}>
                    {t('table')} {String(i + 1).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          }
        </div>
      </div>

      {/* Table Headers */}
      <div className="flex items-center px-3 py-2 bg-gray-100 border-b border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider shrink-0">
        <div className="w-[45%]">{t("Items")}</div>
        <div className="w-[20%] text-center">{t("Check Items")}</div>
        <div className="w-[20%] text-center">{t("Qty.")}</div>
        <div className="w-[15%] text-right pr-2">{t("Price")}</div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto bg-white p-1">
        {cart.length === 0 ?
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-sm">{t("No items added")}</span>
          </div> :

          cart.map((item, index) =>
            <div key={index} className="flex items-start py-2 px-2 border-b border-gray-100 hover:bg-gray-50 transition-colors group">
              {/* Delete Icon */}
              <button
                onClick={() => updateQuantity(item._id || item.name, -item.quantity)}
                disabled={isLocked}
                className="w-6 h-6 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 flex items-center justify-center shrink-0 mt-0 mr-1 transition-all disabled:opacity-50">

                <X size={14} strokeWidth={3} />
              </button>

              {/* Item Name */}
              <div className="flex-1 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] text-gray-700 font-medium leading-tight">{(language !== 'en' && item.nameTranslations?.[language]) || item.name}</span>
                  <button
                    onClick={() => handleItemNoteClick(item)}
                    disabled={isLocked}
                    className="text-gray-400 hover:text-orange-500 transition-colors p-0.5"
                    title={t("Add special note for this item")}
                  >
                    <Clipboard size={12} />
                  </button>
                </div>
                {item.specialNote ? (
                  <div
                    onClick={() => handleItemNoteClick(item)}
                    className="text-[11px] text-amber-600 font-bold cursor-pointer hover:underline mt-0.5 flex items-center gap-1"
                  >
                    <span>📝 {item.specialNote}</span>
                  </div>
                ) : null}
              </div>

              {/* Quantity Controls */}
              <div className="flex items-center gap-2 w-[85px] shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                <button
                  onClick={() => updateQuantity(item._id || item.name, -1)}
                  disabled={isLocked}
                  className="flex-1 h-7 flex items-center justify-center text-gray-600 hover:bg-white hover:text-red-500 disabled:opacity-50 transition-colors">

                  <Minus size={14} />
                </button>
                <span className="font-bold text-sm text-gray-800 shrink-0 w-4 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item._id || item.name, 1)}
                  disabled={isLocked}
                  className="flex-1 h-7 flex items-center justify-center text-gray-600 hover:bg-white hover:text-green-600 disabled:opacity-50 transition-colors">

                  <Plus size={14} />
                </button>
              </div>

              {/* Price */}
              <div className="w-[60px] shrink-0 text-right flex flex-col justify-center h-7 pr-2">
                <div className="text-[10px] text-gray-400 line-through hidden">{item.price}</div>
                <div className="text-[13px] font-bold text-gray-700">{(item.price * item.quantity).toFixed(2)}</div>
              </div>
            </div>
          )
        }
        <div ref={cartEndRef} />
      </div>

      {/* Bottom Action Area */}
      <div className="shrink-0 flex flex-col w-full bg-white shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-20">

        {/* Collapsible Charges Section */}
        <div className="bg-gray-50 flex flex-col relative w-full border-b border-gray-200">
          <button
            className="w-full h-6 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors border-t border-gray-200"
            onClick={() => setShowCharges(!showCharges)}>

            {showCharges ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
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
                    className="w-1/2 bg-white border border-gray-300 rounded text-[12px] h-7 outline-none focus:border-primary px-1"
                    value={discount?.type || 'percentage'}
                    onChange={(e) => setDiscount({ ...(discount || {}), type: e.target.value })}>

                    <option value="percentage">{t("% Percent")}</option>
                    <option value="flat">{currencySymbol}{t("Flat")}</option>
                  </select>
                  <input
                    type="number"
                    className="w-1/2 bg-white border border-gray-300 text-gray-800 text-right px-2 rounded h-7 outline-none focus:border-primary text-[12px] font-bold"
                    placeholder={t('Value')}
                    value={discount?.value || ''}
                    onChange={(e) => setDiscount({ ...(discount || {}), value: e.target.value })} />

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

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button onClick={handleBogoOffer} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors">{t("Bogo Offer")}</button>
            <button
              onClick={() => {
                setSplitWays(pax > 1 ? pax : 2);
                setShowSplitCalcModal(true);
              }}
              className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors">{t("Split")}


            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm font-bold uppercase tracking-wider">{t("Total")}</span>
            <span className="text-primary text-2xl font-black">{currencySymbol}{total.toFixed(0)}</span>
          </div>
        </div>

        {/* Row 3: Settlement */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-gray-600 text-[13px] font-bold uppercase tracking-wider">{t("Settlement Amount")}</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={settlementAmount}
              onChange={(e) => setSettlementAmount(e.target.value)}
              className="w-[100px] h-8 bg-white border border-gray-200 text-gray-800 text-right px-2 rounded-lg outline-none focus:border-primary font-bold text-[14px]" />

            <button
              onClick={(e) => {
                e.preventDefault();
                setIsPaid(true);
                if (onSettleBill) onSettleBill();
              }}
              className="bg-gradient-to-r from-red-600 to-orange-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm hover:shadow-md transition-all">{t("Settle")}


            </button>
          </div>
        </div>

        {/* Row 4: Checkboxes */}
        <div className="flex items-center justify-center gap-12 py-2.5 bg-gray-50/30">
          <label className="flex items-center gap-2 text-gray-600 text-[13px] font-bold cursor-pointer">
            <div className={`w-4 h-4 flex items-center justify-center rounded border-2 transition-colors ${isPaid ? 'border-primary bg-primary' : 'border-gray-300 bg-white'}`}>
              {isPaid && <CheckCircle size={12} className="text-white shrink-0" strokeWidth={3} />}
            </div>
            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="hidden" />{t("It's Paid")}

          </label>
        </div>

        {/* Row 5: Action Buttons */}
        <div className="grid grid-cols-3 gap-2.5 p-3.5 bg-white border-t border-gray-100">
          <button
            onClick={onSaveOrder}
            disabled={loading || cart.length === 0}
            className="col-span-1 bg-red-50 text-red-600 py-3.5 rounded-xl text-[14px] font-black tracking-wide hover:bg-red-100 transition-all shadow-sm border border-red-100 disabled:opacity-50">{t("SAVE")}


          </button>
          <button
            onClick={onSaveOrder}
            disabled={loading || cart.length === 0}
            className="col-span-1 bg-orange-50 text-orange-600 py-3.5 rounded-xl text-[14px] font-black tracking-wide hover:bg-orange-100 transition-all shadow-sm border border-orange-100 disabled:opacity-50">{t("HOLD")}


          </button>
          <button
            onClick={onGenerateBill}
            disabled={loading || cart.length === 0}
            className="col-span-1 bg-gradient-to-r from-red-600 to-orange-500 text-white py-3.5 rounded-xl text-[12px] sm:text-[14px] font-black tracking-wide hover:shadow-lg transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50">{t("SAVE & PRINT")}


          </button>

          <button
            onClick={onPrintKOT}
            disabled={loading || cart.length === 0}
            className="col-span-1 bg-gray-100 text-gray-700 py-3 rounded-xl text-[13px] font-bold hover:bg-gray-200 transition-all shadow-sm border border-gray-200 disabled:opacity-50">
            {t("KOT")}
          </button>
          <button
            onClick={onReopenOrder}
            disabled={loading || !isLocked}
            className="col-span-1 bg-blue-50 text-blue-600 py-3 rounded-xl text-[12px] sm:text-[13px] font-bold hover:bg-blue-100 transition-all shadow-sm border border-blue-100 disabled:opacity-50">
            {t("EDIT")}
          </button>
          <button
            onClick={() => onCancelOrder && onCancelOrder('Cancelled by user')}
            className="col-span-1 bg-white text-gray-400 border border-gray-200 py-3 rounded-xl text-[13px] font-bold hover:bg-gray-50 hover:text-red-500 transition-all shadow-sm">{t("CANCEL")}


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