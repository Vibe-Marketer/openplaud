import { createHmac } from "node:crypto";

export interface WebhookPayload {
    event: "recordings.synced";
    timestamp: string;
    data: {
        newRecordings: {
            id: string;
            filename: string;
            duration: number;
            startTime: string;
            plaudFileId: string;
        }[];
        totalNew: number;
        totalUpdated: number;
    };
}

/**
 * Fire a webhook to a user's configured URL.
 * If a webhookSecret is provided, the payload is HMAC-signed via X-Webhook-Signature header.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function fireWebhook(
    webhookUrl: string,
    payload: WebhookPayload,
    webhookSecret?: string | null,
): Promise<void> {
    try {
        const body = JSON.stringify(payload);
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "User-Agent": "OpenPlaud-Webhook/1.0",
        };

        if (webhookSecret) {
            const signature = createHmac("sha256", webhookSecret)
                .update(body)
                .digest("hex");
            headers["X-Webhook-Signature"] = `sha256=${signature}`;
        }

        const response = await fetch(webhookUrl, {
            method: "POST",
            headers,
            body,
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!response.ok) {
            console.error(
                `Webhook delivery failed (${response.status}): ${webhookUrl}`,
            );
        }
    } catch (error) {
        console.error(`Webhook delivery error for ${webhookUrl}:`, error);
    }
}
