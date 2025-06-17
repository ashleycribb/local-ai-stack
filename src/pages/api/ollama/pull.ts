import type { NextApiRequest, NextApiResponse } from 'next';
import { pullModel } from '../../../lib/ollamaManager';

// Helper to format SSE messages
const formatSSEMessage = (event: string, data: any): string => {
  const jsonData = JSON.stringify(data);
  return `event: ${event}\ndata: ${jsonData}\n\n`;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    const { modelName } = req.body;

    if (!modelName || typeof modelName !== 'string') {
      res.status(400).json({ error: 'Missing or invalid modelName in request body.' });
      return;
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering for Nginx
    res.flushHeaders(); // Flush the headers to establish the connection

    const sendProgress = (progressMessage: string, type: 'progress' | 'error' | 'info' = 'progress') => {
      // Try to parse progress if it's JSON-like (Ollama's verbose output)
      // A more sophisticated parsing can be done on the client-side if needed.
      // Example: {"status":"pulling manifest","digest":"sha256:...", "total":12345, "completed":123}
      let dataToLog = progressMessage;
      try {
        // Ollama sometimes sends multiple JSON objects on one line, or non-JSON text.
        // This simple parsing might fail or take the first valid JSON.
        const potentialJson = progressMessage.substring(progressMessage.indexOf('{'));
        const parsed = JSON.parse(potentialJson);
        dataToLog = parsed;
      } catch (e) {
        // Not JSON or malformed, send as plain text
      }
      res.write(formatSSEMessage(type, { message: progressMessage, details: dataToLog }));
    };

    try {
      sendProgress(`Starting pull for model: ${modelName}`, 'info');

      await pullModel(modelName, (progress) => {
        // Ollama's progress messages can be quite verbose.
        // We'll send them as is, client can decide how to display.
        // Distinguish between actual errors and progress messages if possible from context
        if (progress.toLowerCase().includes("error:")) {
            sendProgress(progress, 'error');
        } else {
            sendProgress(progress, 'progress');
        }
      });

      res.write(formatSSEMessage('done', { message: `Successfully pulled model: ${modelName}` }));
      res.end();

    } catch (error: any) {
      console.error(`API Error pulling model ${modelName}:`, error);
      let errorMessage = `Failed to pull model ${modelName}.`;
      if (error.message) {
        errorMessage = error.message;
      }
      // Ensure the stream is closed with an error event if it hasn't been already.
      // The 'error' event might have been sent by onProgress if stderr contained "error"
      // but this catches errors from pullModel itself (e.g. command not found)
      if (!res.writableEnded) {
        res.write(formatSSEMessage('error', { message: errorMessage }));
        res.end();
      }
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
