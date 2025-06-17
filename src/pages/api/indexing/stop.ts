import type { NextApiRequest, NextApiResponse } from 'next';
import { stopIndexing, StartIndexingResult, getIndexingStatus, IndexingState } from '../../../lib/indexingService'; // Assuming StartIndexingResult is suitable here

type Data = StartIndexingResult & {
    currentStatus?: IndexingState;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method === 'POST') {
    const result = stopIndexing();
    const currentStatusResult = getIndexingStatus(); // Get status after attempting stop

    if (result.error) {
      // Distinguish if the error is because nothing is running vs. failure to stop
      if (currentStatusResult.status !== IndexingState.RUNNING &&
          (result.error.includes('No indexing process is currently running') || result.error.includes('cannot be stopped'))) {
        res.status(404).json({ error: result.error, currentStatus: currentStatusResult.status });
      } else {
        res.status(500).json({ error: result.error, currentStatus: currentStatusResult.status });
      }
    } else {
      res.status(200).json({ message: result.message, currentStatus: currentStatusResult.status });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
