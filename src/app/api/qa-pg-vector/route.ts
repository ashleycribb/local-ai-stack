import { SupabaseVectorStore } from "langchain/vectorstores/supabase";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "langchain/llms/openai";
import { Ollama } from "langchain/llms/ollama";
import dotenv from "dotenv";
import { VectorDBQAChain } from "langchain/chains";
import { StreamingTextResponse, LangChainStream } from "ai";
import { CallbackManager } from "langchain/callbacks";
import { vectorSearch } from "@/util";

dotenv.config({ path: `.env.local` });

export async function POST(req: Request) {
  // Modified to include history and modelName from the request body
  const { prompt, history, modelName: requestedModelName } = await req.json();
  const ollama_endpoint = process.env.OLLAMA_URL;
  const defaultOllamaModelFromEnv = process.env.OLLAMA_MODEL || "llama2"; // Default from env or 'llama2'

  const privateKey = process.env.SUPABASE_PRIVATE_KEY;
  if (!privateKey) throw new Error(`Expected env var SUPABASE_PRIVATE_KEY`);

  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error(`Expected env var SUPABASE_URL`);

  const auth = {
    detectSessionInUrl: false,
    persistSession: false,
    autoRefreshToken: false,
  };
  const client = createClient(url, privateKey, { auth });

  let model;

  if (ollama_endpoint) {
    const effectiveModelName = (typeof requestedModelName === 'string' && requestedModelName.trim() !== '')
      ? requestedModelName.trim()
      : defaultOllamaModelFromEnv;

    console.info(`Using Ollama with endpoint: ${ollama_endpoint} and model: ${effectiveModelName}`);
    model = new Ollama({
      baseUrl: ollama_endpoint,
      model: effectiveModelName,
    });
    model.verbose = true;
    // TODO: Incorporate `history` into the prompt or context if needed for Ollama interactions.
    // For now, `history` is destructured but not used in this specific Ollama path.
    const data = await vectorSearch(client, prompt);
    const contextData = data.map((d: any) => d.content);

    const modifiedPrompt = `Please answer the users question based on the following context. If you can't answer the question based on the context, say 'I don't know'.
    
    Question: ${prompt}
    
    Context: ${JSON.stringify(contextData)}`;
    const result = await model.call(modifiedPrompt);

    return new Response(result);
  } else {
    const vectorStore = await SupabaseVectorStore.fromExistingIndex(
      new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY }),
      {
        client,
        tableName: "documents",
        queryName: "match_documents",
      }
    );

    let { stream, handlers } = LangChainStream();
    model = new OpenAI({
      streaming: true,
      modelName: "gpt-3.5-turbo-16k",
      openAIApiKey: process.env.OPENAI_API_KEY,
      callbackManager: CallbackManager.fromHandlers(handlers),
    });
    model.verbose = true;

    const chain = VectorDBQAChain.fromLLM(model, vectorStore, {
      k: 1,
      returnSourceDocuments: false,
    });

    chain.call({ query: prompt }).catch(console.error);
    return new StreamingTextResponse(stream);
  }
}
