import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

const OFFERINGS = [
  {
    slug: "memberships",
    title: "Gym Memberships",
    description:
      "24/7 access to a 13,500 sqft training facility with premium strength, free weights, machines, racks, and cardio.",
    url: "https://fitbeyondplus.com/memberships",
  },
  {
    slug: "personal-training",
    title: "Personal Training",
    description:
      "1-on-1 coaching for beginners, athletes, and experienced lifters. Structure, accountability, and real programming.",
    url: "https://fitbeyondplus.com/personal-training",
  },
  {
    slug: "classes",
    title: "Group Fitness Classes",
    description:
      "Group classes including HIIT, kickboxing, BJJ (kids & adult), yoga, barre, and TRX.",
    url: "https://fitbeyondplus.com/classes",
  },
  {
    slug: "class-schedule",
    title: "Class Schedule",
    description: "Weekly schedule for all group fitness classes.",
    url: "https://fitbeyondplus.com/classes/schedule",
  },
  {
    slug: "facility",
    title: "Facility Tour",
    description: "Photos and details of the Tullahoma, TN facility.",
    url: "https://fitbeyondplus.com/facility",
  },
];

export default defineTool({
  name: "list_offerings",
  title: "List offerings",
  description:
    "List gym offerings at FIT Beyond Plus: memberships, personal training, group classes, class schedule, and facility tour, each with a link.",
  inputSchema: {
    filter: z
      .string()
      .optional()
      .describe("Optional keyword to filter offerings by title/description."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ filter }) => {
    const q = filter?.toLowerCase().trim();
    const items = q
      ? OFFERINGS.filter(
          (o) =>
            o.title.toLowerCase().includes(q) ||
            o.description.toLowerCase().includes(q) ||
            o.slug.includes(q),
        )
      : OFFERINGS;
    return {
      content: [{ type: "text", text: JSON.stringify(items, null, 2) }],
      structuredContent: { items },
    };
  },
});
