'use client';

import React, { useState, useEffect, useCallback } from 'react';
// Assuming IndexingState is exported from your service or you define it here
// For simplicity, let's define a similar enum/type here for the frontend.
enum FeIndexingState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN', // For initial state before first fetch
}

interface FeIndexingStatus {
  status: FeIndexingState;
  output: string[];
  error: string | null;
  isRunning: boolean;
}

export default function ManageIndexingPage() {
  const [indexingStatus, setIndexingStatus] = useState<FeIndexingStatus>({
    status: FeIndexingState.UNKNOWN,
    output: ['Fetching status...'],
    error: null,
    isRunning: false,
  });
  const [apiCallInProgress, setApiCallInProgress] = useState(false); // For disabling buttons during API calls
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchStatus = useCallback(async (showLoadingMessage = true) => {
    if (showLoadingMessage) {
        // Avoid clearing logs if they are already populated from a running process
        if (indexingStatus.status !== FeIndexingState.RUNNING) {
            setIndexingStatus(prev => ({ ...prev, output: ['Fetching status...'], error: null }));
        }
    }
    try {
      const response = await fetch('/api/indexing/status');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch status and parse error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setIndexingStatus({
        status: data.status as FeIndexingState, // Cast needed if enum values match
        output: data.output || [],
        error: data.error || null,
        isRunning: data.isRunning || data.status === FeIndexingState.RUNNING,
      });
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (error: any) {
      console.error("Failed to fetch indexing status:", error);
      setIndexingStatus(prev => ({
        ...prev,
        status: FeIndexingState.ERROR, // Or keep previous status if more appropriate
        error: error.message || 'Failed to connect to server.',
        // output: [...prev.output, `Error fetching status: ${error.message}`] // Option to add error to logs
      }));
    }
  }, [indexingStatus.status]); // Add indexingStatus.status to re-evaluate if needed

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initial fetch

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (indexingStatus.isRunning) {
      intervalId = setInterval(() => fetchStatus(false), 3000); // Poll every 3 seconds if running
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [indexingStatus.isRunning, fetchStatus]);

  const handleStartIndexing = async () => {
    if (indexingStatus.isRunning) return;
    setApiCallInProgress(true);
    setIndexingStatus(prev => ({ ...prev, output: ['Attempting to start indexing...'], error: null, status: FeIndexingState.RUNNING }));
    try {
      const response = await fetch('/api/indexing/start', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
      // Status will be updated by polling or next manual refresh
      // setIndexingStatus(prev => ({ ...prev, output: [...prev.output, data.message || 'Start request sent.']}));
      await fetchStatus(); // Fetch status immediately after starting
    } catch (error: any) {
      console.error("Failed to start indexing:", error);
      setIndexingStatus(prev => ({ ...prev, error: error.message, status: FeIndexingState.ERROR, isRunning: false }));
    } finally {
      setApiCallInProgress(false);
    }
  };

  const handleStopIndexing = async () => {
    if (!indexingStatus.isRunning) return;
    setApiCallInProgress(true);
    setIndexingStatus(prev => ({ ...prev, output: [...prev.output, 'Attempting to stop indexing...'], error: null }));
    try {
      const response = await fetch('/api/indexing/stop', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP error! status: ${response.status}`);
      // setIndexingStatus(prev => ({ ...prev, output: [...prev.output, data.message || 'Stop request sent.']}));
      await fetchStatus(); // Fetch status immediately after stopping
    } catch (error: any) {
      console.error("Failed to stop indexing:", error);
      // Keep current logs, but show error
      setIndexingStatus(prev => ({ ...prev, error: error.message, status: FeIndexingState.ERROR /* Or keep previous status */ }));
    } finally {
      setApiCallInProgress(false);
    }
  };

  const getStatusColor = (status: FeIndexingState) => {
    switch (status) {
      case FeIndexingState.RUNNING: return 'text-yellow-600';
      case FeIndexingState.SUCCESS: return 'text-green-600';
      case FeIndexingState.ERROR: return 'text-red-600';
      case FeIndexingState.IDLE: return 'text-blue-700';
      default: return 'text-gray-600';
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-3xl">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight sm:text-4xl">
            Manage Document Indexing
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Control and monitor the document indexing process for your local knowledge base.
          </p>
        </header>

        <section className="mb-8 p-6 bg-white shadow-lg rounded-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Controls</h2>
          <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
            <button
              onClick={handleStartIndexing}
              disabled={indexingStatus.isRunning || apiCallInProgress}
              className="w-full sm:w-auto flex-grow sm:flex-grow-0 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {indexingStatus.isRunning ? 'Indexing Running...' : 'Start Indexing'}
            </button>
            <button
              onClick={handleStopIndexing}
              disabled={!indexingStatus.isRunning || apiCallInProgress}
              className="w-full sm:w-auto flex-grow sm:flex-grow-0 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Stop Indexing
            </button>
            <button
              onClick={() => fetchStatus()}
              disabled={apiCallInProgress || indexingStatus.isRunning} // Disable if already polling or another API call active
              className="w-full sm:w-auto flex-grow sm:flex-grow-0 bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50 disabled:opacity-50"
            >
              Refresh Status
            </button>
          </div>
        </section>

        <section className="mb-8 p-6 bg-white shadow-lg rounded-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Current Status</h2>
          <div className="text-gray-700">
            <p>
              Process Status: <span className={`font-bold ${getStatusColor(indexingStatus.status)}`}>{indexingStatus.status}</span>
            </p>
            {indexingStatus.error && <p className="text-red-500 mt-1">Error: {indexingStatus.error}</p>}
            <p className="mt-1 text-xs text-gray-500">Last refreshed: {lastRefreshed || 'N/A'}</p>
          </div>
        </section>

        <section className="p-6 bg-white shadow-lg rounded-lg">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Indexing Logs</h2>
          <pre
            className="bg-gray-900 text-white p-4 rounded-md h-96 overflow-y-auto whitespace-pre-wrap text-sm font-mono custom-scrollbar"
            style={{ maxHeight: '400px' }} // Consistent height
          >
            {indexingStatus.output && indexingStatus.output.length > 0 ? indexingStatus.output.join('') : 'No output yet. Click "Start Indexing" to begin.'}
          </pre>
        </section>

        {/* Basic CSS for custom scrollbar (optional, can be moved to a global CSS file) */}
        <style jsx global>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: #374151; /* bg-gray-700 */
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #4b5563; /* bg-gray-600 */
            border-radius: 4px;
            border: 2px solid #374151; /* bg-gray-700 to create a border effect */
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #6b7280; /* bg-gray-500 */
          }
        `}</style>

      </div>
    </div>
  );
}
