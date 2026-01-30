import React, { useState, useEffect } from 'react';
import { Question, QuestionType, Difficulty } from '../types';
import { CheckCircle2, XCircle, Code, HelpCircle, ExternalLink, Lightbulb, Brain } from 'lucide-react';
import { searchTopicExplanation } from '../services/geminiService';

interface QuizCardProps {
  question: Question;
  onAnswer: (answer: string, isCorrect: boolean) => void;
}

const QuizCard: React.FC<QuizCardProps> = ({ question, onAnswer }) => {
  const [inputAnswer, setInputAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [explanationData, setExplanationData] = useState<{ text: string; sources: string[] } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Fallback: If no options are provided, treat it as an input question regardless of type
  const isInputType = question.type === QuestionType.FillInBlank || 
                     (!question.options || question.options.length === 0);

  // Reset state when question changes
  useEffect(() => {
    setInputAnswer('');
    setSelectedOption(null);
    setIsSubmitted(!!question.userAnswer); // If revisited, show submitted state
    setExplanationData(null);
    if (question.userAnswer) {
        if (!isInputType) {
            setSelectedOption(question.userAnswer);
        } else {
            setInputAnswer(question.userAnswer);
        }
    }
  }, [question, isInputType]);

  const handleSubmit = () => {
    if (isSubmitted) return;
    
    let answer = '';
    let isCorrect = false;

    if (isInputType) {
      answer = inputAnswer.trim();
      // Simple case-insensitive match
      isCorrect = answer.toLowerCase() === question.correctAnswer.toLowerCase();
    } else {
      answer = selectedOption || '';
      isCorrect = answer === question.correctAnswer;
    }

    setIsSubmitted(true);
    onAnswer(answer, isCorrect);
  };

  const handleConsultAI = async () => {
    setIsSearching(true);
    // Extract key noun phrases or use the question text to find relevant info
    const searchResult = await searchTopicExplanation(question.questionText);
    setExplanationData(searchResult);
    setIsSearching(false);
  };

  const getDifficultyColor = (diff: Difficulty) => {
    switch(diff) {
      case Difficulty.Easy: return 'bg-green-500/10 text-green-400 border-green-500/20';
      case Difficulty.Medium: return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case Difficulty.Hard: return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case Difficulty.Advanced: return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case Difficulty.Expert: return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  };

  const renderOptions = () => {
    return (
      <div className="grid grid-cols-1 gap-3 mt-4">
        {question.options?.map((option, idx) => {
          let optionClass = "p-4 rounded-xl border-2 text-left transition-all relative ";
          
          if (isSubmitted) {
            if (option === question.correctAnswer) {
              optionClass += "border-green-500 bg-green-500/10 text-green-100";
            } else if (option === selectedOption) {
              optionClass += "border-red-500 bg-red-500/10 text-red-100";
            } else {
              optionClass += "border-gray-800 bg-gray-900/50 opacity-50";
            }
          } else {
            if (selectedOption === option) {
              optionClass += "border-cyan-500 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20 cursor-pointer";
            } else {
              optionClass += "border-gray-800 bg-gray-900/50 hover:border-gray-600 hover:bg-gray-800 cursor-pointer";
            }
          }

          return (
            <button
              key={idx}
              onClick={() => !isSubmitted && setSelectedOption(option)}
              className={optionClass}
              disabled={isSubmitted}
            >
              <div className="flex items-start">
                <span className="flex-shrink-0 w-6 h-6 rounded-full border border-current flex items-center justify-center mr-3 text-xs font-mono opacity-70">
                  {String.fromCharCode(65 + idx)}
                </span>
                <span>{option}</span>
                {isSubmitted && option === question.correctAnswer && (
                  <CheckCircle2 className="absolute right-4 top-4 text-green-400 w-5 h-5" />
                )}
                {isSubmitted && option === selectedOption && option !== question.correctAnswer && (
                  <XCircle className="absolute right-4 top-4 text-red-400 w-5 h-5" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header Tags */}
      <div className="flex gap-2 mb-4">
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${getDifficultyColor(question.difficulty)} flex items-center gap-1`}>
          {question.difficulty === Difficulty.Advanced && <Brain size={12} />}
          {question.difficulty}
        </span>
        <span className="px-2.5 py-1 rounded-md text-xs font-bold border border-gray-700 bg-gray-800 text-gray-300">
          {question.type === QuestionType.CodeAnalysis ? 'CODE ANALYSIS' : question.type.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Question */}
      <h2 className="text-xl md:text-2xl font-bold text-white mb-6 leading-relaxed">
        {question.questionText}
      </h2>

      {/* Code Snippet */}
      {question.codeSnippet && (
        <div className="mb-6 rounded-lg overflow-hidden border border-gray-700 bg-[#0d1117]">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 border-b border-gray-700">
            <Code className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-gray-400 font-mono">snippet</span>
          </div>
          <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300">
            <code>{question.codeSnippet}</code>
          </pre>
        </div>
      )}

      {/* Inputs */}
      {isInputType ? (
        <div className="mt-6">
          <input
            type="text"
            value={inputAnswer}
            onChange={(e) => setInputAnswer(e.target.value)}
            disabled={isSubmitted}
            placeholder="Type your answer here..."
            className={`w-full p-4 rounded-xl border-2 bg-gray-900/50 text-white font-mono focus:outline-none transition-all
              ${isSubmitted 
                ? (inputAnswer.toLowerCase() === question.correctAnswer.toLowerCase() ? 'border-green-500' : 'border-red-500') 
                : 'border-gray-700 focus:border-cyan-500'
              }`}
          />
        </div>
      ) : (
        renderOptions()
      )}

      {/* Action Bar */}
      <div className="mt-8 flex items-center justify-between">
        {!isSubmitted ? (
          <button
            onClick={handleSubmit}
            disabled={isInputType ? !inputAnswer : !selectedOption}
            className="px-8 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg shadow-cyan-900/20"
          >
            Submit Answer
          </button>
        ) : (
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Answer Explanation Box */}
            <div className={`p-6 rounded-xl border ${question.isCorrect ? 'bg-green-950/20 border-green-900/50' : 'bg-red-950/20 border-red-900/50'}`}>
              <div className="flex items-center gap-2 mb-2 font-bold">
                <Lightbulb className={question.isCorrect ? "text-green-400" : "text-red-400"} size={20} />
                <span className={question.isCorrect ? "text-green-400" : "text-red-400"}>
                  {question.isCorrect ? "Correct!" : "Incorrect"}
                </span>
              </div>
              
              <div className="mb-4">
                <span className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Answer:</span>
                <p className="text-white font-mono mt-1">{question.correctAnswer}</p>
              </div>

              <div>
                <span className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Explanation:</span>
                <p className="text-gray-300 mt-1 leading-relaxed">{question.explanation}</p>
              </div>
            </div>

            {/* AI Consult Button */}
            <div className="mt-4">
              {!explanationData && !isSearching && (
                <button 
                  onClick={handleConsultAI}
                  className="flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  <HelpCircle size={14} />
                  <span>Confused? Ask AI to search for more details on this topic.</span>
                </button>
              )}
              
              {isSearching && (
                 <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                   <div className="animate-spin h-3 w-3 border-b-2 border-cyan-400 rounded-full"></div>
                   Searching the web for context...
                 </div>
              )}

              {explanationData && (
                <div className="mt-3 p-4 bg-gray-900 border border-gray-700 rounded-lg text-sm">
                   <h4 className="font-bold text-cyan-400 mb-2 flex items-center gap-2">
                     <ExternalLink size={14} /> Search Results
                   </h4>
                   <p className="text-gray-300">{explanationData.text}</p>
                   {explanationData.sources.length > 0 && (
                     <div className="mt-2 pt-2 border-t border-gray-800">
                        <p className="text-xs text-gray-500 mb-1">Sources:</p>
                        <ul className="list-disc pl-4 space-y-1">
                          {explanationData.sources.map((src, i) => (
                            <li key={i}>
                              <a href={src} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:underline truncate block max-w-full">
                                {src}
                              </a>
                            </li>
                          ))}
                        </ul>
                     </div>
                   )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizCard;