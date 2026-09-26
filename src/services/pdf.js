import PDFDocument from 'pdfkit';

const C = { ink: '#272722', muted: '#72736A', line: '#DEDED5', soft: '#F7F6F2', accent: '#B4492D', good: '#348264', bad: '#B4492D' };

export const generateScorecardPDF = (res, attempt, user, quiz) => {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 86, bottom: 70, left: 48, right: 48 }, bufferPages: true, info: { Title: `${quiz?.title || 'Quiz'} - Scorecard`, Author: 'CodeArena' } });
  doc.pipe(res);
  const width = doc.page.width - 96;
  const bottom = doc.page.height - 70;
  const frame = () => {
    doc.save();
    doc.rect(48, 32, 7, 7).fill(C.accent);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(C.ink).text('codearena.', 64, 29, { lineBreak: false });
    doc.font('Courier').fontSize(7).fillColor(C.muted).text('ASSESSMENT / SCORECARD', 340, 32, { width: 207, align: 'right', lineBreak: false });
    doc.moveTo(48, 58).lineTo(547, 58).strokeColor(C.line).lineWidth(0.7).stroke();
    doc.restore();
    doc.x = 48; doc.y = 86;
  };
  frame();
  doc.on('pageAdded', frame);
  const ensure = height => { if (doc.y + height > bottom) doc.addPage(); };
  const text = (value, size = 10, font = 'Helvetica', color = C.ink, indent = 0) => {
    doc.font(font).fontSize(size).fillColor(color);
    doc.text(String(value ?? 'Not available'), 48 + indent, doc.y, { width: width - indent, lineGap: 4 });
  };
  const label = value => text(value, 8, 'Courier', C.muted);
  const rule = () => { doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor(C.line).lineWidth(0.6).stroke(); doc.y += 16; };

  label('RESULT / SUBMITTED ATTEMPT');
  doc.y += 12;
  text(quiz?.title || 'Quiz result', 30, 'Times-Roman');
  doc.y += 8;
  text(`${quiz?.category || 'General'} / ${quiz?.difficulty || 'Not specified'}`, 10, 'Helvetica', C.muted);
  doc.y += 24;
  ensure(138);
  const scoreY = doc.y;
  doc.rect(48, scoreY, width, 120).fill(C.soft);
  doc.rect(48, scoreY, 3, 120).fill(C.accent);
  const seconds = Math.max(0, Math.floor(Number(attempt.timeTaken) || 0));
  const stats = [['SCORE', `${attempt.score ?? 0} / ${quiz?.totalMarks ?? '—'}`], ['ACCURACY', `${attempt.accuracy ?? 0}%`], ['TIME TAKEN', `${Math.floor(seconds / 60)}m ${seconds % 60}s`]];
  stats.forEach(([heading, value], index) => {
    const x = 70 + index * 160;
    doc.font('Courier').fontSize(8).fillColor(C.muted).text(heading, x, scoreY + 23, { width: 145 });
    doc.font('Helvetica').fontSize(index === 0 ? 27 : 22).fillColor(index === 0 ? C.accent : C.ink).text(value, x, scoreY + 48, { width: 145 });
  });
  doc.y = scoreY + 144;
  ensure(50); label('01 / CANDIDATE & SESSION'); doc.y += 12;
  const submitted = new Date(attempt.submittedAt);
  const details = [['Candidate', user?.name || 'Not available'], ['Email', user?.email || 'Not available'], ['Institution', user?.college || 'Not specified'], ['Submitted (UTC)', Number.isNaN(submitted.getTime()) ? 'Not available' : submitted.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC')], ['Report ID', String(attempt._id || attempt.id || 'Not available')]];
  for (const [heading, value] of details) {
    doc.font('Helvetica').fontSize(10);
    const height = Math.max(18, doc.heightOfString(String(value), { width: width - 130, lineGap: 4 }));
    ensure(height + 25);
    const y = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(heading, 48, y, { width: 115 });
    doc.font('Helvetica').fontSize(10).fillColor(C.ink).text(String(value), 178, y, { width: width - 130, lineGap: 4 });
    doc.y = Math.max(doc.y, y + height) + 12;
    rule();
  }
  ensure(105); doc.y += 10;
  label('READING THIS REPORT'); doc.y += 8;
  text('The score records marks earned. Accuracy records the percentage of questions answered correctly. The review below includes your responses, correct answers, and available explanations.', 10, 'Helvetica', C.muted);

  const questions = quiz?.questions || [];
  if (questions.length) {
    doc.addPage();
    label('02 / QUESTION REVIEW'); doc.y += 10;
    text('Review your work.', 28, 'Times-Roman');
    text(`${questions.length} questions / Responses and explanations`, 9, 'Helvetica', C.muted);
    doc.y += 24;
    questions.forEach((question, index) => {
      const answer = attempt.answers?.find(item => String(item.questionId) === String(question._id));
      const responded = answer && (answer.selectedOption != null || answer.selectedOptions?.length || answer.booleanAnswer != null || answer.textAnswer?.trim());
      const status = answer?.isCorrect ? 'CORRECT' : responded ? 'INCORRECT' : 'NO RESPONSE';
      ensure(95); rule();
      text(`QUESTION ${String(index + 1).padStart(2, '0')} / ${status}`, 8, 'Courier', answer?.isCorrect ? C.good : C.bad);
      doc.y += 8;
      text(question.questionText, 11, 'Helvetica-Bold');
      doc.y += 10;
      const writeAnswer = (value, color = C.muted) => { ensure(30); text(value, 9, 'Helvetica', color, 12); doc.y += 4; };
      if (['mcq', 'multiple_correct'].includes(question.questionType)) {
        (question.options || []).forEach((option, optionIndex) => {
          const selected = question.questionType === 'mcq' ? answer?.selectedOption === optionIndex : answer?.selectedOptions?.includes(optionIndex);
          const correct = question.questionType === 'mcq' ? question.correctOption === optionIndex : question.correctAnswers?.includes(optionIndex);
          const tags = [selected && 'your answer', correct && 'correct answer'].filter(Boolean).join(', ');
          writeAnswer(`${String.fromCharCode(65 + optionIndex)}. ${option}${tags ? ' [' + tags + ']' : ''}`, correct ? C.good : selected ? C.bad : C.muted);
        });
        if (!responded) writeAnswer('Your answer: No response');
      } else if (question.questionType === 'true_false') {
        writeAnswer(`Your answer: ${answer?.booleanAnswer ?? 'No response'}`);
        writeAnswer(`Correct answer: ${question.answer ?? 'Not available'}`, C.good);
      } else {
        writeAnswer(`Your answer: ${answer?.textAnswer || 'No response'}`);
        writeAnswer(`Correct answer: ${question.correctAnswerText || 'Not available'}`, C.good);
      }
      if (question.explanation) {
        ensure(60); doc.y += 8; label('EXPLANATION');
        text(question.explanation, 9, 'Helvetica', C.muted, 12);
      }
      doc.y += 22;
    });
  }
  const pages = doc.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index++) {
    doc.switchToPage(index);
    doc.moveTo(48, 788).lineTo(547, 788).strokeColor(C.line).stroke();
    // Footer is outside the flowing content area; prevent PDFKit adding an extra page.
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor(C.muted).text('CodeArena / Record of a submitted assessment', 48, 802, { width: 380, lineBreak: false });
    doc.text(`${index + 1} / ${pages.count}`, 480, 802, { width: 67, align: 'right', lineBreak: false });
  }
  doc.end();
  return doc;
};
