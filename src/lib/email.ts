import { logger } from "@/lib/server-logger";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;
const supportEmail = process.env.SUPPORT_EMAIL;

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export function hasEmailConfig() {
  return Boolean(resendApiKey && resendFromEmail);
}

export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailOptions) {
  if (!hasEmailConfig()) {
    logger.warn("Email skipped: Resend config missing", {
      to,
      subject,
      missingApiKey: !resendApiKey,
      missingFromEmail: !resendFromEmail,
    });
    return { sent: false, skipped: true as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [to],
      subject,
      html,
      text,
      reply_to: replyTo,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend failed (${response.status}): ${body}`);
  }

  return { sent: true as const, skipped: false as const };
}

export async function sendSubscriptionActivatedEmail({
  to,
}: {
  to: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const premiumUrl = `${siteUrl}/mes-paris`;
  const subject = "Confirmation de ton abonnement PMU Gagnant";
  const html = `
    <div style="background:#f5f7f8;padding:32px 16px;font-family:Arial,sans-serif;color:#171b1f;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e6ebef;">
        <div style="padding:24px 28px;border-bottom:1px solid #eef2f5;background:#ffffff;">
          <div style="font-size:12px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;color:#0b8f4d;">PMU Gagnant</div>
          <div style="margin-top:10px;font-size:28px;font-weight:800;line-height:1.2;color:#171b1f;">Ton abonnement premium est actif</div>
          <div style="margin-top:10px;font-size:15px;line-height:1.6;color:#4b5563;">
            Le paiement a bien été confirmé. Ton compte premium est maintenant actif.
          </div>
        </div>
        <div style="padding:24px 28px;">
          <div style="font-size:15px;line-height:1.7;color:#4b5563;">
            Tu peux dès maintenant accéder à tes pronostics premium, tes opportunités value filtrées et tes tickets optimisés depuis ton espace membre.
          </div>
          <div style="margin-top:20px;">
            <a href="${premiumUrl}" style="display:inline-block;padding:13px 18px;border-radius:999px;background:#0b8f4d;color:#ffffff;text-decoration:none;font-weight:700;">
              Ouvrir mon espace premium
            </a>
          </div>
          <div style="margin-top:22px;padding-top:18px;border-top:1px solid #eef2f5;font-size:13px;line-height:1.7;color:#6b7280;">
            Email de confirmation automatique suite à ton paiement. Si tu n'es pas à l'origine de cet achat, contacte le support.
          </div>
        </div>
      </div>
    </div>
  `;

  const text = [
    "Confirmation de ton abonnement PMU Gagnant",
    "",
    "Le paiement a bien été confirmé.",
    "Ton compte premium est maintenant actif.",
    "",
    `Ouvre ton espace premium : ${premiumUrl}`,
  ].join("\n");

  return sendEmail({
    to,
    subject,
    html,
    text,
    replyTo: supportEmail ?? resendFromEmail,
  });
}
