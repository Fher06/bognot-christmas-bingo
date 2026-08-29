"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  CalloutRow,
  DrawRow,
  EventRow,
  LETTER_RANGES,
  PatternRow,
  RoundRow,
} from "@/lib/bingo/types";

const LETTERS: ("B" | "I" | "N" | "G" | "O")[] = ["B", "I", "N", "G", "O"];

type WinnerAnnouncement = {
  winner_id: string;
  participant_name: string;
  card_number: number;
  confirmed: boolean;
  pattern_name: string;
};

export default function TVClient({ eventCode }: { eventCode: string }) {
  const [event, setEvent] = useState<EventRow | null>(null);
  const [round, setRound] = useState<RoundRow | null>(null);
  const [pattern, setPattern] = useState<PatternRow | null>(null);
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [callout, setCallout] = useState<CalloutRow | null>(null);
  const [ballPop, setBallPop] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const [celebration, setCelebration] = useState<WinnerAnnouncement[] | null>(null);
  const shownWinnerIds = useState(() => new Set<string>())[0];

  function speak(text: string) {
    if (!audioOn) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.05;
    window.speechSynthesis.speak(utter);
  }

  // Load event, then keep it live
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("*")
        .eq("event_code", eventCode.toUpperCase())
        .maybeSingle();
      if (data) setEvent(data as EventRow);
    })();

    const channel = supabase
      .channel(`tv-event-${eventCode}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events" },
        (payload) => {
          const updated = payload.new as EventRow;
          if (updated.event_code === eventCode.toUpperCase()) setEvent(updated);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventCode]);

  // Load round + pattern + draws whenever current round changes
  useEffect(() => {
    if (!event?.current_round_id) {
      setRound(null);
      setDraws([]);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data: r } = await supabase.from("rounds").select("*").eq("id", event.current_round_id).single();
      if (cancelled || !r) return;
      setRound(r as RoundRow);

      if (r.pattern_id) {
        const { data: p } = await supabase.from("bingo_patterns").select("*").eq("id", r.pattern_id).single();
        if (!cancelled) setPattern(p as PatternRow);
      }

      const { data: d } = await supabase
        .from("draws")
        .select("*")
        .eq("round_id", r.id)
        .order("draw_order", { ascending: true });
      if (!cancelled) setDraws((d as DrawRow[]) ?? []);
    })();

    const channel = supabase
      .channel(`tv-round-${event.current_round_id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "draws", filter: `round_id=eq.${event.current_round_id}` },
        async (payload) => {
          const newDraw = payload.new as DrawRow;
          setDraws((prev) => [...prev, newDraw]);
          setBallPop(true);
          setTimeout(() => setBallPop(false), 1200);

          const { data: c } = await supabase
            .from("callouts")
            .select("*")
            .eq("number", newDraw.number)
            .maybeSingle();
          const found = (c as CalloutRow) ?? null;
          setCallout(found);
          const letterWord: Record<string, string> = { B: "B", I: "I", N: "N", G: "G", O: "O" };
          const spoken = found
            ? `${letterWord[newDraw.letter]}, ${newDraw.number}... ${found.text}`
            : `${letterWord[newDraw.letter]}, ${newDraw.number}`;
          speak(spoken);
        }
      )
      .subscribe();

    const winnerChannel = supabase
      .channel(`tv-winners-${event.current_round_id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "winners", filter: `round_id=eq.${event.current_round_id}` },
        async (payload) => {
          const updated = payload.new as { confirmed: boolean; id: string };
          if (updated.confirmed && !shownWinnerIds.has(updated.id)) {
            const { data } = await supabase.rpc("get_round_winners", { p_round_id: event.current_round_id });
            const freshlyConfirmed = ((data as WinnerAnnouncement[]) ?? []).filter(
              (w) => w.confirmed && !shownWinnerIds.has(w.winner_id)
            );
            if (freshlyConfirmed.length > 0) {
              freshlyConfirmed.forEach((w) => shownWinnerIds.add(w.winner_id));
              setCelebration(freshlyConfirmed);
              const names = freshlyConfirmed.map((w) => w.participant_name).join(", ");
              speak(`Bingo! Congratulations ${names}!`);
              setTimeout(() => setCelebration(null), 9000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(winnerChannel);
    };
  }, [event?.current_round_id]);

  const calledSet = new Set(draws.map((d) => d.number));
  const latest = draws[draws.length - 1];

  if (!event) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-midnight">
        <p className="text-cream/50 text-2xl">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-pine to-midnight text-cream p-6 flex flex-col gap-4 overflow-hidden">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl xl:text-5xl font-display text-gold">🎄 {event.name} 🎄</h1>
        <div className="flex items-center gap-4">
          {round && (
            <div className="text-right">
              <p className="text-lg xl:text-2xl text-cream/80">
                Round {round.round_number}: {round.name}
              </p>
              {round.prize && <p className="text-gold text-xl xl:text-2xl font-bold">{round.prize}</p>}
            </div>
          )}
          <button
            onClick={() => setAudioOn((v) => !v)}
            className="text-2xl bg-cream/10 rounded-full w-12 h-12 flex items-center justify-center flex-shrink-0"
            title={audioOn ? "Mute" : "Unmute"}
          >
            {audioOn ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      {!round && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-3xl text-cream/60">Waiting for the host to start a round...</p>
        </div>
      )}

      {round && (
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-[auto_1fr] gap-8 items-center">
          {/* Left: big ball + callout + pattern */}
          <div className="flex flex-col items-center gap-4">
            {pattern && (
              <div className="text-center">
                <p className="text-cream/60 text-lg">Pattern</p>
                <p className="text-gold text-2xl font-bold">{pattern.name}</p>
              </div>
            )}

            <div
              className={`w-56 h-56 xl:w-72 xl:h-72 rounded-full bg-cranberry border-8 border-gold flex flex-col items-center justify-center shadow-2xl transition-transform duration-500 ${
                ballPop ? "scale-110" : "scale-100"
              }`}
            >
              {latest ? (
                <>
                  <span className="text-2xl xl:text-4xl font-bold text-cream/80">{latest.letter}</span>
                  <span className="text-6xl xl:text-8xl font-display font-bold leading-none">{latest.number}</span>
                </>
              ) : (
                <span className="text-xl text-cream/70">Ready...</span>
              )}
            </div>

            {callout && (
              <p
                className={`text-center font-display font-bold text-gold ${
                  callout.is_special ? "text-4xl xl:text-6xl animate-bounce" : "text-2xl xl:text-3xl"
                }`}
              >
                {callout.text}
              </p>
            )}

            <p className="text-cream/60 text-lg">{draws.length} numbers drawn</p>
          </div>

          {/* Right: full board */}
          <div className="grid grid-cols-5 gap-2 xl:gap-3">
            {LETTERS.map((letter) => {
              const [min, max] = LETTER_RANGES[letter];
              const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
              return (
                <div key={letter} className="flex flex-col items-center gap-1.5">
                  <span className="text-2xl xl:text-4xl font-display font-bold text-gold">{letter}</span>
                  {nums.map((n) => (
                    <div
                      key={n}
                      className={`w-full aspect-square rounded flex items-center justify-center text-sm xl:text-lg font-bold transition-colors ${
                        calledSet.has(n) ? "bg-gold text-pine" : "bg-cream/10 text-cream/40"
                      }`}
                    >
                      {n}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Winner celebration overlay */}
      {celebration && celebration.length > 0 && (
        <div className="fixed inset-0 bg-cranberry/95 flex flex-col items-center justify-center gap-4 z-50 animate-[pulse_2s_ease-in-out_infinite]">
          <div className="flex gap-3 text-6xl">
            🎉🎄🔔🎁🎄🎉
          </div>
          <p className="text-7xl xl:text-9xl font-display font-bold text-gold drop-shadow-lg">BINGO!!!</p>
          <div className="flex flex-col items-center gap-2 mt-4">
            {celebration.map((w) => (
              <p key={w.winner_id} className="text-3xl xl:text-5xl font-bold text-cream text-center">
                {w.participant_name} — Card #{String(w.card_number).padStart(3, "0")}
              </p>
            ))}
          </div>
          <p className="text-xl xl:text-3xl text-cream/90 mt-2">{celebration[0].pattern_name} Winner!</p>
          <div className="flex gap-3 text-6xl">
            🎉🎄🔔🎁🎄🎉
          </div>
        </div>
      )}

      {/* Recent draws strip */}
      {draws.length > 0 && (
        <footer className="flex gap-2 overflow-x-auto pb-1">
          {draws
            .slice()
            .reverse()
            .slice(0, 15)
            .map((d) => (
              <div
                key={d.id}
                className="min-w-10 h-10 rounded-full bg-cream/10 border border-gold/30 flex items-center justify-center text-sm flex-shrink-0"
              >
                {d.letter}{d.number}
              </div>
            ))}
        </footer>
      )}
    </main>
  );
}
