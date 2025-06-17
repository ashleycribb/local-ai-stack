import React, { useState } from 'react'; // Removed useEffect, useCallback
// OllamaModel type will now come from ModelContext or be the same if imported there
import { useModelContext, OllamaModel } from '../../contexts/ModelContext';

interface ModelListViewProps {
  // Props are no longer needed as context handles state
}

const ModelListView: React.FC<ModelListViewProps> = () => {
  const {
    availableModels,
    selectedModel,
    setSelectedModelAndPersist,
    isLoadingModels,
    modelError,
    refreshModels,
  } = useModelContext();

  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Tracks which model is being deleted
  const [deleteError, setDeleteError] = useState<string | null>(null); // Error specific to delete operations

  const handleRemoveModel = async (modelName: string) => {
    if (!window.confirm(`Are you sure you want to remove the model "${modelName}"?`)) {
      return;
    }
    setIsDeleting(modelName);
    setDeleteError(null); // Clear previous delete errors
    try {
      const response = await fetch('/api/ollama/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to remove model: ${response.statusText}`);
      }
      // Success
      // alert(`Model "${modelName}" removed successfully.`); // Simple feedback, can be improved
      await refreshModels(); // Refresh the list using context function
    } catch (err: any) {
      setDeleteError(err.message || `An error occurred while removing ${modelName}.`);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSelectModel = (model: OllamaModel) => {
    setSelectedModelAndPersist(model);
  };

  if (isLoadingModels && availableModels.length === 0) {
    return <p>Loading models...</p>;
  }

  if (modelError) {
    return <p style={{ color: 'red' }}>Error loading models: {modelError.message} <button onClick={refreshModels}>Retry</button></p>;
  }

  if (deleteError) {
    // Display delete error prominently, maybe allow retry of list refresh
    return <p style={{ color: 'red' }}>Error during deletion: {deleteError} <button onClick={refreshModels}>Refresh List</button></p>;
  }

  if (availableModels.length === 0 && !isLoadingModels) {
    return <p>No local Ollama models found. You can pull models using the form below.</p>;
  }

  return (
    <div>
      <h3>Available Local Models</h3>
      {isLoadingModels && <p>Refreshing model list...</p>}
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {availableModels.map((model) => (
          <li
            key={model.id || model.name}
            style={{
              border: selectedModel?.name === model.name ? '2px solid blue' : '1px solid #ccc',
              padding: '10px',
              marginBottom: '10px',
              borderRadius: '5px',
              backgroundColor: selectedModel?.name === model.name ? '#e0e0ff' : 'transparent'
            }}
          >
            <strong>{model.name}</strong><br />
            ID: {model.id}<br />
            Size: {model.size}<br />
            Modified: {model.modified}<br />
            <button
              onClick={() => handleSelectModel(model)}
              disabled={isDeleting === model.name || selectedModel?.name === model.name}
              style={{ marginRight: '5px', marginTop: '5px' }}
            >
              {selectedModel?.name === model.name ? 'Selected' : 'Select'}
            </button>
            <button
              onClick={() => handleRemoveModel(model.name)}
              disabled={isDeleting === model.name}
              style={{ marginTop: '5px', backgroundColor: isDeleting === model.name ? 'grey' : '#ff726f', color: 'white' }}
            >
              {isDeleting === model.name ? 'Deleting...' : 'Remove'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ModelListView;
