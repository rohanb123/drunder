import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  supplyChainProfiles: defineTable({
    name: v.string(),
    updatedAt: v.number(),
  }),
  suppliers: defineTable({
    profileId: v.id("supplyChainProfiles"),
    name: v.string(),
    country: v.string(),
  }).index("by_profile", ["profileId"]),
  htsCodes: defineTable({
    profileId: v.id("supplyChainProfiles"),
    code: v.string(),
    description: v.optional(v.string()),
  }).index("by_profile", ["profileId"]),
  productCategories: defineTable({
    profileId: v.id("supplyChainProfiles"),
    name: v.string(),
  }).index("by_profile", ["profileId"]),
});
