import { GoogleGenAI, Type } from "@google/genai";
import { QuizData, QuestionType, Difficulty, Question, GenerationLog } from "../types";

let userProvidedKey: string | null = null;

/**
 * Configure the user-provided API key.
 * This is used as a fallback if process.env.API_KEY is not set.
 */
export const configureUserApiKey = (key: string) => {
  userProvidedKey = key;
};

// Initialize Gemini Client with fallback logic
const getAiClient = () => {
  // Prioritize environment variable, fallback to user key
  const apiKey = process.env.API_KEY || userProvidedKey;

  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// Logger helper
type LogCallback = (log: GenerationLog) => void;
const log = (cb: LogCallback | undefined, stage: string, message: string) => {
  if (cb) cb({ stage, message, timestamp: Date.now() });
  console.log(`[${stage}] ${message}`);
};

/**
 * Converts a File object to a Base64 string.
 */
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Robust JSON repair.
 */
const repairMalformedJson = async (brokenJson: string): Promise<any> => {
  const ai = getAiClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Fix this broken JSON string. Return ONLY the valid JSON object. 
      If arrays are truncated, close them.
      Broken JSON: ${brokenJson}`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Critical JSON repair failure", error);
    return { questions: [] }; // Fallback
  }
};

/**
 * New Service: AI Filter for removing non-coding questions
 */
export const filterNonCodingQuestions = async (questions: Question[], onLog?: LogCallback): Promise<string[]> => {
  log(onLog, "Urara", `Initiating review of ${questions.length} questions...`);
  
  let ai;
  try {
     ai = getAiClient();
  } catch (e: any) {
     throw e; // Propagate API_KEY_MISSING
  }

  const batchSize = 25; // Process in chunks
  const idsToRemove: string[] = [];

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize).map(q => ({
      id: q.id,
      text: q.questionText,
      type: q.type
    }));

    const currentBatchNum = Math.ceil(i/batchSize) + 1;
    const totalBatches = Math.ceil(questions.length/batchSize);
    log(onLog, "Urara", `Scanning batch ${currentBatchNum}/${totalBatches} (${batch.length} items)...`);

    const prompt = `
      Identify questions that are NOT related to writing code, reading code, command line syntax, or technical execution logic.
      
      Mark for removal (return their IDs):
      - History of Linux/CS (e.g., "Who invented Linux?", "In what year...")
      - Purely conceptual/legal definitions (e.g., "What is open source?", "What is GPL?")
      - GUI descriptions (e.g., "What does the X2GO icon look like?", "Where is the start button?")
      - Basic IT facts not related to syntax (e.g., "Linux is a kernel").
      
      Keep:
      - Specific Commands (ls, cd, grep...)
      - Syntax usage
      - Scripting / Piping
      - Output prediction
      - File permission codes
      - Path navigation
      
      Return JSON: { "removeIds": ["id1", "id2"] }
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
           { role: 'user', parts: [{ text: JSON.stringify(batch) }, { text: prompt }] }
        ],
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
             type: Type.OBJECT,
             properties: {
               removeIds: { type: Type.ARRAY, items: { type: Type.STRING } }
             }
          }
        }
      });
      
      const result = JSON.parse(response.text || "{}");
      if (result.removeIds && Array.isArray(result.removeIds)) {
        idsToRemove.push(...result.removeIds);
        log(onLog, "Urara", `Batch ${currentBatchNum}: Found ${result.removeIds.length} non-coding questions.`);
      } else {
        log(onLog, "Urara", `Batch ${currentBatchNum}: All questions look relevant.`);
      }
    } catch (e: any) {
      if (e.message === "API_KEY_MISSING") throw e;
      console.error("Filter batch failed", e);
      log(onLog, "Urara", `Error filtering batch ${currentBatchNum}, skipping...`);
    }
  }
  return idsToRemove;
};

/**
 * Agent 1: The Planner
 * Scans the document to create logical partitions.
 */
const generateStudyPlan = async (filePart: any): Promise<{ title: string; sections: string[] }> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", // Fast model for planning
    contents: [
      { role: 'user', parts: [filePart, { text: "Scan this document. Create a title for the quiz and split the content into 4-6 distinct, logical study sections (topics) for a midterm exam. Return JSON: { title: string, sections: string[] }." }] }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          sections: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "sections"]
      }
    }
  });
  return JSON.parse(response.text || '{"title": "Exam", "sections": ["General"]}');
};

/**
 * Agent 2: The Worker
 * Generates questions for a specific section.
 */
