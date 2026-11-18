import { and, desc, eq } from "drizzle-orm";
import { KycFields } from "@fedha/contracts";
import { schema } from "../../../shared/database/client";
import type { Ctx } from "../../../shared/context";
import { conflict, notFound, unprocessable } from "../../../shared/errors/app-error";
import { kycId, uuid } from "../../../shared/security/ids";
import { decrypt, encrypt } from "../../../shared/security/crypto";
import { audit } from "../../../shared/audit/audit";
import { getSettings } from "../../admin/application/settings";
import { receivedGross, type Streamer } from "../../streamers/application/streamers.service";
import { notifyStreamer } from "../../notifications/application/notifications.service";

export const KYC_FILES = ["bi_front", "bi_back", "selfie", "bank_proof", "nif_doc"] as const;
const REQUIRED = ["bi_front", "bi_back", "selfie", "bank_proof"] as const;
const MAX_FILE = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export interface UploadedFile { field: string; mime: string; data: Buffer }

const maskIban = (iban: string) => `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;

export async function bankAccountOf(ctx: Ctx, streamerId: string) {
  return ctx.db.query.bankAccounts.findFirst({
    where: and(eq(schema.bankAccounts.streamerId, streamerId), eq(schema.bankAccounts.status, "verified")),
    orderBy: desc(schema.bankAccounts.createdAt),
  });
}

export async function getKyc(ctx: Ctx, s: Streamer) {
  const sub = await ctx.db.query.kycSubmissions.findFirst({ where: eq(schema.kycSubmissions.streamerId, s.id), orderBy: desc(schema.kycSubmissions.createdAt) });
  const settings = await getSettings(ctx);
  const bank = await bankAccountOf(ctx, s.id);
  return {
    status: s.kycStatus as "not_started" | "pending" | "approved" | "rejected" | "correction_requested",
    reason: sub?.decisionReason ?? null,
    submittedAt: sub?.createdAt.toISOString() ?? null,
    data: sub ? { fullName: sub.fullName, birthDate: sub.birthDate, biNumber: sub.biNumber, nif: sub.nif, address: sub.address, iban: maskIban(sub.iban), bankName: sub.bankName } : null,
    documents: sub ? Object.keys(sub.documents) : [],
    limits: { unverifiedLimit: settings.kycUnverifiedLimit, receivedSoFar: await receivedGross(ctx, s.id) },
    bankAccount: bank ? { ibanMasked: maskIban(bank.iban), bankName: bank.bankName, verified: true, withdrawalsLockedUntil: bank.withdrawalsLockedUntil?.toISOString() ?? null } : null,
  };
}

/** A7 — dados pessoais, BI (frente e verso), NIF, selfie com o BI e IBAN com comprovativo. Ficheiros cifrados em repouso. */
export async function submitKyc(ctx: Ctx, s: Streamer, rawFields: Record<string, string>, files: UploadedFile[], actorId: string) {
  if (s.kycStatus === "pending") throw conflict("kyc_pending", "A tua verificação já está em análise.");
  if (s.kycStatus === "approved" && !rawFields.iban) throw conflict("kyc_approved", "A tua conta já está verificada.");
  const parsed = KycFields.safeParse(rawFields);
  if (!parsed.success) {
    const i = parsed.error.issues[0]!;
    throw unprocessable("validation_error", i.message, { field: String(i.path[0] ?? "") });
  }
  const f = parsed.data;
  const prev = await ctx.db.query.kycSubmissions.findFirst({ where: eq(schema.kycSubmissions.streamerId, s.id), orderBy: desc(schema.kycSubmissions.createdAt) });
  const id = kycId();
  const documents: Record<string, string> = {};
  for (const file of files) {
    if (!(KYC_FILES as readonly string[]).includes(file.field)) continue;
    if (!ALLOWED.includes(file.mime)) throw unprocessable("file_type", "Envia fotografias (JPG, PNG, WebP) ou PDF.", { field: file.field });
    if (file.data.length > MAX_FILE) throw unprocessable("file_too_large", "Cada ficheiro pode ter no máximo 8 MB.", { field: file.field });
    const key = `kyc/${s.id}/${id}/${file.field}.bin`;
    await ctx.storage.put(key, encrypt(ctx.env.ENCRYPTION_KEY, Buffer.concat([Buffer.from(`${file.mime}\n`), file.data])), "application/octet-stream");
    documents[file.field] = key;
  }
  // Numa correção, os documentos que não foram reenviados mantêm-se.
  const merged = { ...(prev && s.kycStatus === "correction_requested" ? prev.documents : {}), ...documents };
  const missing = REQUIRED.filter((r) => !merged[r]);
  if (missing.length) throw unprocessable("documents_missing", `Faltam documentos: ${missing.join(", ")}.`, { field: missing[0] });

  const now = ctx.now();
  await ctx.db.transaction(async (tx) => {
    await tx.insert(schema.kycSubmissions).values({ id, streamerId: s.id, status: "pending", ...f, documents: merged, createdAt: now });
    await tx.insert(schema.bankAccounts).values({ id: uuid(), streamerId: s.id, iban: f.iban, bankName: f.bankName, holderName: f.fullName, status: "pending", createdAt: now });
    await tx.update(schema.streamers).set({ kycStatus: "pending" }).where(eq(schema.streamers.id, s.id));
  });
  await audit(ctx, { actorId, actorType: "streamer", action: "kyc.submitted", targetType: "kyc", targetId: id, streamerId: s.id });
  return id;
}

/** B3 — decisão do admin. Aprovar verifica o IBAN; trocar de IBAN bloqueia levantamentos 48 h. */
export async function decideKyc(ctx: Ctx, submissionId: string, decision: "approved" | "rejected" | "correction_requested", reason: string | null, adminId: string) {
  const sub = await ctx.db.query.kycSubmissions.findFirst({ where: eq(schema.kycSubmissions.id, submissionId) });
  if (!sub) throw notFound("Verificação");
  if (sub.status !== "pending") throw conflict("kyc_decided", "Esta verificação já foi decidida.");
  const now = ctx.now();
  await ctx.db.transaction(async (tx) => {
    await tx.update(schema.kycSubmissions).set({ status: decision, decisionReason: reason, reviewedBy: adminId, reviewedAt: now }).where(eq(schema.kycSubmissions.id, sub.id));
    await tx.update(schema.streamers).set({ kycStatus: decision }).where(eq(schema.streamers.id, sub.streamerId));
    const pendingBank = await tx.query.bankAccounts.findFirst({ where: and(eq(schema.bankAccounts.streamerId, sub.streamerId), eq(schema.bankAccounts.status, "pending")), orderBy: desc(schema.bankAccounts.createdAt) });
    if (decision === "approved" && pendingBank) {
      const previous = await tx.query.bankAccounts.findFirst({ where: and(eq(schema.bankAccounts.streamerId, sub.streamerId), eq(schema.bankAccounts.status, "verified")) });
      if (previous) await tx.update(schema.bankAccounts).set({ status: "replaced" }).where(eq(schema.bankAccounts.id, previous.id));
      const changed = previous && previous.iban !== pendingBank.iban;
      await tx.update(schema.bankAccounts).set({ status: "verified", verifiedAt: now, withdrawalsLockedUntil: changed ? new Date(now.getTime() + 48 * 3600_000) : null }).where(eq(schema.bankAccounts.id, pendingBank.id));
    } else if (pendingBank) {
      await tx.update(schema.bankAccounts).set({ status: "replaced" }).where(eq(schema.bankAccounts.id, pendingBank.id));
    }
  });
  await audit(ctx, { actorId: adminId, actorType: "admin", action: `kyc.${decision}`, targetType: "kyc", targetId: sub.id, streamerId: sub.streamerId, data: { reason } });
  const msg = decision === "approved" ? "A tua identidade foi verificada. Já podes levantar." : decision === "rejected" ? `Verificação rejeitada: ${reason}` : `Precisamos de uma correção: ${reason}`;
  await notifyStreamer(ctx, sub.streamerId, "kyc_decided", "Verificação de identidade", msg);
  ctx.bus.emit("kyc.decided", { streamerId: sub.streamerId, status: decision });
}

/** Documento decifrado para o admin ver. Cada acesso fica registado. */
export async function readKycDocument(ctx: Ctx, submissionId: string, field: string, adminId: string, ip: string | null) {
  const sub = await ctx.db.query.kycSubmissions.findFirst({ where: eq(schema.kycSubmissions.id, submissionId) });
  const key = sub?.documents[field];
  if (!sub || !key) throw notFound("Documento");
  const file = await ctx.storage.get(key);
  if (!file) throw notFound("Documento");
  const plain = decrypt(ctx.env.ENCRYPTION_KEY, file.data);
  const nl = plain.indexOf(10);
  await audit(ctx, { actorId: adminId, actorType: "admin", action: "kyc.document_viewed", targetType: "kyc", targetId: sub.id, streamerId: sub.streamerId, data: { field }, ip });
  return { mime: plain.subarray(0, nl).toString(), data: plain.subarray(nl + 1) };
}
