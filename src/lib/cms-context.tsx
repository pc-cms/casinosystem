import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  type Player, type Transaction, type Table, type Expense, type LogEntry,
  DEMO_PLAYERS, DEMO_TABLES, generateId, generateCardNumber,
} from "./store";

type CMSContextType = {
  players: Player[];
  transactions: Transaction[];
  tables: Table[];
  expenses: Expense[];
  logs: LogEntry[];
  addPlayer: (p: Omit<Player, "id" | "cards" | "createdAt">) => Player;
  updatePlayerStatus: (id: string, status: "active" | "blacklist") => void;
  updatePlayerTags: (id: string, tags: string[]) => void;
  addPlayerCard: (playerId: string) => void;
  addTransaction: (t: Omit<Transaction, "id" | "timestamp">) => Transaction;
  addExpense: (e: Omit<Expense, "id" | "timestamp" | "approved" | "approvedBy">) => Expense;
  approveExpense: (id: string, approver: string) => void;
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  getPlayerById: (id: string) => Player | undefined;
  getPlayerTransactions: (id: string) => Transaction[];
  getPlayerStats: (id: string) => { totalBuy: number; totalCashout: number; result: number };
  searchPlayers: (q: string) => Player[];
};

const CMSContext = createContext<CMSContextType | null>(null);

export const useCMS = () => {
  const ctx = useContext(CMSContext);
  if (!ctx) throw new Error("useCMS must be used within CMSProvider");
  return ctx;
};

export const CMSProvider = ({ children }: { children: ReactNode }) => {
  const [players, setPlayers] = useState<Player[]>(DEMO_PLAYERS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tables] = useState<Table[]>(DEMO_TABLES);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    const newLog: LogEntry = { ...entry, id: generateId(), timestamp: new Date().toISOString() };
    setLogs(prev => [newLog, ...prev]);
  }, []);

  const addPlayer = useCallback((p: Omit<Player, "id" | "cards" | "createdAt">) => {
    const newPlayer: Player = {
      ...p, id: generateId(),
      cards: [{ id: generateId(), cardNumber: generateCardNumber(), type: "manual", issuedAt: new Date().toISOString(), active: true }],
      createdAt: new Date().toISOString(),
    };
    setPlayers(prev => [...prev, newPlayer]);
    addLog({ action: "PLAYER_CREATED", details: `${p.firstName} ${p.lastName}`, operator: "SYSTEM", category: "player" });
    return newPlayer;
  }, [addLog]);

  const updatePlayerStatus = useCallback((id: string, status: "active" | "blacklist") => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    addLog({ action: "PLAYER_STATUS_CHANGED", details: `Player ${id} → ${status}`, operator: "MANAGER", category: "player" });
  }, [addLog]);

  const updatePlayerTags = useCallback((id: string, tags: string[]) => {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, tags } : p));
    addLog({ action: "PLAYER_TAGS_UPDATED", details: `Player ${id}: ${tags.join(", ")}`, operator: "MANAGER", category: "edit" });
  }, [addLog]);

  const addPlayerCard = useCallback((playerId: string) => {
    const card = { id: generateId(), cardNumber: generateCardNumber(), type: "rfid" as const, issuedAt: new Date().toISOString(), active: true };
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, cards: [...p.cards, card] } : p));
    addLog({ action: "CARD_ISSUED", details: `Card ${card.cardNumber} → Player ${playerId}`, operator: "SYSTEM", category: "player" });
  }, [addLog]);

  const addTransaction = useCallback((t: Omit<Transaction, "id" | "timestamp">) => {
    const newTx: Transaction = { ...t, id: generateId(), timestamp: new Date().toISOString() };
    setTransactions(prev => [newTx, ...prev]);
    addLog({ action: t.type === "buy" ? "BUY_IN" : "CASHOUT", details: `${t.playerName}: ${t.amount} @ ${t.tableId || "cage"}`, operator: t.operatorId, category: "transaction" });
    return newTx;
  }, [addLog]);

  const addExpense = useCallback((e: Omit<Expense, "id" | "timestamp" | "approved" | "approvedBy">) => {
    const newExp: Expense = { ...e, id: generateId(), timestamp: new Date().toISOString(), approved: false, approvedBy: null };
    setExpenses(prev => [newExp, ...prev]);
    addLog({ action: "EXPENSE_CREATED", details: `${e.category}: ${e.amount}`, operator: "SYSTEM", category: "expense" });
    return newExp;
  }, [addLog]);

  const approveExpense = useCallback((id: string, approver: string) => {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, approved: true, approvedBy: approver } : e));
    addLog({ action: "EXPENSE_APPROVED", details: `Expense ${id} by ${approver}`, operator: approver, category: "expense" });
  }, [addLog]);

  const getPlayerById = useCallback((id: string) => players.find(p => p.id === id), [players]);
  const getPlayerTransactions = useCallback((id: string) => transactions.filter(t => t.playerId === id), [transactions]);
  const getPlayerStats = useCallback((id: string) => {
    const txs = transactions.filter(t => t.playerId === id);
    const totalBuy = txs.filter(t => t.type === "buy").reduce((s, t) => s + t.amount, 0);
    const totalCashout = txs.filter(t => t.type === "cashout").reduce((s, t) => s + t.amount, 0);
    return { totalBuy, totalCashout, result: totalCashout - totalBuy };
  }, [transactions]);

  const searchPlayers = useCallback((q: string) => {
    const lower = q.toLowerCase();
    return players.filter(p =>
      p.firstName.toLowerCase().includes(lower) ||
      p.lastName.toLowerCase().includes(lower) ||
      p.nickname.toLowerCase().includes(lower) ||
      p.cards.some(c => c.cardNumber.includes(q))
    );
  }, [players]);

  return (
    <CMSContext.Provider value={{
      players, transactions, tables, expenses, logs,
      addPlayer, updatePlayerStatus, updatePlayerTags, addPlayerCard,
      addTransaction, addExpense, approveExpense, addLog,
      getPlayerById, getPlayerTransactions, getPlayerStats, searchPlayers,
    }}>
      {children}
    </CMSContext.Provider>
  );
};
