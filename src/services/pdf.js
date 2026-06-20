import PDFDocument from 'pdfkit';

export const generateScorecardPDF = (res, attempt, user, quiz) => {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // Stream PDF response
  doc.pipe(res);

  // Border
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

  doc.text(`Quiz Title: ${quiz.title}`);
  doc.text(`Category: ${quiz.category}`);
  doc.text(`Difficulty: ${quiz.difficulty.toUpperCase()}`);

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

  doc.moveDown(7);

  // Footer & Signatures
  const footerY = 680;
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

  // Finalize
  doc.end();
};
