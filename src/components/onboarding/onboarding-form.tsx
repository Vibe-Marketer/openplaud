"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { LEDIndicator } from "@/components/led-indicator";
import { MetalButton } from "@/components/metal-button";
import { Panel } from "@/components/panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DEFAULT_SERVER_KEY,
    PLAUD_SERVERS,
    type PlaudServerKey,
} from "@/lib/plaud/servers";

type Step = "plaud" | "complete";
type AuthMode = "login" | "token";

export function OnboardingForm() {
    const [step, setStep] = useState<Step>("plaud");
    const [authMode, setAuthMode] = useState<AuthMode>("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [bearerToken, setBearerToken] = useState("");
    const [server, setServer] = useState<PlaudServerKey>(DEFAULT_SERVER_KEY);
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handlePlaudLogin = async () => {
        if (!email.trim() || !password.trim()) {
            toast.error("Please enter your Plaud email and password");
            return;
        }

        setIsLoading(true);
        try {
            // Step 1: Log into Plaud to get bearer token
            const loginResponse = await fetch("/api/plaud/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, server }),
            });

            const loginData = await loginResponse.json();

            if (!loginResponse.ok) {
                toast.error(loginData.error || "Failed to log into Plaud");
                return;
            }

            // Step 2: Connect with the token
            const connectResponse = await fetch("/api/plaud/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    bearerToken: loginData.bearerToken,
                    server,
                }),
            });

            if (!connectResponse.ok) {
                toast.error("Failed to connect Plaud account");
                return;
            }

            toast.success("Plaud account connected!");
            setStep("complete");
        } catch {
            toast.error("Failed to connect to Plaud");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTokenConnect = async () => {
        if (!bearerToken.trim()) {
            toast.error("Please enter your bearer token");
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch("/api/plaud/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bearerToken, server }),
            });

            if (!response.ok) throw new Error("Failed to connect");

            toast.success("Plaud device connected");
            setStep("complete");
        } catch {
            toast.error("Failed to connect to Plaud");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Panel className="w-full max-w-2xl space-y-6">
            {/* Progress indicator */}
            <div className="flex items-center justify-center gap-8">
                <div className="flex items-center gap-2">
                    <LEDIndicator active={step === "plaud"} status="active" />
                    <span className="text-sm">Plaud Setup</span>
                </div>
                <div className="flex items-center gap-2">
                    <LEDIndicator
                        active={step === "complete"}
                        status="active"
                    />
                    <span className="text-sm">Complete</span>
                </div>
            </div>

            {step === "plaud" && (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-xl font-bold">
                            Connect Your Plaud Account
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Sign in with your Plaud account to sync your
                            recordings
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="apiBase">Region</Label>
                        <Select
                            value={server}
                            onValueChange={(v) =>
                                setServer(v as PlaudServerKey)
                            }
                        >
                            <SelectTrigger id="apiBase" disabled={isLoading}>
                                <SelectValue placeholder="Select your region" />
                            </SelectTrigger>
                            <SelectContent className="z-[200]">
                                {(
                                    Object.entries(PLAUD_SERVERS) as [
                                        PlaudServerKey,
                                        (typeof PLAUD_SERVERS)[PlaudServerKey],
                                    ][]
                                ).map(([key, s]) => (
                                    <SelectItem key={key} value={key}>
                                        {s.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {authMode === "login" ? (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="plaudEmail">
                                    Plaud Email
                                </Label>
                                <Input
                                    id="plaudEmail"
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="plaudPassword">
                                    Plaud Password
                                </Label>
                                <Input
                                    id="plaudPassword"
                                    type="password"
                                    placeholder="Your Plaud password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    disabled={isLoading}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Your password is only used to obtain an
                                    access token and is never stored.
                                </p>
                            </div>

                            <MetalButton
                                onClick={handlePlaudLogin}
                                variant="cyan"
                                disabled={isLoading}
                                className="w-full"
                            >
                                {isLoading
                                    ? "Connecting..."
                                    : "Connect Plaud Account"}
                            </MetalButton>

                            <button
                                type="button"
                                onClick={() => setAuthMode("token")}
                                className="text-xs text-muted-foreground hover:text-foreground underline w-full text-center"
                            >
                                Use bearer token instead
                            </button>
                        </>
                    ) : (
                        <>
                            <Panel variant="inset" className="space-y-3 text-sm">
                                <p className="font-semibold">
                                    How to get your bearer token:
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                    <li>
                                        Go to{" "}
                                        <a
                                            href="https://web.plaud.ai"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline"
                                        >
                                            web.plaud.ai
                                        </a>{" "}
                                        and log in
                                    </li>
                                    <li>
                                        Open DevTools (F12) → Application →
                                        Local Storage
                                    </li>
                                    <li>
                                        Copy the value of{" "}
                                        <code className="bg-muted px-1 rounded">
                                            tokenstr
                                        </code>
                                    </li>
                                </ol>
                            </Panel>

                            <div className="space-y-2">
                                <Label htmlFor="bearerToken">
                                    Bearer Token
                                </Label>
                                <Input
                                    id="bearerToken"
                                    type="text"
                                    placeholder="Bearer ..."
                                    value={bearerToken}
                                    onChange={(e) =>
                                        setBearerToken(e.target.value)
                                    }
                                    disabled={isLoading}
                                    className="font-mono text-sm"
                                />
                            </div>

                            <MetalButton
                                onClick={handleTokenConnect}
                                variant="cyan"
                                disabled={isLoading}
                                className="w-full"
                            >
                                {isLoading
                                    ? "Connecting..."
                                    : "Connect Device"}
                            </MetalButton>

                            <button
                                type="button"
                                onClick={() => setAuthMode("login")}
                                className="text-xs text-muted-foreground hover:text-foreground underline w-full text-center"
                            >
                                Sign in with Plaud account instead
                            </button>
                        </>
                    )}
                </div>
            )}

            {step === "complete" && (
                <div className="space-y-4 text-center">
                    <LEDIndicator
                        active
                        status="active"
                        size="lg"
                        pulse
                        className="mx-auto"
                    />
                    <div>
                        <h2 className="text-2xl font-bold">
                            Setup Complete!
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Your recordings will start syncing automatically
                        </p>
                    </div>
                    <MetalButton
                        onClick={() => router.push("/dashboard")}
                        variant="cyan"
                        className="w-full"
                    >
                        Go to Dashboard
                    </MetalButton>
                </div>
            )}
        </Panel>
    );
}
