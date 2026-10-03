export type PollType = 'single' | 'multi' | 'ranked';

export interface OptionDTO {
  text: string;
}

export interface OptionCountDTO {
  optionIndex: number;
  count: number;
}

export interface IrvRoundTallyDTO {
  optionIndex: number;
  votes: number;
}

export interface IrvRoundDTO {
  round: number;
  tallies: IrvRoundTallyDTO[];
  eliminated: number | null;
}

export interface IrvResultDTO {
  winnerIndex: number | null;
  rounds: IrvRoundDTO[];
}

export interface PollDTO {
  _id: string;
  creatorId: string;
  question: string;
  options: OptionDTO[];
  pollType: PollType;
  isPublic: boolean;
  expiresAt: string | null;
  isOpen: boolean;
  totalVotesCache: number;
  finalResult: IrvResultDTO | null;
  createdAt: string;
  updatedAt: string;
  counts?: OptionCountDTO[];
  totalVotes?: number;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
}

export interface CommentDTO {
  _id: string;
  pollId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ReactionCountDTO {
  emoji: string;
  count: number;
}

export interface ReactionsResponseDTO {
  pollId: string;
  reactions: ReactionCountDTO[];
  // Emojis the requester has reacted with (only on GET)
  mine?: string[];
}

// One 15-minute window that received votes (empty windows are left out)
export interface AnalyticsTimelinePointDTO {
  // Start of the window, ISO timestamp
  time: string;
  // Ballots cast in the window
  votes: number;
  // Per option: every pick on multi-select, first preference on ranked
  byOption: number[];
}

export interface AnalyticsDTO {
  totalVotes: number;
  uniqueVoters: number;
  timeline: AnalyticsTimelinePointDTO[];
  irv: IrvResultDTO | null;
}

export interface DiscoverResponseDTO {
  polls: PollDTO[];
  page: number;
  totalPages: number;
  // Polls matching the search (every live public poll when there's no search)
  totalCount: number;
  // Every live public poll, ignoring the search
  stats: { polls: number; votes: number };
}

export interface CommentsResponseDTO {
  comments: CommentDTO[];
  page: number;
  totalPages: number;
  totalCount: number;
}
