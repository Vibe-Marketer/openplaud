import { NextResponse } from "next/server";
import { db } from "@/db";
import { plaudConnections } from "@/db/schema";
import { env } from "@/lib/env";
import { syncRecordingsForUser } from "@/lib/sync/sync-recordings";

/**
 * Server-side cron sync endpoint.
 * Syncs ALL users who have a Plaud connection.
 * Secured via CRON_SECRET — call with ?secret=<CRON_SECRET> or Authorization header.
 */
export async function GET(request: Request) {
    // Verify cron secret
    const cronSecret = env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json(
            { error: "CRON_SECRET not configured" },
            { status: 500 },
        );
    }

    const url = new URL(request.url);
    const querySecret = url.searchParams.get("secret");
    const headerSecret = request.headers
        .get("authorization")
        ?.replace("Bearer ", "");

    if (querySecret !== cronSecret && headerSecret !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        // Get all users with Plaud connections
        const connections = await db
            .select({ userId: plaudConnections.userId })
            .from(plaudConnections);

        if (connections.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No users with Plaud connections",
                results: [],
            });
        }

        // Sync each user sequentially to avoid overwhelming the Plaud API
        const results: {
            userId: string;
            newRecordings: number;
            updatedRecordings: number;
            errors: string[];
        }[] = [];

        for (const { userId } of connections) {
            try {
                const result = await syncRecordingsForUser(userId);
                results.push({
                    userId,
                    newRecordings: result.newRecordings,
                    updatedRecordings: result.updatedRecordings,
                    errors: result.errors,
                });
            } catch (error) {
                results.push({
                    userId,
                    newRecordings: 0,
                    updatedRecordings: 0,
                    errors: [
                        error instanceof Error
                            ? error.message
                            : String(error),
                    ],
                });
            }
        }

        const totalNew = results.reduce((s, r) => s + r.newRecordings, 0);
        const totalUpdated = results.reduce(
            (s, r) => s + r.updatedRecordings,
            0,
        );

        return NextResponse.json({
            success: true,
            usersProcessed: connections.length,
            totalNewRecordings: totalNew,
            totalUpdatedRecordings: totalUpdated,
            results,
        });
    } catch (error) {
        console.error("Cron sync error:", error);
        return NextResponse.json(
            {
                error: "Sync failed",
                details:
                    error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
