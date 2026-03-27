import { logger } from "@/lib/server-logger";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFromEmail = process.env.RESEND_FROM_EMAIL;

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function hasEmailConfig() {
  return Boolean(resendApiKey && resendFromEmail);
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
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
  const subject = "Abonnement PMU AI active";
  const html = `
    <div style="background:#f4f7f6;padding:32px 16px;font-family:Arial,sans-serif;color:#171b1f;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid rgba(15,23,42,0.06);box-shadow:0 18px 36px rgba(15,23,42,0.08);">
        <div style="background:linear-gradient(135deg,#0b8f4d,#066737);padding:28px 32px;color:#ffffff;">
          <div style="font-size:12px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;">PMU AI</div>
          <div style="margin-top:10px;font-size:30px;font-weight:900;line-height:1.1;">Ton abonnement premium est actif.</div>
          <div style="margin-top:10px;font-size:15px;line-height:1.6;opacity:0.9;">Le paiement a bien ete confirme et ton acces premium est maintenant ouvert.</div>
        </div>
        <div style="padding:28px 32px;">
          <div style="font-size:16px;font-weight:800;margin-bottom:12px;">Ce que tu peux faire maintenant</div>
          <ul style="padding-left:18px;margin:0 0 20px;line-height:1.8;color:#51606f;">
            <li>consulter les pronostics premium complets</li>
            <li>voir les value bets filtres</li>
            <li>utiliser les tickets et mises optimises</li>
          </ul>
          <a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/mes-paris" style="display:inline-block;padding:14px 18px;border-radius:999px;background:#171b1f;color:#ffffff;text-decoration:none;font-weight:800;">
            Ouvrir mon espace premium
          </a>
          <div style="margin-top:22px;font-size:13px;line-height:1.7;color:#6b7280;">
            Si tu n&apos;es pas a l&apos;origine de cet achat, reponds a cet email ou contacte le support.
          </div>
        </div>
      </div>
    </div>
  `;

  const text = [
    "Ton abonnement PMU AI est actif.",
    "",
    "Le paiement a bien ete confirme et ton acces premium est maintenant ouvert.",
    "",
    `Ouvre ton espace premium: ${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")}/mes-paris`,
  ].join("\n");

  return sendEmail({
    to,
    subject,
    html,
    text,
  });
}
