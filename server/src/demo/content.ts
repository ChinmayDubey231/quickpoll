import type { PollType } from '../types/models.js';

// Hand-written demo content. generate.ts turns these specs into concrete
// users, polls, votes, comments and reactions with a seeded PRNG, so the
// data is identical on every seed apart from being anchored to "now".

export const DEMO_PASSWORD = 'password123';

export const DEMO_USERS = [
  { key: 'alice', name: 'Alice Johnson', email: 'alice@example.com' },
  { key: 'bob', name: 'Bob Smith', email: 'bob@example.com' },
  { key: 'carol', name: 'Carol Davis', email: 'carol@example.com' },
  { key: 'priya', name: 'Priya Sharma', email: 'priya@example.com' },
  { key: 'marcus', name: 'Marcus Lee', email: 'marcus@example.com' },
] as const;

export type DemoUserKey = (typeof DEMO_USERS)[number]['key'];

export type DemoStatus =
  | { kind: 'open'; expiresInHours?: number } // still live, optionally with a deadline
  | { kind: 'closed'; afterHours: number } // closed manually by the creator
  | { kind: 'expired'; afterHours: number }; // auto-closed when expiresAt passed

export interface DemoPollSpec {
  creator: DemoUserKey;
  question: string;
  options: string[];
  pollType: PollType;
  isPublic: boolean;
  createdHoursAgo: number;
  status: DemoStatus;
  // Most votes land within this many hours of creation (burst, then decay)
  activityHours: number;
  votes: number;
  // single: relative share per option
  // multi:  probability (0–1) that a voter ticks each option
  // ranked: relative popularity, sampled Plackett–Luce style
  weights: number[];
  // ranked only — voter blocs with a shared preference order; overrides weights
  blocs?: { share: number; ranking: number[] }[];
  comments?: [author: string, body: string][];
  // Counts in REACTION_EMOJIS order: 👍 🎉 🤔 ❤️ 😂
  reactions?: number[];
}

