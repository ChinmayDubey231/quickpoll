// Feature flags — flip to true to activate a dormant feature
export const FEATURES = {
  VOTE_GUARD: true, // one-vote-per-user enforcement (fingerprint + IP)
} as const;

export const REACTION_EMOJIS = ['👍', '🎉', '🤔', '❤️', '😂'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];
