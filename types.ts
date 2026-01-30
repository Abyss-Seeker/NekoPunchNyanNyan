export enum QuestionType {
  MultipleChoice = 'MULTIPLE_CHOICE',
  FillInBlank = 'FILL_IN_BLANK',
  CodeAnalysis = 'CODE_ANALYSIS' // Treated similar to MCQ but with code focus
}

export enum Difficulty {
  Easy = 'Easy',
  Medium = 'Medium',
  Hard = 'Hard',
  Advanced = 'Advanced', // New difficulty level
  Expert = 'Expert' // Keeping for backward compatibility or extreme cases
}

export interface Question {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  questionText: string;
  codeSnippet?: string; // Optional code context
  options?: string[]; // For MCQ
  correctAnswer: string; // The correct string value
  explanation: string; // Why it is correct
  userAnswer?: string; // To track state
  isCorrect?: boolean; // To track state
}

export interface QuizData {
  title: string;
  generatedAt: string;
  questions: Question[];
}

export interface GenerationLog {
  stage: string;
  message: string;
  timestamp: number;
}

export type AppState = 'IDLE' | 'GENERATING' | 'PLAYING' | 'SUMMARY' | 'FILTERING' | 'MANUAL_FILTER' | 'SETTINGS';

export interface LoadingState {
  status: string;
  progress: number; // 0 to 100
}