export const DEMO_POLLS: DemoPollSpec[] = [
  // ─── Alice ──────────────────────────────────────────────────────────────────
  {
    creator: 'alice',
    question: "What's your go-to stack for a new side project?",
    options: [
      'Next.js + Postgres + Prisma',
      'Remix + SQLite + Drizzle',
      'SvelteKit + Supabase',
      'Nuxt + MongoDB',
      'Rails 8 or Laravel — boring and fast',
    ],
    pollType: 'single',
    isPublic: true,
    createdHoursAgo: 26,
    status: { kind: 'open' },
    activityHours: 20,
    votes: 86,
    weights: [34, 14, 18, 8, 12],
    comments: [
      ['devrel_max', 'Next.js + Postgres + Prisma is basically the default now, hard to argue with the DX.'],
      ['sqlite_fan', 'Remix + SQLite + Drizzle is criminally underrated for side projects that never need to scale.'],
      ['quiet_coder', "Surprised Nuxt + Mongo is this far behind, I've had a great time with that combo."],
      ['rails_is_back', 'Rails 8 with Solid Queue means zero extra infra. One box, one deploy, done.'],
      ['indie_hacker', 'Whatever lets me ship this weekend. Usually that means the stack I used last time.'],
    ],
    reactions: [21, 6, 9, 11, 4],
  },
  {
    creator: 'alice',
    question: 'Which feature should we build next for QuickPoll? Rank them.',
    options: [
      'Poll templates',
      'Slack integration',
      'Image options',
      'Anonymous-results mode',
      'PDF export of results',
    ],
    pollType: 'ranked',
    isPublic: true,
    createdHoursAgo: 18,
    status: { kind: 'open', expiresInHours: 30 },
    activityHours: 14,
    votes: 54,
    weights: [30, 24, 12, 18, 8],
    comments: [
      ['pm_jordan', 'Slack integration would get this in front of my whole team overnight.'],
      ['teacher_kim', "Templates please! I run the same five classroom polls every week."],
      ['privacy_first', 'Anonymous-results mode is a must for sensitive team retros.'],
    ],
    reactions: [14, 8, 3, 7, 1],
  },
  {
    creator: 'alice',
    question: 'How do you handle auth in production apps?',
    options: [
      'Roll my own JWT + refresh tokens',
      'Auth.js / NextAuth',
      'Clerk or Auth0',
      'Supabase / Firebase Auth',
    ],
    pollType: 'single',
    isPublic: false,
    createdHoursAgo: 14,
    status: { kind: 'open', expiresInHours: 10 },
    activityHours: 10,
    votes: 48,
    weights: [9, 13, 16, 10],
    comments: [
      ['jwt_hater', 'Rolling your own JWT flow is fun until you hit refresh-token rotation edge cases at 2am.'],
      ['clerk_stan', 'Switched to Clerk last quarter and never looked back, worth the cost for us.'],
      ['fbase_dev', 'Supabase auth + RLS has been solid for our multi-tenant app.'],
      ['authjs_user', 'Auth.js covers 90% of what most apps need out of the box.'],
    ],
    reactions: [8, 1, 6, 2, 3],
  },
  {
    creator: 'alice',
    question: 'When does a microservices architecture actually make sense?',
    options: [
      'Team size > 10 engineers',
      'Independent scaling requirements',
      'Almost never — monolith first',
      'Different language needs per service',
    ],
    pollType: 'single',
    isPublic: true,
    createdHoursAgo: 144,
    status: { kind: 'closed', afterHours: 48 },
    activityHours: 30,
    votes: 63,
    weights: [12, 15, 29, 7],
    comments: [
      ['monolith_maxi', "Majestic monolith gang. Split when it hurts, not before."],
      ['k8s_survivor', "We split into 40 services with 12 engineers. Please learn from our mistakes."],
      ['arch_review', 'Independent scaling is the only reason that has held up for us long-term.'],
    ],
    reactions: [17, 2, 12, 4, 9],
  },
  {
    creator: 'alice',
    question: 'Friday team lunch — where are we going?',
    options: ['Tacos', 'Ramen', 'Thai'],
    pollType: 'single',
    isPublic: false,
    createdHoursAgo: 50,
    status: { kind: 'expired', afterHours: 4 },
    activityHours: 4,
    votes: 12,
    weights: [5, 4, 3],
    comments: [
      ['sam', 'Tacos two weeks in a row? I respect it.'],
      ['lee', 'Ramen place has a 40 min wait on Fridays fyi'],
    ],
    reactions: [4, 3, 0, 2, 1],
  },

  // ─── Bob ────────────────────────────────────────────────────────────────────
  {
    creator: 'bob',
    question: 'Biggest bottleneck in your current dev workflow?',
    options: [
      'Slow CI/CD pipelines',
      'Flaky end-to-end tests',
      'PR review turnaround',
      'Local environment setup',
      'Unclear requirements',
    ],
    pollType: 'single',
    isPublic: true,
    createdHoursAgo: 40,
    status: { kind: 'open' },
    activityHours: 24,
    votes: 72,
    weights: [18, 14, 16, 6, 18],
    comments: [
      ['ci_frustrated', "Our pipeline takes 22 minutes end to end, it's brutal for iteration speed."],
      ['flaky_no_more', 'Flaky E2E tests are the actual reason our team stopped trusting the test suite.'],
      ['review_queue', 'PR review turnaround is the real bottleneck here, not the tooling.'],
      ['staff_eng_ana', 'Unclear requirements tying with CI is the most honest result on this site.'],
    ],
    reactions: [19, 3, 7, 5, 12],
  },
  {
    creator: 'bob',
    question: 'Which testing strategy gives you the best ROI?',
    options: [
      'Mostly unit tests',
      'Mostly integration tests',
      'Mostly E2E tests',
      'Balanced pyramid',
    ],
    pollType: 'single',
    isPublic: false,
    createdHoursAgo: 20,
    status: { kind: 'open', expiresInHours: 5 },
    activityHours: 16,
    votes: 57,
    weights: [8, 17, 6, 26],
    comments: [
      ['pyramid_believer', 'Balanced pyramid every time — heavy unit coverage, a handful of integration, light E2E.'],
      ['testing_trophy', 'Integration-heavy "testing trophy" has caught far more real bugs for us than unit tests.'],
      ['e2e_only_guy', 'Controversial but we ship fast with mostly E2E and thin unit coverage.'],
    ],
    reactions: [10, 1, 8, 3, 2],
  },
  {
    creator: 'bob',
    question: 'Which observability tools does your team run in production? (pick all that apply)',
    options: [
      'Datadog',
      'Grafana + Prometheus',
      'Sentry',
      'New Relic',
      'OpenTelemetry',
      'Honeycomb',
    ],
    pollType: 'multi',
    isPublic: true,
    createdHoursAgo: 30,
    status: { kind: 'open' },
    activityHours: 18,
    votes: 44,
    weights: [0.35, 0.55, 0.7, 0.15, 0.45, 0.12],
    comments: [
      ['sre_nadia', 'Sentry for errors + Grafana for everything else is the budget-friendly sweet spot.'],
      ['otel_convert', "Instrument with OpenTelemetry and you can swap vendors later without touching app code."],
      ['dd_bill_shock', 'Datadog is amazing until the invoice arrives.'],
    ],
    reactions: [12, 2, 3, 6, 8],
  },
  {
    creator: 'bob',
    question: "What's your preferred approach to state management in React?",
    options: [
      'useState + useContext',
      'Redux Toolkit',
      'Zustand',
      'Jotai',
      'TanStack Query + minimal client state',
    ],
    pollType: 'single',
    isPublic: true,
    createdHoursAgo: 192,
    status: { kind: 'closed', afterHours: 72 },
    activityHours: 36,
    votes: 91,
    weights: [18, 11, 24, 7, 31],
    comments: [
      ['server_state', 'Most "state management" is server cache. TanStack Query deleted half our Redux.'],
      ['zustand_fan', 'Zustand is what Redux should have been. Tiny API, no boilerplate.'],
      ['rtk_defender', 'Redux Toolkit is genuinely good now, the hate is stuck in 2018.'],
    ],
    reactions: [24, 5, 6, 9, 3],
  },
  {
    creator: 'bob',
    question: "Rank the platforms you'd trust with a production deploy",
    options: ['AWS', 'Vercel', 'Fly.io', 'Render', 'Railway'],
    pollType: 'ranked',
    isPublic: true,
    createdHoursAgo: 96,
    status: { kind: 'expired', afterHours: 48 },
    activityHours: 30,
    votes: 40,
    weights: [30, 26, 14, 18, 12],
    comments: [
      ['cloud_architect', 'AWS for anything with compliance requirements, everything else is a convenience layer.'],
      ['frontend_sam', 'Vercel for the frontend, Render for the API — best of both.'],
    ],
    reactions: [9, 4, 5, 2, 1],
  },

  // ─── Carol ──────────────────────────────────────────────────────────────────
  {
    creator: 'carol',
    question: 'How do you version public APIs?',
    options: [
      'URL versioning (/v1, /v2)',
      'Header versioning',
      'Query param versioning',
      "We don't — additive changes only",
    ],
    pollType: 'single',
    isPublic: false,
    createdHoursAgo: 10,
    status: { kind: 'open' },
    activityHours: 8,
    votes: 33,
    weights: [20, 7, 2, 9],
    comments: [
      ['url_versioner', "URL versioning is ugly but it's the easiest for consumers to reason about."],
      ['header_purist', "Header versioning keeps URLs clean, just needs good docs so clients don't miss it."],
    ],
    reactions: [6, 0, 4, 1, 1],
  },
  {
    creator: 'carol',
    question: "What's your go-to tool for API documentation?",
    options: ['Swagger / OpenAPI', 'Postman', 'Readme.io', 'Just good inline comments'],
    pollType: 'single',
    isPublic: false,
    createdHoursAgo: 120,
    status: { kind: 'closed', afterHours: 36 },
    activityHours: 24,
    votes: 46,
    weights: [22, 12, 5, 7],
    comments: [
      ['openapi_first', 'Spec-first with OpenAPI and generate the clients. Never going back.'],
      ['docs_writer', '"Just good inline comments" is how you end up with no docs at all.'],
    ],
    reactions: [11, 1, 2, 3, 5],
  },
  {
    creator: 'carol',
    question: 'Which frontend frameworks do you use regularly? (pick all that apply)',
    options: ['React', 'Vue', 'Svelte', 'Angular', 'Solid', 'HTMX'],
    pollType: 'multi',
    isPublic: true,
    createdHoursAgo: 22,
    status: { kind: 'open' },
    activityHours: 16,
    votes: 64,
    weights: [0.82, 0.3, 0.24, 0.18, 0.08, 0.14],
    comments: [
      ['react_all_day', 'React everywhere, but I keep a Svelte project on the side for fun.'],
      ['vue_team_lead', 'Vue at work, React for personal projects — best of both worlds honestly.'],
      ['htmx_enjoyer', 'HTMX for internal tools has been a breath of fresh air. No build step!'],
      ['framework_agnostic', 'Used all of these professionally at some point, they all get the job done.'],
    ],
    reactions: [16, 4, 3, 10, 6],
  },
  {
    // Designed so the first-round leader (Pineapple) loses the instant runoff:
    // a big pineapple bloc, but everyone else ranks it dead last.
    creator: 'carol',
    question: 'Rank your favorite pizza toppings 🍕',
    options: ['Pepperoni', 'Margherita', 'Mushroom', 'Pineapple', 'BBQ chicken'],
    pollType: 'ranked',
    isPublic: true,
    createdHoursAgo: 12,
    status: { kind: 'open' },
    activityHours: 10,
    votes: 50,
    weights: [1, 1, 1, 1, 1],
    blocs: [
      { share: 0.34, ranking: [3, 4, 0, 1, 2] },
      { share: 0.3, ranking: [0, 1, 2, 4, 3] },
      { share: 0.2, ranking: [1, 0, 2, 4, 3] },
      { share: 0.1, ranking: [2, 1, 0, 4, 3] },
      { share: 0.06, ranking: [4, 0, 3, 1, 2] },
    ],
    comments: [
      ['pineapple_defender', 'Pineapple on pizza is not a crime, fight me.'],
      ['purist_pepperoni', 'Pepperoni is undefeated, always has been.'],
      ['irv_nerd', 'Love that pineapple leads round 1 and still loses — this is exactly why ranked choice exists.'],
      ['olive_enjoyer', 'No olives option?? Rigged.'],
    ],
    reactions: [13, 9, 5, 8, 22],
  },

  // ─── Priya ──────────────────────────────────────────────────────────────────
  {
    creator: 'priya',
    question: 'Dark mode or light mode for coding?',
    options: ['Dark, always', 'Light, always', 'Follows the system setting', 'Switches by time of day'],
    pollType: 'single',
    isPublic: true,
    createdHoursAgo: 3,
    status: { kind: 'open' },
    activityHours: 3,
    votes: 38,
    weights: [22, 4, 9, 3],
    comments: [
      ['night_owl', 'Light mode at 2am should be illegal.'],
      ['light_mode_lou', 'Light mode with a good theme is easier on my eyes in a bright office. Downvote me.'],
    ],
    reactions: [9, 2, 1, 5, 11],
  },
  {
    creator: 'priya',
    question: 'What should our next team offsite be?',
    options: ['Hiking trip', 'Escape room', 'Cooking class', 'Board game café', 'Karaoke night'],
    pollType: 'ranked',
    isPublic: false,
    createdHoursAgo: 6,
    status: { kind: 'open', expiresInHours: 48 },
    activityHours: 6,
    votes: 14,
    weights: [16, 22, 18, 12, 9],
    comments: [
      ['design_dan', 'Escape room! Last one was the most fun we had all year.'],
      ['ops_olivia', 'Cooking class means we also get dinner. Efficiency.'],
    ],
    reactions: [5, 4, 0, 3, 2],
  },
  {
    creator: 'priya',
    question: 'Which design tools are part of your daily workflow? (pick all that apply)',
    options: ['Figma', 'Framer', 'Sketch', 'Penpot', 'Adobe XD'],
    pollType: 'multi',
    isPublic: true,
    createdHoursAgo: 168,
    status: { kind: 'closed', afterHours: 60 },
    activityHours: 30,
    votes: 39,
    weights: [0.92, 0.28, 0.12, 0.15, 0.05],
    comments: [
      ['ux_mira', 'Figma for everything, Framer when a prototype needs to feel real.'],
      ['oss_designer', 'Penpot has come a long way — worth a look if you want open source.'],
    ],
    reactions: [8, 1, 1, 4, 0],
  },

  // ─── Marcus ─────────────────────────────────────────────────────────────────
  {
    creator: 'marcus',
    question: 'How many hours of focused deep work do you get per day?',
    options: ['Less than 1 hour', '1–2 hours', '2–4 hours', '4+ hours'],
    pollType: 'single',
    isPublic: true,
    createdHoursAgo: 34,
    status: { kind: 'open', expiresInHours: 72 },
    activityHours: 24,
    votes: 58,
    weights: [14, 24, 15, 5],
    comments: [
      ['maker_schedule', 'Blocking 9–12 with no meetings took me from 1 hour to 3. Try it.'],
      ['manager_mode', 'As a manager, "less than 1 hour" and I have made peace with it.'],
      ['async_advocate', 'Async standups gave our whole team an extra hour a day.'],
    ],
    reactions: [15, 2, 6, 7, 3],
  },
  {
    creator: 'marcus',
    question: 'Tabs or spaces?',
    options: ['Tabs', 'Spaces', 'Whatever the formatter says'],
    pollType: 'single',
    isPublic: true,
    createdHoursAgo: 1,
    status: { kind: 'open' },
    activityHours: 1,
    votes: 9,
    weights: [2, 3, 4],
    comments: [['prettier_bot', 'The correct answer is option 3 and it is not close.']],
    reactions: [2, 0, 0, 1, 4],
  },
  {
    // Brand-new poll with no activity yet — shows the empty states
    creator: 'marcus',
    question: 'Best format for our internal tech talks?',
    options: ['30-min deep dive', '5-min lightning talks', 'Live coding session', 'Panel Q&A'],
    pollType: 'single',
    isPublic: false,
    createdHoursAgo: 0.25,
    status: { kind: 'open', expiresInHours: 24 },
    activityHours: 1,
    votes: 0,
    weights: [1, 1, 1, 1],
  },
];
