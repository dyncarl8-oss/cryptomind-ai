# CryptoMind AI Design Guidelines

## Design Approach
**Selected Approach**: Design System with Discord Reference Patterns
**Justification**: CryptoMind AI is a utility-focused chat application where clarity, readability, and real-time interaction are paramount. We'll adopt Discord's proven chat interface patterns while maintaining systematic design principles for consistency and scalability.

## Core Design Elements

### A. Typography Hierarchy

**Primary Font**: Inter or DM Sans (via Google Fonts CDN)
**Secondary Font**: JetBrains Mono (for timestamps, confidence scores, crypto pair labels)

**Type Scale**:
- Chat messages (user/bot): text-sm to text-base (14-16px)
- Bot name/user label: text-xs font-semibold uppercase (11px)
- Prediction results: text-lg font-bold (18px)
- Confidence scores: text-base font-mono (16px)
- Quick-select buttons: text-sm font-medium (14px)
- Timestamps: text-xs font-mono opacity-60 (11px)
- Welcome message: text-base (16px)
- Section headers (/history): text-sm font-semibold uppercase tracking-wide (14px)

### B. Layout System

**Spacing Primitives**: Use Tailwind units of 2, 3, 4, 6, and 8 for consistent rhythm
- Message padding: p-3 to p-4
- Message gaps: space-y-4
- Button spacing: gap-2 to gap-3
- Container padding: p-4 to p-6
- Section margins: my-6 to my-8

**Chat Container Structure**:
- Full-viewport height layout (h-screen)
- Fixed header area (h-16) with logo and New Session button
- Scrollable message area (flex-1 overflow-y-auto)
- Fixed input area at bottom (h-20 to h-24)
- Maximum chat width: max-w-4xl mx-auto for optimal readability

**Message Alignment**:
- Bot messages: Left-aligned with avatar/icon on left
- User messages: Right-aligned (no avatar needed)
- Maximum message width: 75% of container on desktop, 85% on mobile

### C. Component Library

#### Chat Messages
**Bot Messages**:
- Left-aligned container with small avatar/icon (w-8 h-8 rounded-full)
- Message bubble with subtle border, rounded-lg corners
- Bot name label above message (text-xs font-semibold uppercase)
- Timestamp below or inline (text-xs font-mono)
- Prediction results highlighted with distinct visual treatment (border accent)
- Typing indicator: Three animated dots in message bubble

**User Messages**:
- Right-aligned, simpler design without avatar
- Clean message bubble, rounded-lg
- Timestamp inline or below

#### Quick-Select Crypto Buttons
- Pill-shaped buttons (rounded-full) arranged in horizontal scrollable row
- Each button: px-4 py-2 with crypto pair label (e.g., "BTC/USDT")
- Heroicons crypto/trending icons (optional, use sparingly)
- Hover state: subtle scale transform (scale-105)
- Grid layout for 2-3 columns on mobile, single scrollable row on desktop

#### Prediction Display Cards
Within bot messages, prediction results use structured layout:
- Direction indicator: Large UP/DOWN with arrow icon (Heroicons: arrow-trending-up/down)
- Confidence score: Progress bar or percentage badge (font-mono, font-bold)
- Duration badge: Small pill (rounded-full px-3 py-1)
- Trade suggestion: Secondary text below main prediction

#### Input Area
- Single-line text input with rounded-lg border
- Send button (Heroicons: paper-airplane icon)
- Positioned fixed at bottom with backdrop blur effect
- Input: px-4 py-3, placeholder text clearly visible

#### Header
- Logo/branding: "⚡ CryptoMind AI" (text-lg font-bold)
- New Session button: Right-aligned, ghost button style with icon (Heroicons: arrow-path)
- Header height: h-16 with border-b

#### Command Results (/history)
- Distinct section header with separator line
- Compact list view of last 5 predictions
- Each item: timestamp + pair + result in single row
- Condensed spacing (space-y-2)

### D. Spacing & Rhythm

**Message Spacing**:
- Vertical gap between messages: space-y-4
- Padding inside messages: p-3 to p-4
- Gap between bot name and message: mb-1

**Button Groups**:
- Gap between crypto buttons: gap-2 on mobile, gap-3 on desktop
- Button internal padding: px-4 py-2

**Chat Container**:
- Side padding: px-4 on mobile, px-6 on desktop
- Top/bottom spacing for scroll area: py-6

**Input Area**:
- Internal padding: p-4
- Input field padding: px-4 py-3
- Button icon size: w-5 h-5

## Icon Library
**Selected**: Heroicons (via CDN)
- paper-airplane (send button)
- arrow-trending-up/down (prediction indicators)
- arrow-path (new session)
- clock (timestamps, optional)
- chart-bar (confidence/analysis, optional)

## Interaction Patterns

**Message Flow**:
- Messages appear with subtle fade-in (transition-opacity duration-300)
- Auto-scroll to bottom when new message arrives
- Typing indicator shows for 1-2 seconds before bot response

**Button Interactions**:
- All buttons: Subtle hover lift (hover:scale-105 transition-transform)
- Active/pressed state: slight opacity reduction
- No complex animations - keep interface snappy

**Loading States**:
- Typing indicator: Three pulsing dots animation
- "Analysing..." text with subtle opacity pulse

## Accessibility
- Sufficient contrast ratios for all text
- Focus states visible on all interactive elements (ring-2 ring-offset-2)
- Keyboard navigation support for input and buttons
- Screen reader labels for icon-only buttons
- Message timestamps always present for context

## Responsive Behavior

**Mobile (< 768px)**:
- Single column chat, full width messages (85% max-w)
- Crypto buttons: 2-column grid or horizontal scroll
- Reduced padding: p-3 instead of p-4
- Smaller font sizes acceptable (text-sm for messages)

**Desktop (≥ 768px)**:
- Centered chat container: max-w-4xl
- Messages: 75% max width
- Crypto buttons: Single scrollable row with all options visible
- Generous padding: p-4 to p-6

## Images
**No images required** for this chat interface application. The design relies on typography, structured message layouts, and icon system for visual communication.