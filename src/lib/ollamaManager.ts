import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface OllamaModel {
  name: string;
  id: string; // Keeping ID as it's part of the output, might be useful
  size: string;
  modified: string;
  // Potentially add other fields if Ollama output changes or more details are needed
  // e.g., family, format, parameter_size, quantization_level
}

// Expected headers from `ollama list` output
const EXPECTED_HEADERS = ['NAME', 'ID', 'SIZE', 'MODIFIED'];

/**
 * Lists locally available Ollama models.
 * @returns A promise that resolves with an array of OllamaModel objects.
 *          Rejects with an error if the command fails or output parsing fails.
 */
export async function listLocalModels(): Promise<OllamaModel[]> {
  try {
    const { stdout, stderr } = await execAsync('ollama list');

    if (stderr) {
      console.error('Error executing "ollama list":', stderr);
      // Check if the error is because Ollama is not installed or not in PATH
      if (stderr.includes('command not found') || stderr.includes('not recognized')) {
        throw new Error('Ollama command not found. Please ensure Ollama is installed and in your PATH.');
      }
      // For other stderr outputs, throw a generic error or parse stderr for more specific messages
      throw new Error(`Failed to list Ollama models: ${stderr.trim()}`);
    }

    const lines = stdout.trim().split('\n');

    if (lines.length === 0) {
      // This case should ideally not happen if stdout is empty,
      // but as a safeguard if trim results in an empty string.
      return [];
    }

    const headerLine = lines.shift();
    if (!headerLine) {
      // Should be captured by lines.length === 0, but for type safety.
      return [];
    }

    // Validate headers
    const headers = headerLine.trim().split(/\s+/);
    const hasAllExpectedHeaders = EXPECTED_HEADERS.every((expectedHeader, index) => headers[index] === expectedHeader);

    if (!hasAllExpectedHeaders || headers.length < EXPECTED_HEADERS.length) {
      // If no models are installed, Ollama might return just the header or specific messages.
      // Sometimes it returns "no models available" or similar in stdout, or just the headers.
      // If only headers are present, lines will be empty after shift().
      if (lines.length === 0) {
        return []; // No models installed
      }
      console.error('Ollama list output headers are not as expected.', `Expected: "${EXPECTED_HEADERS.join('\t')}"`, `Got: "${headerLine}"`);
      throw new Error('Failed to parse Ollama models: Unexpected output format (headers).');
    }

    if (lines.length === 0) {
        // This means only the header row was present, so no models are installed.
        return [];
    }

    const models: OllamaModel[] = lines.map(line => {
      const parts = line.trim().split(/\s+/);
      // NAME, ID, SIZE, MODIFIED are the first four.
      // If a model name has spaces, `ollama list` doesn't quote it, so this parsing is fragile.
      // However, official model names generally don't have spaces.
      // Assuming model names do not contain spaces for now, matching common Ollama output.
      // A more robust parser might be needed if model names can have spaces.

      // Example line: llama2:7b            707793070832   3.8 GB  2 weeks ago
      // Parts: [llama2:7b, 707793070832, 3.8, GB, 2, weeks, ago]
      // We need to reconstruct size and modified date.

      if (parts.length < 4) {
        console.warn(`Skipping malformed line in "ollama list" output: ${line}`);
        return null; // Will be filtered out
      }

      const name = parts[0];
      const id = parts[1];

      // Reconstruct SIZE: it might be split (e.g., "3.8", "GB")
      let sizeParts = [];
      let modifiedStartIndex = 2; // Default start index for MODIFIED parts

      // Iterate from index 2 to find where "ago" (part of MODIFIED) starts
      // This assumes "ago" is always present in the MODIFIED column.
      let agoIndex = -1;
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].toLowerCase() === 'ago') {
            agoIndex = i;
            break;
        }
      }

      if (agoIndex === -1 && parts.length > 3) { // A simple heuristic if "ago" is not found but enough parts exist
          modifiedStartIndex = parts.length - 2; // Assume last two parts are "X units" e.g. "2 days"
      } else if (agoIndex !== -1) {
          // Try to determine where size ends and modified begins
          // e.g. "3.8 GB 2 weeks ago" -> modified starts at "2"
          // e.g. "10 GB 1 day ago" -> modified starts at "1"
          // e.g. "7 GB 23 hours ago" -> modified starts at "23"
          // The part before "ago" is a unit (days, weeks, hours)
          // The part before that unit is the quantity.
          // So, modified starts 2 positions before "ago"
          modifiedStartIndex = agoIndex - 1;
      }

      // Ensure modifiedStartIndex is valid
      if (modifiedStartIndex < 2 || modifiedStartIndex >= parts.length) {
          // Fallback if logic is confused, grab at least one part for size
          modifiedStartIndex = 3;
          if (modifiedStartIndex >= parts.length) modifiedStartIndex = parts.length -1;
      }


      sizeParts = parts.slice(2, modifiedStartIndex);
      const size = sizeParts.join(' ');

      const modified = parts.slice(modifiedStartIndex).join(' ');

      return { name, id, size, modified };
    }).filter(model => model !== null) as OllamaModel[];

    return models;

  } catch (error: any) {
    console.error('Error in listLocalModels:', error);
    if (error.message.startsWith('Ollama command not found') || error.message.startsWith('Failed to list Ollama models:')) {
        throw error; // Re-throw specific errors
    }
    // Check for ENOENT or similar errors from exec if command itself fails to run
    if (error.code === 'ENOENT' || (error.message && error.message.includes('command not found'))) {
        throw new Error('Ollama command not found. Please ensure Ollama is installed and in your PATH.');
    }
    throw new Error(`An unexpected error occurred while listing Ollama models: ${error.message}`);
  }
}

