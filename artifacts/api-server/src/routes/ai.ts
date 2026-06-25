import { Router, type IRouter } from "express";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../lib/auth";
import { db, companiesTable, jobsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();
router.use(requireAuth);

const QuoteEstimateBody = z.object({
  jobId: z.number().int().optional(),
  jobDescription: z.string().min(1),
  photos: z.array(z.string()).max(3).default([]),
  zipCode: z.string().optional(),
  mode: z.enum(["labor_only", "labor_and_materials"]).default("labor_and_materials"),
});

const SuggestMaterialsBody = z.object({
  jobId: z.number().int().optional(),
  jobDescription: z.string().min(1),
  zipCode: z.string().optional(),
});

const lineItemSchema = z.object({
  description: z.string(),
  qty: z.number().optional(),
  unit: z.string().optional(),
  unitPrice: z.number().optional(),
  hours: z.number().optional(),
  hourlyRate: z.number().optional(),
  section: z.enum(["labor", "material", "equipment", "other"]),
});

const aiResponseSchema = z.object({
  items: z.array(lineItemSchema),
});

router.post("/ai/quote-estimate", async (req, res): Promise<void> => {
  const parsed = QuoteEstimateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jobDescription, photos, mode } = parsed.data;

  let zipCode = parsed.data.zipCode;
  if (!zipCode) {
    const [company] = await db
      .select({ zipCode: companiesTable.zipCode })
      .from(companiesTable)
      .where(eq(companiesTable.id, req.companyId!));
    zipCode = company?.zipCode ?? undefined;
  }

  let jobContext = "";
  if (parsed.data.jobId) {
    const [job] = await db
      .select({ title: jobsTable.title, address: jobsTable.address, jobType: jobsTable.jobType })
      .from(jobsTable)
      .where(and(eq(jobsTable.id, parsed.data.jobId), eq(jobsTable.companyId, req.companyId!)));
    if (job) {
      jobContext = `Job title: "${job.title}". Type: ${job.jobType || "general"}. Address: ${job.address || "not specified"}.`;
    }
  }

  const locationContext = zipCode ? `Location: zip code ${zipCode}.` : "";
  const modeContext = mode === "labor_only"
    ? "Return ONLY labor line items (section: \"labor\"). Do NOT include any materials."
    : "Return both labor line items (section: \"labor\") and material line items (section: \"material\").";

  const systemPrompt = `You are a construction cost estimator. Generate realistic line-item cost estimates based on regional US pricing.
${modeContext}
For labor items: include hours and hourlyRate (leave qty/unitPrice null).
For material items: include qty, unit, and unitPrice (leave hours/hourlyRate null).
Respond ONLY with valid JSON matching this schema:
{ "items": [ { "description": string, "qty": number|null, "unit": string|null, "unitPrice": number|null, "hours": number|null, "hourlyRate": number|null, "section": "labor"|"material"|"equipment"|"other" } ] }
Base prices on regional averages for the given zip code. Be realistic but not padded.`;

  type ContentPart =
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } };

  const userContent: ContentPart[] = [
    {
      type: "text",
      text: `${jobContext} ${locationContext}\n\nJob description: ${jobDescription}\n\nGenerate a detailed cost estimate with line items.`,
    },
    ...photos.map((b64): ContentPart => ({
      type: "image_url",
      image_url: { url: b64, detail: "low" },
    })),
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed2: z.infer<typeof aiResponseSchema>;
  try {
    parsed2 = aiResponseSchema.parse(JSON.parse(raw));
  } catch {
    res.status(500).json({ error: "AI returned invalid response format" });
    return;
  }

  res.json({ items: parsed2.items, disclaimer: "These are rough estimates based on regional averages — review and adjust before sending." });
});

router.post("/ai/suggest-materials", async (req, res): Promise<void> => {
  const parsed = SuggestMaterialsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jobDescription } = parsed.data;

  let zipCode = parsed.data.zipCode;
  if (!zipCode) {
    const [company] = await db
      .select({ zipCode: companiesTable.zipCode })
      .from(companiesTable)
      .where(eq(companiesTable.id, req.companyId!));
    zipCode = company?.zipCode ?? undefined;
  }

  let jobContext = "";
  if (parsed.data.jobId) {
    const [job] = await db
      .select({ title: jobsTable.title, jobType: jobsTable.jobType })
      .from(jobsTable)
      .where(and(eq(jobsTable.id, parsed.data.jobId), eq(jobsTable.companyId, req.companyId!)));
    if (job) {
      jobContext = `Job: "${job.title}" (${job.jobType || "general construction"}).`;
    }
  }

  const locationContext = zipCode ? `Location: zip code ${zipCode}.` : "";

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 2048,
    messages: [
      {
        role: "system",
        content: `You are a construction materials estimator. Return a JSON list of materials needed for the described job with realistic pricing.
Respond ONLY with valid JSON: { "items": [ { "name": string, "description": string|null, "quantity": number, "unit": string, "unitPrice": number, "category": string|null } ] }
Base prices on regional averages${zipCode ? ` for zip ${zipCode}` : ""}.`,
      },
      {
        role: "user",
        content: `${jobContext} ${locationContext}\n\nJob description: ${jobDescription}\n\nList the materials needed with quantities and unit prices.`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const materialSchema = z.object({
    items: z.array(z.object({
      name: z.string(),
      description: z.string().nullish(),
      quantity: z.number(),
      unit: z.string(),
      unitPrice: z.number(),
      category: z.string().nullish(),
    })),
  });

  let result: z.infer<typeof materialSchema>;
  try {
    result = materialSchema.parse(JSON.parse(raw));
  } catch {
    res.status(500).json({ error: "AI returned invalid response format" });
    return;
  }

  res.json({ items: result.items, disclaimer: "These are rough estimates based on regional averages — review and adjust before ordering." });
});

export default router;
