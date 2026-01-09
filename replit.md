# CryptoMind AI

## Subscription Pricing

**IMPORTANT: Fixed Subscription Price**
- Subscription Cost: **$5.00 USD** (500 cents)
- Admin Commission: **50%** = **$2.50 USD** (250 cents)
- This is a fixed price for all users - no variable pricing

When a customer subscribes for $5/month, the admin who owns that product receives $2.50 in commission.

## Overview

CryptoMind AI is a real-time cryptocurrency prediction chat application that provides users with AI-powered market movement predictions through a Discord-style chat interface. The application allows users to interact with an AI bot that analyzes crypto pairs (BTC/USDT, ETH/USDT, SOL/USDT, etc.) and provides directional predictions with confidence scores and time durations. Built as a single-page application with no authentication requirements, it emphasizes simplicity and immediate accessibility.

## User Preferences

Preferred communication style: Simple, everyday language.

## Environment Variables

The application requires the following environment variables for Whop integration:

### Required for Whop App Publishing & Admin Detection

- `WHOP_API_KEY`: Your Whop API key for server-side authentication. Get this from the Whop developer dashboard at https://whop.com/dashboard/developer
- `WHOP_APP_ID`: Your Whop App ID (format: `app_xxxxxxxxxxxxx`). Used for server-side SDK initialization.
- `VITE_WHOP_APP_ID`: Same as WHOP_APP_ID but prefixed with `VITE_` for frontend access. Used for client-side iframe SDK initialization.
- `WHOP_COMPANY_ID`: Your Whop Company ID (format: `biz_xxxxxxxxxxxxxx`). **Required for webhook commission tracking** - used to filter memberships and payments. The system automatically detects admin status from the URL path when loaded as a Whop dashboard app. Find this in your Whop company settings.

### Optional - For Subscription & Commission Features

- `WHOP_PLAN_ID`: Your Whop Plan ID for the subscription product (format: `plan_xxxxxxxxxxxxx`). Optional - only needed if you're using subscription management and payment processing.
- `ADMIN_USER_ID`: The Whop User ID who will receive commission payments (format: `user_xxxxxxxxxxxxx`). Optional - only needed if you want to track commissions. This should be the user ID of whoever should receive the 50/50 revenue split.

### Optional

- `GEMINI_API_KEY`: Google Gemini API key for AI-powered crypto predictions (already configured if using Gemini integration)
- `DEV_ADMIN`: Set to "true" or "false" in development mode to test admin vs member views (default: "true")

### How to Find Your Whop IDs

1. **WHOP_COMPANY_ID**: Go to https://whop.com/dashboard → Select your company → Look in the URL or settings
2. **WHOP_PLAN_ID**: Go to your company dashboard → Products → Select your product → Plans → Copy the plan ID
3. **ADMIN_USER_ID**: Use the Whop API to get your user ID, or check the Whop developer dashboard
4. **Webhook Setup**: In Whop dashboard → Developer → Webhooks → Add endpoint URL: `https://your-replit-url.replit.app/api/webhooks/payment` → Subscribe to `payment.succeeded` events

### Environment Variable Setup in Replit

To add environment variables in Replit:
1. Click on "Tools" in the left sidebar
2. Select "Secrets"
3. Add each variable with its corresponding value
4. Restart the application after adding all variables

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server.

**UI Components**: The application uses shadcn/ui component library built on Radix UI primitives, providing a comprehensive set of accessible, customizable components. The design system follows a "new-york" style with Tailwind CSS for styling.

**Design System**: Discord-inspired dark theme with utility-focused patterns optimized for chat interfaces. Key design decisions include:
- Typography hierarchy using Inter/DM Sans for primary text and JetBrains Mono for timestamps and technical data
- Consistent spacing primitives (Tailwind units: 2, 3, 4, 6, 8)
- Full-viewport layout with fixed header (h-16), scrollable message area, and fixed input area
- Maximum chat width of 4xl for optimal readability
- Message alignment: bot messages left-aligned with avatars, user messages right-aligned

