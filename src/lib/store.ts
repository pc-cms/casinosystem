// In-memory store for CMS data (will be replaced with DB later)
import { useState, useCallback } from "react";

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  phone: string;
  status: "active" | "blacklist";
  tags: string[];
  photo: string | null;
  cards: PlayerCard[];
  createdAt: string;
};

export type PlayerCard = {
  id: string;
  cardNumber: string;
  type: "manual" | "rfid";
  issuedAt: string;
  active: boolean;
};

export type Transaction = {
  id: string;
  type: "buy" | "cashout";
  playerId: string;
  playerName: string;
  tableId: string | null;
  amount: number;
  chips?: Record<number, number>;
  timestamp: string;
  operatorId: string;
};

export type Table = {
  id: string;
  name: string;
  game: string;
  status: "open" | "closed";
  float: number;
  denominations: number[];
};

export type Expense = {
  id: string;
  category: "food" | "alcohol" | "taxi" | "hotel" | "flight" | "other";
  amount: number;
  description: string;
  playerId: string | null;
  playerName: string | null;
  approved: boolean;
  approvedBy: string | null;
  timestamp: string;
};

export type LogEntry = {
  id: string;
  action: string;
  details: string;
  operator: string;
  timestamp: string;
  category: "transaction" | "edit" | "lock" | "expense" | "player" | "system";
};

// Generate IDs
let idCounter = 1000;
export const generateId = () => `CMS-${String(++idCounter).padStart(6, "0")}`;

// Generate card number
let cardCounter = 1000;
export const generateCardNumber = () => {
  const prefix = "0001";
  return `${prefix}${String(++cardCounter).padStart(3, "0")}+`;
};

// Demo data
export const DEMO_TABLES: Table[] = [
  { id: "T1", name: "Table 1", game: "Blackjack", status: "open", float: 50000, denominations: [5, 25, 100, 500, 1000] },
  { id: "T2", name: "Table 2", game: "Blackjack", status: "open", float: 50000, denominations: [5, 25, 100, 500, 1000] },
  { id: "T3", name: "Table 3", game: "Roulette", status: "open", float: 75000, denominations: [5, 25, 100, 500, 1000, 5000] },
  { id: "T4", name: "Table 4", game: "Baccarat", status: "closed", float: 100000, denominations: [25, 100, 500, 1000, 5000] },
];

export const DEMO_PLAYERS: Player[] = [
  {
    id: "P001", firstName: "James", lastName: "Chen", nickname: "Big J",
    phone: "+44 7700 900001", status: "active", tags: ["VIP", "No Alcohol"],
    photo: null, cards: [{ id: "C001", cardNumber: "0001001+", type: "rfid", issuedAt: "2024-01-15", active: true }],
    createdAt: "2024-01-15",
  },
  {
    id: "P002", firstName: "Sarah", lastName: "Williams", nickname: "Ace",
    phone: "+44 7700 900002", status: "active", tags: ["VIP"],
    photo: null, cards: [{ id: "C002", cardNumber: "0001002+", type: "rfid", issuedAt: "2024-02-20", active: true }],
    createdAt: "2024-02-20",
  },
  {
    id: "P003", firstName: "Viktor", lastName: "Petrov", nickname: "Ghost",
    phone: "+44 7700 900003", status: "blacklist", tags: [],
    photo: null, cards: [{ id: "C003", cardNumber: "0001003+", type: "manual", issuedAt: "2024-03-10", active: false }],
    createdAt: "2024-03-10",
  },
];

export const CHIP_COLORS: Record<number, string> = {
  5: "bg-red-600 text-white",
  25: "bg-green-600 text-white",
  100: "bg-black text-white border border-white/20",
  500: "bg-purple-600 text-white",
  1000: "bg-yellow-500 text-black",
  5000: "bg-orange-500 text-white",
};

export const EXPENSE_CATEGORIES = [
  { value: "food", label: "Food" },
  { value: "alcohol", label: "Alcohol" },
  { value: "taxi", label: "Taxi" },
  { value: "hotel", label: "Hotel" },
  { value: "flight", label: "Flight" },
  { value: "other", label: "Other" },
] as const;

export const TAG_OPTIONS = ["VIP", "No Alcohol", "Free Food", "High Roller", "Watch List"];
