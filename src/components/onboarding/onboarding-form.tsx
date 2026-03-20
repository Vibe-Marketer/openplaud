"use client";

import { CheckCircle2, Mic } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type Step = "plaud" | "transcription" | "complete";
type AuthMode = "google" | "login" | "token";
type TranscriptionMode = "auto-plaud" | "manual-plaud" | "custom-ai";

export function OnboardingForm() {
    const [step, setStep] = useState<Step>("plaud");
    const [authMode, setAuthMode] = useState<AuthMode>("google");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [bearerToken, setBearerToken] = useState("");
    const [server, setServer] = useState<PlaudServerKey>(DEFAULT_SERVER_KEY);
    const [isLoading, setIsLoading] = useState(false);
    const [hasConnection, setHasConnection] = useState(false);
    const [connectedDevices, setConnectedDevices] = useState<
        { name: string; model: string }[]
    >([]);
    const [connectedEmail, setConnectedEmail] = useState("");
    const [transcriptionMode, setTranscriptionMode] =
        useState<TranscriptionMode>("auto-plaud");
    const router = useRouter();

    const handlePlaudLogin = async () => {
        if (!email.trim() || !password.trim()) {
            toast.error("Please enter your Plaud email and password");
            return;
        }

        setIsLoading(true);
        try {
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

            const connectData = await connectResponse.json();
            toast.success("Plaud account connected!");
            setHasConnection(true);
            setConnectedEmail(email);
            if (connectData.devices) {
                setConnectedDevices(
                    connectData.devices.map(
                        (d: { name: string; model: string }) => ({
                            name: d.name,
                            model: d.model,
                        }),
                    ),
                );
            }
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
            if (!response.ok) {
                const err = await response.json();
                toast.error(err.error || "Failed to connect");
                return;
            }

            const data = await response.json();
            toast.success("Plaud device connected!");
            setHasConnection(true);
            if (data.devices) {
                setConnectedDevices(
                    data.devices.map(
                        (d: { name: string; model: string }) => ({
                            name: d.name,
                            model: d.model,
                        }),
                    ),
                );
            }
        } catch {
            toast.error("Failed to connect to Plaud");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveTranscriptionPrefs = async () => {
        setIsLoading(true);
        try {
            const settings: Record<string, unknown> = {
                onboardingCompleted: true,
            };

            if (transcriptionMode === "auto-plaud") {
                settings.autoTranscribe = true;
                settings.autoTranscribeProvider = "plaud";
            } else if (transcriptionMode === "manual-plaud") {
                settings.autoTranscribe = false;
                settings.autoTranscribeProvider = "plaud";
            } else {
                settings.autoTranscribe = true;
                settings.autoTranscribeProvider = "user";
            }

            await fetch("/api/settings/user", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });

            // Trigger first sync
            fetch("/api/plaud/sync", { method: "POST" }).catch(() => {});

            setStep("complete");
        } catch {
            toast.error("Failed to save preferences");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-lg">
            <CardContent className="pt-6 space-y-6">
                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2">
                    {["Connect", "Transcription", "Done"].map((label, i) => {
                        const stepOrder: Step[] = [
                            "plaud",
                            "transcription",
                            "complete",
                        ];
                        const currentIdx = stepOrder.indexOf(step);
                        const isActive = i === currentIdx;
                        const isDone = i < currentIdx;
                        return (
                            <div
                                key={label}
                                className="flex items-center gap-2"
                            >
                                {i > 0 && (
                                    <div
                                        className={`w-8 h-px ${isDone ? "bg-primary" : "bg-muted-foreground/30"}`}
                                    />
                                )}
                                <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                                        isDone
                                            ? "bg-primary text-primary-foreground"
                                            : isActive
                                              ? "bg-primary text-primary-foreground"
                                              : "border-2 border-muted-foreground/30 text-muted-foreground"
                                    }`}
                                >
                                    {isDone ? (
                                        <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                        i + 1
                                    )}
                                </div>
                                <span
                                    className={`text-xs ${isActive || isDone ? "text-foreground" : "text-muted-foreground"}`}
                                >
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Step 1: Connect Plaud */}
                {step === "plaud" && (
                    <div className="space-y-4">
                        <div className="text-center">
                            <h2 className="text-xl font-bold">
                                Connect Your Plaud Account
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Sign in to sync your recordings
                            </p>
                        </div>

                        {hasConnection ? (
                            <div className="space-y-4">
                                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-primary" />
                                        <div className="flex-1">
                                            <p className="font-medium">
                                                Connected
                                            </p>
                                            {connectedEmail && (
                                                <p className="text-sm text-muted-foreground">
                                                    {connectedEmail}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {connectedDevices.length > 0 && (
                                        <div className="pl-8 space-y-1">
                                            {connectedDevices.map(
                                                (device, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center gap-2 text-sm"
                                                    >
                                                        <Mic className="w-3 h-3 text-primary" />
                                                        <span>
                                                            {device.name}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            ({device.model})
                                                        </span>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    onClick={() => setStep("transcription")}
                                    className="w-full"
                                >
                                    Next
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label>Region</Label>
                                    <Select
                                        value={server}
                                        onValueChange={(v) =>
                                            setServer(v as PlaudServerKey)
                                        }
                                    >
                                        <SelectTrigger disabled={isLoading}>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(
                                                Object.entries(
                                                    PLAUD_SERVERS,
                                                ) as [
                                                    PlaudServerKey,
                                                    (typeof PLAUD_SERVERS)[PlaudServerKey],
                                                ][]
                                            ).map(([key, s]) => (
                                                <SelectItem
                                                    key={key}
                                                    value={key}
                                                >
                                                    {s.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {authMode === "google" && (
                                    <>
                                        <div className="bg-muted rounded-lg p-4 space-y-4 text-sm">
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                                                    1
                                                </span>
                                                <div className="space-y-2 flex-1">
                                                    <p className="font-medium">
                                                        Drag this to your
                                                        bookmarks bar:
                                                    </p>
                                                    {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                                                    <a
                                                        href="javascript:void(prompt('Copy this token and paste it in OpenPlaud:',localStorage.getItem('tokenstr')))"
                                                        onClick={(e) =>
                                                            e.preventDefault()
                                                        }
                                                        className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-medium cursor-grab hover:opacity-90"
                                                        draggable
                                                    >
                                                        Get Plaud Token
                                                    </a>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                                                    2
                                                </span>
                                                <div className="space-y-2 flex-1">
                                                    <p className="font-medium">
                                                        Open Plaud and log in:
                                                    </p>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            window.open(
                                                                "https://web.plaud.ai",
                                                                "_blank",
                                                            )
                                                        }
                                                    >
                                                        Open web.plaud.ai
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                                                    3
                                                </span>
                                                <p className="font-medium">
                                                    Click the bookmark while on
                                                    web.plaud.ai, then copy the
                                                    token
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>4. Paste your token</Label>
                                            <Input
                                                type="password"
                                                placeholder="Paste token here"
                                                value={bearerToken}
                                                onChange={(e) =>
                                                    setBearerToken(
                                                        e.target.value,
                                                    )
                                                }
                                                disabled={isLoading}
                                            />
                                        </div>

                                        <Button
                                            onClick={handleTokenConnect}
                                            disabled={
                                                isLoading ||
                                                !bearerToken.trim()
                                            }
                                            className="w-full"
                                        >
                                            {isLoading
                                                ? "Connecting..."
                                                : "Connect Plaud Account"}
                                        </Button>
                                    </>
                                )}

                                {authMode === "login" && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Plaud Email</Label>
                                            <Input
                                                type="email"
                                                placeholder="your@email.com"
                                                value={email}
                                                onChange={(e) =>
                                                    setEmail(e.target.value)
                                                }
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Plaud Password</Label>
                                            <Input
                                                type="password"
                                                placeholder="Your Plaud password"
                                                value={password}
                                                onChange={(e) =>
                                                    setPassword(e.target.value)
                                                }
                                                disabled={isLoading}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Never stored — only used to get
                                                an access token.
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handlePlaudLogin}
                                            disabled={
                                                isLoading ||
                                                !email.trim() ||
                                                !password.trim()
                                            }
                                            className="w-full"
                                        >
                                            {isLoading
                                                ? "Connecting..."
                                                : "Connect Plaud Account"}
                                        </Button>
                                    </>
                                )}

                                {authMode === "token" && (
                                    <>
                                        <div className="space-y-2">
                                            <Label>Bearer Token</Label>
                                            <Input
                                                type="password"
                                                placeholder="Paste your bearer token"
                                                value={bearerToken}
                                                onChange={(e) =>
                                                    setBearerToken(
                                                        e.target.value,
                                                    )
                                                }
                                                disabled={isLoading}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                web.plaud.ai → F12 →
                                                Application → Local Storage →
                                                tokenstr
                                            </p>
                                        </div>
                                        <Button
                                            onClick={handleTokenConnect}
                                            disabled={
                                                isLoading ||
                                                !bearerToken.trim()
                                            }
                                            className="w-full"
                                        >
                                            {isLoading
                                                ? "Connecting..."
                                                : "Connect Device"}
                                        </Button>
                                    </>
                                )}

                                <div className="flex justify-center gap-4">
                                    {authMode !== "google" && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAuthMode("google")
                                            }
                                            className="text-xs text-muted-foreground hover:text-foreground underline"
                                        >
                                            Google/Apple login
                                        </button>
                                    )}
                                    {authMode !== "login" && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAuthMode("login")
                                            }
                                            className="text-xs text-muted-foreground hover:text-foreground underline"
                                        >
                                            Email/password
                                        </button>
                                    )}
                                    {authMode !== "token" && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setAuthMode("token")
                                            }
                                            className="text-xs text-muted-foreground hover:text-foreground underline"
                                        >
                                            Bearer token
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Step 2: Transcription Preferences */}
                {step === "transcription" && (
                    <div className="space-y-4">
                        <div className="text-center">
                            <h2 className="text-xl font-bold">
                                Transcription Settings
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                How should your recordings be transcribed?
                            </p>
                        </div>

                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setTranscriptionMode("auto-plaud")
                                }
                                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                                    transcriptionMode === "auto-plaud"
                                        ? "border-primary bg-primary/5"
                                        : "border-muted hover:border-muted-foreground/30"
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                                            transcriptionMode === "auto-plaud"
                                                ? "border-primary"
                                                : "border-muted-foreground/30"
                                        }`}
                                    >
                                        {transcriptionMode ===
                                            "auto-plaud" && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium">
                                            Full Auto (Plaud AI)
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Every new recording is automatically
                                            transcribed and summarized by
                                            Plaud&apos;s AI. No setup needed.
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setTranscriptionMode("manual-plaud")
                                }
                                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                                    transcriptionMode === "manual-plaud"
                                        ? "border-primary bg-primary/5"
                                        : "border-muted hover:border-muted-foreground/30"
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                                            transcriptionMode === "manual-plaud"
                                                ? "border-primary"
                                                : "border-muted-foreground/30"
                                        }`}
                                    >
                                        {transcriptionMode ===
                                            "manual-plaud" && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium">
                                            On Demand (Plaud AI)
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Recordings sync but aren&apos;t
                                            transcribed automatically. You
                                            choose which ones to transcribe.
                                        </p>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setTranscriptionMode("custom-ai")
                                }
                                className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                                    transcriptionMode === "custom-ai"
                                        ? "border-primary bg-primary/5"
                                        : "border-muted hover:border-muted-foreground/30"
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center ${
                                            transcriptionMode === "custom-ai"
                                                ? "border-primary"
                                                : "border-muted-foreground/30"
                                        }`}
                                    >
                                        {transcriptionMode === "custom-ai" && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium">
                                            Your AI Provider
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Use your own OpenAI, Groq, or
                                            compatible API for transcription.
                                            Configure in Settings after setup.
                                        </p>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => setStep("plaud")}
                                className="flex-1"
                            >
                                Back
                            </Button>
                            <Button
                                onClick={handleSaveTranscriptionPrefs}
                                disabled={isLoading}
                                className="flex-1"
                            >
                                {isLoading ? "Saving..." : "Continue"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Complete */}
                {step === "complete" && (
                    <div className="space-y-4 text-center">
                        <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
                        <div>
                            <h2 className="text-xl font-bold">
                                You&apos;re All Set!
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Your recordings are syncing now. They&apos;ll
                                appear in your dashboard within a minute.
                            </p>
                        </div>
                        <Button
                            onClick={() => router.push("/dashboard")}
                            className="w-full"
                        >
                            Go to Dashboard
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
