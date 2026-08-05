/**
 * Receipt OCR provider boundary.
 *
 * No OCR credentials are configured in this environment, so `extractReceiptFields`
 * reports `configured: false` rather than inventing values — a fabricated receipt
 * date or amount would silently corrupt expense audits. Wire a real provider by
 * setting OCR_PROVIDER + OCR_API_KEY and implementing the branch below.
 */

export interface ReceiptFields {
  vendor: string | null;
  /** ISO date string parsed from the receipt face. */
  date: string | null;
  amount: number | null;
}

export type OcrResult =
  | { configured: true; fields: ReceiptFields; rawText: string }
  | { configured: false; reason: string };

export function isOcrConfigured(): boolean {
  return Boolean(process.env.OCR_PROVIDER && process.env.OCR_API_KEY);
}

export async function extractReceiptFields(_fileBuffer: Buffer): Promise<OcrResult> {
  if (!isOcrConfigured()) {
    return {
      configured: false,
      reason:
        "OCR provider not configured. Set OCR_PROVIDER (e.g. 'aws-textract') and OCR_API_KEY to enable receipt field extraction.",
    };
  }

  // Real provider call goes here (AWS Textract / Google Vision / self-hosted Tesseract service).
  throw new Error(`OCR provider '${process.env.OCR_PROVIDER}' is configured but not implemented`);
}

/**
 * Validates a receipt date against the claim submission.
 * Kept separate from extraction so it is testable and usable with manually-entered dates.
 */
export function validateReceiptDate(
  receiptDate: Date,
  submittedAt: Date,
  maxAgeDays = 30
): { valid: boolean; reason?: string } {
  if (receiptDate > submittedAt) {
    return { valid: false, reason: "Receipt date is in the future" };
  }
  const ageDays = (submittedAt.getTime() - receiptDate.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays > maxAgeDays) {
    return { valid: false, reason: `Receipt is older than the ${maxAgeDays}-day claim window` };
  }
  return { valid: true };
}
