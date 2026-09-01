// Meta WhatsApp Cloud API — needs WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN in env.
// https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages

export async function sendWhatsAppMessage(toPhoneE164: string, text: string) {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    console.warn("[whatsapp] WHATSAPP_PHONE_NUMBER_ID/ACCESS_TOKEN not configured — skipping message to", toPhoneE164);
    return { sent: false, reason: "not_configured" as const };
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toPhoneE164,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[whatsapp] send failed:", res.status, body);
    return { sent: false, reason: "api_error" as const };
  }
  return { sent: true };
}
