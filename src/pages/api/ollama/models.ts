import type { NextApiRequest, NextApiResponse } from 'next';
import { listLocalModels, OllamaModel } from '../../../lib/ollamaManager';

type Data = {
  models?: OllamaModel[];
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method === 'GET') {
    try {
      const models = await listLocalModels();
      res.status(200).json({ models });
    } catch (error: any) {
      console.error('API Error fetching local models:', error);
      // Send a more specific error message if available, otherwise generic
      let errorMessage = 'Failed to fetch local models.';
      if (error.message) {
        errorMessage = error.message;
      }
      // Distinguish between Ollama not found and other errors
      if (error.message && error.message.toLowerCase().includes('ollama command not found')) {
        res.status(503).json({ error: 'Ollama service unavailable or not installed.' });
      } else {
        res.status(500).json({ error: errorMessage });
      }
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
