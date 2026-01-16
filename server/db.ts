import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn("MONGODB_URI not set - database features will be disabled");
}

let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    return;
  }

  if (!MONGODB_URI) {
    console.warn("⚠️ MONGODB_URI not defined, skipping database connection. App will run in standalone mode.");
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log("✓ Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  username: { type: String, required: true },
  name: { type: String, required: true },
  profilePictureUrl: { type: String, default: null },
  credits: { type: Number, required: true, default: 3 },
  hasUnlimitedAccess: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const commissionPaymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  paymentId: { type: String, required: true },
  adminUserId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  commissionAmount: { type: Number, required: true },
  customerUserId: { type: String },
  customerEmail: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const withdrawalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  adminUserId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  transferId: { type: String },
  status: { type: String, required: true, default: 'pending' },
  createdAt: { type: Date, default: Date.now },
});

const adminSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, unique: true, index: true },
  companyId: { type: String },
  commissionShare: { type: Number, required: true, default: 100 },
  manualBalanceAdjustment: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const adminAdjustmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  performedBy: { type: String, required: true },
  targetAdminUserId: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  reason: { type: String },
  balanceBefore: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const chatSessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  tradingPair: { type: String, default: null },
  timeframe: { type: String, default: null },
  messages: { type: mongoose.Schema.Types.Mixed, default: [] },
  analysisStages: { type: mongoose.Schema.Types.Mixed, default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

chatSessionSchema.index({ userId: 1, updatedAt: -1 });

const storedMemberSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  membershipId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  name: { type: String, default: null },
  profilePictureUrl: { type: String, default: null },
  adminUserId: { type: String, required: true, index: true },
  companyId: { type: String, required: true, index: true },
  productId: { type: String, required: true },
  productTitle: { type: String, required: true },
  planId: { type: String, required: true },
  status: { type: String, required: true },
  renewalPeriodStart: { type: Date, default: null },
  renewalPeriodEnd: { type: Date, default: null },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  canceledAt: { type: Date, default: null },
  cancellationReason: { type: String, default: null },
  commissionProcessed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

storedMemberSchema.index({ adminUserId: 1, status: 1 });
storedMemberSchema.index({ companyId: 1, status: 1 });

export const UserModel = mongoose.model("User", userSchema);
export const CommissionPaymentModel = mongoose.model("CommissionPayment", commissionPaymentSchema);
export const WithdrawalModel = mongoose.model("Withdrawal", withdrawalSchema);
export const AdminModel = mongoose.model("Admin", adminSchema);
export const AdminAdjustmentModel = mongoose.model("AdminAdjustment", adminAdjustmentSchema);
export const ChatSessionModel = mongoose.model("ChatSession", chatSessionSchema);
export const StoredMemberModel = mongoose.model("StoredMember", storedMemberSchema);
