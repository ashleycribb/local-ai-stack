import type { NextApiRequest, NextApiResponse } from 'next';
import { removeModel } from '../../../lib/ollamaManager';

type Data = {
  message?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method === 'POST') { // Using POST to easily pass modelName in body
    const { modelName } = req.body;

    if (!modelName || typeof modelName !== 'string' || modelName.trim() === '') {
      res.status(400).json({ error: 'Missing or invalid modelName in request body.' });
      return;
    }

    try {
      await removeModel(modelName.trim());
      res.status(200).json({ message: `Successfully removed model: ${modelName}` });
    } catch (error: any) {
      console.error(`API Error removing model ${modelName}:`, error);

      let errorMessage = `Failed to remove model ${modelName}.`;
      if (error.message) {
        errorMessage = error.message;
      }

      if (error.message && error.message.toLowerCase().includes('ollama command not found')) {
        res.status(503).json({ error: 'Ollama service unavailable or not installed.' });
      } else if (error.message && error.message.toLowerCase().includes('not found locally')) {
        res.status(404).json({ error: errorMessage });
      } else {
        res.status(500).json({ error: errorMessage });
      }
    }
  } else {
    res.setHeader('Allow', ['POST']); // Changed from DELETE to POST
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
