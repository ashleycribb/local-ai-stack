import type { NextApiRequest, NextApiResponse } from 'next';
import { getIndexingStatus, IndexingStatus } from '../../../lib/indexingService';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<IndexingStatus | { error: string }>
) {
  if (req.method === 'GET') {
    try {
      const status = getIndexingStatus();
      res.status(200).json(status);
    } catch (error: any) {
      console.error("Error getting indexing status:", error);
      res.status(500).json({ error: "Failed to retrieve indexing status." });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
