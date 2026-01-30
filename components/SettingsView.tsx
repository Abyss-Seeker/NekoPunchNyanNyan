import React, { useState } from 'react';
import { Save, Key, ArrowLeft, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface SettingsViewProps {
  currentKey: string;
  onSave: (key: string) => void;
  onBack: () => void;
  error?: string | null;
}

const SettingsView: React.FC<SettingsViewProps> = ({ currentKey, onSave, onBack, error }) => {
  const [keyInput, setKeyInput] = useState(currentKey);
  const [showKey, setShowKey] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

  const handleSave = () => {
    onSave(keyInput);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleClear = () => {
    setKeyInput('');
    onSave('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0B0F19] animate-in fade-in duration-300">
      <div className="max-w-xl w-full bg-gray-900 border border-gray-800 rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center gap-4 mb-8 border-b border-gray-800 pb-6">
          <button 
            onClick={onBack}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-white">Settings</h2>
            <p className="text-gray-400 text-sm">Configure Application Secrets</p>
          </div>
        </div>

        {error && (
            <div className="mb-6 p-4 bg-red-950/30 border border-red-900 rounded-xl flex items-start gap-3">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                <div className="text-sm text-red-200">
                    <p className="font-bold mb-1">Action Required</p>
                    <p>{error}</p>
                </div>
            </div>
        )}

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Key size={16} className="text-cyan-400" />
              Gemini API Key
            </label>
            <div className="relative">
              <input 
                type={showKey ? "text" : "password"}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Enter your Gemini API key (AIza...)"
                className="w-full bg-gray-950 border border-gray-700 rounded-xl py-3 pl-4 pr-12 text-white focus:outline-none focus:border-cyan-500 transition-colors font-mono text-sm"
              />
              <button 
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              This key is used as a fallback if the application environment key is not configured. 
              It is stored locally in your browser.
            </p>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button 
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-colors"
            >
              <Save size={18} />
              {saveStatus === 'saved' ? 'Saved!' : 'Save Configuration'}
            </button>
            {keyInput && (
              <button 
                onClick={handleClear}
                className="p-3 bg-red-900/20 border border-red-900/50 hover:bg-red-900/40 text-red-400 rounded-xl transition-colors"
                title="Clear Key"
              >
                <Trash2 size={20} />
              </button>
            )}
          </div>
          
          <div className="text-center text-xs text-gray-600 pt-4 border-t border-gray-800">
             Need a key? <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-cyan-500 hover:underline">Get one from Google AI Studio</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;