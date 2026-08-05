import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect, Component } from 'react';
import { X, Delete, Sparkles, Receipt, Coins, ArrowRight, SplitSquareHorizontal, Percent, Mic, Copy, Check } from 'lucide-react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 text-white p-4">
          <div className="bg-red-900 p-6 rounded-xl max-w-2xl w-full font-mono overflow-auto">
            <h1 className="text-2xl font-bold mb-4">{t("Calculator Crash!")}</h1>
            <p className="text-red-200 mb-2">{this.state.error && this.state.error.toString()}</p>
            <pre className="text-xs bg-black/40 p-4 rounded text-red-100 whitespace-pre-wrap">
              {this.state.error && this.state.error.stack}
            </pre>
            <button
              className="mt-4 px-4 py-2 bg-white text-red-900 font-bold rounded"
              onClick={() => this.props.onClose && this.props.onClose()}>{t("Close")}


            </button>
          </div>
        </div>);

    }
    return this.props.children;
  }
}

const CalculatorModalInner = ({ isOpen, onClose }) => {const { t } = useLanguage();
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [micLang, setMicLang] = useState('en-IN'); // Default to Indian English

  const handleNumber = (num) => {
    setDisplay((prev) => prev === '0' ? num : prev + num);
  };

  const handleOperator = (op) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handlePercent = () => {
    const val = parseFloat(display) || 0;
    setDisplay(String(val / 100));
  };

  const handleEqual = () => {
    try {
      const result = new Function('return ' + equation + display)();
      setDisplay(String(Number(result.toFixed(2))));
      setEquation('');
      setAiResult('');
    } catch (e) {
      setDisplay('Error');
      setEquation('');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setAiInput('');
    setAiResult('');
  };

  const handleDelete = () => {
    setDisplay((prev) => prev.length > 1 ? prev.slice(0, -1) : '0');
  };

  const addCash = (amount) => {
    const current = parseFloat(display) || 0;
    setDisplay(String(current + amount));
  };

  const applyPercentage = (percent, isAdd) => {
    const current = parseFloat(display) || 0;
    const modifier = current * (percent / 100);
    const result = isAdd ? current + modifier : current - modifier;
    setEquation(`${current} ${isAdd ? '+' : '-'} ${percent}% = `);
    setDisplay(String(Number(result.toFixed(2))));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const transcriptRef = React.useRef('');

  // Local AI Parser Logic
  const handleAiCalculate = (e, customInput) => {
    if (e) e.preventDefault();
    const inputToParse = customInput !== undefined ? customInput : aiInput;
    if (!inputToParse.trim()) return;

    // Convert spoken numbers/words to math symbols to help the parser
    // Includes English, Hindi, and Telugu common math words and numbers
    let str = inputToParse.toLowerCase()
    // Convert Native Digits to ASCII (Devanagari, Telugu, Fullwidth)
    .replace(/[०-९]/g, (d) => d.charCodeAt(0) - 0x0966).
    replace(/[౦-౯]/g, (d) => d.charCodeAt(0) - 0x0C66).
    replace(/[０-９]/g, (d) => d.charCodeAt(0) - 0xFF10)

    // Hindi Numbers & Mishears
    .replace(/स्वरूप/g, '100').
    replace(/सौ/g, '100').
    replace(/हजार/g, '1000').
    replace(/लाख/g, '100000').
    replace(/एक/g, '1').
    replace(/दो/g, '2').
    replace(/तीन/g, '3').
    replace(/चार/g, '4').
    replace(/पांच/g, '5').
    replace(/छह/g, '6').
    replace(/सात/g, '7').
    replace(/आठ/g, '8').
    replace(/नौ/g, '9').
    replace(/दस/g, '10').
    replace(/बीस/g, '20').
    replace(/तीस/g, '30').
    replace(/चालीस/g, '40').
    replace(/पचास/g, '50').
    replace(/साठ/g, '60').
    replace(/सत्तर/g, '70').
    replace(/अस्सी/g, '80').
    replace(/नब्बे|नव्वे/g, '90')

    // Telugu Numbers
    .replace(/వంద/g, '100').
    replace(/వెయ్యి/g, '1000').
    replace(/లక్ష/g, '100000').
    replace(/ఒకటి|ఒక/g, '1').
    replace(/రెండు/g, '2').
    replace(/మూడు/g, '3').
    replace(/నాలుగు/g, '4').
    replace(/ఐదు/g, '5').
    replace(/ఆరు/g, '6').
    replace(/ఏడు/g, '7').
    replace(/ఎనిమిది/g, '8').
    replace(/తొమ్మిది/g, '9').
    replace(/పది/g, '10').
    replace(/ఇరవై/g, '20').
    replace(/ముప్పై/g, '30').
    replace(/నలభై/g, '40').
    replace(/యాభై/g, '50').
    replace(/అరవై/g, '60').
    replace(/డెబ్బై/g, '70').
    replace(/ఎనభై/g, '80').
    replace(/తొంభై/g, '90')

    // English Math
    .replace(/plus/g, '+').
    replace(/minus/g, '-').
    replace(/times|multiplied by/g, '*').
    replace(/divided by/g, '/').
    replace(/percent/g, '%')
    // Hindi Math
    .replace(/प्लस|और|जमा/g, '+').
    replace(/माइनस|घटा/g, '-').
    replace(/गुणा/g, '*').
    replace(/भाग/g, '/').
    replace(/प्रतिशत|परसेंट/g, '%')
    // Telugu Math
    .replace(/ప్లస్|మరియు/g, '+').
    replace(/మైనస్|తీసివేయి/g, '-').
    replace(/ఇంటు|గుణకారం/g, '*').
    replace(/భాగహారం/g, '/').
    replace(/శాతం|పర్సెంట్/g, '%');

    let finalValue = null;
    let resultText = '';

    const splitMatch = str.match(/split (\d+(\.\d+)?) (?:among|between|for) (\d+)/);
    const changeMatch = str.match(/(?:bill|total).*?(\d+(\.\d+)?).*?(?:gave|paid|tendered).*?(\d+(\.\d+)?)/);
    const changeMatch2 = str.match(/(?:gave|paid).*?(\d+(\.\d+)?).*?(?:for).*?(?:bill|total).*?(\d+(\.\d+)?)/);

    if (splitMatch) {
      const amount = parseFloat(splitMatch[1]);
      const people = parseInt(splitMatch[3]);
      let tipAmount = 0;

      const tipMatch = str.match(/(?:with|and).*?(\d+(\.\d+)?)%\s*tip/);
      if (tipMatch) {
        const tipPercent = parseFloat(tipMatch[1]);
        tipAmount = amount * (tipPercent / 100);
      }

      const total = amount + tipAmount;
      finalValue = total / people;
      resultText = `Split ₹${amount} ${tipAmount ? `+ ₹${tipAmount.toFixed(2)} tip ` : ''}among ${people} = ₹${finalValue.toFixed(2)}/person`;
    } else
    if (changeMatch || changeMatch2) {
      let bill, paid;
      if (changeMatch) {
        bill = parseFloat(changeMatch[1]);
        paid = parseFloat(changeMatch[3]);
      } else {
        paid = parseFloat(changeMatch2[1]);
        bill = parseFloat(changeMatch2[3]);
      }
      finalValue = paid - bill;
      resultText = `Bill: ₹${bill}, Paid: ₹${paid} ➔ Change: ₹${finalValue.toFixed(2)}`;
    } else
    {
      try {
        let mathStr = str.replace(/[a-z]/gi, '').trim();
        // Allow regional language characters to be ignored in the strict math eval
        // by removing any non-math/non-digit character before eval
        const percMatch = mathStr.match(/(\d+(\.\d+)?)\s*([\+\-])\s*(\d+(\.\d+)?)%/);
        if (percMatch) {
          const base = parseFloat(percMatch[1]);
          const op = percMatch[3];
          const perc = parseFloat(percMatch[4]);
          const modifier = base * (perc / 100);
          finalValue = op === '+' ? base + modifier : base - modifier;
          resultText = `${base} ${op} ${perc}% (₹${modifier.toFixed(2)}) = ₹${finalValue.toFixed(2)}`;
        } else {
          const complexPercMatch = mathStr.match(/(.*)\s*([\+\-])\s*(\d+(\.\d+)?)%/);
          if (complexPercMatch) {
            const baseExpr = complexPercMatch[1].replace(/[^0-9\+\-\*\/\.]/g, ''); // Clean base
            const op = complexPercMatch[2];
            const perc = parseFloat(complexPercMatch[3]);

            const base = new Function('return ' + baseExpr)();
            const modifier = base * (perc / 100);
            finalValue = op === '+' ? base + modifier : base - modifier;
            resultText = `${base} ${op} ${perc}% (₹${modifier.toFixed(2)}) = ₹${finalValue.toFixed(2)}`;
          } else {
            const cleanMath = mathStr.replace(/[^0-9\+\-\*\/\.]/g, '');
            if (cleanMath) {
              finalValue = new Function('return ' + cleanMath)();
              resultText = `${cleanMath} = ${finalValue}`;
            } else {
              resultText = "Try: 'Split 1500 between 3' or '500 + 1000 - 5%'";
            }
          }
        }
      } catch (err) {
        resultText = "Sorry, couldn't parse that. Try something like: 'Bill 200 gave 500'";
      }
    }

    if (finalValue !== null) {
      setDisplay(String(Number(finalValue.toFixed(2))));
    }
    setAiResult(resultText);
  };

  const toggleListening = () => {
    if (isListening) return; // Prevent multiple starts

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice input. Please try Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = micLang; // Use the selected language

    recognition.onstart = () => {
      setIsListening(true);
      setAiInput('');
      transcriptRef.current = '';
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).
      map((result) => result[0].transcript).
      join('');
      setAiInput(transcript);
      transcriptRef.current = transcript;
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Wait a tiny bit for state to settle, then calculate using the ref
      setTimeout(() => {
        handleAiCalculate(null, transcriptRef.current);
      }, 300);
    };

    recognition.start();
  };

  // Keyboard Support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        return;
      }

      const key = e.key;

      if (/[0-9.]/.test(key)) {
        e.preventDefault();
        handleNumber(key);
      } else if (key === '+' || key === '-') {
        e.preventDefault();
        handleOperator(key);
      } else if (key === '*' || key === 'x') {
        e.preventDefault();
        handleOperator('*');
      } else if (key === '/' || key === '÷') {
        e.preventDefault();
        handleOperator('/');
      } else if (key === '%') {
        e.preventDefault();
        handlePercent();
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleEqual();
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, display, equation]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose} />
      
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-200">
        
        <div className="w-full md:w-2/5 bg-gray-50 flex flex-col relative z-20">
          <div className="p-4 bg-white border-b border-gray-100 grid grid-cols-4 gap-2 pt-4">
            <button onClick={() => addCash(500)} className="py-2 flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors">
              <span className="text-[10px] uppercase font-bold text-emerald-600/70 mb-0.5">{t("Note")}</span>
              <span className="font-bold text-sm">₹500</span>
            </button>
            <button onClick={() => addCash(200)} className="py-2 flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition-colors">
               <span className="text-[10px] uppercase font-bold text-emerald-600/70 mb-0.5">{t("Note")}</span>
              <span className="font-bold text-sm">₹200</span>
            </button>
            <button onClick={() => applyPercentage(10, false)} className="py-2 flex flex-col items-center justify-center bg-rose-50 text-rose-700 border border-rose-100 rounded-xl hover:bg-rose-100 transition-colors">
               <span className="text-[10px] uppercase font-bold text-rose-600/70 mb-0.5">{t("Disc")}</span>
              <span className="font-bold text-sm">-10%</span>
            </button>
            <button onClick={() => applyPercentage(5, true)} className="py-2 flex flex-col items-center justify-center bg-blue-50 text-blue-700 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
               <span className="text-[10px] uppercase font-bold text-blue-600/70 mb-0.5">{t("GST")}</span>
              <span className="font-bold text-sm">+5%</span>
            </button>
          </div>

          <div className="p-5 grid grid-cols-4 gap-3 bg-gray-50 flex-grow">
            <button onClick={handleClear} className="p-3 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors text-sm">{t("AC")}</button>
            <button onClick={handleDelete} className="p-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors flex justify-center items-center"><Delete size={18} /></button>
            <button onClick={handlePercent} className="p-3 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition-colors flex justify-center items-center"><Percent size={18} /></button>
            <button onClick={() => handleOperator('/')} className="p-3 bg-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-200 transition-colors text-lg">÷</button>

            <button onClick={() => handleNumber('7')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">7</button>
            <button onClick={() => handleNumber('8')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">8</button>
            <button onClick={() => handleNumber('9')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">9</button>
            <button onClick={() => handleOperator('*')} className="p-3 bg-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-200 transition-colors text-lg">×</button>

            <button onClick={() => handleNumber('4')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">4</button>
            <button onClick={() => handleNumber('5')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">5</button>
            <button onClick={() => handleNumber('6')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">6</button>
            <button onClick={() => handleOperator('-')} className="p-3 bg-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-200 transition-colors text-lg">−</button>

            <button onClick={() => handleNumber('1')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">1</button>
            <button onClick={() => handleNumber('2')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">2</button>
            <button onClick={() => handleNumber('3')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">3</button>
            <button onClick={() => handleOperator('+')} className="p-3 bg-indigo-100 text-indigo-700 font-bold rounded-xl hover:bg-indigo-200 transition-colors text-lg">+</button>

            <button onClick={() => handleNumber('0')} className="col-span-2 p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">0</button>
            <button onClick={() => handleNumber('.')} className="p-3 bg-white border border-gray-200/60 text-gray-800 font-bold rounded-xl hover:bg-gray-100 transition-colors text-xl shadow-sm">.</button>
            <button onClick={handleEqual} className="p-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-hover transition-colors text-2xl shadow-lg shadow-primary/30">=</button>
          </div>
        </div>

        <div className="w-full md:w-3/5 bg-slate-900 text-white flex flex-col relative overflow-hidden shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.5)] z-30">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50" />
          
          <div className="px-6 py-5 flex justify-between items-center relative z-10 border-b border-white/10">
            <h3 className="font-black text-xl flex items-center gap-2">{t("Smart Calculator")}

            </h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 relative z-10 border-b border-white/10 bg-white/5">
            <form onSubmit={handleAiCalculate}>
              <div className="relative">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)} placeholder={t("e.g. 500 + 1000 - 5% discount")}

                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 pr-24 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-white placeholder-gray-500 transition-all" />
                
                
                {/* Language Selector */}
                <select
                  value={micLang}
                  onChange={(e) => setMicLang(e.target.value)}
                  className="absolute right-[4.5rem] top-2 p-1.5 bg-transparent text-gray-400 hover:text-white text-xs font-bold focus:outline-none appearance-none cursor-pointer transition-colors z-10" title={t("Select Voice Language")}>

                  
                  <option value="en-IN" className="bg-slate-900 text-white">{t("EN")}</option>
                  <option value="te-IN" className="bg-slate-900 text-white">{t("TE")}</option>
                  <option value="hi-IN" className="bg-slate-900 text-white">{t("HI")}</option>
                </select>

                <button
                  type="button"
                  onClick={toggleListening}
                  className={`absolute right-10 top-2 p-1.5 rounded-lg transition-colors flex items-center justify-center ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/20'}`} title={t("Voice Input")}>

                  
                  <Mic size={16} />
                </button>

                <button type="submit" className="absolute right-2 top-2 p-1.5 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-lg transition-colors">
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
            {aiResult &&
            <div className="mt-3 text-xs font-medium text-emerald-400 bg-emerald-400/10 p-2.5 rounded-lg border border-emerald-400/20 flex items-start gap-2">
                <span className="leading-tight">{aiResult}</span>
              </div>
            }
          </div>

          <div className="p-8 flex-grow flex flex-col items-end justify-end relative z-10">
            <div className="text-gray-400 text-lg h-8 font-mono">{equation}</div>
            <div className="text-6xl font-black font-mono tracking-tight overflow-x-auto w-full text-right hide-scrollbar truncate text-primary-50">
              {display}
            </div>
            
            <button
              onClick={handleCopy}
              className={`mt-6 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-medium transition-all ${
              copied ?
              'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/10'}`
              }>
              
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied to Clipboard' : 'Copy Amount'}
            </button>
          </div>
        </div>
      </div>
    </div>);

};

const CalculatorModal = (props) =>
<ErrorBoundary onClose={props.onClose}>
    <CalculatorModalInner {...props} />
  </ErrorBoundary>;


export default CalculatorModal;