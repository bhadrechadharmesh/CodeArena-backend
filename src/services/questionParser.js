import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Parses questions from an uploaded file (PDF or TXT)
 * @param {Buffer} fileBuffer - File contents buffer
 * @param {string} mimeType - File MIME type
 * @returns {Promise<Array>} List of parsed question objects
 */
export const parseFileContent = async (fileBuffer, mimeType) => {
  let text = '';
  
  if (mimeType === 'application/pdf') {
    const data = await pdfParse(fileBuffer);
    text = data.text;
  } else {
    // Treat as plain text / txt
    text = fileBuffer.toString('utf8');
  }
  
  return parseTextToQuestions(text);
};

/**
 * Parses raw text content into questions array
 * @param {string} text - Raw text content
 * @returns {Array} List of parsed question objects
 */
export const parseTextToQuestions = (text) => {
  const lines = text.split(/\r?\n/);
  const questions = [];
  let currentQuestion = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Check if line starts a new question
    // Match patterns like: "1. Question Text", "Q1: Question Text", "Question 3: Text", "Q) Text"
    const qMatch = line.match(/^\s*(?:Question\s*\d+|Q\d+|\d+)\s*[:.)\]-]\s*(.*)/i);
    if (qMatch) {
      if (currentQuestion) {
        questions.push(currentQuestion);
      }
      currentQuestion = {
        questionText: qMatch[1].trim(),
        options: [],
        rawOptions: {}, // 'A' -> 'option text'
        correctOption: 0,
        correctAnswers: [],
        answer: true,
        correctAnswerText: '',
        explanation: '',
        difficulty: 'medium',
        topic: 'General',
        questionType: 'mcq'
      };
      continue;
    }

    if (!currentQuestion) continue;

    // Check if line is an option
    // Match patterns like: "A) Option text", "b. Option text", "(C) Option text", "D - Option text"
    const optMatch = line.match(/^\s*(?:\(?)([A-Fa-f])(?:\)|\]|\.|-)\s*(.*)/);
    if (optMatch) {
      const letter = optMatch[1].toUpperCase();
      const optText = optMatch[2].trim();
      currentQuestion.rawOptions[letter] = optText;
      currentQuestion.options.push(optText);
      continue;
    }

    // Check if line is correct answer
    // Match patterns like: "Answer: A", "Correct Answer: B", "Ans: True", "Correct: object"
    const ansMatch = line.match(/^\s*(?:Correct\s+)?Answer\s*[:.-]\s*(.*)/i) || 
                     line.match(/^\s*Ans\s*[:.-]\s*(.*)/i) || 
                     line.match(/^\s*Correct\s*[:.-]\s*(.*)/i);
    if (ansMatch) {
      currentQuestion.rawAnswerString = ansMatch[1].trim();
      continue;
    }

    // Check if line is explanation
    // Match patterns like: "Explanation: Because..."
    const expMatch = line.match(/^\s*Explanation\s*[:.-]\s*(.*)/i);
    if (expMatch) {
      currentQuestion.explanation = expMatch[1].trim();
      continue;
    }

    // If it is a continuation of previous line
    if (currentQuestion.explanation) {
      currentQuestion.explanation += ' ' + line;
    } else if (currentQuestion.rawAnswerString) {
      currentQuestion.rawAnswerString += ' ' + line;
    } else if (currentQuestion.options.length > 0) {
      const lastIdx = currentQuestion.options.length - 1;
      currentQuestion.options[lastIdx] += ' ' + line;
      
      const letters = Object.keys(currentQuestion.rawOptions);
      if (letters.length > 0) {
        const lastLetter = letters[letters.length - 1];
        currentQuestion.rawOptions[lastLetter] += ' ' + line;
      }
    } else {
      currentQuestion.questionText += ' ' + line;
    }
  }

  // Add the last parsed question if exists
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  // Refine questions types and correct answer fields based on matches
  const parsedQuestions = questions.map(q => {
    const ansStr = q.rawAnswerString ? q.rawAnswerString.trim() : '';
    delete q.rawAnswerString;
    
    const rawOpts = q.rawOptions || {};
    delete q.rawOptions;

    // Heuristics for question type and answers:
    if (q.options.length === 0) {
      // If there are no options, it's either true_false or fill_blank
      if (ansStr.toLowerCase() === 'true' || ansStr.toLowerCase() === 'false') {
        q.questionType = 'true_false';
        q.answer = ansStr.toLowerCase() === 'true';
      } else {
        q.questionType = 'fill_blank';
        q.correctAnswerText = ansStr || 'Answer';
      }
    } else {
      // If there are options, map raw options to 0-indexed indices
      const letterKeys = Object.keys(rawOpts); // e.g. ['A', 'B', 'C', 'D']
      const matchedLetters = [];
      
      for (const key of letterKeys) {
        const regex = new RegExp(`\\b${key}\\b`, 'i');
        if (regex.test(ansStr)) {
          matchedLetters.push(key);
        }
      }

      if (matchedLetters.length > 1) {
        // Multiple correct options
        q.questionType = 'multiple_correct';
        q.correctAnswers = matchedLetters.map(letter => q.options.indexOf(rawOpts[letter]));
      } else if (matchedLetters.length === 1) {
        // Single correct option (MCQ)
        q.questionType = 'mcq';
        q.correctOption = q.options.indexOf(rawOpts[matchedLetters[0]]);
      } else {
        // Fallback checks: maybe the answer string matches option text exactly
        const optIdx = q.options.findIndex(opt => opt.toLowerCase() === ansStr.toLowerCase());
        if (optIdx !== -1) {
          q.questionType = 'mcq';
          q.correctOption = optIdx;
        } else {
          // Or maybe it's just the letter itself (like "A" or "a") without boundaries
          const firstChar = ansStr.charAt(0).toUpperCase();
          if (rawOpts[firstChar] !== undefined) {
            q.questionType = 'mcq';
            q.correctOption = q.options.indexOf(rawOpts[firstChar]);
          } else {
            // Default fallback
            q.questionType = 'mcq';
            q.correctOption = 0;
          }
        }
      }
    }

    return q;
  });

  return parsedQuestions;
};
