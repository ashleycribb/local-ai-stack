import { spawn, ChildProcess } from 'child_process';

export enum IndexingState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

let currentStatus: IndexingState = IndexingState.IDLE;
let scriptOutput: string[] = [];
let scriptError: string | null = null;
let childProcessInstance: ChildProcess | null = null;

export interface IndexingStatus {
  status: IndexingState;
  output: string[]; // Returning as array of strings for better client-side handling
  error: string | null;
  isRunning: boolean;
}

export interface StartIndexingResult {
  message?: string;
  error?: string;
}

export function startIndexing(): StartIndexingResult {
  if (currentStatus === IndexingState.RUNNING) {
    console.warn('Attempted to start indexing while already in progress.');
    return { error: 'Indexing already in progress.' };
  }

  console.log('Starting indexing process...');
  currentStatus = IndexingState.RUNNING;
  scriptOutput = [];
  scriptError = null;

  try {
    // Ensure the script path is correct and executable
    // For Next.js, paths are usually relative to the project root.
    childProcessInstance = spawn('node', ['src/scripts/indexBlogLocal.mjs'], {
        shell: false, // Recommended for security and predictability
        // cwd: process.cwd(), // Explicitly set CWD if needed, defaults to process.cwd()
    });

    childProcessInstance.stdout?.on('data', (data: Buffer) => {
      const line = data.toString();
      scriptOutput.push(line);
      console.log('stdout:', line.trim());
    });

    childProcessInstance.stderr?.on('data', (data: Buffer) => {
      const line = data.toString();
      // Storing stderr in the main output for now, can be separated
      scriptOutput.push(`stderr: ${line}`);
      scriptError = (scriptError || '') + line; // Accumulate stderr messages into scriptError
      console.error('stderr:', line.trim());
    });

    childProcessInstance.on('error', (err) => {
      console.error('Failed to start or run indexing subprocess.', err);
      currentStatus = IndexingState.ERROR;
      scriptError = err.message;
      childProcessInstance = null;
    });

    childProcessInstance.on('close', (code) => {
      console.log(`Indexing script exited with code ${code}`);
      if (code === 0) {
        currentStatus = IndexingState.SUCCESS;
        // scriptError might have been populated by stderr messages even on success
        // if (scriptError && scriptError.trim() === '') scriptError = null; // Clear if only whitespace
      } else {
        currentStatus = IndexingState.ERROR;
        if (!scriptError) { // If 'error' event didn't set it
          scriptError = `Script exited with code ${code}. Check output for details.`;
        } else {
          scriptError += `\nScript exited with code ${code}.`;
        }
      }
      childProcessInstance = null;
    });

    return { message: 'Indexing started successfully.' };

  } catch (error: any) {
    console.error('Exception during spawn:', error);
    currentStatus = IndexingState.ERROR;
    scriptError = `Failed to spawn indexing process: ${error.message}`;
    childProcessInstance = null; // Ensure it's null on spawn error
    return { error: scriptError };
  }
}

export function getIndexingStatus(): IndexingStatus {
  return {
    status: currentStatus,
    // Return a copy of the output array so consumers can't modify the internal state directly
    output: [...scriptOutput],
    error: scriptError,
    isRunning: currentStatus === IndexingState.RUNNING,
  };
}

// Optional: Add a function to stop indexing if needed, though not requested
export function stopIndexing(): StartIndexingResult {
    if (!childProcessInstance || currentStatus !== IndexingState.RUNNING) {
        return { error: 'No indexing process is currently running or it cannot be stopped.' };
    }
    try {
        // Attempt to kill the process
        // childProcessInstance.kill('SIGTERM'); // or 'SIGKILL' for forceful
        // For node scripts, sending SIGINT might be more graceful if the script handles it
        const killed = childProcessInstance.kill('SIGINT');
        if (killed) {
            console.log('Sent SIGINT to indexing process.');
            // Status will be updated by 'close' event handler
            scriptOutput.push('Attempting to stop indexing process...\n');
            return { message: 'Attempting to stop indexing process.' };
        } else {
            console.error('Failed to send SIGINT to indexing process.');
            return { error: 'Failed to send stop signal to process.' };
        }
    } catch (error: any) {
        console.error('Error trying to stop indexing process:', error);
        return { error: `Error stopping process: ${error.message}` };
    }
}
