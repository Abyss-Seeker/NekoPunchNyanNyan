import React, { useState, useEffect, useRef } from 'react';
import { QuizData, AppState, Question, GenerationLog } from './types';
import FileUpload from './components/FileUpload';
import QuizCard from './components/QuizCard';
import ManualFilterView from './components/ManualFilterView';
import SettingsView from './components/SettingsView';
import { generateQuizFromDocument, configureUserApiKey } from './services/geminiService';
import { BrainCircuit, Download, RefreshCw, ChevronRight, ChevronLeft, Trophy, BarChart3, Terminal, Settings, Settings2 } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [userApiKey, setUserApiKey] = useState<string>('');
  
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Settings from LocalStorage
  useEffect(() => {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setUserApiKey(storedKey);
      configureUserApiKey(storedKey);
    }
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Statistics
  const progressPercentage = quizData ? ((currentQuestionIndex + 1) / quizData.questions.length) * 100 : 0;

  const handleSettingsSave = (key: string) => {
    setUserApiKey(key);
    configureUserApiKey(key);
    localStorage.setItem('gemini_api_key', key);
  };

  const handleFileSelect = async (file: File, codingOnly: boolean) => {
    try {
      setAppState('GENERATING');
      setError(null);
      setLogs([]);
      
      const data = await generateQuizFromDocument(file, codingOnly, (log) => {
        setLogs(prev => [...prev, log]);
      });
      
      setQuizData(data);
      setAppState('PLAYING');
      setScore(0);
      setCurrentQuestionIndex(0);
    } catch (err: any) {
      console.error(err);
      if (err.message === 'API_KEY_MISSING') {
        setError("Gemini API Key is missing. Please configure it in Settings.");
        setAppState('SETTINGS');
      } else {
        setError("Failed to generate quiz. " + (err.message || "Please try again."));
        setAppState('IDLE');
      }
    }
  };

  const handleImportQuiz = (data: QuizData) => {
    if (!data.questions || !Array.isArray(data.questions)) {
      setError("Invalid quiz file format.");
      return;
    }
    const freshData = JSON.parse(JSON.stringify(data));
    setQuizData(freshData);
    const existingScore = freshData.questions.filter((q: Question) => q.isCorrect).length;
    setScore(existingScore);
    const firstUnanswered = freshData.questions.findIndex((q: Question) => q.userAnswer === undefined);
    setCurrentQuestionIndex(firstUnanswered !== -1 ? firstUnanswered : 0);
    setAppState('PLAYING');
  };

  const handleAnswer = (answer: string, isCorrect: boolean) => {
    if (!quizData) return;
    const updatedQuestions = [...quizData.questions];
    updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      userAnswer: answer,
      isCorrect: isCorrect
    };
    setQuizData({ ...quizData, questions: updatedQuestions });
    if (isCorrect) setScore(s => s + 1);
  };

  const downloadJson = (data: any, prefix: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
    const anchor = document.createElement('a');
    anchor.href = dataStr;
    anchor.download = `${prefix}_${new Date().getTime()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleExport = () => quizData && downloadJson(quizData, "midterm_master_progress");
  const handleExportBlank = () => {
    if (!quizData) return;
    const blank = {
      ...quizData,
      questions: quizData.questions.map(({ userAnswer, isCorrect, ...rest }) => rest)
    };
    downloadJson(blank, "midterm_master_blank");
  };

  const handleOpenSettings = () => {
    setError(null); // Clear errors when manually opening settings
    setAppState('SETTINGS');
  };

  // Switch to Manual Filter View
  const handleOpenFilter = () => {
    if (!quizData) return;
    setAppState('MANUAL_FILTER');
  };

  // Save changes from Manual Filter
  const handleSaveFilter = (updatedQuestions: Question[]) => {
    if (!quizData) return;
    setQuizData({ ...quizData, questions: updatedQuestions });
    setCurrentQuestionIndex(0);
    setScore(updatedQuestions.filter(q => q.isCorrect).length);
    setAppState('PLAYING');
  };

  const handleNext = () => {
    if (quizData && currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setAppState('SUMMARY');
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(prev => prev - 1);
  };

  const resetApp = () => {
    if (window.confirm("Are you sure you want to return to home? Current progress will be lost unless exported.")) {
      setQuizData(null);
      setScore(0);
      setCurrentQuestionIndex(0);
      setLogs([]);
      setAppState('IDLE');
    }
  };

  const renderHeaderButtons = () => (
     <div className="absolute top-4 right-4 flex gap-2">
       <button 
         onClick={handleOpenSettings}
         className="p-2 bg-gray-900/50 hover:bg-gray-800 text-gray-400 hover:text-white rounded-lg transition-colors border border-gray-800"
         title="Settings"
       >
         <Settings size={20} />
       </button>
     </div>
  );

  // --- Render Views ---

  if (appState === 'SETTINGS') {
    return (
      <SettingsView 
        currentKey={userApiKey} 
        onSave={handleSettingsSave} 
        onBack={() => setAppState(quizData ? 'PLAYING' : 'IDLE')}
        error={error}
      />
    );
  }

  if (appState === 'IDLE') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0B0F19] relative">
        {renderHeaderButtons()}
        <div className="max-w-4xl w-full text-center space-y-8 animate-in fade-in duration-700">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="p-5 bg-cyan-500/10 rounded-full ring-1 ring-cyan-500/50 shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)]">
              <BrainCircuit className="w-16 h-16 text-cyan-400" />
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-gray-400">
              MidtermMaster
            </h1>
            <p className="text-lg text-gray-400 max-w-lg mx-auto leading-relaxed">
              Upload your CS lectures or documentation. We'll extract the code, syntax, and nuanced testing points to build you a midterm-ready exam.
            </p>
          </div>

          <FileUpload 
            onFileSelect={handleFileSelect} 
            onImportQuiz={handleImportQuiz}
            isProcessing={false} 
          />
          
          {error && (
            <div className="max-w-md mx-auto text-red-400 bg-red-950/30 p-4 rounded border border-red-900">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (appState === 'GENERATING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0B0F19]">
        <div className="max-w-2xl w-full space-y-6 animate-in fade-in duration-500">
          <div className="text-center space-y-4">
            <div className="inline-block p-4 rounded-full bg-cyan-500/10 mb-4 animate-pulse">
               <BrainCircuit className="w-12 h-12 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              Generating Comprehensive Exam...
            </h2>
            <p className="text-gray-400">
              Deploying multi-agent architecture to analyze your document.
            </p>
          </div>
          <div className="bg-[#0d1117] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border-b border-gray-800">
              <Terminal size={14} className="text-gray-400" />
              <span className="text-xs font-mono text-gray-400">agent_logs.txt</span>
            </div>
            <div 
              ref={logContainerRef}
              className="h-64 overflow-y-auto p-4 font-mono text-sm space-y-2 scroll-smooth"
            >
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-3 text-gray-300 animate-in fade-in slide-in-from-left-2 duration-300">
                  <span className="text-gray-600 text-xs w-16 flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`font-bold text-xs uppercase w-20 flex-shrink-0 
                    ${log.stage === 'System' ? 'text-gray-500' : ''}
                    ${log.stage === 'Planner' ? 'text-blue-400' : ''}
                    ${log.stage === 'Worker' ? 'text-green-400' : ''}
                    ${log.stage === 'Reviewer' ? 'text-purple-400' : ''}
                    ${log.stage === 'Orchestrator' ? 'text-cyan-400' : ''}
                  `}>
                    [{log.stage}]
                  </span>
                  <span className="flex-1 break-words">{log.message}</span>
                </div>
              ))}
              <div className="animate-pulse text-cyan-500">_</div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (appState === 'MANUAL_FILTER' && quizData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0B0F19]">
        <ManualFilterView 
          questions={quizData.questions}
          onSave={handleSaveFilter}
          onCancel={() => setAppState('PLAYING')}
        />
      </div>
    );
  }

  if (appState === 'SUMMARY' && quizData) {
    const percentage = Math.round((score / quizData.questions.length) * 100);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0B0F19]">
        <div className="max-w-2xl w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl text-center">
          <Trophy className={`w-20 h-20 mx-auto mb-6 ${percentage > 70 ? 'text-yellow-400' : 'text-gray-400'}`} />
          <h2 className="text-3xl font-bold text-white mb-2">Quiz Completed!</h2>
          <p className="text-gray-400 mb-8">{quizData.title}</p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="p-4 bg-gray-800 rounded-xl">
              <p className="text-sm text-gray-500 uppercase font-bold">Score</p>
              <p className="text-4xl font-mono text-white">{score} <span className="text-lg text-gray-500">/ {quizData.questions.length}</span></p>
            </div>
             <div className="p-4 bg-gray-800 rounded-xl">
              <p className="text-sm text-gray-500 uppercase font-bold">Percentage</p>
              <p className={`text-4xl font-mono ${percentage > 70 ? 'text-green-400' : 'text-red-400'}`}>{percentage}%</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <button onClick={handleExport} className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors"><Download size={18} /> Save Progress</button>
            <button onClick={handleExportBlank} className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors border border-gray-700"><BrainCircuit size={18} /> Export Blank Test</button>
            <button onClick={resetApp} className="flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-colors"><RefreshCw size={18} /> Start New</button>
          </div>
        </div>
      </div>
    );
  }

  // PLAYING STATE
  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F19]">
      <header className="sticky top-0 z-50 bg-[#0B0F19]/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={resetApp}>
            <BrainCircuit className="text-cyan-400 w-6 h-6" />
            <span className="font-bold text-white hidden sm:block">MidtermMaster</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 rounded-full border border-gray-800">
              <BarChart3 size={14} className="text-cyan-500" />
              <span className="text-sm font-mono text-cyan-100">{currentQuestionIndex + 1} / {quizData?.questions.length}</span>
            </div>
            <button onClick={handleOpenSettings} className="p-2 text-gray-400 hover:text-white transition-colors" title="Settings"><Settings size={20} /></button>
            <button onClick={handleOpenFilter} className="p-2 text-gray-400 hover:text-white transition-colors" title="Manual Filter"><Settings2 size={20} /></button>
            <button onClick={handleExportBlank} className="p-2 text-gray-400 hover:text-white transition-colors" title="Export Blank Test"><BrainCircuit size={20} /></button>
            <button onClick={handleExport} className="p-2 text-gray-400 hover:text-white transition-colors" title="Save Quiz Progress"><Download size={20} /></button>
          </div>
        </div>
        <div className="h-1 w-full bg-gray-800">
          <div className="h-full bg-cyan-500 transition-all duration-300 ease-out" style={{ width: `${progressPercentage}%` }} />
        </div>
      </header>
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4 md:p-8">
        {quizData && (
          <>
            <div className="flex-1 flex flex-col justify-center">
              <QuizCard question={quizData.questions[currentQuestionIndex]} onAnswer={handleAnswer} />
            </div>
            <div className="mt-8 pt-6 border-t border-gray-800 flex items-center justify-between">
              <button onClick={handlePrev} disabled={currentQuestionIndex === 0} className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"><ChevronLeft size={20} /> Previous</button>
              <div className="text-xs text-gray-600 font-mono hidden sm:block">ID: {quizData.questions[currentQuestionIndex].id}</div>
              <button onClick={handleNext} className="flex items-center gap-2 px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors border border-gray-700">{currentQuestionIndex === quizData.questions.length - 1 ? "Finish" : "Next"} <ChevronRight size={20} /></button>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;