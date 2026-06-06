import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import Poll from "./models/Poll.js";
import Vote from "./models/Vote.js";
import redis from "./config/redis.js";

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
    // Alice — Live, no expiry
    {
      creatorId: alice._id,
      question: "What is your go-to stack for a new side project in 2025?",
      options: [
        { text: "Next.js + Postgres + Prisma" },
        { text: "Remix + SQLite + Drizzle" },
        { text: "SvelteKit + Supabase" },
        { text: "Nuxt + MongoDB" },
      ],
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
      isOpen: false,
      expiresAt: null,
    },
    // Bob — Live, no expiry
    {
      creatorId: bob._id,
      question: "Biggest bottleneck in your current dev workflow?",
      options: [
        { text: "Slow CI/CD pipelines" },
        { text: "Flaky end-to-end tests" },
        { text: "PR review turnaround time" },
        { text: "Local environment setup" },
      ],
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
      isOpen: false,
      expiresAt: null,
    },
  ]);
  console.log(`📊 Created ${polls.length} polls`);

  // Realistic vote distributions
  const distributions = [
    // Poll 0 — stack (Next.js wins)
    [24, 11, 9, 4],
    // Poll 1 — auth (third-party popular)
    [9, 13, 16, 8],
    // Poll 2 — microservices (monolith first wins)
    [8, 10, 20, 5],
    // Poll 3 — bottleneck (CI/CD top)
    [18, 14, 9, 6],
    // Poll 4 — testing (balanced pyramid wins)
    [6, 10, 4, 22],
    // Poll 5 — state management (zustand rising)
    [12, 8, 18, 5],
    // Poll 6 — API versioning (URL versioning popular)
    [20, 7, 5, 10],
    // Poll 7 — API docs (Swagger dominates)
    [22, 12, 5, 8],
  ];

  const makeVote = (pollId, optionIndex, hoursAgo) => ({
    pollId,
    optionIndex,
    voterFingerprint: null,
    ip: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    createdAt: new Date(now - hoursAgo * 60 * 60 * 1000),
  });

  const votes = [];
  polls.forEach((poll, pi) => {
    distributions[pi].forEach((count, optionIndex) => {
      for (let i = 0; i < count; i++) {
        // Spread votes over past 8 hours with some randomness
        const hoursAgo = Math.random() * 8;
        votes.push(makeVote(poll._id, optionIndex, hoursAgo));
      }
    });
  });

  await Vote.insertMany(votes);
  console.log(`🗳️  Created ${votes.length} votes`);

  // Sync Redis
  const pollMap = {};
  for (const v of votes) {
    const key = v.pollId.toString();
    if (!pollMap[key]) pollMap[key] = {};
    pollMap[key][v.optionIndex] = (pollMap[key][v.optionIndex] || 0) + 1;
  }
  for (const [pollId, counts] of Object.entries(pollMap)) {
    const redisKey = `poll::${pollId}::counts`;
    await redis.del(redisKey);
    for (const [idx, count] of Object.entries(counts)) {
      await redis.hset(redisKey, idx, count);
    }
  }
  console.log("⚡ Redis synced");

  console.log("\n✅ Done!\n");
  console.log("Credentials (all):  password123");
  console.log("alice@example.com  — 3 polls (2 live, 1 closed)");
  console.log("bob@example.com    — 3 polls (2 live, 1 closed)");
  console.log("carol@example.com  — 2 polls (1 live, 1 closed)");

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
