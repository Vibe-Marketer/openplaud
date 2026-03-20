import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
    DEFAULT_SERVER_KEY,
    PLAUD_SERVERS,
    type PlaudServerKey,
} from "@/lib/plaud/servers";

interface PlaudLoginResponse {
    status: number;
    msg: string;
    access_token?: string;
    token_type?: string;
}

/**
 * Log into Plaud with email/password and return the bearer token.
 * The token is NOT stored here — the client should call /api/plaud/connect
 * with the returned token to complete the connection.
 */
export async function POST(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        const { email, password, server: serverKey } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 },
            );
        }

        const resolvedKey = (serverKey ?? DEFAULT_SERVER_KEY) as string;
        if (!Object.hasOwn(PLAUD_SERVERS, resolvedKey)) {
            return NextResponse.json(
                { error: `Unknown server: ${resolvedKey}` },
                { status: 400 },
            );
        }

        const apiBase = PLAUD_SERVERS[resolvedKey as PlaudServerKey].apiBase;

        // Call Plaud's login endpoint
        const response = await fetch(`${apiBase}/auth/access-token`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                username: email,
                password: password,
            }),
        });

        const data = (await response.json()) as PlaudLoginResponse;

        if (!response.ok || data.status !== 0 || !data.access_token) {
            const errorMsg =
                data.msg || "Invalid email or password";
            return NextResponse.json(
                { error: errorMsg },
                { status: 401 },
            );
        }

        // Return the token — client will pass it to /api/plaud/connect
        return NextResponse.json({
            success: true,
            bearerToken: data.access_token,
        });
    } catch (error) {
        console.error("Error logging into Plaud:", error);
        return NextResponse.json(
            { error: "Failed to log into Plaud" },
            { status: 500 },
        );
    }
}
