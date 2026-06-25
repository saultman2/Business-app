import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth";
import { db, companiesTable, jobsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

type OpenAIClient = {
  chat: {
    completions: {
      create: (params: {
        model: string;
        max_completion_tokens: number;
        messages: { role: string; content: unknown }[];
        response_format: { type: string };
      }) => Promise<{ choices: { message: { content: string | null } }[] }>;
    };
  };
};

function getOpenai(): OpenAIClient | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@workspace/integrations-openai-ai-server") as { openai: OpenAIClient };
    return mod.openai ?? null;
  } catch {
    return null;
  }
}

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
  qty: z.number().nullish(),
  unit: z.string().nullish(),
  unitPrice: z.number().nullish(),
  hours: z.number().nullish(),
  hourlyRate: z.number().nullish(),
  section: z.enum(["labor", "material", "equipment", "other"]).catch("other"),
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

  const openai = getOpenai();
  if (!openai) {
    res.status(503).json({ error: "AI service is not configured in this environment." });
    return;
  }

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

  const openai = getOpenai();
  if (!openai) {
    res.status(503).json({ error: "AI service is not configured in this environment." });
    return;
  }

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

const InvoiceDescriptionBody = z.object({
  jobId: z.number().int().optional(),
  jobTitle: z.string().min(1),
  jobType: z.string().nullish(),
  notes: z.string().nullish(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().nullish(),
    unit: z.string().nullish(),
    unitPrice: z.number().nullish(),
    amount: z.number(),
  })).default([]),
});

router.post("/ai/invoice-description", async (req, res): Promise<void> => {
  const parsed = InvoiceDescriptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { jobTitle, jobType, notes, lineItems } = parsed.data;

  const openai = getOpenai();
  if (!openai) {
    res.status(503).json({ error: "AI service is not configured in this environment." });
    return;
  }

  const lineItemsText = lineItems.length > 0
    ? lineItems.map(i => `- ${i.description}: $${i.amount.toFixed(2)}`).join("\n")
    : "No specific line items provided.";

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `You are a professional invoice writer for a construction company. Generate professional invoice content.
Respond ONLY with valid JSON: { "servicesDescription": string, "paymentTerms": string }
- servicesDescription: 2-3 sentences describing services rendered in a professional, client-facing tone.
- paymentTerms: A brief payment terms statement (e.g. "Net 30: Payment due within 30 days of invoice date. Late payments subject to 1.5% monthly interest.").`,
      },
      {
        role: "user",
        content: `Job title: "${jobTitle}"\nJob type: ${jobType || "General Construction"}\nNotes: ${notes || "None"}\n\nLine items:\n${lineItemsText}\n\nWrite professional invoice content for this job.`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const resultSchema = z.object({
    servicesDescription: z.string(),
    paymentTerms: z.string(),
  });

  let result: z.infer<typeof resultSchema>;
  try {
    result = resultSchema.parse(JSON.parse(raw));
  } catch {
    res.status(500).json({ error: "AI returned invalid response format" });
    return;
  }

  res.json(result);
});

const invoiceStyleSchema = z.object({
  accentColor: z.string(),
  headerBg: z.string(),
  logoPosition: z.enum(["left", "center", "right"]),
  fontScale: z.number(),
  showPaymentTerms: z.boolean(),
  paymentTermsText: z.string(),
  showNotes: z.boolean(),
  notesText: z.string(),
  footerText: z.string(),
});

const InvoiceDesignBody = z.object({
  message: z.string().min(1),
  current: invoiceStyleSchema,
});

router.post("/ai/invoice-design", async (req, res): Promise<void> => {
  const parsed = InvoiceDesignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, current } = parsed.data;

  const openai = getOpenai();
  if (!openai) {
    res.status(503).json({ error: "AI service is not configured in this environment." });
    return;
  }

  const systemPrompt = `You are an invoice design assistant for a construction company. You help the user restyle and edit a single invoice by chatting in plain language.

You are given the invoice's CURRENT style as JSON. The user sends a request (e.g. "make it blue", "center the logo", "add a thank-you note", "bigger text", "hide payment terms"). Return the COMPLETE updated style object reflecting their request, keeping all other fields unchanged from the current values.

Rules:
- accentColor and headerBg must be valid 6-digit hex strings like "#2563eb", or "" (empty) to clear/use the default. Never invent other formats.
- logoPosition must be one of: "left", "center", "right".
- fontScale is a number between 0.85 and 1.3 (1 = default). "bigger" ~1.15, "smaller" ~0.9.
- showPaymentTerms / showNotes are booleans controlling whether those sections appear.
- paymentTermsText / notesText / footerText are plain text. Only rewrite them if the user asks for content changes; otherwise keep the current values. If the user asks to add a note or terms, write professional, concise copy and set the matching show flag to true.
- Do NOT touch line items, prices, totals, client, or company details — only visual style and the payment-terms/notes/footer copy.

Respond ONLY with valid JSON of this exact shape:
{ "reply": string, "style": { "accentColor": string, "headerBg": string, "logoPosition": "left"|"center"|"right", "fontScale": number, "showPaymentTerms": boolean, "paymentTermsText": string, "showNotes": boolean, "notesText": string, "footerText": string } }
"reply" is a short, friendly one-sentence confirmation of what you changed.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Current style:\n${JSON.stringify(current, null, 2)}\n\nUser request: ${message}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const designResultSchema = z.object({
    reply: z.string(),
    style: invoiceStyleSchema,
  });

  let result: z.infer<typeof designResultSchema>;
  try {
    result = designResultSchema.parse(JSON.parse(raw));
  } catch {
    res.status(500).json({ error: "AI returned invalid response format" });
    return;
  }

  res.json(result);
});

export default router;
