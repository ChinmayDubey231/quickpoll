export interface OptionCount {
  optionIndex: number;
  count: number;
}

export interface IrvRoundTally {
  optionIndex: number;
  votes: number;
}

export interface IrvRound {
  round: number;
  tallies: IrvRoundTally[];
  eliminated: number | null;
}

export interface IrvResult {
  winnerIndex: number | null;
  rounds: IrvRound[];
}

export interface ReactionCount {
  emoji: string;
  count: number;
}

export interface CommentDTO {
  _id: string;
  pollId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ServerToClientEvents {
  'vote-update': (payload: { pollId: string; counts: OptionCount[]; totalVotes: number }) => void;
  'poll-closed': (payload: { pollId: string; finalResult?: IrvResult | null }) => void;
  'comment-added': (payload: CommentDTO) => void;
  'reaction-update': (payload: { pollId: string; reactions: ReactionCount[] }) => void;
}

export interface ClientToServerEvents {
  'join-poll': (payload: { pollId: string }) => void;
}
