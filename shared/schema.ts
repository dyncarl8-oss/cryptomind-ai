import { z } from "zod";
import { createInsertSchema } from "drizzle-zod";
import { pgTable, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const cryptoPairs = [
  "BTC/USDT",
  "ETH/USDT",
  "XRP/USDT",
  "BNB/USDT",
  "SOL/USDT",
  "TRX/USDT",
  "DOGE/USDT",
  "ADA/USDT",
  "LINK/USDT",
  "LTC/USDT",
  "HBAR/USDT",
  "AVAX/USDT",
  "SUI/USDT",
  "SHIB/USDT",
  "UNI/USDT",
  "DOT/USDT",
  "AAVE/USDT",
  "PEPE/USDT",
  "XLM/USDT",
  "ONDO/USDT",
  "ALGO/USDT",
] as const;

// Note: Only forex pairs supported by Binance spot trading are included
// Binance offers these as EURUSDT, GBPUSDT, and AUDUSDT
export const forexPairs = [
  "EUR/USD",
  "GBP/USD",
  "AUD/USD",
] as const;


export const commoditiesPairs = [
  "XAU/USD",
] as const;

export const indicesPairs = [
  "US100/USD",
] as const;

export const tradingPairs = [...cryptoPairs, ...forexPairs, ...commoditiesPairs, ...indicesPairs] as const;

export const timeframes = [
  "M1",
  "M3",
  "M5",
  "M15",
  "M30",
  "M45",
  "H1",
  "H2",
  "H3",
  "H4",
  "D1",
  "W1",
] as const;

export const timeframeLabels: Record<typeof timeframes[number], string> = {
  M1: "1min",
  M3: "3min",
  M5: "5min",
  M15: "15min",
  M30: "30min",
  M45: "45min",
  H1: "1hr",
  H2: "2hr",
  H3: "3hr",
  H4: "4hr",
  D1: "1d",
  W1: "1w",
};

export const indicatorSignalSchema = z.object({
  name: z.string(),
  value: z.string(),
  direction: z.enum(["UP", "DOWN", "NEUTRAL"]),
  strength: z.number(),
  weight: z.number(),
  reason: z.string(),
  category: z.string(),
});

export const marketDataSnapshotSchema = z.object({
  currentPrice: z.number(),
  priceChange24h: z.number(),
  volume24h: z.number(),
  volumeChange24h: z.number(),
  candlesRetrieved: z.number(),
  lastUpdate: z.string(),
});

export const technicalIndicatorDetailSchema = z.object({
  name: z.string(),
  value: z.string(),
  signal: z.enum(["UP", "DOWN", "NEUTRAL"]),
  strength: z.number(),
  category: z.enum(["MOMENTUM", "TREND", "VOLATILITY", "VOLUME", "PRICE_ACTION"]),
  description: z.string(),
});

export const signalAggregationDataSchema = z.object({
  upSignalsCount: z.number(),
  downSignalsCount: z.number(),
  neutralSignalsCount: z.number(),
  upScore: z.number(),
  downScore: z.number(),
  signalAlignment: z.number(),
  marketRegime: z.string(),
});

export const aiThinkingDataSchema = z.object({
  thinkingProcess: z.string(),
  analysisTime: z.number(),
  modelUsed: z.string(),
});

export const tradeTargetsSchema = z.object({
  entry: z.object({
    low: z.number(),
    high: z.number(),
  }),
  target: z.object({
    low: z.number(),
    high: z.number(),
  }),
  stop: z.number(),
});

export const finalVerdictDataSchema = z.object({
  direction: z.enum(["UP", "DOWN", "NEUTRAL"]),
  confidence: z.number(),
  duration: z.string(),
  qualityScore: z.number(),
  keyFactors: z.array(z.string()),
  riskFactors: z.array(z.string()),
  tradeTargets: tradeTargetsSchema.optional(),
  explanation: z.string().optional(),
});

export const protocolActionSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  action: z.string(),
  status: z.enum(["pending", "success", "warning", "critical"]),
  message: z.string(),
  latency: z.number().optional(),
});

