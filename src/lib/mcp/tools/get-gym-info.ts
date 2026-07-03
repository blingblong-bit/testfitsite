import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_gym_info",
  title: "Get gym info",
  description:
    "Get FIT Beyond Plus overview: address, phone, hours, and website.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            name: "FIT Beyond Plus",
            website: "https://fitbeyondplus.com",
            phone: "+1-931-222-4449",
            address: {
              street: "449 W Lincoln St",
              city: "Tullahoma",
              state: "TN",
              postalCode: "37388",
              country: "US",
            },
            hours: {
              monday_friday: "09:00–20:00 (staffed); 24/7 member access",
              saturday: "09:00–18:00 (staffed)",
              sunday: "10:00–17:00 (staffed)",
            },
            facility_sqft: 13500,
          },
          null,
          2,
        ),
      },
    ],
  }),
});
