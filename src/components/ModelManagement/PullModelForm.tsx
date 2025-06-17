import React, { useState } from 'react';
import { useModelContext } from '../../contexts/ModelContext';

interface PullModelFormProps {
  // onPullComplete might no longer be needed if refresh is handled via context
  // For now, let's keep it if other actions are tied to it, or remove if solely for refresh.
  // Let's assume for now it might still be useful for other parent notifications (e.g. global message)
  // If not, it can be removed.
  onPullComplete?: () => void;
}

const PullModelForm: React.FC<PullModelFormProps> = ({ onPullComplete }) => {
  const { refreshModels } = useModelContext();
  const [modelName, setModelName] = useState<string>('');
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [pullProgress, setPullProgress] = useState<string[]>([]); // Array of progress messages
  const [pullError, setPullError] = useState<string | null>(null);

  const handlePullModel = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent default form submission
    if (!modelName.trim()) {
      setPullError('Please enter a model name.');
      return;
    }

    setIsPulling(true);
    setPullProgress([`Starting pull for ${modelName.trim()}...`]); // Use trimmed model name
    setPullError(null);

    try {
      const response = await fetch('/api/ollama/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelName: modelName.trim() }),
      });

      if (!response.ok) {
        // Try to parse error from body, otherwise use statusText
        let errorMsg = `Failed to start pull: ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.error || errorMsg;
        } catch (e) {
            // Ignore if body isn't JSON
        }
        throw new Error(errorMsg);
      }

      if (!response.body) {
        throw new Error('Response body is null, cannot read stream.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Process any remaining buffer content if necessary
          if (buffer.trim()) {
            setPullProgress(prev => [...prev, `Stream finished. Remainder: ${buffer}`]);
          }
          break; // Exit loop when stream is done
        }

        buffer += decoder.decode(value, { stream: true });

        // Process messages separated by \n\n
        let eolIndex;
        while ((eolIndex = buffer.indexOf('\n\n')) >= 0) {
          const messageBlock = buffer.substring(0, eolIndex);
          buffer = buffer.substring(eolIndex + 2); // Skip \n\n

          if (messageBlock.trim() === '') continue;

          let eventName = 'message';
          let dataContent = '';

          messageBlock.split('\n').forEach(line => {
            if (line.startsWith('event: ')) {
              eventName = line.substring('event: '.length).trim();
            } else if (line.startsWith('data: ')) {
              dataContent = line.substring('data: '.length).trim();
            }
          });

          if (dataContent) {
            try {
              const parsedData = JSON.parse(dataContent);
              const messageToAdd = parsedData.message || JSON.stringify(parsedData.details) || JSON.stringify(parsedData);

              setPullProgress(prev => [...prev, messageToAdd]);

              if (eventName === 'error') {
                setPullError(parsedData.message || 'An error occurred during pull.');
                setIsPulling(false); // Stop on error
                return; // Exit message processing loop
              } else if (eventName === 'done') {
                setPullProgress(prev => [...prev, 'Pull complete!']);
                setIsPulling(false);
                setModelName(''); // Clear input
                await refreshModels(); // Refresh model list via context
                if (onPullComplete) onPullComplete(); // Call prop if provided
                return; // Exit message processing loop
              }
            } catch (e) {
              setPullProgress(prev => [...prev, `Raw/Non-JSON: ${dataContent}`]);
            }
          }
        }
      }
       // If loop finishes and isPulling is still true (e.g. stream ended without 'done' or 'error' event)
      if (isPulling) {
        setPullProgress(prev => [...prev, "Stream ended unexpectedly."]);
        setIsPulling(false);
      }

    } catch (err: any) {
      setPullError(err.message || 'An unexpected error occurred during pull.');
      setPullProgress(prev => [...prev, `Error: ${err.message}`]);
      setIsPulling(false);
    }
  };

  return (
    <div>
      <h3>Pull New Model</h3>
      <form onSubmit={handlePullModel}>
        <input
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="e.g., llama2:7b or mistral"
          disabled={isPulling}
          style={{ marginRight: '5px' }}
        />
        <button type="submit" disabled={isPulling}>
          {isPulling ? 'Pulling...' : 'Pull Model'}
        </button>
      </form>
      {pullError && <p style={{ color: 'red' }}>Error: {pullError}</p>}
      {pullProgress.length > 0 && (
        <div style={{ marginTop: '10px', border: '1px solid #eee', padding: '10px', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <h4>Pull Progress:</h4>
          {pullProgress.map((line, index) => (
            // Using <pre> or whiteSpace: 'pre-wrap' for better formatting of multiline JSON from Ollama
            <p key={index} style={{ margin: '2px 0' }}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
};

export default PullModelForm;
