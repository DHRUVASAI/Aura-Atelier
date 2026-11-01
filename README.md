# Aura Atelier — 3D Event & Spatial Planning Studio

**Aura Atelier** is a smart, dynamic event production, 3D spatial seating, WebXR augmented reality floor-plan validator, `@react-three/cannon` physics-driven venue studio, Indian Rupee (`₹`) financial orchestrator, and biochemical safety assistant designed for **weddings, milestone birthdays, and civic community celebrations**.

---

## 1. Chosen Vertical & Persona

- **Challenge Vertical**: Smart, Dynamic Event & Hospitality Planning Assistant
- **Primary Personas**:
  1. **Host Couples & Wedding Producers** (*Sample Demo: Aarav & Diya — Udaipur Courtyard Wedding*): Coordinating multi-vendor contracts, 3D banquet floor sightlines, escrow disbursements, and guest dietary safety under a `₹45,00,000` production cap.
  2. **Custom Event Creators (100% User-Driven Studio)**: Planners and individuals building their own wedding, birthday gala, or community festival from scratch—setting their own event name, date, `₹` Rupee budget, indoor/outdoor 3D venue mode, lighting atmosphere, table arrangement, colors, and custom ledger items.

---

## 2. Approach & Context-Aware Decision Logic

Aura Atelier combines **deterministic domain algorithms** (`src/utils/planningLogic.ts`) with **conversational natural-language scene & financial orchestration** (`server.ts`) so that every recommendation and 3D scene state adapts dynamically to the user's live context:

1. **Dual-Mode 3D Venue Control (Chat + Direct Physics Manipulation)**:
   - Users can modify the 3D venue either **by typing natural language commands in the chat assistant** (e.g., *"Switch to outdoor garden in U-shape layout with emerald green tablecloth and Midnight Gala lighting"*) OR **by manually dragging tables on the 3D floor / selecting options in the clean 4-tab studio dock**.
2. **Real-Time Physics & Collision Detection (`@react-three/cannon`)**:
   - Integrates a rigid-body physics world with gravity (`-9.81 m/s²`), a static floor plane, perimeter boundary walls, and cylindrical table colliders so tables drop naturally onto the floor and resolve table-to-table collisions realistically when dragged or rearranged.
3. **WebXR Augmented Reality Space Validation (`AR Space Projection`)**:
   - Projects the current 3D floor plan at 1:12 architectural scale into the user's physical environment via WebXR (`immersive-ar`) or an interactive live camera / spatial grid projection fallback with a real-time clearance badge (`Clearance Verified · 1.8m Aisles`).
4. **Lighting Atmosphere Switcher & Light Intensity Controls**:
   - Allows toggling between **Sunset Warmth**, **Midnight Gala**, and **Daylight Crisp** lighting environments with fine-grained **Light Intensity Controls** (`40%`–`200%` slider, `-15%`/`+15%` step buttons, and `Soft 65%`, `Balanced 100%`, `Radiant 150%` quick presets).
5. **Share Seating — Unique Guest QR Passes & Mobile Venue Zone Map**:
   - Generates a unique deterministic **21×21 QR Code Pass** (`buildGuestSeatingPass` & `generateQrMatrix`) and verification code for every guest. When scanned or opened on mobile (`?seatingPass=<guestId>`), it displays the guest's assigned table, architectural zone, dietary note, and an interactive **Mobile Venue Zone Map** highlighting their table.
6. **Dynamic Event Readiness & Next-Step Engine (`evaluateEventReadiness`)**:
   - Continuously inspects the active event's **department budget variance in `₹`**, **unassigned confirmed RSVP headcount**, **open vendor negotiations**, and **non-standard guest dietary declarations**.
7. **Algorithmic `₹` Rupee Budget Reallocation (`optimizeBudgetAllocation`)**:
   - Automatically identifies overspent line items, covers 100% of the active deficit plus a 10% safety buffer, and reclaims 18% of unspent slack from `flexible` and `elevated` categories having `>25%` unspent headroom.

---

## 3. How the Solution Works

### A. Interactive 3D Block & Scroll-Animated Landing Page (`src/components/LandingPage.tsx`)
- Features an interactive **3D Isometric Venue Block Stage** that tilts in 3D space with cursor movement and lets users preview **Outdoor**, **Indoor**, and **Glasshouse** blocks, table formations (`Radial`, `U-Shape`, `Columns`), and linen colors right in the hero section.
- Includes a **Custom Event Creator Studio** so users can launch their own event from scratch with a blank or starter ledger in **Indian Rupees (`₹`)**, plus a one-click launcher for the single **Sample Demo Event (`₹45,00,000`)**.

