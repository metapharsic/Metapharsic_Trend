import { Role } from "@prisma/client";
import { withAuth, AuthedRequest } from "@/lib/with-auth";
import { ok, badRequest, apiError } from "@/lib/api-response";
import { describeTools, isPharmaChatConfigured, runTool } from "@/lib/pharmachat";
import { z } from "zod";

const InvokeSchema = z.object({
  tool: z.string().min(1),
  args: z.record(z.unknown()).optional().default({}),
});

async function getTools(req: AuthedRequest) {
  return ok({
    configured: isPharmaChatConfigured(),
    tools: describeTools(),
    ...(isPharmaChatConfigured()
      ? {}
      : {
          note: "No ANTHROPIC_API_KEY configured, so natural-language questions cannot be answered yet. The query tools below are live and callable directly via POST { tool, args }.",
        }),
  });
}

/**
 * Invokes a single PharmaChat query tool directly.
 *
 * Natural-language routing is intentionally not faked here: without a model key,
 * guessing intent from keywords would give managers confidently wrong answers about
 * coverage. Callers pick the tool explicitly until a model is wired up.
 */
async function invokeTool(req: AuthedRequest) {
  try {
    const body = await req.json();
    const parsed = InvokeSchema.safeParse(body);
    if (!parsed.success) return badRequest("Validation error", parsed.error.flatten());

    const result = await runTool(parsed.data.tool, parsed.data.args);
    return ok({ tool: parsed.data.tool, result });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Unknown PharmaChat tool")) {
      return badRequest(err.message);
    }
    console.error("[POST /api/ai/pharmachat]", err);
    return apiError("INTERNAL_SERVER_ERROR", "PharmaChat tool invocation failed", 500);
  }
}

export const GET = withAuth(getTools, [Role.ASM, Role.ADMIN]);
export const POST = withAuth(invokeTool, [Role.ASM, Role.ADMIN]);
