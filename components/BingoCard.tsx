"use client";

import { CardNumbers } from "@/lib/bingo/types";

const COLUMN_ORDER: (keyof CardNumbers)[] = ["B", "I", "N", "G", "O"];

export default function BingoCard({
  numbers,
  calledSet,
  markedSet,
  onToggleMark,
}: {
  numbers: CardNumbers;
  calledSet: Set<number>;
  markedSet: Set<number>;
  onToggleMark: (n: number) => void;
}) {
  return (
    <div className="w-full max-w-sm mx-auto select-none">
      <div className="grid grid-cols-5 gap-1 mb-1">
        {COLUMN_ORDER.map((letter) => (
          <div
            key={letter}
            className="text-center font-display text-xl md:text-2xl font-bold text-gold"
          >
            {letter}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1 bg-pine/40 p-1 rounded-xl border border-gold/40">
        {[0, 1, 2, 3, 4].map((row) =>
          COLUMN_ORDER.map((letter) => {
            const value = numbers[letter][row];
            const isFree = value === null;
            const isCalled = value !== null && calledSet.has(value);
            const isMarked = isFree || (value !== null && markedSet.has(value));

            return (
              <button
                key={`${letter}-${row}`}
                disabled={isFree || !isCalled}
                onClick={() => value !== null && onToggleMark(value)}
                className={[
                  "aspect-square rounded-lg flex items-center justify-center",
                  "text-base md:text-xl font-bold transition-all",
                  isFree
                    ? "bg-gold text-pine"
                    : isMarked
                    ? "bg-cranberry text-cream scale-95"
                    : isCalled
                    ? "bg-cream text-pine ring-2 ring-gold cursor-pointer"
                    : "bg-cream/10 text-cream/50 cursor-not-allowed",
                ].join(" ")}
              >
                {isFree ? "★" : value}
              </button>
            );
          })
        )}
      </div>
      <p className="text-center text-xs text-cream/50 mt-2">
        Tap a called number to mark it — this is just for you, it doesn't decide who wins.
      </p>
    </div>
  );
}
