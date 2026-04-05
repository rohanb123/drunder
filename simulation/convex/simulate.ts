"use node";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";
import { buildJsonOnlySimulationPrompt, parseSimulationJson } from "./simulationCore";

const MODEL = "gemini-2.5-flash";

export const run = action({
  args: {
    profileId: v.id("supplyChainProfiles"),
    event: v.string(),
  },
  handler: async (ctx, { profileId, event }) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in Convex (Dashboard → Settings → Environment Variables, or `npx convex env set GEMINI_API_KEY ...`).");
    }

    const profileCtx = await ctx.runQuery(internal.profiles.getProfileContext, { profileId });
    if (!profileCtx) {
      throw new Error("Supply chain profile not found");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(buildJsonOnlySimulationPrompt(event, profileCtx));
    const text = result.response.text();
    const parsed = parseSimulationJson(text);
    if (!parsed) {
      throw new Error("Gemini response was not valid simulation JSON");
    }
    return parsed;
  },
});