**State Management**: Uses @tanstack/react-query (v5) for server state management and caching. The QueryClient is configured with infinite stale time and disabled automatic refetching, suitable for the real-time nature of the chat application.

**Routing**: Implements wouter for lightweight client-side routing, currently serving a single main Chat route.

**Real-time Communication**: Custom WebSocket hook (`useWebSocket`) manages bidirectional communication with the server over a dedicated `/ws` path, separate from Vite's HMR WebSocket to avoid conflicts.

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js, configured as an ES module.

**WebSocket Server**: Uses the `ws` library to handle WebSocket connections on a dedicated `/ws` path. The server maintains session-based prediction history in memory for each connected client.

**Prediction Engine**: Modular prediction logic (`server/prediction.ts`) that generates realistic random predictions with:
- Direction: UP or DOWN (50/50 probability)
- Confidence scores: 60-90% range
- Duration options: 15s, 30s, 45s, 1m, 2m, 5m
- Design allows for future replacement with actual ML/AI models

**Message Protocol**: Structured message types for client-server communication:
- Client messages: `user_message`, `select_pair`, `history`, `new_session`
- Server messages: `bot_message`, `typing`, `prediction`

**Build Process**: 
- Frontend: Vite builds the React application to `dist/public`
- Backend: esbuild bundles the server code to `dist/index.js` with ESM format
- Production mode serves static files from the built frontend

### External Dependencies

**Database**: Drizzle ORM is configured with PostgreSQL dialect (using @neondatabase/serverless driver), though the current implementation uses in-memory storage. Database schema is defined in `shared/schema.ts` with migrations output to `./migrations`. The system is structured to easily transition from in-memory storage to PostgreSQL persistence.

