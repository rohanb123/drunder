import { internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listProfiles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("supplyChainProfiles").collect();
  },
});

export const getProfileDetail = query({
  args: { profileId: v.id("supplyChainProfiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) return null;
    const [suppliers, htsCodes, categories] = await Promise.all([
      ctx.db
        .query("suppliers")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect(),
      ctx.db
        .query("htsCodes")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect(),
      ctx.db
        .query("productCategories")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect(),
    ]);
    return { profile, suppliers, htsCodes, categories };
  },
});

export const getProfileContext = internalQuery({
  args: { profileId: v.id("supplyChainProfiles") },
  handler: async (ctx, { profileId }) => {
    const profile = await ctx.db.get(profileId);
    if (!profile) return null;
    const [suppliers, htsCodes, categories] = await Promise.all([
      ctx.db
        .query("suppliers")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect(),
      ctx.db
        .query("htsCodes")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect(),
      ctx.db
        .query("productCategories")
        .withIndex("by_profile", (q) => q.eq("profileId", profileId))
        .collect(),
    ]);
    return {
      profileName: profile.name,
      suppliers: suppliers.map((s) => ({ name: s.name, country: s.country })),
      htsCodes: htsCodes.map((h) => ({ code: h.code, description: h.description ?? null })),
      categories: categories.map((c) => ({ name: c.name })),
    };
  },
});

export const createProfile = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const now = Date.now();
    return await ctx.db.insert("supplyChainProfiles", { name, updatedAt: now });
  },
});

export const addSupplier = mutation({
  args: {
    profileId: v.id("supplyChainProfiles"),
    name: v.string(),
    country: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, { updatedAt: Date.now() });
    return await ctx.db.insert("suppliers", {
      profileId: args.profileId,
      name: args.name,
      country: args.country,
    });
  },
});

export const addHtsCode = mutation({
  args: {
    profileId: v.id("supplyChainProfiles"),
    code: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, { updatedAt: Date.now() });
    return await ctx.db.insert("htsCodes", {
      profileId: args.profileId,
      code: args.code,
      description: args.description,
    });
  },
});

export const addCategory = mutation({
  args: {
    profileId: v.id("supplyChainProfiles"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.profileId, { updatedAt: Date.now() });
    return await ctx.db.insert("productCategories", {
      profileId: args.profileId,
      name: args.name,
    });
  },
});
