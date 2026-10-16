import "server-only";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

const DEFAULT_FROM = "BKLN Marketplace <no-reply@bklnmarketplace.com>";

/**
 * Envía un email con Resend (API REST, sin SDK).
 * Sin RESEND_API_KEY: fuera de producción el email se escribe en la consola del servidor
 * (así se puede probar el flujo); en producción solo se registra que no se envió.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.VERCEL_ENV === "production") {
      console.error("email_not_sent: falta RESEND_API_KEY");
    } else {
      console.info(
        `\n[email] Para: ${message.to}\nAsunto: ${message.subject}\n\n${message.text}\n`,
      );
    }
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`resend_error ${response.status}: ${await response.text()}`);
  }
}
