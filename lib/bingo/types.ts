export type CardNumbers = {
  B: number[];
  I: number[];
  N: (number | null)[]; // middle entry is null (FREE)
  G: number[];
  O: number[];
};

export type Card = {
  id: string;
  round_id: string;
  participant_id: string;
  card_number: number;
  numbers: CardNumbers;
};

export type Participant = {
  id: string;
  event_id: string;
  device_id: string;
  name: string;
  status: "active" | "disqualified";
};

export type EventRow = {
  id: string;
  name: string;
  event_code: string;
  registration_open: boolean;
  status: "setup" | "registration" | "active" | "ended";
  audio_enabled: boolean;
  current_round_id: string | null;
};

export type RoundRow = {
  id: string;
  event_id: string;
  round_number: number;
  name: string;
  prize: string | null;
  pattern_id: string | null;
  cards_mode: "same" | "new";
  status: "pending" | "active" | "paused" | "ended";
};

export type DrawRow = {
  id: string;
  round_id: string;
  number: number;
  letter: "B" | "I" | "N" | "G" | "O";
  draw_order: number;
};

export type PatternRow = {
  id: string;
  name: string;
  grid: boolean[][]; // 5 rows x 5 cols, true = required square
};

export const LETTER_RANGES: Record<"B" | "I" | "N" | "G" | "O", [number, number]> = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};

export type CalloutRow = {
  number: number;
  letter: "B" | "I" | "N" | "G" | "O";
  text: string;
  is_special: boolean;
  enabled: boolean;
};

export type WinnerRow = {
  id: string;
  round_id: string;
  participant_id: string;
  card_id: string;
  pattern_id: string;
  confirmed: boolean;
};

export function letterForNumber(n: number): "B" | "I" | "N" | "G" | "O" {
  if (n <= 15) return "B";
  if (n <= 30) return "I";
  if (n <= 45) return "N";
  if (n <= 60) return "G";
  return "O";
}