**UI Component Libraries**:
- @radix-ui/* - Comprehensive set of accessible, unstyled UI primitives (accordion, dialog, dropdown, popover, etc.)
- @heroicons/react - Icon library for visual elements
- class-variance-authority & clsx - Utility libraries for conditional CSS class composition
- tailwindcss - Utility-first CSS framework with custom design tokens

**Form Management**:
- react-hook-form - Form state management
- @hookform/resolvers - Validation resolvers
- zod & drizzle-zod - Schema validation

**Date Utilities**: date-fns for timestamp formatting and manipulation

**Development Tools**:
- Replit-specific plugins for enhanced development experience (vite-plugin-runtime-error-modal, vite-plugin-cartographer, vite-plugin-dev-banner)
- TypeScript with strict mode enabled for type safety
- Path aliases configured (@/, @shared/, @assets/) for cleaner imports

**Session Management**: Infrastructure prepared with connect-pg-simple for PostgreSQL-backed sessions, though currently using in-memory storage.

### Key Architectural Decisions

**Separation of Concerns**: The codebase is organized into clear domains:
- `client/` - Frontend React application
- `server/` - Backend Express server and WebSocket logic
- `shared/` - Type definitions and schemas shared between client and server
- `attached_assets/` - Project specifications and design documents

**Type Safety**: Zod schemas in `shared/schema.ts` ensure runtime type validation for messages and crypto pairs, with TypeScript types derived from these schemas for compile-time safety.

**Modular Prediction Logic**: The prediction generator is isolated in its own module, making it simple to swap with a real ML model or API integration without affecting the rest of the application.

**Real-time First**: WebSocket communication chosen over HTTP polling for immediate, bidirectional updates suitable for a chat interface with low latency requirements.

**Whop Platform Integration**: The application is integrated with Whop to enable publishing as a Whop app. Key integration features:
- Authentication via Whop user tokens passed through iframe headers
- Experience-based routing (`/experiences/:experienceId`) for Whop embedding
- Iframe SDK for communication with the Whop platform
- Access control to verify user permissions for experiences
- API endpoints for authentication and authorization
- **Payment Processing (Direct Processing - No Webhook Dependency)**:
  1. Frontend calls `/api/credits/checkout-config` to create checkout configuration with metadata
  2. Whop SDK returns checkout config referencing existing `WHOP_PLAN_ID` 
  3. Frontend opens Whop payment modal with both `planId` and `checkoutConfigId`
  4. When payment succeeds, iframe SDK returns payment ID immediately
  5. Frontend calls `/api/credits/process-payment` with payment ID
  6. Backend verifies payment with Whop API and processes immediately:
     - Grants unlimited access to customer
     - Records commission for admin
     - All processing happens synchronously without webhook dependency
  7. Webhook endpoint `/api/webhooks/payment` still exists as a backup but is not required
  8. Legacy `/api/credits/purchase` endpoint disabled when Whop enabled (dev mode only)

**Admin Dashboard & Commission Tracking**: The application includes a comprehensive admin dashboard for company owners:
- **Admin Detection**: Uses Whop's `users.checkAccess(companyId, { id: userId })` API to verify if the user has admin-level access to the company. The companyId is automatically extracted from the URL path (`/companies/:companyId/...`) when the app is loaded as a Whop dashboard app. This approach uses standard permissions and follows Whop's recommended authentication patterns.
- **Multi-Tenant Admin Authorization** (Updated November 21, 2025):
  - Admin checks are now properly scoped to specific companies/experiences
  - When a user who is admin of Company A views Company B (where they're just a member), they will NOT see admin controls
  - Storage method `isAdminForCompany(userId, companyId)` validates admin status for the specific company being viewed
  - JWT tokens provide `companyId` and `experienceId` context, which the frontend passes to `/api/admin/check`
  - Backend validates admin rights against the specific company using both Whop's access check and local storage verification
- **Multi-Tenant Subscription Tracking** (Updated December 11, 2025):
  - All members subscribe to the product owner's plan (WHOP_COMPANY_ID) but are attributed to specific admins
  - StoredMember records are the source of truth for admin-member relationships
  - Checkout config captures `referring_admin_user_id` in metadata with multiple fallback methods:
    1. JWT company context from verifyWhopToken
    2. Experience ID resolution to company
    3. Direct stored member lookup by userId
    4. Explicit admin context from request body
  - Members are ALWAYS stored (with `pending_attribution` when admin unknown) for future reconciliation
  - Dashboard fetches memberships from WHOP_COMPANY_ID and filters to show only admin's stored members
  - Direct `getStoredMemberByUserId()` lookup enables scalable O(1) attribution
- **Automatic Routing**: Company admins are redirected to `/admin` dashboard when accessing the app, regular customers go to `/chat` page
- **Commission Tracking**: 50/50 revenue split is automatically calculated when members make payments
- **Webhook Integration**: Listens to Whop's `payment.succeeded` webhook events to track commissions in real-time
- **Dashboard Features**:
  - Total earned (lifetime commission earnings from local database)
  - Pending balance
  - Payment count
  - Detailed commission history with customer information
  - Member list showing only the admin's own referred subscribers
- **Storage**: Uses MongoDB for commission data and stored member tracking
- **Note**: The dashboard displays simulated commission earnings tracked in your local database from webhook events, not real Whop account balance

**Webhook Setup (OPTIONAL - Backup Only)**:
The system now processes payments directly when they complete, WITHOUT requiring webhooks. However, you can still set up webhooks as a backup:

1. Go to Whop Dashboard → Developer → Webhooks
2. Add a new webhook endpoint: `https://your-replit-url.replit.app/api/webhooks/payment`
3. Subscribe to the `payment.succeeded` event
4. The webhook serves as a backup and will:
   - Grant unlimited access to the customer if not already granted
   - Detect recurring monthly payments
   - Calculate 50/50 commission split ($2.50 from $5.00 subscription)
   - Add commission to admin's balance if not already recorded
   - Use idempotency checks to avoid duplicate processing

**NEW**: Payments are now processed immediately when completed through the iframe SDK, so webhooks are NOT required for the system to work. Access and commissions are granted instantly without waiting for webhook delivery.

**No Authentication (Standalone Mode)**: When not running in Whop, the app works as a frictionless experience - users can immediately start chatting without login, signup, or any barriers to entry. Each WebSocket connection represents an independent session.

**Scalability Considerations**: While currently using in-memory storage, the architecture with Drizzle ORM and session store infrastructure allows for straightforward migration to persistent database storage when needed for features like prediction history or multi-session support.