const generateSectionQuestions = async (filePart: any, section: string, codingOnly: boolean): Promise<Question[]> => {
  const ai = getAiClient();
  
  const prompt = `
    You are a Worker Agent generating exam questions for the section: "${section}".
    
    DIFFICULTY RULES:
    - EASY: Word-for-word recall from the text.
    - MEDIUM: Standard command usage, flags, basic comprehension.
    - HARD: Edge cases, debugging, complex piping, obscure flags.
    - ADVANCED: Synthesis & Application. Ask the user to achieve a goal using knowledge from the doc combined with general CS logic. The scenario might be new, but the solution relies on the doc.

    ${codingOnly ? `
    STRICT CONSTRAINT: CODING ONLY MODE IS ACTIVE.
    1. DO NOT generate questions about history, dates, people, license types, or general definitions.
    2. DO NOT generate questions about GUI icons, windows, or visual elements (e.g. "What does the icon look like?").
    3. EVERY QUESTION must test:
       - A terminal command (syntax, flags, usage).
       - A code snippet (output, behavior, debugging).
       - File system operations.
       - Scripting logic.
    ` : ''}

    TASK:
    Generate 15-20 distinct questions for this section.
    Mix types: Multiple Choice, Fill in Blank (exact command), Code Analysis.
    For 'CODE_ANALYSIS', usually provide 'options' unless it is strictly a write-the-code question, in which case leave 'options' empty.
    Return JSON.
  `;

  // Schema for questions (reused)
  const questionSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        type: { type: Type.STRING, enum: [QuestionType.MultipleChoice, QuestionType.FillInBlank, QuestionType.CodeAnalysis] },
        difficulty: { type: Type.STRING, enum: [Difficulty.Easy, Difficulty.Medium, Difficulty.Hard, Difficulty.Advanced] },
        questionText: { type: Type.STRING },
        codeSnippet: { type: Type.STRING, nullable: true },
        options: { type: Type.ARRAY, items: { type: Type.STRING }, nullable: true },
        correctAnswer: { type: Type.STRING },
        explanation: { type: Type.STRING },
      },
      required: ["id", "type", "difficulty", "questionText", "correctAnswer", "explanation"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Pro for quality generation
      contents: [{ role: 'user', parts: [filePart, { text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: questionSchema,
        maxOutputTokens: 8192
      }
    });

    try {
      return JSON.parse(response.text || "[]");
    } catch {
      const repaired = await repairMalformedJson(response.text || "");
      return Array.isArray(repaired) ? repaired : (repaired.questions || []);
    }
  } catch (e: any) {
    if (e.message === "API_KEY_MISSING") throw e;
    console.error(`Worker failed for section ${section}`, e);
    return [];
  }
};

/**
 * Agent 3: The Reviewer
 * Checks quality, quantity, and duplication.
 */
