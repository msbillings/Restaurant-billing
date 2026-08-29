import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect, Component } from 'react';
import { X, Delete, Sparkles, Receipt, Coins, ArrowRight, SplitSquareHorizontal, Percent, Mic, Copy, Check } from 'lucide-react';
import WhisperWorker from '../workers/whisperWorker.js?worker';

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
            <h1 className="text-2xl font-bold mb-4">Calculator Crash!</h1>
            <p className="text-red-200 mb-2">{this.state.error && this.state.error.toString()}</p>
            <pre className="text-xs bg-black/40 p-4 rounded text-red-100 whitespace-pre-wrap">
              {this.state.error && this.state.error.stack}
            </pre>
            <button
              className="mt-4 px-4 py-2 bg-white text-red-900 font-bold rounded"
              onClick={() => this.props.onClose && this.props.onClose()}>Close


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
  
  // Local Whisper state
  const [worker, setWorker] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState('');
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const audioContextRef = React.useRef(null);

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

  const initWorker = () => {
    let currentWorker = worker;
    if (!currentWorker) {
      try {
        currentWorker = new WhisperWorker();
        currentWorker.onmessage = (e) => {
          const { status, data, output } = e.data;
        if (status === 'progress') {
          setModelProgress(data.status === 'downloading' ? `Downloading model... ${Math.round(data.progress || 0)}%` : `Loading model...`);
        } else if (status === 'ready') {
          setModelLoading(false);
          setModelProgress('');
        } else if (status === 'complete') {
          setIsListening(false);
          const transcript = output.text;
          setAiInput(transcript);
          transcriptRef.current = transcript;
          setTimeout(() => {
            handleAiCalculate(null, transcript);
          }, 300);
        } else if (status === 'error') {
          setIsListening(false);
          setAiResult("Local voice processing error: " + data);
        }
      };
      setWorker(currentWorker);
      setModelLoading(true);
      currentWorker.postMessage({ type: 'load' });
      } catch (err) {
        console.error("Worker initialization failed:", err);
        setAiResult("Offline voice not supported on this device.");
        setIsListening(false);
        return null;
      }
    }
    return currentWorker;
  };

  const startLocalRecording = async (activeWorker) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsListening(false);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert to Float32Array PCM for Transformers.js
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        const pcmData = audioBuffer.getChannelData(0);

        setAiResult("Processing voice...");
        activeWorker.postMessage({ type: 'transcribe', audio: pcmData });
        
        // Cleanup stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
      setAiResult("Listening (Offline Mode)... Tap Mic to stop");
    } catch (err) {
      console.error("Local recording error:", err);
      setIsListening(false);
      setAiResult("Microphone permission required for offline voice.");
    }
  };

  const toggleListening = () => {
    if (isListening) {
      // If using fallback offline recording, stop it
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      return;
    }

    setAiInput('');
    transcriptRef.current = '';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    // Determine if we are in an environment that probably doesn't support the cloud API (e.g., .exe wrapper)
    // One way is if SpeechRecognition doesn't exist, OR we can just try it, and if it fails immediately, we fallback.
    if (!SpeechRecognition) {
      // Fallback natively missing
      const w = initWorker();
      if (w) startLocalRecording(w);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = micLang;

    recognition.onstart = () => {
      setIsListening(true);
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
      // Fallback for network/not-allowed (common in Electron/WebView2 without API keys)
      if (event.error === 'network' || event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        console.log("Native speech API failed, falling back to local offline model...");
        const w = initWorker();
        if (w) startLocalRecording(w);
      } else {
        setIsListening(false);
        let errMsg = "Voice input error. You can type commands like '500 + 1000 - 5%'";
        if (event.error === 'no-speech') {
          errMsg = "No speech detected. Please speak clearly into the microphone.";
        }
        setAiResult(errMsg);
      }
    };

    recognition.onend = () => {
      // Only handle end if we actually listened and didn't fall back
      if (isListening && transcriptRef.current) {
        setIsListening(false);
        setTimeout(() => {
          handleAiCalculate(null, transcriptRef.current);
        }, 300);
      } else if (isListening && !transcriptRef.current && !mediaRecorderRef.current) {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      // Fallback
      const w = initWorker();
      if (w) startLocalRecording(w);
    }
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

  const isElectron = navigator.userAgent.toLowerCase().includes('electron');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto custom-scrollbar">
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose} />

      <div className="relative bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-2xl overflow-hidden flex flex-col md:flex-row-reverse my-auto max-h-[85vh] sm:max-h-[92vh] border border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Top (Mobile) / Right Screen (Desktop): Header, Voice AI & Result Display */}
        <div className="w-full md:w-3/5 bg-slate-900 text-white flex flex-col relative overflow-hidden shadow-xl z-30 shrink-0 md:border-l md:border-white/10">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50 pointer-events-none" />
          
          <div className="px-3 sm:px-6 py-2 sm:py-4 flex justify-between items-center relative z-10 border-b border-white/10 shrink-0">
            <h3 className="font-black text-sm sm:text-xl flex items-center gap-1.5 sm:gap-2 text-white">
              <Sparkles size={16} className="text-primary sm:w-[18px] sm:h-[18px]" />
              <span>{t("Smart Calculator")}</span>
            </h3>
            <button onClick={onClose} className="p-1 sm:p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors touch-target flex items-center justify-center">
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>

          <div className="px-3 sm:px-6 py-2 sm:py-3 relative z-10 border-b border-white/10 bg-white/5 shrink-0">
            <form onSubmit={handleAiCalculate}>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder={t("e.g. 500 + 1000 - 5% discount")}
                  className="w-full bg-black/40 border border-white/15 rounded-lg sm:rounded-xl py-1.5 sm:py-2.5 px-3 sm:px-3.5 pr-20 sm:pr-24 text-[11px] sm:text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-white placeholder-slate-400 transition-all font-medium" />
                
                {!isElectron && (
                  <>
                    {/* Language Selector */}
                    <select
                      value={micLang}
                      onChange={(e) => setMicLang(e.target.value)}
                      className="absolute right-[3.8rem] sm:right-[4.25rem] top-1/2 -translate-y-1/2 p-0.5 sm:p-1 bg-transparent text-slate-400 hover:text-white text-[9px] sm:text-xs font-bold focus:outline-none cursor-pointer transition-colors z-10"
                      title={t("Select Voice Language")}>
                      <option value="en-IN" className="bg-slate-900 text-white">{t("EN")}</option>
                      <option value="te-IN" className="bg-slate-900 text-white">{t("TE")}</option>
                      <option value="hi-IN" className="bg-slate-900 text-white">{t("HI")}</option>
                    </select>

                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`absolute right-7 sm:right-9 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 rounded-lg transition-colors flex items-center justify-center ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                      title={t("Voice Input")}>
                      <Mic size={13} className="sm:w-[15px] sm:h-[15px]" />
                    </button>
                  </>
                )}

                <button type="submit" className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-md sm:rounded-lg transition-colors">
                  <ArrowRight size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
              </div>
            </form>

            {aiResult && !modelLoading &&
              <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] font-medium text-emerald-400 bg-emerald-500/10 p-1.5 sm:p-2 rounded-lg border border-emerald-500/20 flex items-start gap-1.5">
                <span className="leading-tight">{aiResult}</span>
              </div>
            }
            {modelLoading &&
              <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] font-medium text-amber-400 bg-amber-500/10 p-1.5 sm:p-2 rounded-lg border border-amber-500/20 flex items-start gap-1.5">
                <span className="leading-tight animate-pulse">{modelProgress || "Initializing offline voice model..."}</span>
              </div>
            }
          </div>

          <div className="p-3 sm:p-6 flex-1 flex flex-col items-end justify-end relative z-10 min-h-[55px] sm:min-h-[120px]">
            <div className="text-slate-400 text-[11px] sm:text-base font-mono h-4 sm:h-6">{equation}</div>
            <div className="text-2xl sm:text-5xl font-black font-mono tracking-tight overflow-x-auto w-full text-right hide-scrollbar text-white">
              {display}
            </div>
            
            <button
              onClick={handleCopy}
              className={`mt-2 sm:mt-4 px-2.5 py-1 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl flex items-center gap-1.5 text-[11px] sm:text-xs font-bold transition-all touch-target ${
                copied ?
                'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                'bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 border border-white/10'
              }`}>
              {copied ? <Check size={12} className="sm:w-[14px] sm:h-[14px]" /> : <Copy size={12} className="sm:w-[14px] sm:h-[14px]" />}
              <span>{copied ? t('Copied!') : t('Copy Amount')}</span>
            </button>
          </div>
        </div>

        {/* Keypad & Quick Modifiers Section */}
        <div className="w-full md:w-2/5 bg-slate-50 flex flex-col relative z-20 overflow-y-auto custom-scrollbar">
          {/* Quick Cash/Discount Preset Strip */}
          <div className="p-1.5 sm:p-3 bg-white border-b border-slate-200/80 grid grid-cols-4 gap-1 sm:gap-1.5 shrink-0">
            <button onClick={() => addCash(500)} className="py-1 sm:py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg sm:rounded-xl hover:bg-emerald-100 transition-colors touch-target">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-emerald-600/80 mb-0.5">{t("Note")}</span>
              <span className="font-bold text-[11px] sm:text-sm">₹500</span>
            </button>
            <button onClick={() => addCash(200)} className="py-1 sm:py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-lg sm:rounded-xl hover:bg-emerald-100 transition-colors touch-target">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-emerald-600/80 mb-0.5">{t("Note")}</span>
              <span className="font-bold text-[11px] sm:text-sm">₹200</span>
            </button>
            <button onClick={() => applyPercentage(10, false)} className="py-1 sm:py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center bg-rose-50 text-rose-700 border border-rose-200/60 rounded-lg sm:rounded-xl hover:bg-rose-100 transition-colors touch-target">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-rose-600/80 mb-0.5">{t("Disc")}</span>
              <span className="font-bold text-[11px] sm:text-sm">-10%</span>
            </button>
            <button onClick={() => applyPercentage(5, true)} className="py-1 sm:py-2 px-0.5 sm:px-1 flex flex-col items-center justify-center bg-blue-50 text-blue-700 border border-blue-200/60 rounded-lg sm:rounded-xl hover:bg-blue-100 transition-colors touch-target">
              <span className="text-[8px] sm:text-[9px] uppercase font-bold text-blue-600/80 mb-0.5">{t("GST")}</span>
              <span className="font-bold text-[11px] sm:text-sm">+5%</span>
            </button>
          </div>

          {/* Numeric Key Grid */}
          <div className="p-2 sm:p-4 grid grid-cols-4 gap-1 sm:gap-2 bg-slate-50 flex-1">
            <button onClick={handleClear} className="p-2 sm:p-3 bg-red-100 text-red-700 font-black rounded-lg sm:rounded-xl hover:bg-red-200 transition-colors text-[11px] sm:text-sm touch-target">{t("AC")}</button>
            <button onClick={handleDelete} className="p-2 sm:p-3 bg-slate-200 text-slate-700 font-bold rounded-lg sm:rounded-xl hover:bg-slate-300 transition-colors flex justify-center items-center touch-target"><Delete size={15} className="sm:w-[18px] sm:h-[18px]" /></button>
            <button onClick={handlePercent} className="p-2 sm:p-3 bg-slate-200 text-slate-700 font-bold rounded-lg sm:rounded-xl hover:bg-slate-300 transition-colors flex justify-center items-center touch-target"><Percent size={15} className="sm:w-[18px] sm:h-[18px]" /></button>
            <button onClick={() => handleOperator('/')} className="p-2 sm:p-3 bg-indigo-100 text-indigo-700 font-black rounded-lg sm:rounded-xl hover:bg-indigo-200 transition-colors text-sm sm:text-lg touch-target">÷</button>

            <button onClick={() => handleNumber('7')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">7</button>
            <button onClick={() => handleNumber('8')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">8</button>
            <button onClick={() => handleNumber('9')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">9</button>
            <button onClick={() => handleOperator('*')} className="p-2 sm:p-3 bg-indigo-100 text-indigo-700 font-black rounded-lg sm:rounded-xl hover:bg-indigo-200 transition-colors text-sm sm:text-lg touch-target">×</button>

            <button onClick={() => handleNumber('4')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">4</button>
            <button onClick={() => handleNumber('5')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">5</button>
            <button onClick={() => handleNumber('6')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">6</button>
            <button onClick={() => handleOperator('-')} className="p-2 sm:p-3 bg-indigo-100 text-indigo-700 font-black rounded-lg sm:rounded-xl hover:bg-indigo-200 transition-colors text-sm sm:text-lg touch-target">−</button>

            <button onClick={() => handleNumber('1')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">1</button>
            <button onClick={() => handleNumber('2')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">2</button>
            <button onClick={() => handleNumber('3')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">3</button>
            <button onClick={() => handleOperator('+')} className="p-2 sm:p-3 bg-indigo-100 text-indigo-700 font-black rounded-lg sm:rounded-xl hover:bg-indigo-200 transition-colors text-sm sm:text-lg touch-target">+</button>

            <button onClick={() => handleNumber('0')} className="col-span-2 p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">0</button>
            <button onClick={() => handleNumber('.')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">.</button>
            <button onClick={handleEqual} className="p-2 sm:p-3 bg-primary text-white font-black rounded-lg sm:rounded-xl hover:bg-primary-hover transition-colors text-base sm:text-2xl shadow-md touch-target">=</button>
          </div>
        </div>
      </div>
    </div>
  );

};

const CalculatorModal = (props) =>
<ErrorBoundary onClose={props.onClose}>
    <CalculatorModalInner {...props} />
  </ErrorBoundary>;


export default CalculatorModal;