"use client";

import { DrawRow } from "@/lib/bingo/types";

export default function CalledNumberBall({ draws }: { draws: DrawRow[] }) {
  const latest = draws[draws.length - 1];
  const recent = draws.slice(-6, -1).reverse();

  if (!latest) {
    return (
      <div className="text-center py-4">
        <p className="text-cream/60">Waiting for the first number...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-cranberry border-4 border-gold flex flex-col items-center justify-center shadow-lg shadow-black/40">
        <span className="text-xs font-bold text-cream/80">{latest.letter}</span>
        <span className="text-3xl md:text-4xl font-display font-bold text-cream leading-none">
          {latest.number}
        </span>
      </div>
      {recent.length > 0 && (
        <div className="flex gap-2">
          {recent.map((d) => (
            <div
              key={d.id}
              className="w-8 h-8 rounded-full bg-pine/60 border border-gold/40 flex items-center justify-center text-xs text-cream/70"
            >
              {d.number}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
