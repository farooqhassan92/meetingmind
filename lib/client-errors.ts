export async function readErrorMessage(
  response: Response,
  fallback: string
) {
  const text = await response.text();

  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text) as { error?: string };

    return payload.error ?? fallback;
  } catch {
    return text;
  }
}

export function friendlyClientError(caught: unknown, fallback: string) {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}
