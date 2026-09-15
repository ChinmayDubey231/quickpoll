import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import Poll from "./models/Poll.js";
import Vote from "./models/Vote.js";
import redis from "./config/redis.js";

interface VoteSeed {
  pollId: mongoose.Types.ObjectId;
  optionIndex?: number;
  optionIndexes?: number[];
  rankings?: number[];
  voterFingerprint: string | null;
  ip: string;
  createdAt: Date;
}

const shuffled = <T>(arr: T[]): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const randomIp = (prefix: string) =>
  `${prefix}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;

const seed = async () => {
  await connectDB();
  console.log("🌱 Seeding...");

  await Promise.all([User.deleteMany(), Poll.deleteMany(), Vote.deleteMany()]);

  const hashed = await bcrypt.hash("password123", 12);
  const [alice, bob, carol] = await User.insertMany([
    { name: "Alice Johnson", email: "alice@example.com", password: hashed },
    { name: "Bob Smith", email: "bob@example.com", password: hashed },
    { name: "Carol Davis", email: "carol@example.com", password: hashed },
  ]);

  console.log("👤 Created 3 users");

  const now = Date.now();

  const polls = await Poll.insertMany([
    // Alice — Live, no expiry, public (discoverable)
    {
      creatorId: alice._id,
      question: "What is your go-to stack for a new side project in 2025?",
      options: [
        { text: "Next.js + Postgres + Prisma" },
        { text: "Remix + SQLite + Drizzle" },
        { text: "SvelteKit + Supabase" },
        { text: "Nuxt + MongoDB" },
      ],
      pollType: "single",
      isPublic: true,
      isOpen: true,
      expiresAt: null,
    },
    // Alice — Live, expires in 12h
    {
      creatorId: alice._id,
      question: "How do you handle auth in production apps?",
      options: [
        { text: "Roll my own JWT + refresh tokens" },
        { text: "Auth.js / NextAuth" },
        { text: "Clerk or Auth0 (third-party)" },
        { text: "Supabase / Firebase Auth" },
      ],
      pollType: "single",
      isOpen: true,
      expiresAt: new Date(now + 12 * 60 * 60 * 1000),
    },
    // Alice — Closed
    {
      creatorId: alice._id,
      question: "When does a microservices architecture actually make sense?",
      options: [
        { text: "Team size > 10 engineers" },
        { text: "Independent scaling requirements" },
        { text: "Almost never — monolith first" },
        { text: "Different language needs per service" },
      ],
      pollType: "single",
      isOpen: false,
      expiresAt: null,
    },
    // Bob — Live, no expiry, public
    {
      creatorId: bob._id,
      question: "Biggest bottleneck in your current dev workflow?",
      options: [
        { text: "Slow CI/CD pipelines" },
        { text: "Flaky end-to-end tests" },
        { text: "PR review turnaround time" },
        { text: "Local environment setup" },
      ],
      pollType: "single",
      isPublic: true,
      isOpen: true,
      expiresAt: null,
    },
    // Bob — Live, expires in 6h
    {
      creatorId: bob._id,
      question: "Which testing strategy gives you the best ROI?",
      options: [
        { text: "Unit tests only" },
        { text: "Integration tests only" },
        { text: "E2E tests only" },
        { text: "Balanced pyramid (unit + integration + E2E)" },
      ],
      pollType: "single",
      isOpen: true,
      expiresAt: new Date(now + 6 * 60 * 60 * 1000),
    },
    // Bob — Closed
    {
      creatorId: bob._id,
      question: "What's your preferred approach to state management in React?",
      options: [
        { text: "useState + useContext" },
        { text: "Redux Toolkit" },
        { text: "Zustand" },
        { text: "Jotai / Recoil" },
      ],
      pollType: "single",
      isOpen: false,
      expiresAt: null,
    },
    // Carol — Live
    {
      creatorId: carol._id,
      question: "How do you handle API versioning in production?",
      options: [
        { text: "URL versioning (/v1, /v2)" },
        { text: "Header versioning" },
        { text: "Query param versioning" },
        { text: "We don't version — breaking changes only" },
      ],
      pollType: "single",
      isOpen: true,
      expiresAt: null,
    },
    // Carol — Closed
    {
      creatorId: carol._id,
      question: "What's your go-to tool for API documentation?",
      options: [
        { text: "Swagger / OpenAPI" },
        { text: "Postman" },
        { text: "Readme.io" },
        { text: "Just good inline comments" },
      ],
      pollType: "single",
      isOpen: false,
      expiresAt: null,
    },
    // Carol — Live, multi-select, public
    {
      creatorId: carol._id,
      question: "Which frontend frameworks do you use regularly? (pick all that apply)",
      options: [
        { text: "React" },
        { text: "Vue" },
        { text: "Svelte" },
        { text: "Angular" },
      ],
      pollType: "multi",
      isPublic: true,
      isOpen: true,
      expiresAt: null,
    },
    // Carol — Live, ranked-choice, public
    {
      creatorId: carol._id,
      question: "Rank your favorite pizza toppings",
      options: [
        { text: "Pepperoni" },
        { text: "Mushroom" },
        { text: "Pineapple" },
        { text: "Olives" },
      ],
      pollType: "ranked",
      isPublic: true,
      isOpen: true,
      expiresAt: null,
    },
  ]);
  console.log(`📊 Created ${polls.length} polls`);

  // Realistic single-select vote distributions for the first 8 polls
  const distributions = [
    [24, 11, 9, 4],
    [9, 13, 16, 8],
    [8, 10, 20, 5],
    [18, 14, 9, 6],
    [6, 10, 4, 22],
    [12, 8, 18, 5],
    [20, 7, 5, 10],
    [22, 12, 5, 8],
  ];

  const votes: VoteSeed[] = [];

  polls.slice(0, 8).forEach((poll, pi) => {
    distributions[pi].forEach((count, optionIndex) => {
      for (let i = 0; i < count; i++) {
        votes.push({
          pollId: poll._id,
          optionIndex,
          voterFingerprint: null,
          ip: randomIp("192.168"),
          createdAt: new Date(now - Math.random() * 8 * 60 * 60 * 1000),
        });
      }
    });
  });

  // Multi-select poll — each voter picks 1-3 options
  const multiPoll = polls[8];
  for (let i = 0; i < 18; i++) {
    const numChoices = 1 + Math.floor(Math.random() * 3);
    const optionIndexes = shuffled([0, 1, 2, 3]).slice(0, numChoices).sort((a, b) => a - b);
    votes.push({
      pollId: multiPoll._id,
      optionIndexes,
      voterFingerprint: null,
      ip: randomIp("10.0"),
      createdAt: new Date(now - Math.random() * 8 * 60 * 60 * 1000),
    });
  }

  // Ranked-choice poll — each voter submits a full ranking permutation
  const rankedPoll = polls[9];
  for (let i = 0; i < 18; i++) {
    const rankings = shuffled([0, 1, 2, 3]);
    votes.push({
      pollId: rankedPoll._id,
      rankings,
      voterFingerprint: null,
      ip: randomIp("10.1"),
      createdAt: new Date(now - Math.random() * 8 * 60 * 60 * 1000),
    });
  }

  await Vote.insertMany(votes);
  console.log(`🗳️  Created ${votes.length} votes`);

  // Sync Redis counts + ballots counter, and Poll.totalVotesCache
  const pollStats: Record<string, { counts: Record<number, number>; ballots: number }> = {};
  for (const v of votes) {
    const key = v.pollId.toString();
    if (!pollStats[key]) pollStats[key] = { counts: {}, ballots: 0 };
    pollStats[key].ballots += 1;

    if (v.optionIndexes) {
      for (const idx of v.optionIndexes) {
        pollStats[key].counts[idx] = (pollStats[key].counts[idx] || 0) + 1;
      }
    } else {
      const idx = v.optionIndex ?? v.rankings?.[0];
      if (idx !== undefined) {
        pollStats[key].counts[idx] = (pollStats[key].counts[idx] || 0) + 1;
      }
    }
  }

  for (const [pollId, { counts, ballots }] of Object.entries(pollStats)) {
    const countsKey = `poll::${pollId}::counts`;
    const ballotsKey = `poll::${pollId}::ballots`;
    await redis.del(countsKey, ballotsKey);
    for (const [idx, count] of Object.entries(counts)) {
      await redis.hset(countsKey, idx, count);
    }
    await redis.set(ballotsKey, ballots);
    await Poll.updateOne({ _id: pollId }, { $set: { totalVotesCache: ballots } });
  }
  console.log("⚡ Redis synced");

  console.log("\n✅ Done!\n");
  console.log("Credentials (all):  password123");
  console.log("alice@example.com  — 3 polls (2 live, 1 closed)");
  console.log("bob@example.com    — 3 polls (2 live, 1 closed)");
  console.log("carol@example.com  — 4 polls (3 live incl. multi + ranked, 1 closed)");

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
