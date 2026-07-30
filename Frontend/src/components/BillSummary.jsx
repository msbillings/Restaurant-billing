import React, { useState } from 'react';
import { Trash2, Plus, Minus, Search, User, Users, Clipboard, X, CheckCircle, UserCheck, ChevronUp, ChevronDown } from 'lucide-react';

const BillSummary = ({
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
  customerInfo
}) => {
  const isLocked = orderStatus !== 'Open';
  const isCaptain = userRole === 'Captain';
  
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [isPaid, setIsPaid] = useState(false);
  const [useLoyalty, setUseLoyalty] = useState(true);
  const [sendSms, setSendSms] = useState(true);
  const [pax, setPax] = useState(4);
  const [showCharges, setShowCharges] = useState(false);
  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [containerCharge, setContainerCharge] = useState('0');
  const [settlementAmount, setSettlementAmount] = useState('');

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden border-l border-gray-300">
      
      {/* Top Tabs */}
      <div className="flex w-full bg-[#424242] h-12 shrink-0">
        <button 
          onClick={() => !isLocked && setBillType('Dine-In')}
          className={`flex-1 font-bold text-sm flex items-center justify-center transition-colors ${
            billType === 'Dine-In' ? 'bg-[#d32f2f] text-white' : 'text-gray-300 hover:text-white hover:bg-[#555]'
          }`}
        >
          Dine In
        </button>
        <button 
          onClick={() => !isLocked && setBillType('Delivery')}
          className={`flex-1 font-bold text-sm flex items-center justify-center transition-colors border-l border-r border-[#555] ${
            billType === 'Delivery' ? 'bg-[#d32f2f] text-white' : 'text-gray-300 hover:text-white hover:bg-[#555]'
          }`}
        >
          Delivery
        </button>
        <button 
          onClick={() => !isLocked && setBillType('Takeaway')}
          className={`flex-1 font-bold text-sm flex items-center justify-center transition-colors ${
            billType === 'Takeaway' ? 'bg-[#d32f2f] text-white' : 'text-gray-300 hover:text-white hover:bg-[#555]'
          }`}
        >
          Pick Up
        </button>
      </div>

      {/* Info Bar */}
      <div className="flex items-center gap-2 p-2 border-b border-gray-200 bg-[#f9f9f9]">
        <div className="flex items-center gap-1">
          <div className="flex flex-col items-center justify-center w-10 h-10 bg-white border border-gray-300 rounded text-gray-600 overflow-hidden px-0.5">
            <span className="text-[9px] font-bold">TABLE</span>
            <span className="text-[11px] font-black text-red-600 whitespace-nowrap truncate w-full text-center">
              {activeTable ? (activeTable.includes('-') ? activeTable.split('-').pop().trim().replace('Table ', 'T') : activeTable.substring(0, 4)) : '--'}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center w-10 h-10 bg-white border border-gray-300 rounded text-gray-600 cursor-pointer hover:bg-gray-50">
            <Users size={14} />
            <span className="text-[10px] font-bold mt-0.5">{pax}</span>
          </div>
          <div className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 rounded text-gray-600 cursor-pointer hover:bg-gray-50">
            <UserCheck size={16} />
          </div>
          <div className="flex items-center justify-center w-10 h-10 bg-white border border-gray-300 rounded text-gray-600 cursor-pointer hover:bg-gray-50">
            <Clipboard size={16} />
          </div>
        </div>
        <div className="flex-1 ml-2 bg-[#ffb74d] h-10 rounded flex items-center justify-center px-2 text-white font-bold text-xs text-center leading-tight">
          {activeTable ? `Table: ${activeTable}` : 'Select a table'}
        </div>
      </div>

      {/* Table Headers */}
      <div className="flex items-center px-3 py-2 bg-gray-100 border-b border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider shrink-0">
        <div className="w-[45%]">Items</div>
        <div className="w-[20%] text-center">Check Items</div>
        <div className="w-[20%] text-center">Qty.</div>
        <div className="w-[15%] text-right pr-2">Price</div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto bg-white p-1">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-sm">No items added</span>
          </div>
        ) : (
          cart.map((item, index) => (
            <div key={index} className="flex items-start py-2 px-2 border-b border-gray-100 hover:bg-gray-50 transition-colors group">
              {/* Delete Icon */}
              <button 
                onClick={() => updateQuantity(item._id || item.name, -item.quantity)}
                disabled={isLocked}
                className="w-5 h-5 rounded-full bg-[#d32f2f] text-white flex items-center justify-center shrink-0 mt-0.5 mr-2 opacity-80 hover:opacity-100 disabled:opacity-50"
              >
                <X size={12} strokeWidth={3} />
              </button>
              
              {/* Item Name */}
              <div className="flex-1 pr-2">
                <div className="text-[13px] text-gray-700 font-medium leading-tight">{item.name}</div>
                {item.specialNote && <div className="text-[10px] text-gray-400 mt-0.5">{item.specialNote}</div>}
              </div>

              {/* Quantity Controls */}
              <div className="flex flex-col items-center gap-1 w-[80px] shrink-0 border border-gray-300 rounded overflow-hidden">
                <div className="flex w-full bg-white h-7 items-center justify-between">
                   <button 
                    onClick={() => updateQuantity(item._id || item.name, -1)}
                    disabled={isLocked}
                    className="w-7 h-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                   >
                     <Minus size={14} />
                   </button>
                   <span className="font-bold text-sm text-gray-800">{item.quantity}</span>
                   <button 
                    onClick={() => updateQuantity(item._id || item.name, 1)}
                    disabled={isLocked}
                    className="w-7 h-full flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-50 border-l border-gray-200"
                   >
                     <Plus size={14} />
                   </button>
                </div>
              </div>

              {/* Price */}
              <div className="w-[60px] shrink-0 text-right flex flex-col justify-center h-7 pr-2">
                <div className="text-[10px] text-gray-400 line-through hidden">{item.price}</div>
                <div className="text-[13px] font-bold text-gray-700">{(item.price * item.quantity).toFixed(2)}</div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bottom Action Area */}
      <div className="shrink-0 flex flex-col w-full bg-[#424242]">
        
        {/* Collapsible Charges Section */}
        <div className="bg-[#666666] flex flex-col relative w-full">
          <button 
            className="w-full h-5 bg-[#555] hover:bg-[#777] flex items-center justify-center text-white transition-colors border-b border-gray-600"
            onClick={() => setShowCharges(!showCharges)}
          >
            {showCharges ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          
          {showCharges && (
            <div className="flex flex-col px-4 py-2 space-y-2 text-sm text-gray-200">
              <div className="flex items-center justify-between font-bold">
                <span className="w-1/3">Sub Total</span>
                <span className="w-1/3 text-center">{cart.reduce((acc, item) => acc + item.quantity, 0)}</span>
                <span className="w-1/3 text-right">{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="w-1/3 flex items-center gap-1">Discount <button className="text-white underline text-[11px] ml-1">More</button></span>
                <span className="w-1/3 text-center"></span>
                <span className="w-1/3 text-right">({discountAmount.toFixed(2)})</span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="w-2/3">Delivery Charge</span>
                <span className="w-1/3 text-right">
                  <input type="number" value={deliveryCharge} onChange={e => setDeliveryCharge(e.target.value)} className="w-[80px] bg-white text-black text-right px-1 rounded h-6 outline-none" />
                </span>
              </div>
              <div className="flex items-center justify-between font-bold">
                <span className="w-2/3 flex items-center gap-1"><span className="w-3 h-3 border border-gray-400 rounded-full inline-block"></span> Container Charge</span>
                <span className="w-1/3 text-right">
                  <input type="number" value={containerCharge} onChange={e => setContainerCharge(e.target.value)} className="w-[80px] bg-white text-black text-right px-1 rounded h-6 outline-none" />
                </span>
              </div>
            </div>
          )}
          {showCharges && (
            <div className="w-full h-4 bg-[#555] flex items-center justify-center text-white border-t border-gray-600">
              <ChevronDown size={14} />
            </div>
          )}
        </div>

        {/* Row 1: Offers & Total */}
        <div className="flex items-center justify-between p-2 border-b border-gray-600">
          <div className="flex items-center gap-2">
            <button className="bg-[#d32f2f] text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-red-700">Bogo Offer</button>
            <button className="bg-[#d32f2f] text-white px-3 py-1.5 rounded text-xs font-bold shadow-sm hover:bg-red-700">Split</button>
          </div>
          <div className="flex items-center gap-2 px-4">
            <span className="text-white text-sm font-bold">Total</span>
            <span className="text-[#ffb74d] text-xl font-black">{total.toFixed(0)}</span>
          </div>
        </div>

        {/* Row 2: Payment Modes */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-gray-600">
          {['Cash', 'Card', 'Due', 'Other', 'Part'].map(mode => (
            <label key={mode} className="flex items-center gap-1.5 text-white text-[13px] font-bold cursor-pointer">
              <div className={`w-4 h-4 rounded-full border-[3px] flex items-center justify-center ${paymentMode === mode ? 'border-white' : 'border-gray-400'}`}>
                {paymentMode === mode && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
              <input 
                type="radio" 
                name="paymentMode"
                value={mode}
                checked={paymentMode === mode}
                onChange={() => setPaymentMode(mode)}
                className="hidden"
              />
              {mode}
            </label>
          ))}
        </div>

        {/* Row 3: Settlement */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-600">
          <span className="text-white text-[13px] font-bold">Settlement Amount</span>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              value={settlementAmount} 
              onChange={e => setSettlementAmount(e.target.value)}
              className="w-[100px] h-7 bg-white text-black text-right px-2 rounded outline-none font-bold text-[13px]" 
            />
            <button className="bg-[#d32f2f] text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700">
              Settle & Save
            </button>
          </div>
        </div>

        {/* Row 4: Checkboxes */}
        <div className="flex items-center justify-center gap-12 py-2">
          <label className="flex items-center gap-2 text-white text-xs font-bold cursor-pointer">
            <div className={`w-4 h-4 flex items-center justify-center border-2 ${isPaid ? 'border-white bg-transparent' : 'border-gray-400 bg-transparent'}`}>
              {isPaid && <CheckCircle size={12} className="text-white" />}
            </div>
            <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="hidden" />
            It's Paid
          </label>
        </div>

        {/* Row 5: Action Buttons */}
        <div className="flex items-center justify-between gap-1 p-1 bg-white">
          <button 
            onClick={onSaveOrder}
            disabled={loading || cart.length === 0}
            className="flex-1 bg-[#d32f2f] text-white py-2 rounded text-[13px] font-bold hover:bg-red-700 disabled:opacity-50"
          >
            Save
          </button>
          <button 
            onClick={onGenerateBill}
            disabled={loading || cart.length === 0}
            className="flex-1 bg-[#d32f2f] text-white py-2 rounded text-[13px] font-bold hover:bg-red-700 disabled:opacity-50"
          >
            Save & Print
          </button>
          <button 
            disabled={loading || cart.length === 0}
            className="flex-1 bg-[#d32f2f] text-white py-2 rounded text-[13px] font-bold hover:bg-red-700 disabled:opacity-50"
          >
            Save & eBill
          </button>
          <button 
            onClick={() => onCancelOrder && onCancelOrder('Cancelled by user')}
            className="flex-1 bg-white text-gray-700 border border-gray-400 py-2 rounded text-[13px] font-bold hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={onPrintKOT}
            disabled={loading || cart.length === 0}
            className="flex-1 bg-[#424242] text-white py-2 rounded text-[13px] font-bold hover:bg-gray-800 disabled:opacity-50"
          >
            KOT
          </button>
          <button 
            disabled={loading || cart.length === 0}
            className="flex-1 bg-[#424242] text-white py-2 rounded text-[13px] font-bold hover:bg-gray-800 disabled:opacity-50"
          >
            KOT & Print
          </button>
        </div>
      </div>

    </div>
  );
};

export default BillSummary;