### B. 3D Venue, Physics, WebXR AR & Lighting Studio (`src/components/VenueScene3D.tsx`)
- Supports **3 Architectural Venue Modes** (*Outdoor Starlit Garden*, *Indoor Grand Ballroom*, *Glasshouse Conservatory*), **3 Lighting Atmospheres** (*Sunset Warmth*, *Midnight Gala*, *Daylight Crisp*) with **Light Intensity Controls**, **Physics-Driven Table Dragging & Auto-Formations**, **WebXR AR Floor Plan Projection**, and **Custom Color Pickers** inside a clean 4-tab bottom dock.

### C. Guest RSVP Portal & Share Seating QR Passes (`src/components/SeatingAndRsvpModal.tsx`)
- Manages guest RSVPs, dietary requirements, capacity-validated table assignments, and **Share Seating QR Passes** with downloadable SVG passes, shareable deep links, and a **Mobile Venue Zone Map** preview.

### D. Smart `₹` Rupee Budget Tracker & Escrow Payment Gateway (`src/components/BudgetAndPaymentsView.tsx`)
- Tracks allocated vs. actual spend in **Indian Rupees (`₹`)** (`en-IN` formatting), allows editing the master budget cap, adding/editing/deleting any budget line item, rebalancing allocations, and authorizing vendor disbursements via `Escrow Wire` (1.5% fee), `Direct Bank Transfer`, or `Corporate Card`.

### E. Automated Vendor Negotiation & Decor Mood Boards (`src/components/VendorsAndThemesView.tsx`)
- Users can add their own custom vendors in `₹`, generate anchoring counter-offers (`~6%` below target cap) with leverage talking points, track vendor checklists, and synthesize custom `1K`, `2K`, and `4K` decor mood boards.

### F. Bioscience Allergen Scout & Google Workspace Sync (`src/components/BioscienceAndWorkspaceView.tsx`)
- Queries the live **NCBI PubChem PUG-REST API** for botanical terpenes and culinary compounds (*Linalool*, *Vanillin*, *Capsaicin*, *Histamine*, *Caffeine*), rendering 2D skeletal chemical structures and GHS allergen advisories.
- Integrates **Firebase Google OAuth** to synchronize **Gmail**, **Google Calendar**, **Google Docs**, **Google Tasks**, and **Google Keep**, protected by an explicit **User Confirmation Dialog** before any mutating Workspace action.

---

## 4. Assumptions Made

1. **Single Sample + Full User Creation**: Only one sample event (*Aarav & Diya — Udaipur Courtyard Wedding*) is pre-loaded so reviewers can immediately test editing an existing plan, while the Custom Event Creator leaves all new event parameters, budgets, and items completely in the user's hands.
2. **Zero-Config Netlify & Full-Stack Compatibility**: Includes `netlify.toml` and `public/_redirects` for instant static SPA deployment on **Netlify** (with full client-side fallbacks for chat, negotiation, mood boards, and direct NCBI PubChem REST queries), while also supporting full-stack Express execution via `npm start`.
3. **Clean Plain-Text Conversational Output**: All chat replies are sanitized through `formatCleanChatReply` so markdown asterisks (`***` or `**`) never clutter the user interface.

---

## 5. Local Development, Testing & Vercel / Netlify Deployment

```bash
npm install
npm test
npm run build
npm run dev
```

### Deploy Live on Vercel (Recommended)
1. **Push to GitHub**: Push this repository to a public single-branch (`main`) GitHub repository.
2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and click **Import** next to your GitHub repository.
   - Vercel automatically reads `vercel.json`:
     - **Framework Preset**: `Vite`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`
     - **Serverless API Routes**: `/api/*` automatically mounts `api/index.ts` (`server.ts`).
   - *(Optional)* Under **Environment Variables**, add `GEMINI_API_KEY` if you want live server-side AI generation in addition to the built-in smart fallbacks.
   - Click **Deploy**. Your live URL and all Guest QR Seating Pass deep links (`/?seatingPass=...`) will work immediately.
3. **Or Deploy via Vercel CLI**:
   ```bash
   npx vercel --prod
   ```

### Deploy Live on Netlify
- Connect your public GitHub repository to Netlify. Netlify automatically detects `netlify.toml` (`build command: npm run build`, `publish directory: dist`) and `public/_redirects` to serve SPA routes and QR seating pass links (`/?seatingPass=...`) seamlessly.

