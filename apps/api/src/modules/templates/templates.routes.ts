import { Router } from "express";
import {
  compileTemplate,
  matchTemplate,
  buildTemplateFromSpans,
  detectFields,
  FIELD_TOKENS,
  type FieldName,
} from "@coffeeshop/shared";
import {
  createTemplateSchema,
  updateTemplateSchema,
  testTemplateSchema,
  templateFromSmsSchema,
} from "@coffeeshop/shared";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler, ok, AppError } from "../../lib/http.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { recordAudit } from "../../lib/audit.js";

const router = Router();
router.use(requireAuth);

const UNKNOWN_FIELD = (name: string) => !(name in FIELD_TOKENS);

/** Validate a template body and return compile + extraction diagnostics. */
function diagnose(templateBody: string, smsText?: string) {
  const compiled = compileTemplate(templateBody);
  const unknown = compiled.warnings.filter((w) => w.startsWith("Unknown token"));
  const result = smsText ? matchTemplate(templateBody, smsText) : null;
  return {
    regex: compiled.regex,
    fields: compiled.fields,
    warnings: compiled.warnings,
    hasAmount: compiled.fields.includes("amount" as FieldName),
    errored: unknown.length > 0,
    extraction: result,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = req.query as Record<string, string | undefined>;
    const templates = await prisma.smsTemplate.findMany({
      where: {
        shopId: req.staff!.shopId,
        ...(query.status ? { status: query.status as never } : {}),
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    });
    res.json(ok(templates));
  }),
);

router.get(
  "/fields",
  asyncHandler(async (_req, res) => {
    res.json(ok(Object.values(FIELD_TOKENS)));
  }),
);

router.post(
  "/test",
  validate(testTemplateSchema),
  asyncHandler(async (req, res) => {
    const { templateBody, smsText } = req.body as {
      templateBody: string;
      smsText: string;
    };
    const diag = diagnose(templateBody, smsText);
    // Never expose the raw compiled regex to non-admins as a hard failure; return diagnostics.
    res.json(ok(diag));
  }),
);

router.post(
  "/from-sms",
  validate(templateFromSmsSchema),
  asyncHandler(async (req, res) => {
    const { smsText, spans } = req.body as {
      smsText: string;
      spans: Array<{ field: string; start: number; end: number }>;
    };
    const unknown = spans.filter((s) => UNKNOWN_FIELD(s.field));
    if (unknown.length > 0) {
      throw new AppError(400, `Unknown field(s): ${unknown.map((s) => s.field).join(", ")}`);
    }

    const templateBody = buildTemplateFromSpans(
      smsText,
      spans.map((s) => ({
        field: s.field as FieldName,
        start: s.start,
        end: s.end,
      })),
    );
    const diag = diagnose(templateBody, smsText);
    res.json(
      ok({
        templateBody,
        suggestedFields: detectFields(smsText),
        ...diag,
      }),
    );
  }),
);

router.post(
  "/",
  requireRole("OWNER", "MANAGER"),
  validate(createTemplateSchema),
  asyncHandler(async (req, res) => {
    const input = req.body as {
      name: string;
      provider: "TELEBIRR" | "CBE_BIRR" | "AMOLE" | "AWASH" | "OTHER";
      senderAllowlist: string[];
      templateBody: string;
      direction: "CREDIT" | "DEBIT";
      status: "DRAFT" | "ACTIVE" | "ARCHIVED";
      sampleSms?: string;
    };

    const diag = diagnose(input.templateBody, input.sampleSms);
    if (diag.errored) {
      throw new AppError(400, diag.warnings.join("; "));
    }
    if (input.status === "ACTIVE" && !diag.hasAmount) {
      throw new AppError(400, "An active template must capture an {amount}");
    }

    const created = await prisma.smsTemplate.create({
      data: {
        shopId: req.staff!.shopId,
        name: input.name,
        provider: input.provider,
        senderAllowlist: input.senderAllowlist,
        templateBody: input.templateBody,
        direction: input.direction,
        status: input.status,
        sampleSms: input.sampleSms,
        lastTestedAt: input.sampleSms ? new Date() : null,
        createdById: req.staff!.id,
        fieldMap: diag.fields as never,
        revisions: {
          create: {
            version: 1,
            templateBody: input.templateBody,
            direction: input.direction,
            senderAllowlist: input.senderAllowlist,
            changedById: req.staff!.id,
          },
        },
      },
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "template.create",
      entity: "SmsTemplate",
      entityId: created.id,
      ip: req.ip,
    });
    res.status(201).json(ok(created));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const template = await prisma.smsTemplate.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
      include: {
        revisions: { orderBy: { version: "desc" } },
      },
    });
    if (!template) throw new AppError(404, "Template not found");
    res.json(ok(template));
  }),
);

