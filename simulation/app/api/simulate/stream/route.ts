import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildStreamingSimulationPrompt } from "@/lib/simulation";
import type { ProfileContext } from "@/lib/simulation-types";

export const maxDuration = 120;

const MODEL = "gemini-2.5-flash";

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          "GEMINI_API_KEY is not set for Next.js. Add it to .env.local (same key as Convex is fine) to enable streaming.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { event?: string; profile?: ProfileContext };
  try {
    body = (await req.json()) as { event?: string; profile?: ProfileContext };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const event = body.event?.trim();
  const profile = body.profile;
  if (!event || !profile?.profileName) {
    return new Response(JSON.stringify({ error: "event and profile required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });
  const prompt = buildStreamingSimulationPrompt(event, profile);

  const streamResult = await model.generateContentStream(prompt);
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamResult.stream) {
          const t = chunk.text();
          if (t) controller.enqueue(encoder.encode(t));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Stream failed";
        controller.enqueue(encoder.encode(`\n\n[STREAM_ERROR]${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
