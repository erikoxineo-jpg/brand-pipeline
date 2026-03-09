import { prisma } from "../lib/prisma";
import { config } from "../config";

/**
 * Send a WhatsApp message via the workspace's configured provider
 * (Evolution API or Meta Cloud API).
 */
export async function sendWhatsAppMessage(
  workspaceId: string,
  phone: string,
  text: string,
  dispatchId?: string,
  senderType?: string
): Promise<{ messageId: string | null; error?: string }> {
  try {
    // 1. Fetch workspace WhatsApp config
    const waConfig = await prisma.whatsappConfig.findUnique({
      where: { workspace_id: workspaceId },
    });

    if (!waConfig) {
      return { messageId: null, error: "WhatsApp não configurado para este workspace" };
    }

    const provider = waConfig.provider || "evolution";
    const cleanPhone = phone.replace(/\D/g, "");
    let messageId: string | null = null;

    // 2. Evolution API
    if (provider === "evolution") {
      const instanceName = waConfig.evolution_instance_name;
      if (!instanceName) {
        return { messageId: null, error: "Evolution API não configurada (instance_name ausente)" };
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.evolutionApiKey) {
        headers["apikey"] = config.evolutionApiKey;
      }

      const evoResponse = await fetch(
        `${config.evolutionApiUrl}/message/sendText/${instanceName}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ number: cleanPhone, text }),
        }
      );

      const evoText = await evoResponse.text();
      let evoResult: any;
      try {
        evoResult = JSON.parse(evoText);
      } catch {
        evoResult = null;
      }

      if (evoResponse.ok && evoResult?.key?.id) {
        messageId = evoResult.key.id;
      } else {
        const errMsg =
          evoResult?.message ||
          evoResult?.error ||
          `Evolution API error (${evoResponse.status}): ${evoText.slice(0, 200)}`;
        return { messageId: null, error: errMsg };
      }
    }

    // 3. Meta Cloud API
    else if (provider === "meta") {
      const phoneNumberId = waConfig.phone_number_id;
      const accessToken = waConfig.access_token;

      if (!phoneNumberId || !accessToken) {
        return { messageId: null, error: "Meta WhatsApp não configurado (phone_number_id ou access_token ausente)" };
      }

      const waResponse = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: cleanPhone,
            type: "text",
            text: { body: text },
          }),
        }
      );

      const waResult: any = await waResponse.json();

      if (waResponse.ok && waResult.messages?.[0]?.id) {
        messageId = waResult.messages[0].id;
      } else {
        const errMsg = waResult.error?.message || "WhatsApp API error";
        return { messageId: null, error: errMsg };
      }
    } else {
      return { messageId: null, error: `Provider desconhecido: ${provider}` };
    }

    // 4. Save outbound message record
    if (messageId) {
      // Find lead by phone to get lead_id
      const lead = await prisma.lead.findFirst({
        where: {
          workspace_id: workspaceId,
          OR: [
            { phone: cleanPhone },
            { phone: `+${cleanPhone}` },
            { phone },
          ],
        },
        select: { id: true },
      });

      await prisma.message.create({
        data: {
          workspace_id: workspaceId,
          lead_id: lead?.id ?? "",
          dispatch_id: dispatchId || null,
          direction: "outbound",
          body: text,
          whatsapp_message_id: messageId,
          status: "sent",
          sender_type: senderType || null,
        },
      });
    }

    return { messageId };
  } catch (err: any) {
    console.error("sendWhatsAppMessage error:", err.message);
    return { messageId: null, error: err.message };
  }
}