router.get(
  "/:id/revisions",
  asyncHandler(async (req, res) => {
    const template = await prisma.smsTemplate.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
      select: { id: true },
    });
    if (!template) throw new AppError(404, "Template not found");
    const revisions = await prisma.smsTemplateRevision.findMany({
      where: { templateId: template.id },
      orderBy: { version: "desc" },
      include: { changedBy: { select: { id: true, fullName: true } } },
    });
    res.json(ok(revisions));
  }),
);

router.patch(
  "/:id",
  requireRole("OWNER", "MANAGER"),
  validate(updateTemplateSchema),
  asyncHandler(async (req, res) => {
    const existing = await prisma.smsTemplate.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Template not found");

    const input = req.body as {
      name?: string;
      provider?: "TELEBIRR" | "CBE_BIRR" | "AMOLE" | "AWASH" | "OTHER";
      senderAllowlist?: string[];
      templateBody?: string;
      direction?: "CREDIT" | "DEBIT";
      status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
      sampleSms?: string;
    };

    const bodyChanged =
      (input.templateBody !== undefined && input.templateBody !== existing.templateBody) ||
      (input.direction !== undefined && input.direction !== existing.direction) ||
      (input.senderAllowlist !== undefined);

    let diag = diagnose(input.templateBody ?? existing.templateBody, input.sampleSms);
    if (diag.errored) throw new AppError(400, diag.warnings.join("; "));

    const nextStatus = input.status ?? existing.status;
    if (nextStatus === "ACTIVE" && !diag.hasAmount) {
      throw new AppError(400, "An active template must capture an {amount}");
    }

    const nextVersion = bodyChanged ? existing.version + 1 : existing.version;

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.smsTemplate.update({
        where: { id: existing.id },
        data: {
          name: input.name,
          provider: input.provider,
          senderAllowlist: input.senderAllowlist,
          templateBody: input.templateBody,
          direction: input.direction,
          status: input.status,
          sampleSms: input.sampleSms,
          version: nextVersion,
          fieldMap: diag.fields as never,
          lastTestedAt: input.sampleSms ? new Date() : existing.lastTestedAt,
        },
      });
      if (bodyChanged) {
        await tx.smsTemplateRevision.create({
          data: {
            templateId: t.id,
            version: nextVersion,
            templateBody: t.templateBody,
            direction: t.direction,
            senderAllowlist: t.senderAllowlist,
            changedById: req.staff!.id,
          },
        });
      }
      return t;
    });

    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "template.update",
      entity: "SmsTemplate",
      entityId: existing.id,
      metadata: { version: nextVersion },
      ip: req.ip,
    });
    res.json(ok(updated));
  }),
);

router.post(
  "/:id/activate",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.smsTemplate.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Template not found");

    const diag = diagnose(existing.templateBody);
    if (!diag.hasAmount) {
      throw new AppError(400, "An active template must capture an {amount}");
    }

    const updated = await prisma.smsTemplate.update({
      where: { id: existing.id },
      data: { status: "ACTIVE" },
    });
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "template.activate",
      entity: "SmsTemplate",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json(ok(updated));
  }),
);

router.post(
  "/:id/archive",
  requireRole("OWNER", "MANAGER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.smsTemplate.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Template not found");
    const updated = await prisma.smsTemplate.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED" },
    });
    res.json(ok(updated));
  }),
);

router.delete(
  "/:id",
  requireRole("OWNER"),
  asyncHandler(async (req, res) => {
    const existing = await prisma.smsTemplate.findFirst({
      where: { id: String(req.params.id), shopId: req.staff!.shopId },
    });
    if (!existing) throw new AppError(404, "Template not found");
    await prisma.smsTemplate.delete({ where: { id: existing.id } });
    recordAudit({
      shopId: req.staff!.shopId,
      staffId: req.staff!.id,
      action: "template.delete",
      entity: "SmsTemplate",
      entityId: existing.id,
      ip: req.ip,
    });
    res.json(ok({ deleted: true }));
  }),
);

export { diagnose };
export default router;