export const auditCheckSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["pass", "fail", "neutral"]),
  value: z.string(),
  threshold: z.string(),
  category: z.enum(["Liquidity", "Momentum", "Market Structure"]),
  details: z.string().optional(),
});

export const newsHeadlineSchema = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string(),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  impact: z.enum(["high", "medium", "low"]),
  url: z.string().optional(),
  publishedAt: z.string(),
});

export const analysisStageSchema = z.object({
  stage: z.enum([
    "data_collection",
    "protocol_execution",
    "technical_calculation",
    "hedge_fund_audit",
    "sentiment_analysis",
    "signal_aggregation",
    "ai_thinking",
    "final_verdict"
  ]),
  progress: z.number().min(0).max(100),
  status: z.enum(["pending", "in_progress", "complete"]),
  duration: z.number().optional(),
  data: z.union([
    marketDataSnapshotSchema,
    z.object({ logs: z.array(protocolActionSchema) }),
    z.object({ indicators: z.array(technicalIndicatorDetailSchema) }),
    z.object({ checks: z.array(auditCheckSchema), score: z.number() }),
    z.object({ headlines: z.array(newsHeadlineSchema), summary: z.string().optional() }),
    signalAggregationDataSchema,
    aiThinkingDataSchema,
    finalVerdictDataSchema,
    z.any(),
  ]).optional(),
});

export const confidenceBreakdownSchema = z.object({
  baseScore: z.number(),
  volumeBonus: z.number(),
  regimeBonus: z.number(),
  alignmentPenalty: z.number(),
  qualityBoost: z.number(),
  rawScore: z.number(),
  finalConfidence: z.number(),
});

export const messageSchema = z.object({
  id: z.string(),
  sender: z.enum(["user", "bot"]),
  content: z.string(),
  timestamp: z.date(),
  prediction: z.object({
    pair: z.enum(tradingPairs),
    direction: z.enum(["UP", "DOWN", "NEUTRAL"]),
    confidence: z.number().min(0).max(100),
    duration: z.string(),
    tradeTargets: tradeTargetsSchema.optional(),
    analysis: z.string().optional(),
    rationale: z.string().optional(),
    riskFactors: z.array(z.string()).optional(),
    detailedAnalysis: z.object({
      indicators: z.array(indicatorSignalSchema).optional(),
      upSignals: z.array(indicatorSignalSchema).optional(),
      downSignals: z.array(indicatorSignalSchema).optional(),
      upScore: z.number().optional(),
      downScore: z.number().optional(),
      signalAlignment: z.number().optional(),
      qualityScore: z.number().optional(),
      marketRegime: z.string().optional(),
      confidenceBreakdown: confidenceBreakdownSchema.optional(),
      thinkingProcess: z.string().optional(),
      keyFactors: z.array(z.string()).optional(),
    }).optional(),
  }).optional(),
  analysisStage: analysisStageSchema.optional(),
});

export type Message = z.infer<typeof messageSchema>;
export type IndicatorSignal = z.infer<typeof indicatorSignalSchema>;
export type AnalysisStage = z.infer<typeof analysisStageSchema>;
export type ConfidenceBreakdown = z.infer<typeof confidenceBreakdownSchema>;
export type MarketDataSnapshot = z.infer<typeof marketDataSnapshotSchema>;
export type ProtocolAction = z.infer<typeof protocolActionSchema>; // NEW
export type AuditCheck = z.infer<typeof auditCheckSchema>; // NEW
export type NewsHeadline = z.infer<typeof newsHeadlineSchema>; // NEW
export type TechnicalIndicatorDetail = z.infer<typeof technicalIndicatorDetailSchema>;
export type SignalAggregationData = z.infer<typeof signalAggregationDataSchema>;
export type AIThinkingData = z.infer<typeof aiThinkingDataSchema>;
export type TradeTargets = z.infer<typeof tradeTargetsSchema>;
export type FinalVerdictData = z.infer<typeof finalVerdictDataSchema>;
export type TradingPair = typeof tradingPairs[number];
export type CryptoPair = typeof cryptoPairs[number];
export type ForexPair = typeof forexPairs[number];
export type Timeframe = typeof timeframes[number];

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  username: varchar("username").notNull(),
  name: varchar("name").notNull(),
  profilePictureUrl: varchar("profile_picture_url"),
  credits: integer("credits").notNull().default(3),
  hasUnlimitedAccess: varchar("has_unlimited_access").notNull().default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const userCreditsSchema = z.object({
  userId: z.string(),
  credits: z.number().int().min(0),
  hasUnlimitedAccess: z.boolean(),
});

