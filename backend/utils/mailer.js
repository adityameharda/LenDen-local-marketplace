const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const hasMailConfig = () => Boolean(process.env.BREVO_API_KEY);

const parseSender = () => {
  const mailFrom = String(process.env.MAIL_FROM || "").trim();
  const senderEmail = String(process.env.BREVO_SENDER_EMAIL || "").trim();
  const senderName =
    String(process.env.BREVO_SENDER_NAME || "").trim() || "LeniDeni";

  const fromValue = mailFrom || senderEmail;
  if (!fromValue) {
    return null;
  }

  const match = fromValue.match(/^(.*)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "") || senderName;
    const email = match[2].trim();
    if (!email) {
      return null;
    }
    return { name, email };
  }

  return { name: senderName, email: fromValue };
};

const sendEmail = async ({ to, subject, html, text }) => {
  const apiKey = String(process.env.BREVO_API_KEY || "").trim();
  const sender = parseSender();
  const recipient = String(to || "").trim();

  if (!apiKey || !sender || !recipient) {
    return {
      sent: false,
      reason: "Missing Brevo API key, sender config, or recipient",
    };
  }

  const timeoutMs = Number(process.env.BREVO_TIMEOUT_MS || 30000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: recipient }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(`Brevo API ${response.status}: ${responseText}`);
    }

    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      payload = null;
    }

    return {
      sent: true,
      messageId: payload?.messageId || null,
      provider: "brevo",
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

module.exports = {
  sendEmail,
  hasMailConfig,
  hasSmtpConfig: hasMailConfig,
};
