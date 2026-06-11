const DEFAULT_EMBEDDING_MODEL = "nomic-embed-text";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
export const EMBEDDING_DIMENSIONS = 768;

type OllamaEmbeddingResponse = {
  embedding?: number[];
};

export async function embedText(text: string) {
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
    throw new Error(`Embedding request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as OllamaEmbeddingResponse;

  if (!Array.isArray(payload.embedding)) {
    throw new Error("Embedding response did not include an embedding array.");
  }

  if (payload.embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding model returned ${payload.embedding.length} dimensions; expected ${EMBEDDING_DIMENSIONS}.`
    );
  }

  return payload.embedding;
}

export function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}
