import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle, Code, CheckSquare } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File, codingOnly: boolean) => void;
  onImportQuiz: (data: any) => void;
  isProcessing: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onImportQuiz, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codingOnly, setCodingOnly] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateAndUpload = (file: File) => {
    if (file.type === 'application/pdf') {
      onFileSelect(file, codingOnly);
      setError(null);
    } else if (file.type === 'application/json') {
      // Import existing quiz
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          onImportQuiz(json);
        } catch (err) {
          setError("Invalid JSON file.");
        }
      };
      reader.readAsText(file);
    } else {
      setError("Please upload a PDF document or a JSON quiz file.");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  }, [codingOnly]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto p-6 space-y-6">
      <div 
        className={`relative flex flex-col items-center justify-center w-full h-80 border-2 border-dashed rounded-2xl transition-all duration-300
          ${dragActive ? 'border-cyan-400 bg-cyan-400/10' : 'border-gray-700 bg-gray-900/50'}
          ${isProcessing ? 'opacity-50 pointer-events-none' : 'hover:border-cyan-500/50 hover:bg-gray-800/80'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
          <div className="p-4 rounded-full bg-gray-800 mb-4 shadow-lg shadow-cyan-900/20">
            {isProcessing ? (
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-400"></div>
            ) : (
              <Upload className="w-10 h-10 text-cyan-400" />
            )}
          </div>
          <p className="mb-2 text-xl font-bold text-white">
            {isProcessing ? "Analyzing Document..." : "Drop your Lecture PDF here"}
          </p>
          <p className="text-sm text-gray-400 mb-4">
            MidtermMaster will extract code, syntax, and concepts to build your exam.
          </p>
          <p className="text-xs text-gray-500">Supported: .pdf (Document), .json (Import Quiz)</p>
        </div>
        <input 
          id="dropzone-file" 
          type="file" 
          className="hidden" 
          accept=".pdf,.json"
          onChange={handleChange}
          disabled={isProcessing}
        />
        <label 
          htmlFor="dropzone-file"
          className="absolute inset-0 cursor-pointer"
        ></label>
      </div>

      <div className="flex items-center justify-center">
        <label className="flex items-center space-x-3 p-4 bg-gray-900/50 border border-gray-800 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors w-full sm:w-auto">
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${codingOnly ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'}`}>
            {codingOnly && <CheckSquare size={14} className="text-white" />}
          </div>
          <input 
            type="checkbox" 
            checked={codingOnly}
            onChange={(e) => setCodingOnly(e.target.checked)}
            className="hidden"
            disabled={isProcessing}
          />
          <div className="flex items-center gap-2">
            <Code size={18} className="text-cyan-400" />
            <span className="text-gray-300 font-medium">Generate Coding Questions Only</span>
          </div>
          <div className="text-xs text-gray-500 pl-2 border-l border-gray-700">
            Omits history & concepts
          </div>
        </label>
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-800 text-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;