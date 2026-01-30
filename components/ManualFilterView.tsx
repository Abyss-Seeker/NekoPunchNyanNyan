import React, { useState } from 'react';
import { Question, Difficulty } from '../types';
import { Trash2, X, Search, CheckSquare, Square, AlertTriangle } from 'lucide-react';

interface ManualFilterViewProps {
  questions: Question[];
  onSave: (updatedQuestions: Question[]) => void;
  onCancel: () => void;
}

const ManualFilterView: React.FC<ManualFilterViewProps> = ({ questions, onSave, onCancel }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggleSelection = (id: string) => {
    setConfirmDelete(false); // Reset confirmation if selection changes
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    setConfirmDelete(false);
    if (selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0) {
      setSelectedIds(new Set());
    } else {
      const newSet = new Set(selectedIds);
      filteredQuestions.forEach(q => newSet.add(q.id));
      setSelectedIds(newSet);
    }
  };

  const handleDeleteAction = () => {
    if (selectedIds.size === 0) return;
    
    if (confirmDelete) {
      // Perform delete
      const remaining = questions.filter(q => !selectedIds.has(q.id));
      onSave(remaining);
    } else {
      // Ask for confirmation
      setConfirmDelete(true);
    }
  };

  const filteredQuestions = questions.filter(q => 
    q.questionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.difficulty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getDifficultyColor = (diff: Difficulty) => {
    switch(diff) {
      case Difficulty.Easy: return 'text-green-400';
      case Difficulty.Medium: return 'text-yellow-400';
      case Difficulty.Hard: return 'text-orange-400';
      case Difficulty.Advanced: return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] max-w-6xl mx-auto w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-lg">
        <div>
          <h2 className="text-2xl font-bold text-white">Manual Question Filter</h2>
          <p className="text-gray-400 text-sm">Select questions to remove from the quiz.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          
          <button 
            onClick={handleDeleteAction}
            disabled={selectedIds.size === 0}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition-all font-bold shadow-lg
              ${selectedIds.size === 0 
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                : confirmDelete 
                  ? 'bg-red-500 hover:bg-red-400 text-white animate-pulse' 
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
          >
            {confirmDelete ? (
              <>
                <AlertTriangle size={18} />
                Click again to Confirm ({selectedIds.size})
              </>
            ) : (
              <>
                <Trash2 size={18} />
                Remove {selectedIds.size} Selected
              </>
            )}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Search questions..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg py-2 pl-10 pr-4 text-gray-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <button 
          onClick={toggleAll}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm hover:bg-gray-700 transition-colors"
        >
          {selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0 ? (
            <><CheckSquare size={16} className="text-cyan-400"/> Deselect All</>
          ) : (
            <><Square size={16} /> Select All Shown</>
          )}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
        {filteredQuestions.map((q, idx) => {
          const isSelected = selectedIds.has(q.id);
          return (
            <div 
              key={q.id}
              onClick={() => toggleSelection(q.id)}
              className={`group flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all select-none
                ${isSelected 
                  ? 'bg-red-900/10 border-red-500/50 shadow-[0_0_15px_-3px_rgba(239,68,68,0.1)]' 
                  : 'bg-gray-900/30 border-gray-800 hover:border-gray-600 hover:bg-gray-800/50'
                }`}
            >
              <div className="mt-1">
                {isSelected ? (
                  <CheckSquare className="text-red-400" size={20} />
                ) : (
                  <Square className="text-gray-600 group-hover:text-gray-400" size={20} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-gray-500">#{idx + 1}</span>
                  <span className={`text-xs font-bold ${getDifficultyColor(q.difficulty)} px-2 py-0.5 rounded bg-gray-900`}>
                    {q.difficulty}
                  </span>
                  <span className="text-xs font-mono text-cyan-500/80 uppercase">
                    {q.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed ${isSelected ? 'text-gray-400 line-through' : 'text-gray-200'}`}>
                  {q.questionText}
                </p>
                {q.codeSnippet && (
                  <div className="mt-2 p-2 bg-black/30 rounded border border-gray-800 font-mono text-xs text-gray-500 truncate">
                    {q.codeSnippet}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {filteredQuestions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No questions found matching your search.
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualFilterView;