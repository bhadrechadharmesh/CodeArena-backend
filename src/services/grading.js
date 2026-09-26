export function gradeQuiz(quiz, answers) {
  let correctCount = 0;
  const gradedAnswers = quiz.questions.map(question => {
    const answer = answers.find(item => String(item.questionId) === String(question._id));
    const selectedOption = Number.isInteger(answer?.selectedOption) ? answer.selectedOption : null;
    const selectedOptions = Array.isArray(answer?.selectedOptions) ? [...new Set(answer.selectedOptions.filter(Number.isInteger))] : [];
    const booleanAnswer = typeof answer?.booleanAnswer === 'boolean' ? answer.booleanAnswer : null;
    const textAnswer = typeof answer?.textAnswer === 'string' ? answer.textAnswer : '';
    let isCorrect = false;
    if (question.questionType === 'mcq') isCorrect = selectedOption !== null && selectedOption === question.correctOption;
    if (question.questionType === 'multiple_correct') isCorrect = selectedOptions.length > 0 && selectedOptions.length === question.correctAnswers.length && selectedOptions.every(option => question.correctAnswers.includes(option));
    if (question.questionType === 'true_false') isCorrect = booleanAnswer !== null && booleanAnswer === question.answer;
    if (question.questionType === 'fill_blank') isCorrect = !!textAnswer.trim() && textAnswer.trim().toLowerCase() === question.correctAnswerText?.trim().toLowerCase();
    if (isCorrect) correctCount++;
    return { questionId: question._id, selectedOption, selectedOptions, booleanAnswer, textAnswer, isCorrect };
  });
  const totalQuestions = quiz.questions.length;
  return { gradedAnswers, correctCount, totalQuestions, accuracy: totalQuestions ? Math.round(correctCount / totalQuestions * 100) : 0, score: totalQuestions ? Math.round(correctCount / totalQuestions * quiz.totalMarks) : 0 };
}
export const validQuizSubmission = (answers, timeTaken) => Array.isArray(answers) && answers.every(answer => answer && typeof answer.questionId === 'string') && Number.isFinite(timeTaken) && timeTaken >= 0;
