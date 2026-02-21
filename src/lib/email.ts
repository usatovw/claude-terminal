import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendRegistrationEmail(
  user: { first_name: string; last_name: string; login: string },
  approveToken: string,
  rejectToken: string
): Promise<void> {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const approveUrl = `${appUrl}/api/auth/approve?token=${approveToken}&action=approve`;
  const rejectUrl = `${appUrl}/api/auth/approve?token=${rejectToken}&action=reject`;

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #0a0a0b; color: #e4e4e7; border-radius: 12px;">
      <h2 style="margin: 0 0 24px; font-size: 20px; color: #fff;">Новая заявка на регистрацию</h2>
      <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-size: 14px;"><strong style="color: #a1a1aa;">Имя:</strong> <span style="color: #fff;">${fullName}</span></p>
        <p style="margin: 0; font-size: 14px;"><strong style="color: #a1a1aa;">Логин:</strong> <span style="color: #fff;">${user.login}</span></p>
      </div>
      <div style="display: flex; gap: 12px;">
        <a href="${approveUrl}" style="display: inline-block; padding: 10px 24px; background: #22c55e; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Одобрить</a>
        <a href="${rejectUrl}" style="display: inline-block; padding: 10px 24px; background: #ef4444; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Отклонить</a>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Claude Terminal" <${process.env.SMTP_USER}>`,
    to: process.env.ADMIN_EMAIL,
    subject: `Заявка на регистрацию: ${fullName}`,
    html,
  });
}
