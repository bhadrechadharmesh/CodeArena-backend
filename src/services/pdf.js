import PDFDocument from 'pdfkit';

/**
 * Generates a comprehensive, premium multi-page PDF scorecard
 * containing candidate details, performance summary, feedback, 
 * and detailed question breakdown (user response, correct answer, explanation).
 * 
 * @param {object} res - Express Response object to pipe the PDF stream to
 * @param {object} attempt - Quiz attempt details
 * @param {object} user - Candidate details
 * @param {object} quiz - Quiz details including questions
 */
export const generateScorecardPDF = (res, attempt, user, quiz) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Stream PDF response
  doc.pipe(res);

  // --- Page 1: Scorecard Certificate & Summary ---
  
  // Outer borders
  doc.rect(20, 20, 555, 800).strokeColor('#4F46E5').lineWidth(3).stroke();
  doc.rect(25, 25, 545, 790).strokeColor('#E2E8F0').lineWidth(1).stroke();

  // Header Title
  doc.fillColor('#1E1B4B')
     .font('Helvetica-Bold')
     .fontSize(28)
     .text('CODEARENA SCORECARD', { align: 'center' });

  doc.moveDown(0.5);
  doc.fontSize(12)
     .fillColor('#4F46E5')
     .font('Helvetica-Bold')
     .text('Official Performance Certificate', { align: 'center' });

  doc.moveDown(1.5);

  // Divider Line
  doc.moveTo(50, 110).lineTo(545, 110).strokeColor('#E2E8F0').stroke();

  doc.moveDown(2);

  // User details
  doc.fillColor('#1F2937')
     .font('Helvetica-Bold')
     .fontSize(14)
     .text('Candidate Information');
  
  doc.font('Helvetica')
     .fontSize(11)
     .moveDown(0.5);

  doc.text(`Name: ${user.name}`);
  doc.text(`Email: ${user.email}`);
  doc.text(`College: ${user.college || 'Not Specified'}`);
  doc.text(`Date of Attempt: ${new Date(attempt.submittedAt).toLocaleDateString()}`);

  doc.moveDown(2);

  // Test details
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('Quiz Details');
  
  doc.font('Helvetica')
     .fontSize(11)
     .moveDown(0.5);

  doc.text(`Quiz Title: ${quiz?.title || 'N/A (Deleted Quiz)'}`);
  doc.text(`Category: ${quiz?.category || 'N/A'}`);
  doc.text(`Difficulty: ${quiz?.difficulty ? quiz.difficulty.toUpperCase() : 'N/A'}`);

  doc.moveDown(2);

  // Performance Table / summary
  doc.font('Helvetica-Bold')
     .fontSize(14)
     .text('Performance Summary');

  doc.moveDown(0.8);

  // Draw a styled performance block
  const x = 50;
  const y = doc.y;
  
  doc.rect(x, y, 495, 120).fill('#F8FAFC');
  
  // Fill details on the block
  doc.fillColor('#1E293B')
     .font('Helvetica-Bold')
     .fontSize(11)
     .text(`Score Obtained: ${attempt.score} / ${quiz.totalMarks}`, x + 20, y + 20);

  doc.text(`Accuracy: ${attempt.accuracy}%`, x + 20, y + 45);
  
  const min = Math.floor(attempt.timeTaken / 60);
  const sec = attempt.timeTaken % 60;
  doc.text(`Time Taken: ${min}m ${sec}s`, x + 20, y + 70);

  // Status Badge
  const passStatus = attempt.accuracy >= 50 ? 'PASSED' : 'COMPLETED';
  const badgeColor = attempt.accuracy >= 50 ? '#10B981' : '#F59E0B';
  
  doc.rect(x + 320, y + 30, 130, 40).fill(badgeColor);
  doc.fillColor('#FFFFFF')
     .font('Helvetica-Bold')
     .fontSize(14)
     .text(passStatus, x + 320, y + 42, { width: 130, align: 'center' });

  // Reset doc.y below the performance summary block
  doc.y = y + 140;

  // Feedback Block (based on marks)
  const getFeedback = (accuracy) => {
    if (accuracy >= 90) return "Outstanding! You have demonstrated exceptional mastery of this quiz.";
    if (accuracy >= 75) return "Excellent! You have a very strong grasp of the concepts tested.";
    if (accuracy >= 50) return "Good job! You passed the quiz. Review incorrect answers to improve further.";
    return "Needs Improvement. Review the explanations below and try practicing again.";
  };

  doc.font('Helvetica-Bold')
     .fontSize(13)
     .fillColor('#1E293B')
     .text('Performance Feedback');

  doc.moveDown(0.5);
  const fbX = 50;
  const fbY = doc.y;
  const fbText = getFeedback(attempt.accuracy);
  
  doc.rect(fbX, fbY, 495, 45).fill('#EEF2F6');
  doc.fillColor('#312E81')
     .font('Helvetica-Oblique')
     .fontSize(10)
     .text(fbText, fbX + 15, fbY + 16, { width: 465 });

  doc.y = fbY + 65;

  // Footer & Signatures
  const footerY = 700;
  doc.moveTo(50, footerY).lineTo(200, footerY).strokeColor('#94A3B8').stroke();
  doc.moveTo(395, footerY).lineTo(545, footerY).strokeColor('#94A3B8').stroke();

  doc.fillColor('#64748B')
     .font('Helvetica')
     .fontSize(9)
     .text('Platform Administrator', 50, footerY + 10, { width: 150, align: 'center' });

  doc.text('Verification Code', 395, footerY + 10, { width: 150, align: 'center' });

  // Verification ID
  doc.fillColor('#4F46E5')
     .font('Helvetica-Bold')
     .fontSize(8)
     .text(`ID: ${attempt._id.toString()}`, 395, footerY + 25, { width: 150, align: 'center' });

  // --- Page 2+: Detailed Question-by-Question Breakdown ---
  const questions = quiz?.questions || [];
  if (questions.length > 0) {
    // Add page added event listener for all future pages to draw headers, footers & borders
    doc.on('pageAdded', () => {
      doc.rect(20, 20, 555, 800).strokeColor('#4F46E5').lineWidth(2).stroke();
      doc.rect(25, 25, 545, 790).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      
      // Running Header
      doc.fillColor('#64748B')
         .font('Helvetica-Bold')
         .fontSize(8)
         .text('CODEARENA SCORECARD - DETAILED REPORT', 50, 35);
      
      doc.moveTo(50, 45).lineTo(545, 45).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      
      // Reset doc context
      doc.font('Helvetica').fontSize(10).fillColor('#1F2937');
      doc.y = 65;
    });

    // Move to next page for questions breakdown
    doc.addPage();

    doc.fillColor('#1E1B4B')
       .font('Helvetica-Bold')
       .fontSize(16)
       .text('Detailed Question Breakdown', { align: 'left' });
    
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E2E8F0').lineWidth(1).stroke();
    doc.moveDown(1);

    questions.forEach((q, index) => {
      // Check for page overflow (each question card usually needs 120-180 points)
      if (doc.y > 660) {
        doc.addPage();
      }

      const userAns = attempt.answers?.find(ans => ans.questionId.toString() === q._id.toString());
      const isCorrect = userAns ? userAns.isCorrect : false;

      // Question Title
      doc.font('Helvetica-Bold')
         .fontSize(11)
         .fillColor(isCorrect ? '#10B981' : '#EF4444')
         .text(`Q${index + 1}. [${isCorrect ? 'Correct' : 'Incorrect'}] `, { continued: true })
         .fillColor('#1F2937')
         .text(`${q.questionText} `, { continued: true })
         .font('Helvetica')
         .fontSize(9)
         .fillColor('#64748B')
         .text(`(${q.difficulty.toUpperCase()} | Topic: ${q.topic})`);
      
      doc.moveDown(0.5);

      // Render options/answers based on type
      if (q.questionType === 'mcq') {
        q.options.forEach((opt, optIdx) => {
          const isSelected = userAns && userAns.selectedOption === optIdx;
          const isCorrectOpt = q.correctOption === optIdx;

          let prefix = '[ ] ';
          let color = '#475569';
          if (isCorrectOpt) {
            prefix = '[✓] ';
            color = '#10B981';
          } else if (isSelected) {
            prefix = '[x] ';
            color = '#EF4444';
          }

          doc.fillColor(color)
             .font(isCorrectOpt || isSelected ? 'Helvetica-Bold' : 'Helvetica')
             .fontSize(9.5)
             .text(`   ${prefix}${opt}`, { indent: 12 });
        });
      } 
      else if (q.questionType === 'multiple_correct') {
        q.options.forEach((opt, optIdx) => {
          const isSelected = userAns && userAns.selectedOptions?.includes(optIdx);
          const isCorrectOpt = q.correctAnswers?.includes(optIdx);

          let prefix = '[ ] ';
          let color = '#475569';
          if (isCorrectOpt) {
            prefix = '[✓] ';
            color = '#10B981';
          } else if (isSelected) {
            prefix = '[x] ';
            color = '#EF4444';
          }

          doc.fillColor(color)
             .font(isCorrectOpt || isSelected ? 'Helvetica-Bold' : 'Helvetica')
             .fontSize(9.5)
             .text(`   ${prefix}${opt}`, { indent: 12 });
        });
      }
      else if (q.questionType === 'true_false') {
        const userVal = userAns ? userAns.booleanAnswer : null;
        const correctVal = q.answer;

        ['True', 'False'].forEach(valStr => {
          const valBool = valStr === 'True';
          const isSelected = userVal === valBool;
          const isCorrectOpt = correctVal === valBool;

          let prefix = '[ ] ';
          let color = '#475569';
          if (isCorrectOpt) {
            prefix = '[✓] ';
            color = '#10B981';
          } else if (isSelected) {
            prefix = '[x] ';
            color = '#EF4444';
          }

          doc.fillColor(color)
             .font(isCorrectOpt || isSelected ? 'Helvetica-Bold' : 'Helvetica')
             .fontSize(9.5)
             .text(`   ${prefix}${valStr}`, { indent: 12 });
        });
      }
      else if (q.questionType === 'fill_blank') {
        const userVal = userAns ? userAns.textAnswer : '';
        const correctVal = q.correctAnswerText;

        doc.fillColor('#1E293B').font('Helvetica').fontSize(9.5);
        doc.text(`   Your Response: `, { continued: true })
           .font('Helvetica-Bold')
           .fillColor(isCorrect ? '#10B981' : '#EF4444')
           .text(userVal || '(No Response)', { continued: true })
           .fillColor('#1E293B')
           .font('Helvetica')
           .text(`  |  Correct Answer: `, { continued: true })
           .font('Helvetica-Bold')
           .fillColor('#10B981')
           .text(correctVal);
      }

      doc.moveDown(0.5);

      // Explanation Box
      if (q.explanation) {
        const explanationText = `Explanation: ${q.explanation}`;
        const boxX = 60;
        const boxY = doc.y;
        const boxWidth = 485;
        
        // Estimate height
        const textHeight = doc.heightOfString(explanationText, { width: boxWidth - 20 }) + 10;
        
        doc.rect(boxX, boxY, boxWidth, textHeight).fill('#F8FAFC');
        doc.fillColor('#475569')
           .font('Helvetica-Oblique')
           .fontSize(8.5)
           .text(explanationText, boxX + 10, boxY + 5, { width: boxWidth - 20 });
        
        doc.y = boxY + textHeight + 10;
      } else {
        doc.moveDown(0.5);
      }

      // Divider line between questions
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E2E8F0').lineWidth(0.5).stroke();
      doc.moveDown(0.8);
    });
  }

  // Finalize PDF Document
  doc.end();
};
