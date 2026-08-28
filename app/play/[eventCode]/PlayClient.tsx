"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { getDeviceId } from "@/lib/bingo/deviceId";
import {
  Card,
  DrawRow,
  EventRow,
  Participant,
  PatternRow,
  RoundRow,
} from "@/lib/bingo/types";
import BingoCard from "@/components/BingoCard";
import CalledNumberBall from "@/components/CalledNumberBall";
import ConnectionStatus from "@/components/ConnectionStatus";

type LoadState = "loading" | "not_found" | "need_name" | "ready" | "error";

export default function PlayClient({ eventCode }: { eventCode: string }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [event, setEvent] = useState<EventRow | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [round, setRound] = useState<RoundRow | null>(null);
  const [pattern, setPattern] = useState<PatternRow | null>(null);
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [connStatus, setConnStatus] = useState<"connecting" | "connected" | "reconnecting">(
    "connecting"
  );
  const [nameInput, setNameInput] = useState("");
  const [joining, setJoining] = useState(false);

  const roundChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Step 1: look up the event by its short code
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("event_code", eventCode.toUpperCase())
        .maybeSingle();

      if (error || !data) {
        setLoadState("not_found");
        return;
      }
      setEvent(data as EventRow);

      const deviceId = getDeviceId();
      const savedName = window.localStorage.getItem(`bognot_name_${data.id}`);

      if (savedName) {
        await attemptJoin(data as EventRow, deviceId, savedName);
      } else {
        setLoadState("need_name");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventCode]);

  async function attemptJoin(evt: EventRow, deviceId: string, name: string) {
    setJoining(true);
    setErrorMsg("");
    const { data, error } = await supabase.rpc("join_or_resume", {
      p_event_id: evt.id,
      p_device_id: deviceId,
      p_name: name,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoadState(window.localStorage.getItem(`bognot_name_${evt.id}`) ? "error" : "need_name");
      setJoining(false);
      return;
    }

    window.localStorage.setItem(`bognot_name_${evt.id}`, name);
    setParticipant(data.participant);
    setCard(data.card);
    setLoadState("ready");
    setJoining(false);
  }

  // Step 2: once joined, load round info + subscribe to realtime updates
  useEffect(() => {
    if (loadState !== "ready" || !event) return;

    let cancelled = false;

    async function loadRoundAndDraws(roundId: string) {
      const { data: roundData } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", roundId)
        .single();
      if (cancelled || !roundData) return;
      setRound(roundData as RoundRow);

      if (roundData.pattern_id) {
        const { data: patternData } = await supabase
          .from("bingo_patterns")
          .select("*")
          .eq("id", roundData.pattern_id)
          .single();
        if (!cancelled) setPattern(patternData as PatternRow);
      }

      const { data: drawData } = await supabase
        .from("draws")
        .select("*")
        .eq("round_id", roundId)
        .order("draw_order", { ascending: true });
      if (!cancelled) setDraws((drawData as DrawRow[]) ?? []);
    }

    if (event.current_round_id) {
      loadRoundAndDraws(event.current_round_id);
    }

    // Subscribe to this event's row for round changes (new round started, etc.)
    const eventChannel = supabase
      .channel(`event-${event.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${event.id}` },
        (payload) => {
          const updated = payload.new as EventRow;
          setEvent(updated);
          if (updated.current_round_id && updated.current_round_id !== round?.id) {
            setDraws([]);
            setMarked(new Set());
            loadRoundAndDraws(updated.current_round_id);
            // fetch our card for the new round
            const deviceId = getDeviceId();
            const name = window.localStorage.getItem(`bognot_name_${updated.id}`) ?? "";
            attemptJoin(updated, deviceId, name);
          }
        }
      )
      .subscribe((status) => {
        setConnStatus(status === "SUBSCRIBED" ? "connected" : "reconnecting");
      });

    return () => {
      cancelled = true;
      supabase.removeChannel(eventChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, event?.id]);

  // Step 3: subscribe to new draws for the current round
  useEffect(() => {
    if (!round) return;

    if (roundChannelRef.current) {
      supabase.removeChannel(roundChannelRef.current);
    }

    const channel = supabase
      .channel(`round-${round.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "draws", filter: `round_id=eq.${round.id}` },
        (payload) => {
          setDraws((prev) => [...prev, payload.new as DrawRow]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rounds", filter: `id=eq.${round.id}` },
        (payload) => setRound(payload.new as RoundRow)
      )
      .subscribe((status) => {
        setConnStatus(status === "SUBSCRIBED" ? "connected" : "reconnecting");
      });

    roundChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [round?.id]);

  const calledSet = new Set(draws.map((d) => d.number));

  function toggleMark(n: number) {
    if (!calledSet.has(n)) return; // cannot mark a number that hasn't been called
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  // ---------- Render states ----------

  if (loadState === "loading") {
    return <CenteredMessage text="Loading game..." />;
  }

  if (loadState === "not_found") {
    return (
      <CenteredMessage text={`We couldn't find a game with code "${eventCode.toUpperCase()}". Please check the link or QR code from your host.`} />
    );
  }

  if (loadState === "need_name" || (loadState === "error" && !participant)) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl md:text-3xl font-display text-gold mb-1 text-center">
          🎄 {event?.name ?? "Bognot Family Christmas Bingo"}
        </h1>
        <p className="text-cream/70 mb-6 text-center">Enter your name to join the game</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!event || !nameInput.trim()) return;
            attemptJoin(event, getDeviceId(), nameInput.trim());
          }}
          className="w-full max-w-xs flex flex-col gap-3"
        >
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Your full name"
            className="rounded-lg px-4 py-3 text-pine text-lg bg-cream placeholder:text-pine/50 outline-none"
            maxLength={60}
            autoFocus
          />
          <button
            type="submit"
            disabled={joining || !nameInput.trim()}
            className="rounded-lg py-3 bg-cranberry text-cream font-bold text-lg disabled:opacity-50"
          >
            {joining ? "Joining..." : "Join Game"}
          </button>
          {errorMsg && <p className="text-cranberry bg-cream/90 rounded p-2 text-sm">{errorMsg}</p>}
        </form>
      </main>
    );
  }

  if (!card || !participant) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-2">
        <h1 className="text-2xl font-display text-gold">You're in, {participant?.name ?? ""}!</h1>
        <p className="text-cream/70">Waiting for the host to start the round...</p>
        <ConnectionStatus status={connStatus} />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-4 gap-4 pb-10">
      <header className="w-full max-w-sm flex items-center justify-between">
        <div>
          <p className="text-sm text-cream/70">{participant.name}</p>
          <p className="text-xs text-gold">Card #{String(card.card_number).padStart(3, "0")}</p>
        </div>
        <ConnectionStatus status={connStatus} />
      </header>

      {round && (
        <div className="w-full max-w-sm text-center">
          <p className="text-xs uppercase tracking-wide text-cream/50">
            Round {round.round_number}: {round.name}
          </p>
          {round.prize && <p className="text-sm text-gold">{round.prize}</p>}
          {pattern && <p className="text-xs text-cream/60 mt-0.5">Pattern: {pattern.name}</p>}
        </div>
      )}

      <CalledNumberBall draws={draws} />

      <BingoCard
        numbers={card.numbers}
        calledSet={calledSet}
        markedSet={marked}
        onToggleMark={toggleMark}
      />
    </main>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 text-center">
      <p className="text-cream/80 max-w-sm">{text}</p>
    </main>
  );
}
