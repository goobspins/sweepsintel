import { useState } from 'react';

import type { SignalItem } from './types';

interface UseSignalVotingOptions {
  setItems: React.Dispatch<React.SetStateAction<SignalItem[]>>;
  onError: (error: Error) => void;
}

export function useSignalVoting({ setItems, onError }: UseSignalVotingOptions) {
  const [pendingVoteId, setPendingVoteId] = useState<number | null>(null);
  const [userVotes, setUserVotes] = useState<Record<number, 'worked' | 'didnt_work'>>({});

  async function vote(signalId: number, voteValue: 'worked' | 'didnt_work') {
    setPendingVoteId(signalId);
    try {
      const response = await fetch(`/api/intel/vote/${signalId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: voteValue }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Unable to vote.');
      }

      setUserVotes((current) => ({ ...current, [signalId]: voteValue }));
      setItems((current) =>
        current.map((item) =>
          item.id === signalId
            ? {
                ...item,
                worked_count: data.worked_count,
                didnt_work_count: data.didnt_work_count,
                signal_status: data.signal_status,
              }
            : item,
        ),
      );
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unable to vote.'));
    } finally {
      setPendingVoteId(null);
    }
  }

  return { vote, pendingVoteId, userVotes };
}
