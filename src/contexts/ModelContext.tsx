import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Re-define or import a frontend-specific OllamaModel type
// For simplicity, let's assume it's similar to the backend one.
// In a larger app, this might come from a shared types directory.
export interface OllamaModel {
  name: string;
  id: string;
  size: string;
  modified: string;
  // Add any other frontend-specific fields if needed
}

interface ModelContextType {
  availableModels: OllamaModel[];
  selectedModel: OllamaModel | null;
  setSelectedModelAndPersist: (model: OllamaModel | null) => void; // Renamed for clarity
  isLoadingModels: boolean;
  modelError: Error | null;
  refreshModels: () => Promise<void>;
}

const ModelContext = createContext<ModelContextType | undefined>(undefined);

export const useModelContext = () => {
  const context = useContext(ModelContext);
  if (!context) {
    throw new Error('useModelContext must be used within a ModelProvider');
  }
  return context;
};

interface ModelProviderProps {
  children: ReactNode;
}

const LOCAL_STORAGE_SELECTED_MODEL_KEY = 'ollamaSelectedModelName';

export const ModelProvider: React.FC<ModelProviderProps> = ({ children }) => {
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<OllamaModel | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState<boolean>(true);
  const [modelError, setModelError] = useState<Error | null>(null);

  const fetchModels = useCallback(async () => {
    setIsLoadingModels(true);
    setModelError(null);
    try {
      const response = await fetch('/api/ollama/models');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch models: ${response.statusText}`);
      }
      const data = await response.json();
      const fetchedModels: OllamaModel[] = data.models || [];
      setAvailableModels(fetchedModels);

      // Restore selected model from localStorage
      const storedModelName = localStorage.getItem(LOCAL_STORAGE_SELECTED_MODEL_KEY);
      if (storedModelName) {
        const previouslySelected = fetchedModels.find(m => m.name === storedModelName);
        if (previouslySelected) {
          setSelectedModel(previouslySelected);
        } else {
          // If previously selected model is no longer available, clear selection
          localStorage.removeItem(LOCAL_STORAGE_SELECTED_MODEL_KEY);
          setSelectedModel(null);
        }
      } else {
        setSelectedModel(null); // No stored selection
      }

    } catch (err: any) {
      setModelError(err);
      setAvailableModels([]); // Clear models on error
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const setSelectedModelAndPersist = (model: OllamaModel | null) => {
    setSelectedModel(model);
    if (model) {
      localStorage.setItem(LOCAL_STORAGE_SELECTED_MODEL_KEY, model.name);
    } else {
      localStorage.removeItem(LOCAL_STORAGE_SELECTED_MODEL_KEY);
    }
  };

  const refreshModels = async () => {
    // Re-fetch models. Selected model logic is handled within fetchModels.
    await fetchModels();
  };

  return (
    <ModelContext.Provider
      value={{
        availableModels,
        selectedModel,
        setSelectedModelAndPersist,
        isLoadingModels,
        modelError,
        refreshModels,
      }}
    >
      {children}
    </ModelContext.Provider>
  );
};
