import type { NextApiRequest, NextApiResponse } from 'next';
import { startIndexing, IndexingState, getIndexingStatus, StartIndexingResult } from '../../../lib/indexingService';

type Data = StartIndexingResult & {
    currentStatus?: IndexingState; // Optionally include current status
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method === 'POST') {
    const result = startIndexing();
    if (result.error) {
      // If already running, it's not a server error, but a user error/conflict.
      // Consider 409 Conflict status code.
      const currentStatusResult = getIndexingStatus();
      if (currentStatusResult.status === IndexingState.RUNNING) {
        res.status(409).json({ error: result.error, currentStatus: currentStatusResult.status });
      } else {
        // Potentially a more generic error if startIndexing fails for other reasons
        res.status(500).json({ error: result.error, currentStatus: currentStatusResult.status });
      }
    } else {
      res.status(200).json({ message: result.message, currentStatus: getIndexingStatus().status });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
