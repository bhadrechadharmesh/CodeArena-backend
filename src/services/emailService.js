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
  console.log(`[EMAIL SEND] OTP Code: ${otp}`);
  console.log('==================================================\n');

  const htmlContent = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your CodeArena Email</title>
  <style type="text/css">
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #f8fafc;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 20px 0;">
    <tr>
      <td align="center" valign="top">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; text-align: left;">
          <tr>
            <td style="padding: 32px 32px 24px 32px; border-bottom: 2px solid #f1f5f9; text-align: center;">
              <h1 style="color: #4f46e5; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">CodeArena</h1>
              <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Where Champions Code</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 20px 32px;">
              <h2 style="color: #1e293b; font-size: 20px; font-weight: 700; margin-top: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Verify Your Email Address</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 16px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Hello ${name},</p>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 12px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">Thank you for registering at CodeArena! Please use the following One-Time Password (OTP) to verify your account and complete your registration:</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f3ff; border: 1px dashed #c084fc; border-radius: 12px; text-align: center;">
                <tr>
                  <td style="padding: 24px;">
                    <span style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #7c3aed; font-family: monospace; display: inline-block;">${otp}</span>
                    <p style="color: #701a75; font-size: 12px; margin: 8px 0 0 0; font-weight: 600; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">This code is valid for 10 minutes.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 32px 32px;">
              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">If you did not initiate this request, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 12px; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
              <p style="margin: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">&copy; ${new Date().getFullYear()} CodeArena. All rights reserved.</p>
              <p style="margin: 4px 0 0 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">This is an automated message, please do not reply.</p>
            </td>
          </tr>
        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textContent = `Hello ${name},\n\nYour OTP to verify your email is: ${otp}. This code is valid for 10 minutes.\n\nThank you,\nCodeArena Team`;

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
