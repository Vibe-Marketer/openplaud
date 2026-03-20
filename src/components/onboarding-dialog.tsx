"use client";

import {
    ArrowLeft,
    ArrowRight,
    Bot,
    CheckCircle2,
    Mic,
    Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/onboarding-dialog-base";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type OnboardingStep = "welcome" | "plaud" | "ai-provider" | "complete";

interface OnboardingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
}

export function OnboardingDialog({
    open,
    onOpenChange,
    onComplete,
}: OnboardingDialogProps) {
    const router = useRouter();
    const [step, setStep] = useState<OnboardingStep>("welcome");
    const [plaudEmail, setPlaudEmail] = useState("");
    const [plaudPassword, setPlaudPassword] = useState("");
    const [bearerToken, setBearerToken] = useState("");
    const [plaudAuthMode, setPlaudAuthMode] = useState<"login" | "google" | "token">("google");
    const [server, setServer] = useState<PlaudServerKey>(DEFAULT_SERVER_KEY);
    const [isLoading, setIsLoading] = useState(false);
    const [hasPlaudConnection, setHasPlaudConnection] = useState(false);
    const [plaudDevices, setPlaudDevices] = useState<{ name: string; model: string }[]>([]);
    const [connectedEmail, setConnectedEmail] = useState("");
    const [hasAiProvider, setHasAiProvider] = useState(false);

    useEffect(() => {
        if (open && step === "plaud") {
            fetch("/api/plaud/connection")
                .then((res) => res.json())
                .then((data) => {
                    if (data.connected) {
                        setHasPlaudConnection(true);
                        if (data.server) {
                            setServer(data.server as PlaudServerKey);
                        }
                    }
                })
                .catch(() => {});
        }
    }, [open, step]);

    useEffect(() => {
        if (open && step === "ai-provider") {
            fetch("/api/settings/ai/providers")
                .then((res) => res.json())
                .then((data) => {
                    if (data.providers && data.providers.length > 0) {
                        setHasAiProvider(true);
                    }
                })
                .catch(() => {});
        }
    }, [open, step]);

    useEffect(() => {
        if (!open) {
            setStep("welcome");
            setPlaudEmail("");
            setPlaudPassword("");
            setBearerToken("");
            setPlaudAuthMode("login");
            setServer(DEFAULT_SERVER_KEY);
            setIsLoading(false);
            setHasPlaudConnection(false);
            setHasAiProvider(false);
        }
    }, [open]);

    const handlePlaudConnect = async () => {
        if (!plaudEmail.trim() || !plaudPassword.trim()) {
            toast.error("Please enter your Plaud email and password");
            return;
        }

        setIsLoading(true);
        try {
            // Step 1: Log into Plaud to get bearer token
            const loginResponse = await fetch("/api/plaud/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: plaudEmail,
                    password: plaudPassword,
                    server,
                }),
            });

            const loginData = await loginResponse.json();

            if (!loginResponse.ok) {
                throw new Error(loginData.error || "Invalid Plaud credentials");
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
                const error = await connectResponse.json();
                throw new Error(error.error || "Failed to connect");
            }

            const connectData = await connectResponse.json();
            toast.success("Plaud account connected!");
            setHasPlaudConnection(true);
            setConnectedEmail(plaudEmail);
            if (connectData.devices) {
                setPlaudDevices(
                    connectData.devices.map((d: { name: string; model: string }) => ({
                        name: d.name,
                        model: d.model,
                    })),
                );
            }
            setPlaudEmail("");
            setPlaudPassword("");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to connect to Plaud",
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlaudTokenConnect = async () => {
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
                const error = await response.json();
                throw new Error(error.error || "Failed to connect");
            }

            toast.success("Plaud device connected");
            setHasPlaudConnection(true);
            setBearerToken("");
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to connect to Plaud",
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkipPlaud = () => {
        setStep("ai-provider");
    };

    const handleSkipAiProvider = () => {
        setStep("complete");
    };

    const handleComplete = async () => {
        try {
            await fetch("/api/settings/user", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ onboardingCompleted: true }),
            });
            onComplete();
            onOpenChange(false);
            router.refresh();
        } catch {
            toast.error("Failed to complete onboarding");
        }
    };

    const getStepIndex = () => {
        const steps: OnboardingStep[] = [
            "welcome",
            "plaud",
            "ai-provider",
            "complete",
        ];
        return steps.indexOf(step);
    };

    const isStepCompleted = (stepIndex: number) => {
        const currentIndex = getStepIndex();
        return stepIndex < currentIndex;
    };

    const isStepCurrent = (stepIndex: number) => {
        const currentIndex = getStepIndex();
        return stepIndex === currentIndex;
    };

    const canSkipStep = () => {
        if (step === "plaud") return true;
        if (step === "ai-provider") return true;
        return false;
    };

    const getNextStep = (): OnboardingStep | null => {
        if (step === "welcome") return "plaud";
        if (step === "plaud") return "ai-provider";
        if (step === "ai-provider") return "complete";
        return null;
    };

    const getPrevStep = (): OnboardingStep | null => {
        if (step === "plaud") return "welcome";
        if (step === "ai-provider") return "plaud";
        if (step === "complete") return "ai-provider";
        return null;
    };

    const handleNext = () => {
        const next = getNextStep();
        if (next) setStep(next);
    };

    const handlePrev = () => {
        const prev = getPrevStep();
        if (prev) setStep(prev);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl" hidden>
                        Welcome to OpenPlaud
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {step === "welcome" && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Mic className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold">
                                    Your AI-Powered Recording Hub
                                </h3>
                                <p className="text-muted-foreground">
                                    OpenPlaud helps you manage, transcribe, and
                                    enhance your Plaud recordings with AI. Let's
                                    set up your account.
                                </p>
                            </div>

                            <div className="grid gap-4">
                                <Card className="gap-0 py-4">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Mic className="w-4 h-4" />
                                            Connect Your Device
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            Link your Plaud device to start
                                            syncing recordings automatically
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="gap-0 py-4">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Bot className="w-4 h-4" />
                                            Set Up AI Provider
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            Configure an AI provider for
                                            automatic transcriptions
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card className="gap-0 py-4">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            Start Recording
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            You're all set! Start recording and
                                            let AI do the work
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {step === "plaud" && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Mic className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold">
                                    Connect Your Plaud Account
                                </h3>
                                <p className="text-muted-foreground">
                                    Sign in with your Plaud account to sync
                                    recordings automatically
                                </p>
                            </div>

                            {hasPlaudConnection ? (
                                <Card className="border-primary/50 bg-primary/5 py-3">
                                    <CardContent className="px-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-primary" />
                                            <div className="flex-1">
                                                <p className="font-medium">
                                                    Plaud Account Connected
                                                </p>
                                                {connectedEmail && (
                                                    <p className="text-sm text-muted-foreground">
                                                        {connectedEmail}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setHasPlaudConnection(false);
                                                    setPlaudDevices([]);
                                                    setConnectedEmail("");
                                                }}
                                            >
                                                Reconnect
                                            </Button>
                                        </div>
                                        {plaudDevices.length > 0 && (
                                            <div className="pl-8 space-y-1">
                                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                    Devices Found
                                                </p>
                                                {plaudDevices.map((device, i) => (
                                                    <div
                                                        key={i}
                                                        className="flex items-center gap-2 text-sm"
                                                    >
                                                        <Mic className="w-3 h-3 text-primary" />
                                                        <span>{device.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            ({device.model})
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card className="gap-0 py-4">
                                    <CardContent className="pt-6 space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="api-server">
                                                Region
                                            </Label>
                                            <Select
                                                value={server}
                                                onValueChange={(v) =>
                                                    setServer(
                                                        v as PlaudServerKey,
                                                    )
                                                }
                                            >
                                                <SelectTrigger
                                                    id="api-server"
                                                    disabled={isLoading}
                                                >
                                                    <SelectValue placeholder="Select your region" />
                                                </SelectTrigger>
                                                <SelectContent className="z-[200]">
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

                                        {plaudAuthMode === "google" && (
                                            <>
                                                <div className="space-y-4">
                                                    <div className="bg-muted rounded-lg p-4 space-y-4 text-sm">
                                                        <div className="flex items-start gap-3">
                                                            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                                                                1
                                                            </span>
                                                            <div className="space-y-2 flex-1">
                                                                <p className="font-medium">
                                                                    Drag this
                                                                    button to
                                                                    your
                                                                    bookmarks
                                                                    bar:
                                                                </p>
                                                                {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
                                                                <a
                                                                    href="javascript:void(prompt('Copy this token and paste it in OpenPlaud:',localStorage.getItem('tokenstr')))"
                                                                    onClick={(
                                                                        e,
                                                                    ) =>
                                                                        e.preventDefault()
                                                                    }
                                                                    className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md text-xs font-medium cursor-grab hover:opacity-90"
                                                                    draggable
                                                                >
                                                                    Get Plaud
                                                                    Token
                                                                </a>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Can&apos;t
                                                                    drag? Right-click
                                                                    it →
                                                                    &quot;Bookmark
                                                                    This
                                                                    Link&quot;
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-start gap-3">
                                                            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                                                                2
                                                            </span>
                                                            <div className="space-y-2 flex-1">
                                                                <p className="font-medium">
                                                                    Open Plaud
                                                                    and log in:
                                                                </p>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => {
                                                                        window.open(
                                                                            "https://web.plaud.ai",
                                                                            "_blank",
                                                                        );
                                                                    }}
                                                                >
                                                                    Open
                                                                    web.plaud.ai
                                                                </Button>
                                                                <p className="text-xs text-muted-foreground">
                                                                    Log in with
                                                                    Google,
                                                                    Apple, or
                                                                    email
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-start gap-3">
                                                            <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                                                                3
                                                            </span>
                                                            <div className="flex-1">
                                                                <p className="font-medium">
                                                                    Click the
                                                                    &quot;Get
                                                                    Plaud
                                                                    Token&quot;
                                                                    bookmark
                                                                    while on
                                                                    web.plaud.ai
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    A dialog
                                                                    will show
                                                                    your token —
                                                                    copy it
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <Label htmlFor="bearer-token-google">
                                                        4. Paste your token
                                                        here
                                                    </Label>
                                                    <Input
                                                        id="bearer-token-google"
                                                        type="password"
                                                        placeholder="Paste your token here"
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
                                                    onClick={
                                                        handlePlaudTokenConnect
                                                    }
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

                                                <div className="flex justify-center gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPlaudAuthMode(
                                                                "login",
                                                            )
                                                        }
                                                        className="text-xs text-muted-foreground hover:text-foreground underline"
                                                    >
                                                        Use email/password
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {plaudAuthMode === "login" && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label htmlFor="plaud-email">
                                                        Plaud Email
                                                    </Label>
                                                    <Input
                                                        id="plaud-email"
                                                        type="email"
                                                        placeholder="your@email.com"
                                                        value={plaudEmail}
                                                        onChange={(e) =>
                                                            setPlaudEmail(
                                                                e.target.value,
                                                            )
                                                        }
                                                        disabled={isLoading}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="plaud-password">
                                                        Plaud Password
                                                    </Label>
                                                    <Input
                                                        id="plaud-password"
                                                        type="password"
                                                        placeholder="Your Plaud password"
                                                        value={plaudPassword}
                                                        onChange={(e) =>
                                                            setPlaudPassword(
                                                                e.target.value,
                                                            )
                                                        }
                                                        disabled={isLoading}
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Your password is only
                                                        used to obtain an access
                                                        token and is never
                                                        stored.
                                                    </p>
                                                </div>

                                                <Button
                                                    onClick={
                                                        handlePlaudConnect
                                                    }
                                                    disabled={
                                                        isLoading ||
                                                        !plaudEmail.trim() ||
                                                        !plaudPassword.trim()
                                                    }
                                                    className="w-full"
                                                >
                                                    {isLoading
                                                        ? "Connecting..."
                                                        : "Connect Plaud Account"}
                                                </Button>

                                                <div className="flex justify-center gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPlaudAuthMode(
                                                                "google",
                                                            )
                                                        }
                                                        className="text-xs text-muted-foreground hover:text-foreground underline"
                                                    >
                                                        Sign in with
                                                        Google/Apple
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPlaudAuthMode(
                                                                "token",
                                                            )
                                                        }
                                                        className="text-xs text-muted-foreground hover:text-foreground underline"
                                                    >
                                                        Paste bearer token
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {plaudAuthMode === "token" && (
                                            <>
                                                <div className="space-y-2">
                                                    <Label htmlFor="bearer-token">
                                                        Bearer Token
                                                    </Label>
                                                    <Input
                                                        id="bearer-token"
                                                        type="password"
                                                        placeholder="Paste your Plaud bearer token"
                                                        value={bearerToken}
                                                        onChange={(e) =>
                                                            setBearerToken(
                                                                e.target.value,
                                                            )
                                                        }
                                                        disabled={isLoading}
                                                    />
                                                    <p className="text-xs text-muted-foreground">
                                                        Go to web.plaud.ai →
                                                        log in → F12 →
                                                        Application → Local
                                                        Storage → copy{" "}
                                                        <code className="bg-muted px-1 rounded">
                                                            tokenstr
                                                        </code>
                                                    </p>
                                                </div>

                                                <Button
                                                    onClick={
                                                        handlePlaudTokenConnect
                                                    }
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

                                                <div className="flex justify-center gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPlaudAuthMode(
                                                                "google",
                                                            )
                                                        }
                                                        className="text-xs text-muted-foreground hover:text-foreground underline"
                                                    >
                                                        Sign in with
                                                        Google/Apple
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setPlaudAuthMode(
                                                                "login",
                                                            )
                                                        }
                                                        className="text-xs text-muted-foreground hover:text-foreground underline"
                                                    >
                                                        Use email/password
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {step === "ai-provider" && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Bot className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold">
                                    Transcription
                                </h3>
                                <p className="text-muted-foreground">
                                    How your recordings get transcribed
                                </p>
                            </div>

                            <Card className="gap-0 py-4">
                                <CardContent className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                                        <div>
                                            <p className="font-medium">
                                                Plaud AI (default)
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Plaud&apos;s built-in AI handles
                                                transcription and summaries
                                                automatically. No setup needed.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Sparkles className="w-5 h-5 text-muted-foreground mt-0.5" />
                                        <div>
                                            <p className="font-medium text-muted-foreground">
                                                Your own AI (optional)
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                You can add your own OpenAI,
                                                Groq, or compatible API key in
                                                Settings for AI-generated titles
                                                and custom transcription.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {hasAiProvider && (
                                <Card className="border-primary/50 bg-primary/5 py-3">
                                    <CardContent>
                                        <div className="flex items-center gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-primary" />
                                            <p className="font-medium">
                                                AI provider already configured
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {step === "complete" && (
                        <div className="space-y-6">
                            <div className="text-center space-y-2">
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-xl font-semibold">
                                    You're All Set!
                                </h3>
                                <p className="text-muted-foreground">
                                    Start recording and let OpenPlaud handle the
                                    rest
                                </p>
                            </div>

                            <Card className="gap-0 py-4">
                                <CardContent>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                                            <div>
                                                <p className="font-medium">
                                                    Recordings sync
                                                    automatically
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Your Plaud device will sync
                                                    recordings in the background
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                                            <div>
                                                <p className="font-medium">
                                                    AI-powered transcriptions
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Set up an AI provider to
                                                    transcribe recordings
                                                    automatically
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                                            <div>
                                                <p className="font-medium">
                                                    Customize your experience
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Adjust settings anytime from
                                                    the Settings menu
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-3 relative">
                        <div className="flex gap-2 flex-1">
                            {getPrevStep() && (
                                <Button variant="outline" onClick={handlePrev}>
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Previous
                                </Button>
                            )}
                        </div>

                        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 mt-0.5">
                            {[1, 2, 3, 4].map((stepNum, index) => {
                                const completed = isStepCompleted(index);
                                const current = isStepCurrent(index);
                                return (
                                    <div
                                        key={stepNum}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                                            completed || current
                                                ? "bg-primary text-primary-foreground"
                                                : "border-2 border-muted-foreground/30 text-muted-foreground"
                                        }`}
                                    >
                                        {stepNum}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-2 flex-1 justify-end">
                            {canSkipStep() && step !== "complete" && (
                                <Button
                                    variant="ghost"
                                    onClick={() => {
                                        if (step === "plaud") handleSkipPlaud();
                                        if (step === "ai-provider")
                                            handleSkipAiProvider();
                                    }}
                                >
                                    Skip
                                </Button>
                            )}
                            {step === "complete" ? (
                                <Button onClick={handleComplete}>
                                    Get Started
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            ) : (
                                getNextStep() && (
                                    <Button onClick={handleNext}>
                                        Next
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                )
                            )}
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
