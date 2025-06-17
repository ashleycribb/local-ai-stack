import React from 'react';
import ModelListView from '../components/ModelManagement/ModelListView';
import PullModelForm from '../components/ModelManagement/PullModelForm';

// The ModelProvider is already in _app.tsx, so context is available to children.

const ModelManagementPage: React.FC = () => {
  // The refreshKey and handlePullComplete logic is no longer needed here,
  // as PullModelForm will call refreshModels from the context directly,
  // and ModelListView will react to changes in the context.

  // The onPullComplete prop for PullModelForm can be removed if its only purpose
  // was to trigger a refresh. If it serves other notification purposes for this page,
  // it could be kept, but for simple refresh, it's not needed.
  // For this refactor, we'll assume it was primarily for refresh.

  return (
    <div style={{ padding: '20px' }}>
      <h1>Ollama Model Management</h1>

      {/*
        PullModelForm now uses context to refresh the model list.
        The onPullComplete prop might be used for page-specific notifications
        (e.g., a toast message) if desired, but not for triggering list refresh.
        Example: <PullModelForm onPullComplete={() => showToast("Pull successful!")} />
        For now, we remove it to show context handles the refresh.
      */}
      <PullModelForm />

      <hr style={{ margin: '20px 0' }} />

      {/*
        ModelListView now gets its data directly from the ModelContext.
        The key={refreshKey} is no longer needed for refresh.
      */}
      <ModelListView />

      {/*
        Future considerations for state management:
        - selectedModel: string | null; (to highlight in list and for app to use)
        - Function to set selectedModel, persisted in localStorage/config.
        - This state would likely live in a Context or Zustand store.
      */}
    </div>
  );
};

export default ModelManagementPage;

// We also need to make sure the OllamaModel interface is accessible or duplicated
// if ModelListView is in a different directory scope for props.
// It's currently in `../../lib/ollamaManager` which should be fine.

// Note: The `selectedModel` and `onSelectModel` props were commented out in ModelListView.
// These would be part of a larger state management integration.
// For now, the page provides the structure for listing, pulling, and removing.
// Selection is a UI stub (`alert`) in ModelListView.
