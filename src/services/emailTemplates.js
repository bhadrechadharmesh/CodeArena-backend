const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

export function buildOTPEmail({ name, otp, reset = false }) {
  const title = reset ? 'Reset your password.' : 'Confirm your email.';
  const instruction = reset ? 'Enter this code on the password reset screen to choose a new password.' : 'Enter this code on the verification screen to finish setting up your CodeArena account.';
  const notice = reset ? 'If you did not request a reset, ignore this email. Your password will remain unchanged.' : 'If you did not create a CodeArena account, you can ignore this email.';
  const greeting = name || 'there';
  return {
    text: `CodeArena\n\n${title}\n\nHello ${greeting},\n${instruction}\n\nYour code: ${otp}\nValid for 10 minutes. Do not share this code.\n\n${notice}\n\nThis is an automated message; please do not reply.`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;padding:0;-webkit-text-size-adjust:100%}table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}@media(max-width:480px){.email-pad{padding-left:24px!important;padding-right:24px!important}.email-title{font-size:30px!important}}</style></head>
<body style="margin:0;background:#f7f6f2;color:#272722;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${reset ? 'Your password reset code is ready.' : 'Complete your CodeArena registration.'} Valid for 10 minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f2"><tr><td align="center" style="padding:32px 12px">
<!--[if mso]><table role="presentation" width="560"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #deded5;border-top:4px solid #b4492d">
<tr><td class="email-pad" style="padding:28px 40px;border-bottom:1px solid #deded5"><span style="font-size:20px;font-weight:bold;letter-spacing:-1px">codearena<span style="color:#b4492d">.</span></span></td></tr>
<tr><td class="email-pad" style="padding:36px 40px 24px"><p style="font-family:Courier New,monospace;font-size:10px;letter-spacing:1.5px;color:#72736a;margin:0 0 18px">ACCOUNT / ${reset ? 'PASSWORD RESET' : 'EMAIL VERIFICATION'}</p><h1 class="email-title" style="font-size:36px;line-height:1.15;letter-spacing:-1px;font-weight:normal;margin:0 0 26px">${title}</h1><p style="font-size:14px;line-height:1.8;margin:0 0 12px">Hello ${escapeHTML(greeting)},</p><p style="font-size:14px;line-height:1.8;color:#72736a;margin:0">${instruction}</p></td></tr>
<tr><td class="email-pad" style="padding:0 40px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f6f2;border-left:3px solid #b4492d"><tr><td style="padding:22px 24px"><p style="font-size:10px;letter-spacing:1px;color:#72736a;margin:0 0 12px">YOUR ONE-TIME CODE</p><p style="font-family:Courier New,monospace;font-size:34px;letter-spacing:5px;font-weight:bold;color:#272722;margin:0">${escapeHTML(otp)}</p><p style="font-size:12px;color:#72736a;margin:14px 0 0">Valid for 10 minutes.</p></td></tr></table></td></tr>
<tr><td class="email-pad" style="padding:24px 40px 36px"><p style="font-size:12px;line-height:1.8;margin:0 0 12px">Keep this code private. CodeArena will never ask you to share it.</p><p style="font-size:12px;color:#72736a;line-height:1.8;margin:0">${notice}</p></td></tr>
<tr><td class="email-pad" style="padding:20px 40px;border-top:1px solid #deded5;font-size:11px;line-height:1.8;color:#72736a">CodeArena &copy; ${new Date().getFullYear()}<br>This is an automated message; please do not reply.</td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}
