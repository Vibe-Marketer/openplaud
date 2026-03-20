import type {
    PlaudApiError,
    PlaudDetailResponse,
    PlaudDeviceListResponse,
    PlaudOutlineItem,
    PlaudRecordingsResponse,
    PlaudTempUrlResponse,
    PlaudTranscriptSegment,
} from "@/types/plaud";
import { DEFAULT_SERVER_KEY, PLAUD_SERVERS } from "./servers";

export interface PlaudUpdateFilenameResponse {
    status: number;
    msg: string;
    data_file?: unknown;
}

export const DEFAULT_PLAUD_API_BASE = PLAUD_SERVERS[DEFAULT_SERVER_KEY].apiBase;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Plaud API Client
 * Handles all communication with Plaud API
 */
export class PlaudClient {
    private bearerToken: string;
    private apiBase: string;

    constructor(bearerToken: string, apiBase: string = DEFAULT_PLAUD_API_BASE) {
        this.bearerToken = bearerToken;
        this.apiBase = apiBase;
    }

    /**
     * Make authenticated request to Plaud API with retry logic
     */
    private async request<T>(
        endpoint: string,
        options?: RequestInit,
        retryCount = 0,
    ): Promise<T> {
        const url = `${this.apiBase}${endpoint}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options?.headers,
                    Authorization: `Bearer ${this.bearerToken}`,
                    "Content-Type": "application/json",
                },
            });

            if (response.status === 429 && retryCount < MAX_RETRIES) {
                const retryAfter = response.headers.get("Retry-After");
                const delay = retryAfter
                    ? Number.parseInt(retryAfter, 10) * 1000
                    : INITIAL_RETRY_DELAY * 2 ** retryCount; // Exponential backoff
                await sleep(delay);
                return this.request<T>(endpoint, options, retryCount + 1);
            }

            if (!response.ok) {
                const error = (await response.json()) as PlaudApiError;
                const errorMessage = `Plaud API error (${response.status}): ${error.msg || response.statusText}`;

                if (
                    response.status >= 500 &&
                    response.status < 600 &&
                    retryCount < MAX_RETRIES
                ) {
                    const delay = INITIAL_RETRY_DELAY * 2 ** retryCount;
                    await sleep(delay);
                    return this.request<T>(endpoint, options, retryCount + 1);
                }

                throw new Error(errorMessage);
            }

            return (await response.json()) as T;
        } catch (error) {
            if (
                error instanceof TypeError &&
                error.message.includes("fetch") &&
                retryCount < MAX_RETRIES
            ) {
                const delay = INITIAL_RETRY_DELAY * 2 ** retryCount;
                await sleep(delay);
                return this.request<T>(endpoint, options, retryCount + 1);
            }

            if (error instanceof Error) {
                throw error;
            }
            throw new Error(
                `Failed to make request to Plaud API: ${String(error)}`,
            );
        }
    }

    /**
     * List all devices associated with the account
     */
    async listDevices(): Promise<PlaudDeviceListResponse> {
        return this.request<PlaudDeviceListResponse>("/device/list");
    }

    /**
     * Get all recordings
     * @param skip - Number of recordings to skip
     * @param limit - Maximum number of recordings to return
     * @param isTrash - Whether to get trashed recordings (0 = active, 1 = trash)
     * @param sortBy - Field to sort by (default: edit_time)
     * @param isDesc - Sort in descending order (default: true)
     */
    async getRecordings(
        skip: number = 0,
        limit: number = 99999,
        isTrash: number = 0,
        sortBy: string = "edit_time",
        isDesc: boolean = true,
    ): Promise<PlaudRecordingsResponse> {
        const params = new URLSearchParams({
            skip: skip.toString(),
            limit: limit.toString(),
            is_trash: isTrash.toString(),
            sort_by: sortBy,
            is_desc: isDesc.toString(),
        });

        return this.request<PlaudRecordingsResponse>(
            `/file/simple/web?${params.toString()}`,
        );
    }

    /**
     * Get temporary URL for downloading audio file
     * @param fileId - The recording file ID
     * @param isOpus - Whether to get OPUS format URL (default: true)
     */
    async getTempUrl(
        fileId: string,
        isOpus: boolean = true,
    ): Promise<PlaudTempUrlResponse> {
        const params = new URLSearchParams({
            is_opus: isOpus ? "1" : "0",
        });

        return this.request<PlaudTempUrlResponse>(
            `/file/temp-url/${fileId}?${params.toString()}`,
        );
    }

    /**
     * Download audio file as buffer
     * @param fileId - The recording file ID
     * @param preferOpus - Whether to prefer OPUS format (smaller size)
     */
    async downloadRecording(
        fileId: string,
        preferOpus: boolean = true,
    ): Promise<Buffer> {
        try {
            const tempUrlResponse = await this.getTempUrl(fileId, preferOpus);
            const downloadUrl =
                preferOpus && tempUrlResponse.temp_url_opus
                    ? tempUrlResponse.temp_url_opus
                    : tempUrlResponse.temp_url;

            const response = await fetch(downloadUrl);
            if (!response.ok) {
                throw new Error(
                    `Failed to download file: ${response.statusText}`,
                );
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            throw new Error(
                `Failed to download recording: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Test connection to Plaud API
     * Returns true if bearer token is valid
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.listDevices();
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Update filename for a recording
     * @param fileId - The recording file ID
     * @param filename - New filename to set
     */
    async updateFilename(
        fileId: string,
        filename: string,
    ): Promise<PlaudUpdateFilenameResponse> {
        return this.request<PlaudUpdateFilenameResponse>(`/file/${fileId}`, {
            method: "PATCH",
            body: JSON.stringify({ filename }),
        });
    }

    /**
     * Get detailed recording info including content links
     */
    async getRecordingDetail(fileId: string): Promise<PlaudDetailResponse> {
        return this.request<PlaudDetailResponse>(`/file/detail/${fileId}`);
    }

    /**
     * Fetch and decompress gzipped content from a signed S3 URL
     */
    async fetchGzippedContent(url: string): Promise<string> {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(
                `Failed to fetch content: ${response.statusText}`,
            );
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        try {
            const { gunzipSync } = await import("node:zlib");
            return gunzipSync(buffer).toString("utf-8");
        } catch {
            return buffer.toString("utf-8");
        }
    }

    /**
     * Get transcript, summary, and outline for a recording
     * Returns null for any content type that isn't available
     */
    async getRecordingContent(fileId: string): Promise<{
        transcript: PlaudTranscriptSegment[] | null;
        summary: string | null;
        outline: PlaudOutlineItem[] | null;
    }> {
        const detail = await this.getRecordingDetail(fileId);
        const result: {
            transcript: PlaudTranscriptSegment[] | null;
            summary: string | null;
            outline: PlaudOutlineItem[] | null;
        } = { transcript: null, summary: null, outline: null };

        for (const item of detail.data.content_list) {
            if (item.task_status !== 1 || !item.data_link) continue;

            try {
                const content = await this.fetchGzippedContent(item.data_link);

                switch (item.data_type) {
                    case "transaction":
                        result.transcript = JSON.parse(
                            content,
                        ) as PlaudTranscriptSegment[];
                        break;
                    case "auto_sum_note":
                        result.summary = content;
                        break;
                    case "outline":
                        result.outline = JSON.parse(
                            content,
                        ) as PlaudOutlineItem[];
                        break;
                }
            } catch (error) {
                console.error(
                    `Failed to fetch ${item.data_type} for ${fileId}:`,
                    error,
                );
            }
        }

        return result;
    }
}

/**
 * Create Plaud client from encrypted bearer token
 */
export async function createPlaudClient(
    encryptedToken: string,
    apiBase: string = DEFAULT_PLAUD_API_BASE,
): Promise<PlaudClient> {
    const { decrypt } = await import("../encryption");
    const bearerToken = decrypt(encryptedToken);
    return new PlaudClient(bearerToken, apiBase);
}

export * from "./types";
