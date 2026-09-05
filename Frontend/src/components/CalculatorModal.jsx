import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, Component } from 'react';
import { X, Delete, Receipt, Coins, ArrowRight, SplitSquareHorizontal, Percent, Mic, MicOff, Copy, Check, History, Trash2, ShieldCheck, Clock, RefreshCcw } from 'lucide-react';
import WhisperWorker from '../workers/whisperWorker.js?worker';
import { getCalculationHistory, saveCalculationEntry, clearCalculationHistory, deleteSingleCalculationEntry } from '../api/calculator.js';

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
        </div>
      );
    }
    return this.props.children;
  }
}

const CalculatorModalInner = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [micLang, setMicLang] = useState('en-IN'); // Default to Indian English

  // History state
  const [historyList, setHistoryList] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Local Whisper state
  const [worker, setWorker] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelProgress, setModelProgress] = useState('');
  const mediaRecorderRef = React.useRef(null);
  const audioChunksRef = React.useRef([]);
  const audioContextRef = React.useRef(null);
  const recognitionRef = React.useRef(null);

  // Fetch history & reset listening when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      loadHistory();
    } else {
      cancelListening();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getCalculationHistory();
      setHistoryList(data);
    } catch (e) {
      console.error("Error loading calculation history:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleClearHistory = async () => {
    await clearCalculationHistory();
    setHistoryList([]);
  };

  const handleDeleteSingle = async (id) => {
    if (!id) return;
    try {
      await deleteSingleCalculationEntry(id);
      setHistoryList((prev) => prev.filter((item) => (item._id || item.id) !== id));
    } catch (err) {
      console.error("Error deleting single calculation entry:", err);
    }
  };

  const handleNumber = (num) => {
    setDisplay((prev) => prev === '0' ? num : prev + num);
  };

  const handleOperator = (op) => {
    const opSymbol = op === '*' ? 'x' : op;
    setEquation(display + ' ' + opSymbol + ' ');
    setDisplay('0');
  };

  const handlePercent = () => {
    const val = parseFloat(display) || 0;
    setDisplay(String(val / 100));
  };

  const handleEqual = async () => {
    try {
      const fullExpr = `${equation}${display}`;
      const evalExpr = fullExpr.replace(/x/g, '*').replace(/×/g, '*');
      const resultVal = new Function('return ' + evalExpr)();
      const formattedRes = String(Number(resultVal.toFixed(2)));
      
      setDisplay(formattedRes);
      setEquation('');
      setAiResult('');

      if (fullExpr.trim()) {
        const displayExpr = fullExpr.replace(/\*/g, ' x ');
        const saved = await saveCalculationEntry(displayExpr, formattedRes);
        setHistoryList((prev) => [saved, ...prev.filter(h => (h._id || h.id) !== (saved._id || saved.id))]);
      }
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

  const applyPercentage = async (percent, isAdd) => {
    const current = parseFloat(display) || 0;
    const modifier = current * (percent / 100);
    const resultVal = isAdd ? current + modifier : current - modifier;
    const expr = `${current} ${isAdd ? '+' : '-'} ${percent}%`;
    const formattedRes = String(Number(resultVal.toFixed(2)));

    setEquation(`${expr} = `);
    setDisplay(formattedRes);

    const saved = await saveCalculationEntry(expr, formattedRes);
    setHistoryList((prev) => [saved, ...prev.filter(h => (h._id || h.id) !== (saved._id || saved.id))]);
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

    let str = inputToParse.toLowerCase()
      .replace(/[०-९]/g, (d) => d.charCodeAt(0) - 0x0966)
      .replace(/[౦-౯]/g, (d) => d.charCodeAt(0) - 0x0C66)
      .replace(/[０-９]/g, (d) => d.charCodeAt(0) - 0xFF10)
      .replace(/स्वरूप/g, '100').replace(/सौ/g, '100').replace(/हजार/g, '1000').replace(/लाख/g, '100000')
      .replace(/एक/g, '1').replace(/दो/g, '2').replace(/तीन/g, '3').replace(/चार/g, '4').replace(/पांच/g, '5')
      .replace(/छह/g, '6').replace(/सात/g, '7').replace(/आठ/g, '8').replace(/नौ/g, '9').replace(/दस/g, '10')
      .replace(/बीस/g, '20').replace(/तीस/g, '30').replace(/चालीस/g, '40').replace(/पचास/g, '50').replace(/साठ/g, '60')
      .replace(/सत्तर/g, '70').replace(/अस्सी/g, '80').replace(/नब्बे|नव्वे/g, '90')
      .replace(/వంద/g, '100').replace(/వెయ్యి/g, '1000').replace(/లక్ష/g, '100000')
      .replace(/ఒకటి|ఒక/g, '1').replace(/రెండు/g, '2').replace(/మూడు/g, '3').replace(/నాలుగు/g, '4').replace(/ఐదు/g, '5')
      .replace(/ఆరు/g, '6').replace(/ఏడు/g, '7').replace(/ఎనిమిది/g, '8').replace(/తొమ్మిది/g, '9').replace(/పది/g, '10')
      .replace(/ఇరవై/g, '20').replace(/ముప్పై/g, '30').replace(/నలభై/g, '40').replace(/యాభై/g, '50').replace(/అరవై/g, '60')
      .replace(/డెబ్బై/g, '70').replace(/ఎనభై/g, '80').replace(/తొంభై/g, '90')
      .replace(/(\d+)\s*[x×]\s*(\d+)/gi, '$1 * $2')
      .replace(/(\d+)\s*[÷]\s*(\d+)/gi, '$1 / $2')
      .replace(/\b(times|multiplied by|multiply by|into|in to)\b/gi, '*')
      .replace(/\b(divided by|divide by)\b/gi, '/')
      .replace(/\b(plus|add)\b/gi, '+')
      .replace(/\b(minus|subtract)\b/gi, '-')
      .replace(/\bpercent\b/gi, '%')
      .replace(/प्लस|और|जमा/g, '+').replace(/माइनस|घटा/g, '-').replace(/गुणा/g, '*').replace(/भाग/g, '/').replace(/प्रतिशत|परसेंट/g, '%')
      .replace(/ప్లస్|మరియు/g, '+').replace(/మైనస్|తీసివేయి/g, '-').replace(/ఇంటు|గుణకారం/g, '*').replace(/భాగహారం/g, '/').replace(/శాతం|పర్సెంట్/g, '%');

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
    } else if (changeMatch || changeMatch2) {
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
    } else {
      try {
        let mathStr = str
          .replace(/(\d+)\s*x\s*(\d+)/gi, '$1 * $2')
          .replace(/×/g, '*')
          .replace(/÷/g, '/')
          .replace(/[a-z]/gi, '')
          .trim();
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
            const baseExpr = complexPercMatch[1].replace(/[^0-9\+\-\*\/\.]/g, '');
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
              const displayMath = cleanMath.replace(/\*/g, ' x ');
              resultText = `${displayMath} = ${finalValue}`;
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
      const formattedRes = String(Number(finalValue.toFixed(2)));
      setDisplay(formattedRes);
      const saveExpr = inputToParse.replace(/\*/g, ' x ');
      const formattedResultText = resultText.replace(/\*/g, ' x ');
      saveCalculationEntry(saveExpr, formattedRes, formattedResultText).then(saved => {
        setHistoryList((prev) => [saved, ...prev.filter(h => (h._id || h.id) !== (saved._id || saved.id))]);
      }).catch(() => {});
    }
    setAiResult(resultText.replace(/\*/g, ' x '));
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
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        const pcmData = audioBuffer.getChannelData(0);

        setAiResult("Processing voice...");
        activeWorker.postMessage({ type: 'transcribe', audio: pcmData });
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

  const cancelListening = () => {
    setIsListening(false);
    setAiInput('');
    transcriptRef.current = '';
    setAiResult('');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  const stopListening = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
  };

  const startSpeechRecognition = (targetLang = micLang) => {
    setAiInput('');
    transcriptRef.current = '';

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const w = initWorker();
      if (w) startLocalRecording(w);
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = targetLang;

    const langLabel = targetLang === 'te-IN' ? 'Telugu' : targetLang === 'hi-IN' ? 'Hindi' : 'English';

    recognition.onstart = () => {
      setIsListening(true);
      setAiResult(`Listening (${langLabel})... Speak now`);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join('');
      setAiInput(transcript);
      transcriptRef.current = transcript;
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'aborted') {
        return;
      }
      if (event.error === 'network' || event.error === 'not-allowed' || event.error === 'service-not-allowed') {
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
      if (transcriptRef.current) {
        setIsListening(false);
        setTimeout(() => {
          handleAiCalculate(null, transcriptRef.current);
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      const w = initWorker();
      if (w) startLocalRecording(w);
    }
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setMicLang(newLang);

    if (isListening) {
      // Instantly stop current voice session and seamlessly restart in the new language!
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (err) {}
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try {
          mediaRecorderRef.current.stop();
        } catch (err) {}
      }

      setTimeout(() => {
        startSpeechRecognition(newLang);
      }, 150);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startSpeechRecognition(micLang);
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

      <div className="relative bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-2xl overflow-hidden flex flex-col md:flex-row-reverse my-auto border border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Top (Mobile) / Right Screen (Desktop): Header, Voice AI & Result Display */}
        <div className="w-full md:w-3/5 bg-slate-900 text-white flex flex-col relative overflow-hidden shadow-xl z-30 shrink-0 md:border-l md:border-white/10">
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/20 rounded-full blur-3xl opacity-50 pointer-events-none" />
          
          <div className="px-3 sm:px-6 py-2 sm:py-4 flex justify-between items-center relative z-10 border-b border-white/10 shrink-0">
            <h3 className="font-black text-sm sm:text-lg flex items-center gap-1.5 sm:gap-2 text-white whitespace-nowrap">
              <span>{t("Smart Calculator")}</span>
            </h3>

            <div className="flex items-center gap-2">
              {/* Toggle Keypad / History */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all ${!showHistory ? 'bg-primary text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                >
                  {t("Keypad")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 ${showHistory ? 'bg-primary text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                >
                  <History size={12} />
                  <span>{t("History")}</span>
                  {historyList.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-white/20 text-white text-[9px] font-extrabold flex items-center justify-center">
                      {historyList.length}
                    </span>
                  )}
                </button>
              </div>

              <button onClick={onClose} className="p-1 sm:p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors touch-target flex items-center justify-center">
                <X size={18} className="sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>

          <div className="px-3 sm:px-6 py-2 sm:py-3 relative z-10 border-b border-white/10 bg-white/5 shrink-0">
            <form onSubmit={handleAiCalculate}>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder={t("e.g. 500 + 1000 - 5% discount")}
                  className={`w-full bg-black/40 border border-white/15 rounded-lg sm:rounded-xl py-1.5 sm:py-2.5 px-3 sm:px-3.5 text-[11px] sm:text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-white placeholder-slate-400 transition-all font-medium ${
                    isListening ? 'pr-28 sm:pr-36' : 'pr-20 sm:pr-24'
                  }`} />
                
                {!isElectron && (
                  <>
                    {/* Language Selector */}
                    <select
                      value={micLang}
                      onChange={handleLanguageChange}
                      className={`absolute top-1/2 -translate-y-1/2 p-0.5 sm:p-1 bg-slate-900/90 text-slate-300 hover:text-white text-[9px] sm:text-xs font-bold focus:outline-none cursor-pointer transition-colors z-10 rounded border border-white/10 ${
                        isListening ? 'right-[5.2rem] sm:right-[6.4rem]' : 'right-[3.8rem] sm:right-[4.25rem]'
                      }`}
                      title={t("Select Voice Language")}>
                      <option value="en-IN" className="bg-slate-900 text-white">{t("EN")}</option>
                      <option value="te-IN" className="bg-slate-900 text-white">{t("TE")}</option>
                      <option value="hi-IN" className="bg-slate-900 text-white">{t("HI")}</option>
                    </select>

                    {/* Cancel Mic Button (Visible when mic is active) */}
                    {isListening && (
                      <button
                        type="button"
                        onClick={cancelListening}
                        className="absolute right-13 sm:right-16 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 rounded-lg bg-red-500/30 text-red-300 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center z-10"
                        title={t("Cancel Mic / Voice Input")}>
                        <MicOff size={13} className="sm:w-[15px] sm:h-[15px]" />
                      </button>
                    )}

                    {/* Mic Toggle Button */}
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`absolute right-7 sm:right-9 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 rounded-lg transition-colors flex items-center justify-center z-10 ${
                        isListening ? 'bg-emerald-500/30 text-emerald-300 hover:bg-emerald-500 hover:text-white animate-pulse' : 'text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                      title={isListening ? t("Stop & Process Voice") : t("Voice Input")}>
                      <Mic size={13} className="sm:w-[15px] sm:h-[15px]" />
                    </button>
                  </>
                )}

                <button type="submit" className="absolute right-1 sm:right-1.5 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 bg-primary/20 text-primary hover:bg-primary hover:text-white rounded-md sm:rounded-lg transition-colors">
                  <ArrowRight size={13} className="sm:w-[15px] sm:h-[15px]" />
                </button>
              </div>
            </form>

            {isListening && (
              <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] font-medium text-amber-300 bg-amber-500/15 p-1.5 sm:p-2 rounded-lg border border-amber-500/30 flex items-center justify-between gap-1.5">
                <span className="leading-tight flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping inline-block shrink-0" />
                  {aiResult || `Listening (${micLang === 'te-IN' ? 'Telugu' : micLang === 'hi-IN' ? 'Hindi' : 'English'})...`}
                </span>
                <button
                  type="button"
                  onClick={cancelListening}
                  className="px-2 py-0.5 bg-red-500/30 text-red-200 hover:bg-red-600 hover:text-white rounded text-[9px] font-bold transition-colors whitespace-nowrap cursor-pointer shrink-0"
                >
                  {t("Cancel Mic")}
                </button>
              </div>
            )}

            {!isListening && aiResult && !modelLoading &&
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

          {/* Retention Notice Banner */}
          <div className="mx-3 sm:mx-6 my-1.5 sm:my-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-[10px] sm:text-xs font-medium flex items-center gap-1.5 shrink-0">
            <ShieldCheck size={14} className="text-amber-400 shrink-0" />
            <span className="leading-tight">{t("🔒 Calculation history is auto-deleted after 2 days.")}</span>
          </div>

          {/* Calculator Screen / Display */}
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

        {/* Keypad OR History List View */}
        <div className="w-full md:w-2/5 bg-slate-50 flex flex-col relative z-20">
          {showHistory ? (
            /* Calculation History Panel */
            <div className="flex flex-col h-full bg-slate-100 p-3 max-h-[380px] sm:max-h-[420px]">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 mb-2 gap-1 whitespace-nowrap shrink-0">
                <div className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-slate-800 shrink-0">
                  <Clock size={13} className="text-primary shrink-0" />
                  <span className="whitespace-nowrap">{t("History")}</span>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 font-normal whitespace-nowrap">({t("2 Days")})</span>
                </div>

                {historyList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 rounded-lg text-[9px] sm:text-[10px] font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                    title={t("Clear All Calculations")}
                  >
                    <Trash2 size={11} />
                    <span>{t("Clear")}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[180px] max-h-[320px]">
                {loadingHistory ? (
                  <div className="flex items-center justify-center p-6 text-slate-500 text-xs font-medium">
                    <RefreshCcw size={14} className="animate-spin text-primary mr-2" />
                    {t("Loading history...")}
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 text-xs font-medium">
                    {t("No calculation history found.")}
                  </div>
                ) : (
                  historyList.map((item, idx) => (
                    <div
                      key={item._id || item.id || idx}
                      className="bg-white p-2.5 rounded-xl border border-slate-200 hover:border-primary/50 transition-all shadow-2xs group relative"
                    >
                      <div
                        className="flex justify-between items-start text-xs cursor-pointer"
                        onClick={() => {
                          setDisplay(String(item.result));
                          setEquation(item.expression ? `${item.expression.replace(/\*/g, ' x ')} = ` : '');
                          setShowHistory(false);
                        }}
                      >
                        <span className="font-mono text-slate-600 font-semibold group-hover:text-primary transition-colors">{item.expression ? item.expression.replace(/\*/g, ' x ') : ''}</span>
                        <span className="font-mono font-black text-slate-900 text-sm">= {item.result}</span>
                      </div>
                      {item.details && (
                        <div className="text-[10px] text-slate-500 mt-1 italic">{item.details.replace(/\*/g, ' x ')}</div>
                      )}
                      <div className="flex items-center justify-between mt-1 text-[9px] text-slate-400 font-mono">
                        <span>
                          {item.createdAt ? new Date(item.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSingle(item._id || item.id);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title={t("Delete entry")}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Numeric Key Grid & Modifiers */
            <>
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
                <button onClick={() => handleNumber('5')} className="p-2 sm:p-3 bg-white border border-slate-200 text-slate-800 font-black rounded-lg sm:rounded-xl hover:bg-slate-100 transition-colors text-sm sm:text-xl shadow-xs touch-target">5</button>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const CalculatorModal = (props) => (
  <ErrorBoundary onClose={props.onClose}>
    <CalculatorModalInner {...props} />
  </ErrorBoundary>
);

export default CalculatorModal;