"use client";

export default function ConnectionStatus({
  status,
}: {
  status: "connecting" | "connected" | "reconnecting";
}) {
  const config = {
    connecting: { color: "bg-gold", label: "Connecting..." },
    connected: { color: "bg-holly", label: "Connected" },
    reconnecting: { color: "bg-cranberry animate-pulse", label: "Reconnecting..." },
  }[status];

  return (
    <div className="flex items-center gap-1.5 text-xs text-cream/70">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      {config.label}
    </div>
  );
}
