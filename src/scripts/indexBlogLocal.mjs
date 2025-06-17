// Call embeding API and insert to supabase
// Ref: https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/supabase

import dotenv from "dotenv";
import { Document } from "langchain/document";
import { createClient } from "@supabase/supabase-js";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { pipeline } from "@xenova/transformers";

import fs from "fs";
import path from "path";
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

dotenv.config({ path: `.env.local` });

const blogsDir = "blogs"; // Define the directory to scan

// Parsing functions
async function parseMarkdown(filePath, fileName, splitter) {
  console.log(`Processing Markdown file: ${fileName}`);
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const splitDocs = await splitter.splitText(fileContent);
    const documents = splitDocs.map((doc) => {
      return new Document({
        metadata: { source: filePath, fileName, fileType: '.md' },
        pageContent: doc,
      });
    });
    console.log(`Parsed ${documents.length} documents from ${fileName}`);
    return documents;
  } catch (error) {
    console.error(`Error processing Markdown file ${fileName}:`, error);
    return [];
  }
}

async function parseTxt(filePath, fileName, splitter) { // Added splitter for consistency
  console.log(`Processing TXT file: ${fileName}`);
  // Actual TXT parsing will go here
  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    // Optional: Use splitter for TXT if desired, otherwise treat as one chunk
    // const splitDocs = await splitter.splitText(fileContent); // Example if splitting TXT
    // For now, one doc per file as per previous logic for simplicity.
    // If splitting, the map function similar to parseMarkdown would be used.
    const document = new Document({
      metadata: { source: filePath, fileName, fileType: '.txt' },
      pageContent: fileContent,
    });
    console.log(`Parsed 1 document from ${fileName} (TXT simple)`);
    return [document]; // Return array of Document objects
  } catch (error) {
    console.error(`Error processing TXT file ${fileName}:`, error);
    return [];
  }
}

async function parsePdf(filePath, fileName, splitter) { // Added splitter
  console.log(`Processing PDF file: ${fileName}`);
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const textContent = data.text;

    // Optional: Split PDF content if it's very large
    // const splitDocs = await splitter.splitText(textContent);
    // const documents = splitDocs.map((docChunk) => new Document({
    //   metadata: { source: filePath, fileName, fileType: '.pdf' },
    //   pageContent: docChunk,
    // }));
    // For now, one document per PDF.
    const document = new Document({
      metadata: { source: filePath, fileName, fileType: '.pdf' },
      pageContent: textContent,
    });
    console.log(`Parsed PDF ${fileName}, extracted text length: ${textContent.length}`);
    return [document];
  } catch (error) {
    console.error(`Error processing PDF file ${fileName}:`, error);
    return [];
  }
}

async function parseDocx(filePath, fileName, splitter) { // Added splitter
  console.log(`Processing DOCX file: ${fileName}`);
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const textContent = result.value;
    // Optional: Split DOCX content
    // const splitDocs = await splitter.splitText(textContent);
    // const documents = splitDocs.map((docChunk) => new Document({
    //   metadata: { source: filePath, fileName, fileType: '.docx' },
    //   pageContent: docChunk,
    // }));
    // For now, one document per DOCX.
    const document = new Document({
      metadata: { source: filePath, fileName, fileType: '.docx' },
      pageContent: textContent,
    });
    console.log(`Parsed DOCX ${fileName}, extracted text length: ${textContent.length}`);
    return [document];
  } catch (error) {
    console.error(`Error processing DOCX file ${fileName}:`, error);
    return [];
  }
}


// Main processing logic
async function main() {
  const fileNames = fs.readdirSync(blogsDir);
  const splitter = RecursiveCharacterTextSplitter.fromLanguage("markdown", {
    chunkSize: 1000,
    chunkOverlap: 50,
  });

  let allLangchainDocs = []; // To store all documents from all parsed files

  for (const fileName of fileNames) {
    const filePath = path.join(blogsDir, fileName);
    const extension = path.extname(fileName).toLowerCase();
    let parsedDocs = [];

    switch (extension) {
      case ".md":
        parsedDocs = await parseMarkdown(filePath, fileName, splitter);
        break;
      case ".txt":
        // Pass splitter to parseTxt if you want to enable chunking for .txt files
        // For now, parseTxt handles content as a single chunk internally.
        parsedDocs = await parseTxt(filePath, fileName, splitter);
        break;
      case ".pdf":
        parsedDocs = await parsePdf(filePath, fileName, splitter);
        break;
      case ".docx":
        parsedDocs = await parseDocx(filePath, fileName, splitter);
        break;
      default:
        console.log(`Skipping unsupported file type: ${fileName}`);
        continue; // Skip to next file
    }
    if (parsedDocs && parsedDocs.length > 0) { // Ensure parsedDocs is not null/undefined
      allLangchainDocs.push(...parsedDocs);
    }
  }

  if (allLangchainDocs.length === 0) {
    console.log("No documents processed. Exiting.");
    return;
  }

  console.log(`Total documents processed from all files: ${allLangchainDocs.length}`);

  // The rest of the script (Supabase client, embedding, insertion) goes here
  // It will need to operate on `allLangchainDocs`
  const auth = {
    detectSessionInUrl: false,
    persistSession: false,
    autoRefreshToken: false,
  };

  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PRIVATE_KEY,
    { auth }
  );

  console.log(`Generating embeddings for ${allLangchainDocs.length} document chunks...`);
  const embeddingPromises = allLangchainDocs.map((doc) => {
    // Ensure doc.pageContent is not empty or null before embedding
    if (!doc.pageContent || doc.pageContent.trim() === "") {
      console.warn(`Skipping embedding for empty content from file: ${doc.metadata.fileName}`);
      return Promise.resolve(null); // Resolve with null for empty content
    }
    return generateEmbedding(doc.pageContent);
  });

  const returnedEmbeddings = await Promise.all(embeddingPromises);

  let insertData = [];
  allLangchainDocs.forEach((doc, index) => {
    const embedding = returnedEmbeddings[index];
    if (embedding) { // Only insert if embedding was generated
      insertData.push({
        content: doc.pageContent,
        embedding: embedding,
        metadata: doc.metadata,
      });
    }
  });

  if (insertData.length > 0) {
    console.log(`Inserting ${insertData.length} data entries into Supabase...`);
    const { error } = await client.from("documents").insert(insertData);
    if (error) {
      console.error("Error inserting data into Supabase:", error);
    } else {
      console.log("Data inserted successfully.");
    }
  } else {
    console.log("No data to insert into Supabase.");
  }
}

// Moved generateEmbedding function here, unchanged for now
export async function generateEmbedding(content) {
  const generateEmbedding = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  );

  // Generate a vector using Transformers.js
  const output = await generateEmbedding(content, {
    pooling: "mean",
    normalize: true,
  });

  // Extract the embedding output
  const embedding = Array.from(output.data);
  return embedding;
}
