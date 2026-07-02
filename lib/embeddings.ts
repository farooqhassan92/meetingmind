const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const EMBEDDING_DIMENSIONS = 768;

type OllamaEmbeddingResponse = {
  embedding?: number[];
};

type GeminiEmbeddingResponse = {
  embedding?: {
    values?: number[];
  };
};

export function isEmbeddingServiceError(message: string) {
  return [
    "Embedding",
    "Ollama",
    "Gemini",
    "fetch failed",
    "ECONNREFUSED",
    "UND_ERR_CONNECT_TIMEOUT"
  ].some((token) => message.includes(token));
}

export async function embedText(text: string) {
  if (process.env.EMBEDDING_PROVIDER === "gemini") {
    return embedTextWithGemini(text);
  }

  const baseUrl =
    process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_OLLAMA_BASE_URL;
  const model = process.env.EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const response = await fetch(`${baseUrl}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt: text
    })
  });

  if (!response.ok) {
    throw new Error(
      `Embedding service returned status ${response.status}. Check that Ollama is running and the embedding model is available.`
    );
  }

  const payload = (await response.json()) as OllamaEmbeddingResponse;

  if (!Array.isArray(payload.embedding)) {
    throw new Error(
      "Embedding service returned an unexpected response. Check the embedding model configuration."
    );
  }

  if (payload.embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model returned ${payload.embedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}. Check that EMBEDDING_MODEL is set to nomic-embed-text.`
    );
  }

  return payload.embedding;
}

async function embedTextWithGemini(text: string) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required when using Gemini embeddings.");
  }

  const model = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        taskType: "SEMANTIC_SIMILARITY",
        output_dimensionality: EMBEDDING_DIMENSIONS,
        content: {
          parts: [{ text }]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `Gemini embedding service returned status ${response.status}. Check GEMINI_API_KEY and EMBEDDING_MODEL.`
    );
  }

  const payload = (await response.json()) as GeminiEmbeddingResponse;
  const embedding = payload.embedding?.values;

  if (!Array.isArray(embedding)) {
    throw new Error("Gemini returned an unexpected embedding response.");
  }

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Gemini returned ${embedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`
    );
  }

  return embedding;
}

export function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
