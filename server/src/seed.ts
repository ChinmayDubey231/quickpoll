import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import Poll from "./models/Poll.js";
import Vote from "./models/Vote.js";
import Comment from "./models/Comment.js";
import Reaction from "./models/Reaction.js";
import { DEMO_PASSWORD, DEMO_USERS, seedDemoData } from "./demo/index.js";

const seed = async () => {
  await connectDB();
  console.log("🌱 Seeding...");

  await Promise.all([
    User.deleteMany(),
    Poll.deleteMany(),
    Vote.deleteMany(),
    Comment.deleteMany(),
    Reaction.deleteMany(),
  ]);

  const summary = await seedDemoData();

  console.log(`👤 ${summary.users} users`);
  console.log(`📊 ${summary.polls} polls`);
  console.log(`🗳️  ${summary.votes} votes`);
  console.log(`💬 ${summary.comments} comments`);
  console.log(`🎉 ${summary.reactions} reactions`);
  console.log("\n✅ Done!\n");
  console.log(`Password for every account: ${DEMO_PASSWORD}`);
  for (const user of DEMO_USERS) console.log(`  ${user.email}`);

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
