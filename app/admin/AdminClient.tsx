"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Card,
  DrawRow,
  EventRow,
  Participant,
  PatternRow,
  RoundRow,
} from "@/lib/bingo/types";

type Callout = { number: number; letter: string; text: string; is_special: boolean; enabled: boolean };

export default function AdminClient() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [newEventName, setNewEventName] = useState("");
  const [newEventCode, setNewEventCode] = useState("");

  const [rounds, setRounds] = useState<RoundRow[]>([]);
  const [patterns, setPatterns] = useState<PatternRow[]>([]);
  const [newRoundName, setNewRoundName] = useState("");
  const [newRoundPrize, setNewRoundPrize] = useState("");
  const [newRoundPatternId, setNewRoundPatternId] = useState("");
  const [newRoundCardsMode, setNewRoundCardsMode] = useState<"same" | "new">("new");

  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [lastCallout, setLastCallout] = useState<Callout | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [pendingWinners, setPendingWinners] = useState<
    { winner_id: string; participant_name: string; card_number: number }[]
  >([]);
  const [confirming, setConfirming] = useState(false);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [callouts, setCallouts] = useState<Callout[]>([]);
  const [showCallouts, setShowCallouts] = useState(false);

  const selectedEvent = events.find((e) => e.id === selectedEventId) || null;
  const activeRound = rounds.find((r) => r.id === selectedEvent?.current_round_id) || null;

  // ---------- Auth ----------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => checkAdmin(data.session?.user.id));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      checkAdmin(session?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function checkAdmin(userId?: string) {
    if (!userId) {
      setIsAdmin(false);
      setCheckingAuth(false);
      return;
    }
    const { data } = await supabase.from("admin_users").select("id").eq("id", userId).maybeSingle();
    setIsAdmin(!!data);
    setCheckingAuth(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError(error.message);
  }

  // ---------- Load events once admin ----------
  useEffect(() => {
    if (!isAdmin) return;
    loadEvents();
    loadCallouts();
  }, [isAdmin]);

  async function loadCallouts() {
    const { data } = await supabase.from("callouts").select("*").order("number");
    setCallouts((data as Callout[]) ?? []);
  }

  async function toggleCallout(number: number, enabled: boolean) {
    await supabase.from("callouts").update({ enabled: !enabled }).eq("number", number);
    loadCallouts();
  }

  async function loadEvents() {
    const { data } = await supabase.from("events").select("*").order("created_at", { ascending: false });
    setEvents((data as EventRow[]) ?? []);
    if (data && data.length > 0 && !selectedEventId) setSelectedEventId(data[0].id);
  }

  async function createEvent() {
    if (!newEventName.trim() || !newEventCode.trim()) return;
    const { data, error } = await supabase
      .from("events")
      .insert({ name: newEventName.trim(), event_code: newEventCode.trim().toUpperCase() })
      .select()
      .single();
    if (error) {
      alert(error.message);
      return;
    }
    setNewEventName("");
    setNewEventCode("");
    await loadEvents();
    setSelectedEventId(data.id);
  }

  async function toggleRegistration() {
    if (!selectedEvent) return;
    await supabase
      .from("events")
      .update({ registration_open: !selectedEvent.registration_open })
      .eq("id", selectedEvent.id);
    loadEvents();
  }

  // ---------- Load rounds + patterns + participants for selected event ----------
  useEffect(() => {
    if (!selectedEventId) return;
    loadRounds();
    loadParticipants();
    loadPatterns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  async function loadRounds() {
    const { data } = await supabase
      .from("rounds")
      .select("*")
      .eq("event_id", selectedEventId)
      .order("round_number", { ascending: true });
    setRounds((data as RoundRow[]) ?? []);
  }

  async function loadPatterns() {
    const { data } = await supabase.from("bingo_patterns").select("*").order("name");
    setPatterns((data as PatternRow[]) ?? []);
    if (data && data.length > 0 && !newRoundPatternId) setNewRoundPatternId(data[0].id);
  }

  async function loadParticipants() {
    const { data: p } = await supabase
      .from("participants")
      .select("*")
      .eq("event_id", selectedEventId)
      .order("joined_at", { ascending: true });
    setParticipants((p as Participant[]) ?? []);

    if (p && p.length > 0) {
      const { data: c } = await supabase
        .from("cards")
        .select("*")
        .in(
          "round_id",
          rounds.map((r) => r.id)
        );
      setCards((c as Card[]) ?? []);
    }
  }

  // ---------- Load draws for active round + subscribe realtime ----------
  useEffect(() => {
    if (!activeRound) {
      setDraws([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("draws")
        .select("*")
        .eq("round_id", activeRound.id)
        .order("draw_order", { ascending: true });
      setDraws((data as DrawRow[]) ?? []);

      // Pick up any winners detected but not yet confirmed (e.g. after a page refresh)
      const { data: w } = await supabase.rpc("get_round_winners", { p_round_id: activeRound.id });
      const unconfirmed = (w ?? []).filter((x: any) => !x.confirmed);
      setPendingWinners(
        unconfirmed.map((x: any) => ({
          winner_id: x.winner_id,
          participant_name: x.participant_name,
          card_number: x.card_number,
        }))
      );
    })();

    const channel = supabase
      .channel(`admin-round-${activeRound.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draws", filter: `round_id=eq.${activeRound.id}` },
        () => {
          supabase
            .from("draws")
            .select("*")
            .eq("round_id", activeRound.id)
            .order("draw_order", { ascending: true })
            .then(({ data }) => setDraws((data as DrawRow[]) ?? []));
        }
      )
      .subscribe();

    const participantChannel = supabase
      .channel(`admin-participants-${selectedEventId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "participants", filter: `event_id=eq.${selectedEventId}` },
        () => loadParticipants()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(participantChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRound?.id]);

  // ---------- Round actions ----------
  async function handleCreateRound() {
    if (!newRoundName.trim() || !newRoundPatternId) return;
    const { error } = await supabase.rpc("create_round", {
      p_event_id: selectedEventId,
      p_name: newRoundName.trim(),
      p_prize: newRoundPrize.trim() || null,
      p_pattern_id: newRoundPatternId,
      p_cards_mode: newRoundCardsMode,
    });
    if (error) return alert(error.message);
    setNewRoundName("");
    setNewRoundPrize("");
    loadRounds();
  }

  async function handleStartRound(roundId: string) {
    const { error } = await supabase.rpc("start_round", { p_round_id: roundId });
    if (error) return alert(error.message);
    loadEvents();
    loadRounds();
  }

  async function handleDraw() {
    if (!activeRound || drawing) return;
    setDrawing(true);
    const { data, error } = await supabase.rpc("draw_number", { p_round_id: activeRound.id });
    setDrawing(false);
    if (error) return alert(error.message);
    setLastCallout(data.callout ?? null);
    if (data.winners && data.winners.length > 0) {
      setPendingWinners(data.winners);
      loadRounds(); // round auto-pauses when winners are found
    }
  }

  async function handleConfirmWinners() {
    if (!activeRound) return;
    setConfirming(true);
    const { error } = await supabase.rpc("confirm_winners", { p_round_id: activeRound.id });
    setConfirming(false);
    if (error) return alert(error.message);
    setPendingWinners([]);
  }

  async function handleUndo() {
    if (!activeRound) return;
    if (!confirm("Undo the most recent draw? This cannot be reversed.")) return;
    const { error } = await supabase.rpc("undo_last_draw", { p_round_id: activeRound.id });
    if (error) alert(error.message);
  }

  async function handlePauseResume() {
    if (!activeRound) return;
    const paused = activeRound.status === "active";
    const { error } = await supabase.rpc("set_round_pause", {
      p_round_id: activeRound.id,
      p_paused: paused,
    });
    if (error) alert(error.message);
    loadRounds();
  }

  async function handleEndRound() {
    if (!activeRound) return;
    if (!confirm(`End round "${activeRound.name}"? No more numbers can be drawn after this.`)) return;
    const { error } = await supabase.rpc("end_round", { p_round_id: activeRound.id });
    if (error) alert(error.message);
    loadRounds();
    loadEvents();
  }

  async function handleResetRound() {
    if (!activeRound) return;
    if (!confirm(`Reset round "${activeRound.name}"? This clears all drawn numbers and winners for this round.`))
      return;
    const { error } = await supabase.rpc("reset_round", { p_round_id: activeRound.id });
    if (error) alert(error.message);
    loadRounds();
  }

  async function handleRemoveParticipant(id: string, name: string) {
    if (!confirm(`Remove ${name} from the game? They won't be able to win any more rounds.`)) return;
    const { error } = await supabase.rpc("disqualify_participant", { p_participant_id: id });
    if (error) alert(error.message);
    loadParticipants();
  }

  // ---------- Render ----------

  if (checkingAuth) return <Centered text="Checking login..." />;

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-midnight text-cream">
        <h1 className="text-2xl font-display text-gold mb-6">🎄 Host Login</h1>
        <form onSubmit={handleLogin} className="w-full max-w-xs flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg px-4 py-3 text-pine bg-cream outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg px-4 py-3 text-pine bg-cream outline-none"
          />
          <button className="rounded-lg py-3 bg-cranberry font-bold">Log In</button>
          {loginError && <p className="text-cranberry bg-cream rounded p-2 text-sm">{loginError}</p>}
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-midnight text-cream p-4 md:p-8 flex flex-col gap-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-display text-gold">🎄 Host Console</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-sm text-cream/60 underline">
          Log out
        </button>
      </header>

      {/* Event selector / creator */}
      <section className="bg-pine/30 border border-gold/30 rounded-xl p-4">
        <h2 className="font-bold text-gold mb-2">Event</h2>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-cream text-pine rounded px-3 py-2"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.event_code})
              </option>
            ))}
          </select>
          {selectedEvent && (
            <button
              onClick={toggleRegistration}
              className={`px-3 py-2 rounded font-bold text-sm ${
                selectedEvent.registration_open ? "bg-holly" : "bg-cream/20"
              }`}
            >
              Registration: {selectedEvent.registration_open ? "OPEN" : "CLOSED"}
            </button>
          )}
          <span className="text-sm text-cream/70">
            {participants.filter((p) => p.status === "active").length} joined
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            placeholder="New event name"
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            className="bg-cream text-pine rounded px-3 py-1.5 text-sm"
          />
          <input
            placeholder="CODE"
            value={newEventCode}
            onChange={(e) => setNewEventCode(e.target.value)}
            className="bg-cream text-pine rounded px-3 py-1.5 text-sm w-24"
          />
          <button onClick={createEvent} className="bg-gold text-pine rounded px-3 py-1.5 text-sm font-bold">
            + Create Event
          </button>
        </div>
      </section>

      {selectedEvent && (
        <>
          {/* Rounds */}
          <section className="bg-pine/30 border border-gold/30 rounded-xl p-4">
            <h2 className="font-bold text-gold mb-2">Rounds</h2>
            <ul className="flex flex-col gap-2 mb-3">
              {rounds.map((r) => (
                <li
                  key={r.id}
                  className={`flex items-center justify-between rounded px-3 py-2 ${
                    r.id === activeRound?.id ? "bg-cranberry/30 border border-cranberry" : "bg-cream/5"
                  }`}
                >
                  <span>
                    Round {r.round_number}: {r.name} {r.prize && `— ${r.prize}`}{" "}
                    <span className="text-xs text-cream/50">[{r.status}]</span>
                  </span>
                  {r.status === "pending" && (
                    <button
                      onClick={() => handleStartRound(r.id)}
                      className="bg-holly rounded px-3 py-1 text-sm font-bold"
                    >
                      Start
                    </button>
                  )}
                </li>
              ))}
              {rounds.length === 0 && <p className="text-cream/50 text-sm">No rounds yet.</p>}
            </ul>

            <div className="flex flex-wrap gap-2 items-center border-t border-gold/20 pt-3">
              <input
                placeholder="Round name (e.g. Four Corners)"
                value={newRoundName}
                onChange={(e) => setNewRoundName(e.target.value)}
                className="bg-cream text-pine rounded px-3 py-1.5 text-sm"
              />
              <input
                placeholder="Prize (optional)"
                value={newRoundPrize}
                onChange={(e) => setNewRoundPrize(e.target.value)}
                className="bg-cream text-pine rounded px-3 py-1.5 text-sm"
              />
              <select
                value={newRoundPatternId}
                onChange={(e) => setNewRoundPatternId(e.target.value)}
                className="bg-cream text-pine rounded px-3 py-1.5 text-sm"
              >
                {patterns.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={newRoundCardsMode}
                onChange={(e) => setNewRoundCardsMode(e.target.value as "same" | "new")}
                className="bg-cream text-pine rounded px-3 py-1.5 text-sm"
              >
                <option value="new">New cards</option>
                <option value="same">Same cards</option>
              </select>
              <button
                onClick={handleCreateRound}
                className="bg-gold text-pine rounded px-3 py-1.5 text-sm font-bold"
              >
                + Create Round
              </button>
            </div>
          </section>

          {/* Draw controls */}
          {activeRound && (
            <section className="bg-pine/30 border border-gold/30 rounded-xl p-4 flex flex-col items-center gap-3">
              <h2 className="font-bold text-gold self-start">
                Drawing — Round {activeRound.round_number}: {activeRound.name} [{activeRound.status}]
              </h2>

              {pendingWinners.length > 0 && (
                <div className="w-full bg-gold text-pine rounded-lg p-4 text-center">
                  <p className="font-display font-bold text-xl mb-2">
                    🎉 {pendingWinners.length} WINNER{pendingWinners.length > 1 ? "S" : ""} DETECTED
                  </p>
                  <ul className="mb-3">
                    {pendingWinners.map((w) => (
                      <li key={w.winner_id} className="font-bold">
                        {w.participant_name} — Card #{String(w.card_number).padStart(3, "0")}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handleConfirmWinners}
                    disabled={confirming}
                    className="bg-cranberry text-cream rounded px-4 py-2 font-bold disabled:opacity-50"
                  >
                    {confirming ? "Confirming..." : "Confirm & Celebrate 🎊"}
                  </button>
                </div>
              )}

              <button
                onClick={handleDraw}
                disabled={drawing || activeRound.status !== "active" || pendingWinners.length > 0}
                className="w-40 h-40 rounded-full bg-cranberry border-4 border-gold text-2xl font-display font-bold disabled:opacity-40"
              >
                {drawing ? "..." : "DRAW"}
              </button>

              {lastCallout && (
                <p className="text-gold font-bold text-lg text-center">
                  {lastCallout.letter}-{lastCallout.number}: {lastCallout.text}
                </p>
              )}

              <div className="flex flex-wrap gap-1.5 justify-center max-w-xl">
                {draws.map((d) => (
                  <span key={d.id} className="bg-cream/10 rounded px-2 py-1 text-sm">
                    {d.letter}{d.number}
                  </span>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 justify-center pt-2 border-t border-gold/20 w-full">
                <button onClick={handleUndo} className="bg-cream/10 rounded px-3 py-1.5 text-sm">
                  Undo Last
                </button>
                <button onClick={handlePauseResume} className="bg-cream/10 rounded px-3 py-1.5 text-sm">
                  {activeRound.status === "active" ? "Pause" : "Resume"}
                </button>
                <button onClick={handleEndRound} className="bg-cream/10 rounded px-3 py-1.5 text-sm">
                  End Round
                </button>
                <button onClick={handleResetRound} className="bg-cream/10 rounded px-3 py-1.5 text-sm text-cranberry">
                  Reset Round
                </button>
              </div>
            </section>
          )}

          {/* Participants */}
          <section className="bg-pine/30 border border-gold/30 rounded-xl p-4">
            <h2 className="font-bold text-gold mb-2">
              Participants ({participants.filter((p) => p.status === "active").length})
            </h2>
            <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
              {participants.map((p) => {
                const myCard = cards.find((c) => c.participant_id === p.id);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between px-2 py-1.5 rounded text-sm ${
                      p.status === "disqualified" ? "opacity-40" : "bg-cream/5"
                    }`}
                  >
                    <span>
                      {p.name}{" "}
                      {myCard && <span className="text-gold">#{String(myCard.card_number).padStart(3, "0")}</span>}
                      {p.status === "disqualified" && " (removed)"}
                    </span>
                    {p.status === "active" && (
                      <button
                        onClick={() => handleRemoveParticipant(p.id, p.name)}
                        className="text-cranberry text-xs underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
              {participants.length === 0 && <p className="text-cream/50 text-sm">No participants yet.</p>}
            </div>
          </section>

          {/* Callout manager */}
          <section className="bg-pine/30 border border-gold/30 rounded-xl p-4">
            <button
              onClick={() => setShowCallouts((v) => !v)}
              className="font-bold text-gold w-full text-left flex items-center justify-between"
            >
              <span>Pinoy Callouts ({callouts.filter((c) => c.enabled).length}/{callouts.length} enabled)</span>
              <span>{showCallouts ? "▲" : "▼"}</span>
            </button>
            {showCallouts && (
              <div className="max-h-72 overflow-y-auto mt-3 flex flex-col gap-1">
                {callouts.map((c) => (
                  <label
                    key={c.number}
                    className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
                      c.enabled ? "bg-cream/5" : "opacity-40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      onChange={() => toggleCallout(c.number, c.enabled)}
                    />
                    <span className="font-bold text-gold w-10">
                      {c.letter}{c.number}
                    </span>
                    <span className="flex-1">{c.text}</span>
                    {c.is_special && <span className="text-xs text-cranberry">SPECIAL</span>}
                  </label>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function Centered({ text }: { text: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-midnight text-cream">
      <p>{text}</p>
    </main>
  );
}