export type UserCredits = z.infer<typeof userCreditsSchema>;

export const commissionPayments = pgTable("commission_payments", {
  id: varchar("id").primaryKey(),
  paymentId: varchar("payment_id").notNull(),
  adminUserId: varchar("admin_user_id").notNull(),
  amount: integer("amount").notNull(),
  commissionAmount: integer("commission_amount").notNull(),
  customerUserId: varchar("customer_user_id"),
  customerEmail: varchar("customer_email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommissionPaymentSchema = createInsertSchema(commissionPayments).omit({
  createdAt: true,
});

export type InsertCommissionPayment = z.infer<typeof insertCommissionPaymentSchema>;
export type CommissionPayment = typeof commissionPayments.$inferSelect;

export const adminBalanceSchema = z.object({
  adminUserId: z.string(),
  balance: z.number(),
  paymentCount: z.number(),
});

export type AdminBalance = z.infer<typeof adminBalanceSchema>;

export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey(),
  adminUserId: varchar("admin_user_id").notNull(),
  amount: integer("amount").notNull(),
  transferId: varchar("transfer_id"),
  status: varchar("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  createdAt: true,
});

export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;

export const admins = pgTable("admins", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().unique(),
  companyId: varchar("company_id"),
  commissionShare: integer("commission_share").notNull().default(100),
  manualBalanceAdjustment: integer("manual_balance_adjustment").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;

export const adminAdjustments = pgTable("admin_adjustments", {
  id: varchar("id").primaryKey(),
  performedBy: varchar("performed_by").notNull(),
  targetAdminUserId: varchar("target_admin_user_id").notNull(),
  amount: integer("amount").notNull(),
  reason: varchar("reason"),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAdminAdjustmentSchema = createInsertSchema(adminAdjustments).omit({
  createdAt: true,
});

export type InsertAdminAdjustment = z.infer<typeof insertAdminAdjustmentSchema>;
export type AdminAdjustment = typeof adminAdjustments.$inferSelect;

export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  tradingPair: varchar("trading_pair"),
  timeframe: varchar("timeframe"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;

export const chatSessionWithMessagesSchema = z.object({
  id: z.string(),
  userId: z.string(),
  tradingPair: z.string().nullable(),
  timeframe: z.string().nullable(),
  messages: z.array(messageSchema),
  analysisStages: z.array(analysisStageSchema).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ChatSessionWithMessages = z.infer<typeof chatSessionWithMessagesSchema>;

export const membershipStatuses = [
  "trialing",
  "active",
  "past_due",
  "completed",
  "canceled",
  "expired",
  "unresolved",
  "drafted"
] as const;

export type MembershipStatus = typeof membershipStatuses[number];

export const storedMemberSchema = z.object({
  id: z.string(),
  membershipId: z.string(),
  userId: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  profilePictureUrl: z.string().nullable(),
  adminUserId: z.string(),
  companyId: z.string(),
  productId: z.string(),
  productTitle: z.string(),
  planId: z.string(),
  status: z.enum(membershipStatuses),
  renewalPeriodStart: z.date().nullable(),
  renewalPeriodEnd: z.date().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  canceledAt: z.date().nullable(),
  cancellationReason: z.string().nullable(),
  commissionProcessed: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type StoredMember = z.infer<typeof storedMemberSchema>;

export const insertStoredMemberSchema = storedMemberSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertStoredMember = z.infer<typeof insertStoredMemberSchema>;
