import type { CVState, StreamEvent } from "./types";

export interface OptimizeInput {
  jobText: string;
  resumeText: string;
  resumeFile: File | null;
}

/** POST /api/optimize and call `onEvent` for every NDJSON line the server streams back. */
export async function optimize(
  input: OptimizeInput,
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const body = new FormData();
  body.set("job_text", input.jobText);
  if (input.resumeFile) body.set("resume_file", input.resumeFile);
  else body.set("resume_text", input.resumeText);

  const res = await fetch("/api/optimize", { method: "POST", body, signal });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string" ? data.detail : `Request failed (${res.status})`,
    );
  }
  if (!res.body) throw new Error("The server returned an empty response.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as StreamEvent);
    }
  }
  if (buf.trim()) onEvent(JSON.parse(buf) as StreamEvent);
}

export async function checkHealth(): Promise<string[]> {
  try {
    const res = await fetch("/health");
    const data = (await res.json()) as { missing?: string[] };
    return data.missing ?? [];
  } catch {
    return [];
  }
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : `Request failed (${res.status})`);
  }
  return data as T;
}

export const getCV = (id: string) => fetch(`/api/cv/${id}`).then((r) => json<CVState>(r));

export const editCV = (id: string, instruction: string, signal?: AbortSignal) =>
  fetch(`/api/cv/${id}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instruction }),
    signal,
  }).then((r) => json<CVState>(r));

export const undoCV = (id: string) =>
  fetch(`/api/cv/${id}/undo`, { method: "POST" }).then((r) => json<CVState>(r));

export const cvUrls = (id: string) => ({
  view: `/cv/${id}`,
  pdf: `/cv/${id}/pdf`,
  docx: `/cv/${id}/docx`,
});
