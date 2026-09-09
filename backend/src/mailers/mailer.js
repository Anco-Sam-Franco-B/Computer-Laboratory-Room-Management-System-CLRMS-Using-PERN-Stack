const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.MAIL_PORT, 10) || 2525,
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
  },
});

const FROM = process.env.MAIL_FROM || 'CLRMS <no-reply@clrms.local>';

async function sendMail({ to, subject, html, text }) {
  const mailOptions = {
    from: FROM,
    to,
    subject,
    html,
    text: text || 'Please view this email in an HTML-capable client.',
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`[mail] sent -> ${to} :: ${subject}`);
    return info;
  } catch (err) {
    // Nodemailer failures (e.g. no SMTP configured) should not crash flows.
    logger.error(`[mail] failed -> ${to} :: ${subject} :: ${err.message}`);
    return null;
  }
}

const layout = (title, contentHtml) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
  <div style="background:#1e293b;color:#fff;padding:20px 24px;font-size:20px;font-weight:700">CLRMS</div>
  <div style="padding:24px">
    <h2 style="margin:0 0 8px;color:#0f172a">${title}</h2>
    <div style="color:#334155;line-height:1.6;font-size:15px">${contentHtml}</div>
  </div>
  <div style="background:#f8fafc;color:#64748b;font-size:12px;padding:12px 24px;text-align:center">
    Computer Laboratory Room Management System
  </div>
</div>`;

const btn = (href, label) =>
  `<div style="margin:24px 0"><a href="${href}" style="background:#4f46e5;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">${label}</a></div>
   <p style="color:#64748b;font-size:13px">Or open: <a href="${href}" style="color:#4f46e5">${href}</a></p>`;

module.exports = { sendMail, layout, btn };