import type { OptionCountDTO, ReactionCountDTO, CommentDTO, IrvResultDTO } from './api';

export interface ServerToClientEvents {
  'vote-update': (payload: { pollId: string; counts: OptionCountDTO[]; totalVotes: number }) => void;
  'poll-closed': (payload: { pollId: string; finalResult?: IrvResultDTO | null }) => void;
  'comment-added': (payload: CommentDTO) => void;
  'reaction-update': (payload: { pollId: string; reactions: ReactionCountDTO[] }) => void;
}

export interface ClientToServerEvents {
  'join-poll': (payload: { pollId: string }) => void;
}