const reviewAndRefine = async (
    filePart: any, 
    currentQuestions: Question[], 
    depth: number, 
    onLog: LogCallback
): Promise<Question[]> => {
  
  if (depth <= 0) {
    log(onLog, "Calstone", "Max recursion depth reached. Finalizing.");
    return currentQuestions;
  }

  log(onLog, "Calstone", `Analyzing ${currentQuestions.length} questions (Depth: ${depth})...`);

  // 1. Identification check (using Flash for speed)
  const ai = getAiClient();
  const analysisPrompt = `
    Analyze this list of ${currentQuestions.length} questions.
    Check for:
    1. Exact duplicates (same question text).
    2. Lack of "Advanced" questions.
    3. Missing key concepts from the document context (you have the doc).
    
    Return JSON:
    {
      "passed": boolean (true if count > 70 AND good distribution),
      "feedback": string (instructions on what to fix/add),
      "duplicateIds": string[] (list of IDs to remove)
    }
  `;

  // We send a summary of questions to save tokens, not full JSON if possible, 
  // but for accuracy we send full JSON of questions minus heavy explanations.
  const slimQuestions = currentQuestions.map(q => ({ id: q.id, text: q.questionText, diff: q.difficulty }));
  
  let reviewResult;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { role: 'user', parts: [filePart, { text: JSON.stringify(slimQuestions) }, { text: analysisPrompt }] }
      ],
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                passed: { type: Type.BOOLEAN },
                feedback: { type: Type.STRING },
                duplicateIds: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
        }
      }
    });
    reviewResult = JSON.parse(response.text || "{}");
  } catch (e: any) {
    if (e.message === "API_KEY_MISSING") throw e;
    log(onLog, "Calstone", "Review step failed, skipping recursion.");
    return currentQuestions;
  }

  // 2. Process Duplicates
  let filteredQuestions = currentQuestions;
  if (reviewResult.duplicateIds && reviewResult.duplicateIds.length > 0) {
    log(onLog, "Calstone", `Removing ${reviewResult.duplicateIds.length} duplicates.`);
    filteredQuestions = currentQuestions.filter(q => !reviewResult.duplicateIds.includes(q.id));
  }

  // 3. Decision
  if (reviewResult.passed) {
    log(onLog, "Calstone", "Quiz meets quality standards!");
    return filteredQuestions;
  }

  log(onLog, "Calstone", `Quality Check Failed: ${reviewResult.feedback}`);
  log(onLog, "Tachyon", "Generating supplementary questions...");

  // 4. Generate Fixes
  // Ask for ~15 more questions specifically addressing the feedback
  const fixPrompt = `
    The previous batch of questions had these issues: "${reviewResult.feedback}".
    Generate 15 NEW, distinct questions to address this. 
    Focus heavily on "Advanced" difficulty if mentioned.
    Return JSON array of questions.
  `;
  
  try {
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: [{ role: 'user', parts: [filePart, { text: fixPrompt }] }],
        config: { responseMimeType: "application/json", maxOutputTokens: 8192 }
    });
    
    let newQuestions: Question[] = [];
    try {
        const parsed = JSON.parse(response.text || "[]");
        newQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
    } catch {
        const repaired = await repairMalformedJson(response.text || "");
        newQuestions = Array.isArray(repaired) ? repaired : (repaired.questions || []);
    }

    // Ensure IDs are unique in new batch
    newQuestions.forEach(q => q.id = `patch_${depth}_${Math.random().toString(36).substr(2, 9)}`);

    const combined = [...filteredQuestions, ...newQuestions];
    return reviewAndRefine(filePart, combined, depth - 1, onLog);

  } catch (e: any) {
    if (e.message === "API_KEY_MISSING") throw e;
    log(onLog, "Tachyon", "Fix generation failed.");
    return filteredQuestions;
  }
};

/**
 * Main Orchestrator
 */
export const generateQuizFromDocument = async (file: File, codingOnly: boolean, onLog: LogCallback): Promise<QuizData> => {
  log(onLog, "Bourbon", `Initializing file processing (Coding Only: ${codingOnly})...`);
  const filePart = await fileToGenerativePart(file);

  // Step 1: Plan
  log(onLog, "Bakushin", "Analyzing document structure...");
  const plan = await generateStudyPlan(filePart);
  log(onLog, "Bakushin", `Identified ${plan.sections.length} sections: ${plan.sections.join(', ')}`);

  // Step 2: Parallel Execution (Worker Agents)
  log(onLog, "Bourbon", `Deploying ${plan.sections.length} agents to generate questions...`);
  
  const questionPromises = plan.sections.map(section => 
    generateSectionQuestions(filePart, section, codingOnly)
      .then(qs => {
        log(onLog, "Amazon", `Section "${section}" completed: ${qs.length} questions.`);
        return qs;
      })
  );

  const results = await Promise.all(questionPromises);
  let allQuestions = results.flat();

  // Assign IDs if missing
  allQuestions.forEach((q, i) => {
    if (!q.id) q.id = `gen_${i}`;
  });

  // Step 3: Review and Refine (Recursive)
  log(onLog, "Bourbon", "Aggregating results for quality control...");
  const finalQuestions = await reviewAndRefine(filePart, allQuestions, 3, onLog);

  log(onLog, "Universe", `Finalizing quiz with ${finalQuestions.length} questions.`);

  return {
    title: plan.title || "Generated Midterm",
    generatedAt: new Date().toISOString(),
    questions: finalQuestions
  };
};

/**
 * Search Grounding (Existing)
 */
export const searchTopicExplanation = async (topic: string): Promise<{ text: string; sources: string[] }> => {
    const ai = getAiClient();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Explain the computer science concept: "${topic}" concisely.`,
        config: { tools: [{ googleSearch: {} }] }
      });
      const text = response.text || "Could not retrieve information.";
      const sources: string[] = [];
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
          if (chunk.web?.uri) sources.push(chunk.web.uri);
        });
      }
      return { text, sources };
    } catch (error) {
      return { text: "Failed to perform search. Check API configuration.", sources: [] };
    }
};