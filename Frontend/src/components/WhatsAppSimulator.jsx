import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, ShoppingCart, Check, Sparkles } from 'lucide-react';
import api from '../api/axios';

const WhatsAppSimulator = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: "👋 Hi! I'm your AI Order Assistant. Type what you want to order!\n\nExample: \"2 chicken mandi and 1 coke\"",
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');

    // Add user message
    setMessages(prev => [...prev, {
      from: 'user',
      text: userMsg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setLoading(true);

    try {
      // First parse to show preview
      const parseRes = await api.post('/ai/parse-only', { message: userMsg });
      const { parsed, total } = parseRes.data;

      if (!parsed || parsed.length === 0) {
        setMessages(prev => [...prev, {
          from: 'bot',
          text: "🤔 Sorry, I couldn't find those items on the menu. Try something like:\n• \"2 chicken mandi\"\n• \"1 biryani and 2 pepsi\"",
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        setLoading(false);
        return;
      }

      // Show parsed items
      const itemList = parsed.map(p => 
        `  ${p.quantity}x ${p.name} — ₹${p.total} (${p.confidence}% match)`
      ).join('\n');

      setMessages(prev => [...prev, {
        from: 'bot',
        text: `🛒 I found these items:\n\n${itemList}\n\n💰 Total: ₹${total.toLocaleString()}\n\nType "confirm" to place the order, or send a new message to try again.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        parsed: parsed,
        total: total,
        awaitingConfirm: true,
        originalMessage: userMsg
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        from: 'bot',
        text: '❌ Something went wrong. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }

    setLoading(false);
  };

  const handleConfirm = async (originalMessage) => {
    setLoading(true);
    try {
      const res = await api.post('/ai/whatsapp-order', {
        message: originalMessage,
        customerName: customerName || 'WhatsApp Customer',
        customerPhone: customerPhone || ''
      });

      if (res.data.success) {
        setMessages(prev => [...prev, {
          from: 'bot',
          text: `✅ Order placed successfully!\n\n🔖 Order ID: ${res.data.order.tableNo}\n📋 Items: ${res.data.parsed.length}\n💰 Total: ₹${res.data.order.total.toLocaleString()}\n\nThe order has been sent to the kitchen! 🍳`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSuccess: true
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        from: 'bot',
        text: '❌ Failed to create order. Please try again.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // Check if last bot message is awaiting confirm
      const lastBotMsg = [...messages].reverse().find(m => m.from === 'bot');
      if (lastBotMsg?.awaitingConfirm && input.toLowerCase().trim() === 'confirm') {
        setInput('');
        setMessages(prev => [...prev, {
          from: 'user',
          text: 'confirm',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
        handleConfirm(lastBotMsg.originalMessage);
      } else {
        handleSend();
      }
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          isOpen 
            ? 'bg-red-500 hover:bg-red-600 rotate-90' 
            : 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'
        }`}
      >
        {isOpen ? <X size={24} className="text-white" /> : <MessageCircle size={24} className="text-white" />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-surface rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 duration-300" style={{ height: '520px' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-500 p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">AI Order Assistant</h3>
              <p className="text-green-100 text-xs flex items-center gap-1">
                <span className="w-2 h-2 bg-green-300 rounded-full inline-block animate-pulse"></span>
                Online — WhatsApp Simulator
              </p>
            </div>
            <div className="bg-white/10 p-1.5 rounded-lg">
              <Sparkles size={16} className="text-yellow-300" />
            </div>
          </div>

          {/* Customer Info (Collapsible) */}
          <div className="px-3 py-2 bg-green-50 dark:bg-green-950/20 border-b border-border flex gap-2">
            <input
              type="text"
              placeholder="Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="flex-1 text-xs bg-white dark:bg-surface border border-border rounded-md px-2 py-1.5 focus:outline-none focus:border-green-500"
            />
            <input
              type="tel"
              placeholder="Phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-28 text-xs bg-white dark:bg-surface border border-border rounded-md px-2 py-1.5 focus:outline-none focus:border-green-500"
            />
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#e5ddd5] dark:bg-background/50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%239C92AC\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                  msg.from === 'user'
                    ? 'bg-green-100 dark:bg-green-900/40 text-text-main rounded-br-sm'
                    : msg.isSuccess 
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-text-main border border-emerald-200 dark:border-emerald-800 rounded-bl-sm'
                      : 'bg-white dark:bg-surface text-text-main rounded-bl-sm'
                }`}>
                  <p className="text-sm whitespace-pre-line">{msg.text}</p>
                  {msg.awaitingConfirm && (
                    <button
                      onClick={() => {
                        setMessages(prev => [...prev, {
                          from: 'user',
                          text: 'confirm',
                          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }]);
                        handleConfirm(msg.originalMessage);
                      }}
                      className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check size={14} />
                      Confirm Order
                    </button>
                  )}
                  <p className="text-[10px] text-text-muted mt-1 text-right">{msg.time}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-surface rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-surface border-t border-border flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your order..."
              className="flex-1 bg-background border border-border rounded-full px-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/20"
              disabled={loading}
            />
            <button
              onClick={() => {
                const lastBotMsg = [...messages].reverse().find(m => m.from === 'bot');
                if (lastBotMsg?.awaitingConfirm && input.toLowerCase().trim() === 'confirm') {
                  setInput('');
                  setMessages(prev => [...prev, {
                    from: 'user',
                    text: 'confirm',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }]);
                  handleConfirm(lastBotMsg.originalMessage);
                } else {
                  handleSend();
                }
              }}
              disabled={loading || !input.trim()}
              className="w-10 h-10 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 rounded-full flex items-center justify-center transition-colors shadow-sm"
            >
              <Send size={16} className="text-white ml-0.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default WhatsAppSimulator;
