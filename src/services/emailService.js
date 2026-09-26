import { buildOTPEmail } from './emailTemplates.js';
import nodemailer from 'nodemailer';
import { promises as dnsPromises } from 'dns';

let transporter = null;

// Resolve hostname to IPv4 manually to bypass IPv6 network issues
const resolveToIPv4 = async (hostname) => {
  try {
    if (!hostname) return hostname;
    // If it's already an IP address, return it
    if (/^[0-9.]+$/.test(hostname)) return hostname;
    const addresses = await dnsPromises.resolve4(hostname);
    if (addresses && addresses.length > 0) {
      console.log(`Resolved SMTP host ${hostname} to IPv4: ${addresses[0]}`);
      return addresses[0];
    }
  } catch (err) {
    console.warn(`DNS resolution to IPv4 failed for ${hostname}:`, err.message);
  }
  return hostname;
};

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
    const resolvedHost = await resolveToIPv4(host);
    transporter = nodemailer.createTransport({
      host: resolvedHost,
      port: port || 587,
      secure: secure,
      auth: {
        user,
        pass,
      },
      tls: {
        servername: host, // Crucial: maintains SSL validation against original domain
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
  
  // Extract display name and email address from "Name" <email> format
  let fromName = 'CodeArena';
  let fromEmail = 'noreply@codearena.com';
  const fromMatch = from.match(/^(?:"?([^"]*)"?\s)?(?:<?(.+?)>?)?$/);
  if (fromMatch) {
    fromName = fromMatch[1] || 'CodeArena';
    fromEmail = fromMatch[2] || fromEmail;
  }

  // Always log the OTP to the console for easy development/testing
  console.log('\n==================================================');
  console.log(`[EMAIL SEND] To: ${toEmail}`);
  console.log(`[EMAIL SEND] Subject: Verify your CodeArena Email`);
  console.log('==================================================\n');

  const { html: htmlContent, text: textContent } = buildOTPEmail({ name, otp, reset: false });

  // 1. Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      console.log('Sending email via Resend HTTP API...');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from,
          to: [toEmail],
          subject: 'Verify your CodeArena Email',
          html: htmlContent,
          text: textContent,
        }),
      });

      const resData = await response.json();
      if (response.ok) {
        console.log('Email sent successfully via Resend API');
        return { success: true, messageId: resData.id };
      } else {
        throw new Error(resData.message || JSON.stringify(resData));
      }
    } catch (error) {
      console.error('Resend API Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 2. Brevo API
  if (process.env.BREVO_API_KEY) {
    try {
      console.log('Sending email via Brevo HTTP API...');
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: toEmail, name }],
          subject: 'Verify your CodeArena Email',
          htmlContent: htmlContent,
          textContent: textContent,
        }),
      });

      const resData = await response.json();
      if (response.ok) {
        console.log('Email sent successfully via Brevo API');
        return { success: true, messageId: resData.messageId };
      } else {
        throw new Error(resData.message || JSON.stringify(resData));
      }
    } catch (error) {
      console.error('Brevo API Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 3. Fallback: SMTP / Nodemailer
  try {
    const activeTransporter = await getTransporter();
    if (!activeTransporter) {
      return { success: false, message: 'Transporter not available' };
    }

    const mailOptions = {
      from,
      to: toEmail,
      subject: 'Verify your CodeArena Email',
      text: textContent,
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
    console.error('SMTP Fallback Error sending email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send password reset OTP email
 * @param {string} toEmail - Recipient email
 * @param {string} otp - One-time password code
 * @param {string} name - User's name
 */
export const sendForgotPasswordOTPEmail = async (toEmail, otp, name) => {
  const from = process.env.EMAIL_FROM || '"CodeArena" <noreply@codearena.com>';
  
  // Extract display name and email address from "Name" <email> format
  let fromName = 'CodeArena';
  let fromEmail = 'noreply@codearena.com';
  const fromMatch = from.match(/^(?:"?([^"]*)"?\s)?(?:<?(.+?)>?)?$/);
  if (fromMatch) {
    fromName = fromMatch[1] || 'CodeArena';
    fromEmail = fromMatch[2] || fromEmail;
  }

  // Always log the OTP to the console for easy development/testing
  console.log('\n==================================================');
  console.log(`[EMAIL SEND] To: ${toEmail}`);
  console.log(`[EMAIL SEND] Subject: Reset your CodeArena Password`);
  console.log('==================================================\n');

  const { html: htmlContent, text: textContent } = buildOTPEmail({ name, otp, reset: true });

  // 1. Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      console.log('Sending email via Resend HTTP API...');
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: from,
          to: [toEmail],
          subject: 'Reset your CodeArena Password',
          html: htmlContent,
          text: textContent,
        }),
      });

      const resData = await response.json();
      if (response.ok) {
        console.log('Email sent successfully via Resend API');
        return { success: true, messageId: resData.id };
      } else {
        throw new Error(resData.message || JSON.stringify(resData));
      }
    } catch (error) {
      console.error('Resend API Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 2. Brevo API
  if (process.env.BREVO_API_KEY) {
    try {
      console.log('Sending email via Brevo HTTP API...');
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: toEmail, name }],
          subject: 'Reset your CodeArena Password',
          htmlContent: htmlContent,
          textContent: textContent,
        }),
      });

      const resData = await response.json();
      if (response.ok) {
        console.log('Email sent successfully via Brevo API');
        return { success: true, messageId: resData.messageId };
      } else {
        throw new Error(resData.message || JSON.stringify(resData));
      }
    } catch (error) {
      console.error('Brevo API Error:', error);
      return { success: false, error: error.message };
    }
  }

  // 3. Fallback: SMTP / Nodemailer
  try {
    const activeTransporter = await getTransporter();
    if (!activeTransporter) {
      return { success: false, message: 'Transporter not available' };
    }

    const mailOptions = {
      from,
      to: toEmail,
      subject: 'Reset your CodeArena Password',
      text: textContent,
      html: htmlContent,
    };

    const info = await activeTransporter.sendMail(mailOptions);
    
    // If using ethereal, output the preview URL
    if (activeTransporter.options.host === 'smtp.ethereal.email') {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Ethereal Reset Preview URL]: ${previewUrl}`);
      return { success: true, previewUrl };
    }

    return { success: true };
  } catch (error) {
    console.error('SMTP Fallback Error sending email:', error);
    return { success: false, error: error.message };
  }
};
