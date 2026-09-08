import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { createHash } from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "visits");
const RECEIPT_ROOT = path.join(process.cwd(), "public", "uploads", "receipts");
const COMPANY_ROOT = path.join(process.cwd(), "public", "uploads", "company");
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_RECEIPT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type UploadResult =
  | { ok: true; result: { relativePath: string } }
  | { ok: false; error: { message: string } };

export async function saveVisitPhoto(
  file: File,
  employeeId: string,
  visitId: string
): Promise<UploadResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: { message: "Photo exceeds maximum size of 10MB" } };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: { message: "Unsupported photo format. Use JPEG, PNG, or WebP" } };
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const relativePath = path.posix.join(employeeId, `${visitId}.${ext}`);
  const destination = path.join(UPLOAD_ROOT, employeeId, `${visitId}.${ext}`);

  await mkdir(path.dirname(destination), { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(destination, buffer);

  return { ok: true, result: { relativePath } };
}

export function photoUrl(relativePath: string): string {
  return `/uploads/visits/${relativePath.split(path.sep).join("/")}`;
}

type ReceiptUploadResult =
  | { ok: true; result: { relativePath: string; hash: string } }
  | { ok: false; error: { message: string } };

export async function saveReceiptFile(file: File, employeeId: string): Promise<ReceiptUploadResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: { message: "Receipt exceeds maximum size of 10MB" } };
  }
  if (!ALLOWED_RECEIPT_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: { message: "Unsupported receipt format. Use JPEG, PNG, WebP, or PDF" } };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buffer).digest("hex");

  const ext = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const fileName = `${hash}.${ext}`;
  const relativePath = path.posix.join(employeeId, fileName);
  const destination = path.join(RECEIPT_ROOT, employeeId, fileName);

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, buffer);

  return { ok: true, result: { relativePath, hash } };
}

export function receiptUrl(relativePath: string): string {
  return `/uploads/receipts/${relativePath.split(path.sep).join("/")}`;
}

type LogoUploadResult =
  | { ok: true; result: { relativePath: string } }
  | { ok: false; error: { message: string } };

export async function saveCompanyLogo(file: File): Promise<LogoUploadResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: { message: "Logo exceeds maximum size of 10MB" } };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: { message: "Unsupported logo format. Use JPEG, PNG, or WebP" } };
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const relativePath = `logo.${ext}`;
  const destination = path.join(COMPANY_ROOT, relativePath);

  await mkdir(COMPANY_ROOT, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(destination, buffer);

  return { ok: true, result: { relativePath } };
}

export function logoUrl(relativePath: string): string {
  return `/uploads/company/${relativePath}?v=${Date.now()}`;
}

const DMS_ROOT = path.join(process.cwd(), "public", "uploads", "dms");
const MAX_DMS_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit

type DmsUploadResult =
  | { ok: true; result: { relativePath: string; fileName: string; fileSize: number; fileType: string } }
  | { ok: false; error: { message: string } };

export async function saveDmsFile(file: File): Promise<DmsUploadResult> {
  if (file.size > MAX_DMS_FILE_SIZE_BYTES) {
    return { ok: false, error: { message: "File exceeds maximum allowed size of 50MB" } };
  }

  const fileExt = path.extname(file.name).substring(1).toUpperCase() || "BIN";
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const storedFileName = `DOC-${uniqueSuffix}.${fileExt.toLowerCase()}`;
  const destination = path.join(DMS_ROOT, storedFileName);

  await mkdir(DMS_ROOT, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(destination, buffer);

  return {
    ok: true,
    result: {
      relativePath: `/uploads/dms/${storedFileName}`,
      fileName: file.name,
      fileSize: file.size,
      fileType: fileExt,
    },
  };
}

export function dmsUrl(relativePath: string): string {
  return relativePath;
}

