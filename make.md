# LegalConnect - React Frontend Application

A full-featured React.js platform connecting clients with lawyers. Supports appointment booking, document management, job postings, real-time chat, AI legal advice, and admin management — all backed by Supabase.

---

## Features

### For Clients
- Lawyer search with filters (name, specialization, location)
- Appointment booking with available time slots
- Document upload and management
- Client dashboard (appointments, documents, case progress)
- Real-time chat with lawyers
- Post legal jobs and manage proposals
- Case tracking with milestone/payment visibility
- AI Legal Advisor for instant guidance
- Feedback and ratings for lawyers

### For Lawyers
- Full lawyer suite dashboard (appointments, cases, contracts, billing, analytics)
- Profile and credentials management
- Consultation settings (pricing, availability, cancellation rules)
- Proposal management for client job posts
- Communication portal with clients
- Verification workflow

### For Admins
- Admin overview and settings
- Lawyer and client verification management
- User and job management
- Category management
- Flagged review moderation

### General
- Supabase authentication (email/password, JWT)
- Forgot/reset password flow
- Protected routes by role (client, lawyer, admin)
- Responsive design with Tailwind CSS
- Toast notifications
- Error boundaries
- Legal updates feed

---

## Project Structure

```
LegalConnect/
├── public/
│   ├── index.html
│   ├── favicon.svg
│   └── logo.svg
├── sql/                        # All Supabase SQL migration files
├── src/
│   ├── __tests__/
│   │   └── ProtectedRoute.test.jsx
│   ├── components/
│   │   ├── AdminLayout/
│   │   ├── AdminRoute/
│   │   ├── AIAdvisor/
│   │   ├── Button/
│   │   ├── Card/
│   │   ├── chat/               # ChatWindow, MessageBubble, TypingIndicator
│   │   ├── ClientPortalLayout/
│   │   ├── DashboardLayout/
│   │   ├── ErrorBoundary/
│   │   ├── Footer/
│   │   ├── Header/
│   │   ├── LawyerCard/
│   │   ├── LawyerCaseTracking/
│   │   ├── LawyerConsultationSettings/
│   │   ├── LawyerSuite/
│   │   ├── Layout/
│   │   ├── NotificationBell/
│   │   ├── PasswordStrength/
│   │   ├── ProtectedRoute/
│   │   ├── PublicLayout/
│   │   ├── Sidebar/
│   │   ├── Skeleton/
│   │   ├── StarRating/
│   │   ├── Timeline/
│   │   └── MainLayout.js
│   ├── context/
│   │   ├── AuthContext.js
│   │   └── SocketContext.js
│   ├── hooks/
│   │   ├── useChatSocket.js
│   │   ├── useLawyerProfile.js
│   │   └── useLawyers.js
│   ├── pages/
│   │   ├── Admin/
│   │   ├── AIAdvisor/
│   │   ├── AppointmentBooking/
│   │   ├── Auth/               # Login, Register, ForgotPassword, ResetPassword
│   │   ├── CaseTracking/
│   │   ├── Chat/
│   │   ├── ClientCommunicationPortal/
│   │   ├── ClientMyPosts/
│   │   ├── ClientSettings/
│   │   ├── Contact/
│   │   ├── Dashboard/          # ClientDashboard, LawyerDashboard
│   │   ├── FeedbackRatings/
│   │   ├── Home/
│   │   ├── JobBoard/
│   │   ├── JobDetail/
│   │   ├── LawyerProfile/
│   │   ├── LawyerSearch/
│   │   ├── LawyerSuite/        # Full lawyer management suite
│   │   ├── LegalUpdates/
│   │   ├── PostJob/
│   │   ├── PublicLawyerProfile/
│   │   └── Workspace/
│   ├── services/
│   │   ├── aiAdvisor.service.js
│   │   ├── auth.service.js
│   │   ├── chat.service.js
│   │   ├── payment.service.js
│   │   ├── realtimeSync.service.js
│   │   └── supabase.js
│   ├── utils/
│   │   └── axiosInstance.js
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── .env.example
├── vercel.json
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Copy the environment file and fill in your values:

```bash
cp .env.example .env
```

3. Start the development server:

```bash
npm start
```

The app runs at `http://localhost:3000`.

---

## Environment Variables

Create a `.env` file in the project root (see `.env.example`):

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000
```

---

## Database Setup (Supabase)

All SQL migrations are in the `sql/` folder. Run them in order against your Supabase project using the Supabase SQL editor or CLI:

```bash
# Example using Supabase CLI
supabase db push
```

Key migration files:
- `01_auth_and_users.sql` — user profiles and roles
- `05_cases_and_appointments.sql` — cases and appointments schema
- `06_communication_and_docs.sql` — chat and documents
- `09_rls_policies.sql` — Row Level Security policies
- `31_milestones_payments_commission.sql` — payment and milestone tracking
- `39_job_board_system.sql` — job board and proposals
- `47_review_system_and_rating_calculation.sql` — ratings and reviews

---

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start development server |
| `npm run build` | Build for production |
| `npm test` | Run tests with coverage |

---

## Technologies Used

| Package | Version | Purpose |
|---|---|---|
| react | ^18.2.0 | UI library |
| react-router-dom | ^6.20.0 | Routing |
| @supabase/supabase-js | ^2.104.0 | Backend (auth, DB, storage, realtime) |
| @google/generative-ai | ^0.24.1 | AI Legal Advisor (Gemini) |
| react-hot-toast | ^2.6.0 | Toast notifications |
| tailwindcss | ^3.4.17 | Utility-first CSS |

---

## Deployment (Vercel)

The project includes a `vercel.json` for one-click Vercel deployment:

```bash
vercel --prod
```

- Build command: `CI=false react-scripts build`
- Output directory: `build`
- SPA rewrites: all routes → `index.html`
- Static assets cached for 1 year

---

## Authentication & Authorization

- Supabase Auth handles sign-up, login, and password reset
- JWT tokens stored and managed by Supabase client
- Role-based access: `client`, `lawyer`, `admin`
- `ProtectedRoute` component guards role-specific pages
- `AdminRoute` component guards admin-only pages

---

## Key Services

- `supabase.js` — Supabase client initialization
- `auth.service.js` — login, register, logout, password reset
- `chat.service.js` — fetch/send messages, real-time subscriptions
- `aiAdvisor.service.js` — Gemini AI integration for legal advice
- `payment.service.js` — milestone payments and commission logic
- `realtimeSync.service.js` — Supabase realtime channel management

---

## License

Created for academic/demonstration purposes.
