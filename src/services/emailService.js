import nodemailer from 'nodemailer';

let transporter = null;

// Initialize the email transporter
const getTransporter = async () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT, 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';

  if (host && user && pass) {
    console.log('Using configured SMTP transporter for emails.');
    transporter = nodemailer.createTransport({
      host,
      port: port || 587,
      secure: secure,
      auth: {
        user,
        pass,
      },
    });
  } else {
    console.log('No SMTP config found. Generating Ethereal test email account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`Ethereal test account created. User: ${testAccount.user}`);
    } catch (err) {
      console.error('Failed to create Ethereal test account. Emails will only be logged to console.', err.message);
    }
  }

  return transporter;
};

/**
 * Send verification OTP email
 * @param {string} toEmail - Recipient email
 * @param {string} otp - One-time password code
 * @param {string} name - User's name
 */
export const sendOTPEmail = async (toEmail, otp, name) => {
  const from = process.env.EMAIL_FROM || '"CodeArena" <noreply@codearena.com>';
  
  // Always log the OTP to the console for easy development/testing
  console.log('\n==================================================');
  console.log(`[EMAIL SEND] To: ${toEmail}`);
  console.log(`[EMAIL SEND] Subject: Verify your CodeArena Email`);
  console.log(`[EMAIL SEND] OTP Code: ${otp}`);
  console.log('==================================================\n');

  try {
    const activeTransporter = await getTransporter();
    if (!activeTransporter) {
      return { success: false, message: 'Transporter not available' };
    }

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9;">
          <h1 style="color: #4f46e5; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">CodeArena</h1>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Where Champions Code</p>
        </div>
        
        <div style="margin-bottom: 24px;">
          <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-top: 0;">Verify Your Email Address</h2>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">Hello ${name},</p>
          <p style="color: #475569; font-size: 16px; line-height: 1.6;">Thank you for registering at CodeArena! Please use the following One-Time Password (OTP) to verify your account and complete your registration:</p>
        </div>

        <div style="text-align: center; margin: 32px 0; padding: 18px; background-color: #f5f3ff; border: 1px dashed #c084fc; border-radius: 12px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #7c3aed; font-family: monospace;">${otp}</span>
          <p style="color: #701a75; font-size: 12px; margin: 8px 0 0 0; font-weight: 600;">This code is valid for 10 minutes.</p>
        </div>

        <div style="margin-bottom: 24px;">
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">If you did not initiate this request, you can safely ignore this email.</p>
        </div>

        <div style="padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px;">
          <p style="margin: 0;">© ${new Date().getFullYear()} CodeArena. All rights reserved.</p>
          <p style="margin: 4px 0 0 0;">This is an automated message, please do not reply.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from,
      to: toEmail,
      subject: 'Verify your CodeArena Email',
      text: `Hello ${name},\n\nYour OTP to verify your email is: ${otp}. This code is valid for 10 minutes.\n\nThank you,\nCodeArena Team`,
      html: htmlContent,
    };

    const info = await activeTransporter.sendMail(mailOptions);
    
    // If using ethereal, output the preview URL
    if (activeTransporter.options.host === 'smtp.ethereal.email') {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Ethereal Preview URL]: ${previewUrl}`);
      return { success: true, previewUrl };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};
