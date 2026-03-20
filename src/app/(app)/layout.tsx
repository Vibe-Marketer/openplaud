import { Footer } from "@/components/footer";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <div className="flex flex-col h-[100vh] overflow-hidden">
                <main className="flex-1 flex flex-col min-h-0">{children}</main>
                <Footer />
            </div>
            <Toaster />
        </>
    );
}
