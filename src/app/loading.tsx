import { Home, Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
            <Home className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--surface)] rounded-full flex items-center justify-center shadow-sm">
            <Loader2 className="w-4 h-4 text-[var(--accent)] animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-medium text-[var(--text-primary)]">
            Loading
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Connecting to your smart home...
          </p>
        </div>
      </div>
    </div>
  );
}

