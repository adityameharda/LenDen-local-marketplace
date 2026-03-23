const nodemailer = require("nodemailer");

const toBoolean = (value) => String(value || "").toLowerCase() === "true";

const hasSmtpConfig = () =>
  Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS,
  );

let transporter = null;

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!hasSmtpConfig()) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? toBoolean(process.env.SMTP_SECURE)
      : port === 465;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const getFromAddress = () =>
  process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || "";

const sendEmail = async ({ to, subject, html, text }) => {
  const client = getTransporter();
  const from = getFromAddress();

  if (!client || !to || !from) {
    return { sent: false, reason: "Missing SMTP config, recipient, or sender" };
  }

  await client.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });

  return { sent: true };
};

module.exports = {
  sendEmail,
  hasSmtpConfig,
};
