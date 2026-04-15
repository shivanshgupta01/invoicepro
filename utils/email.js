const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host:   process.env.EMAIL_HOST,
  port:   process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendPasswordResetEmail(toEmail, resetLink, firstName) {
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      toEmail,
    subject: 'Reset your InvoicePro password',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#111520;border-radius:12px;overflow:hidden;">
        <div style="background:#0b0d14;padding:28px 32px;text-align:center;">
          <span style="font-size:20px;font-weight:700;color:#fff;">Invoice<span style="color:#4f6ef7;">Pro</span></span>
        </div>
        <div style="padding:32px;">
          <p style="font-size:16px;font-weight:600;color:#e8ecff;margin-bottom:12px;">Hi ${firstName} 👋</p>
          <p style="font-size:14px;color:#8a92b2;line-height:1.7;margin-bottom:24px;">
            You requested a password reset. Click the button below — this link expires in <strong style="color:#e8ecff;">1 hour</strong>.
          </p>
          <a href="${resetLink}"
             style="display:inline-block;background:#4f6ef7;color:#fff;text-decoration:none;
                    padding:13px 28px;border-radius:8px;font-size:14px;font-weight:500;">
            Reset My Password
          </a>
          <p style="font-size:12px;color:#545e7e;margin-top:24px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendPasswordResetEmail };
