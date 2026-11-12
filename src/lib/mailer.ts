import { brand } from "@/config/brand";

interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Transactional email. Uses Resend when RESEND_API_KEY is configured; otherwise the
 * message is printed to the server log so links still work during development.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || `${brand.name} <onboarding@resend.dev>`;
  if (!key) {
    console.info(`[mail] (no RESEND_API_KEY – not sent)\n  to: ${mail.to}\n  subject: ${mail.subject}\n  ${mail.text.replace(/\n/g, "\n  ")}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error(`[mail] Resend returned HTTP ${res.status}`);
  } catch (err) {
    console.error("[mail] failed to send", err);
  }
}

export const mailConfigured = () => Boolean(process.env.RESEND_API_KEY);