// Example usage (for testing purposes, remove or comment out in production):
/*
async function testListModels() { // eslint-disable-line @typescript-eslint/no-unused-vars
  try {
    console.log('Listing local Ollama models...');
    const models = await listLocalModels();
    if (models.length === 0) {
      console.log('No models found.');
    } else {
      console.log('Found models:');
      models.forEach(model => {
        console.log(`- Name: ${model.name}, ID: ${model.id}, Size: ${model.size}, Modified: ${model.modified}`);
      });
    }
  } catch (err: any) {
    console.error('Test failed:', err.message);
  }
}
// testListModels(); // Commented out for now
*/

/**
 * Pulls a model using Ollama.
 * @param modelName The name of the model to pull (e.g., "llama2:7b").
 * @param onProgress Optional callback to report progress. Receives progress messages.
 * @returns A promise that resolves when the model is pulled successfully, or rejects on error.
 */
export async function pullModel(
  modelName: string,
  onProgress?: (progress: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!modelName || typeof modelName !== 'string' || modelName.trim() === '') {
      reject(new Error('Model name must be a non-empty string.'));
      return;
    }

    const command = `ollama pull ${modelName.trim()}`;
    const process = exec(command);

    process.stdout?.on('data', (data: Buffer | string) => {
      const message = data.toString();
      if (onProgress) {
        onProgress(message);
      }
      // Ollama's final message upon successful pull is usually something like:
      // "success pulling manifest for <modelName>" or just a new line after progress.
      // We might need a more robust way to detect completion if output varies.
      // For now, we rely on the process exiting with code 0.
    });

    process.stderr?.on('data', (data: Buffer | string) => {
      const message = data.toString();
      // Ollama often sends progress to stderr as well, or actual errors.
      // It's tricky to distinguish progress from errors in Ollama's stderr stream.
      // For example: "pulling manifest", "pulling Digest...", "verifying sha256..."
      // all go to stderr. An actual error might be "Error: repository not found".
      if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
        console.error(`Ollama pull stderr (error indication): ${message}`);
        // We will let the 'exit' event handle the actual rejection based on exit code,
        // but we can log it here. If onProgress is used, it might receive these stderr messages too.
      }
      if (onProgress) {
        onProgress(message); // Send stderr to progress as well, client can filter if needed
      }
    });

    process.on('exit', (code) => {
      if (code === 0) {
        // Check stdout or a known success message if necessary, but exit code 0 is usually good.
        resolve();
      } else {
        // Try to get the last few lines of stderr if possible for a better error message
        // This is tricky as the stream might be closed.
        // For now, a generic message.
        console.error(`Ollama pull process exited with code ${code}.`);
        reject(new Error(`Failed to pull model "${modelName}". Ollama process exited with code ${code}.`));
      }
    });

    process.on('error', (err) => {
      console.error('Failed to start Ollama pull process:', err);
      if ((err as any).code === 'ENOENT') {
        reject(new Error('Ollama command not found. Please ensure Ollama is installed and in your PATH.'));
      } else {
        reject(new Error(`Failed to start Ollama pull process for "${modelName}": ${err.message}`));
      }
    });
  });
}

/**
 * Removes a locally installed Ollama model.
 * @param modelName The name of the model to remove (e.g., "llama2:7b").
 * @returns A promise that resolves when the model is removed successfully, or rejects on error.
 */
export async function removeModel(modelName: string): Promise<void> {
  if (!modelName || typeof modelName !== 'string' || modelName.trim() === '') {
    throw new Error('Model name must be a non-empty string.');
  }

  const command = `ollama rm ${modelName.trim()}`;

  try {
    const { stdout, stderr } = await execAsync(command);

    // `ollama rm` is typically silent on success or prints "deleted <modelName>"
    // If stderr has content, it's usually an error (e.g., model not found)
    if (stderr) {
      // Example stderr for model not found: "Error: model '...' not found"
      if (stderr.toLowerCase().includes('not found')) {
        throw new Error(`Model "${modelName}" not found locally.`);
      }
      console.error(`Ollama rm stderr for ${modelName}: ${stderr}`);
      throw new Error(`Failed to remove model "${modelName}": ${stderr.trim()}`);
    }

    // stdout might contain "deleted <modelName>"
    console.log(`Ollama rm stdout for ${modelName}: ${stdout}`);
    // No specific success message to check, command success (exit code 0) is enough.
    return Promise.resolve();

  } catch (error: any) {
    console.error(`Error in removeModel for ${modelName}:`, error);
    if (error.message.startsWith('Model "') && error.message.endsWith('" not found locally.')) {
      throw error;
    }
    if (error.message.startsWith('Failed to remove model "')) {
      throw error;
    }
    if ((error.code === 'ENOENT' || (error.message && error.message.includes('command not found'))) && !error.message.includes('Ollama command not found')) {
      throw new Error('Ollama command not found. Please ensure Ollama is installed and in your PATH.');
    }
    // Re-throw other specific errors or a generic one
    throw new Error(`An unexpected error occurred while removing model "${modelName}": ${error.message}`);
  }
}
