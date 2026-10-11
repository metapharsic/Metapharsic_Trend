import path from "path";
import { Worker } from "worker_threads";
import { parseLicenseText } from "./workers/license-worker";

export interface ExtractedLicenseData {
  licenseNo: string | null;
  gstNo: string | null;
  entityName: string | null;
  contactPerson: string | null;
  address: string | null;
  licenseType: "RETAIL" | "WHOLESALE" | "HOSPITAL_PHARMACY" | "CLINIC" | string;
  validTill: string | null;
  phone: string | null;
  qualification: string | null;
  confidenceScore: number;
  processingTimeMs: number;
  isMultiThreaded: boolean;
  workerThreadId: number;
  extractedAt: string;
}

export interface LicenseParseOptions {
  multiThread?: boolean;
  customerTypeHint?: "CHEMIST" | "DOCTOR" | "DISTRIBUTOR" | "HOSPITAL";
  fileName?: string;
  mimeType?: string;
}

export class LicenseParserService {
  /**
   * Parses text or document payload using Node.js Worker Thread (multi-thread mode)
   * or inline thread fallback.
   */
  static async parse(
    rawText: string,
    options: LicenseParseOptions = {}
  ): Promise<ExtractedLicenseData> {
    const useMultiThread = options.multiThread !== false;

    if (useMultiThread) {
      try {
        return await this.parseInWorker(rawText, options.customerTypeHint);
      } catch (workerErr) {
        console.warn("[LicenseParserService] Worker thread fallback to main thread:", workerErr);
        // Graceful fallback to inline execution
        const res = parseLicenseText(rawText, options.customerTypeHint);
        return {
          ...res,
          isMultiThreaded: false,
          workerThreadId: 0,
        };
      }
    } else {
      const res = parseLicenseText(rawText, options.customerTypeHint);
      return {
        ...res,
        isMultiThreaded: false,
        workerThreadId: 0,
      };
    }
  }

  /**
   * Spawns a dedicated Node.js Worker Thread to process the extraction asynchronously.
   */
  private static parseInWorker(
    text: string,
    customerTypeHint?: string
  ): Promise<ExtractedLicenseData> {
    return new Promise((resolve, reject) => {
      const workerPath = path.resolve(process.cwd(), "services/workers/license-worker.js");
      const worker = new Worker(workerPath, {
        workerData: { text, customerTypeHint },
      });

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("Worker thread execution timed out after 5000ms"));
      }, 5000);

      worker.on("message", (msg) => {
        clearTimeout(timeout);
        worker.terminate();
        if (msg.success) {
          resolve(msg.data);
        } else {
          reject(new Error(msg.error || "Worker thread failed extraction"));
        }
      });

      worker.on("error", (err) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(err);
      });

      worker.on("exit", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  /**
   * Sample presets for testing and instantaneous MR field demonstrations.
   */
  static getSampleLicenses(): { label: string; type: string; sampleText: string }[] {
    return [
      {
        label: "Telangana Form 20 & 21 (Retail Chemist)",
        type: "CHEMIST",
        sampleText: `GOVERNMENT OF TELANGANA
DRUGS CONTROL ADMINISTRATION
LICENCE TO SELL, STOCK OR EXHIBIT OR OFFER FOR SALE, OR DISTRIBUTE DRUGS OTHER THAN THOSE SPECIFIED IN SCHEDULE C, C(1) AND X
FORM 20 & FORM 21
Licence No: TS/HYD/2024/9912 & TS/HYD/2024/9913
Firm Name: M/s Apollo Pharmacy Yakutpura
Proprietor: Mohammed Zubair
Regd. Pharmacist: Mohammed Zubair, D.Pharm
Premises: Shop No. 4, Ground Floor, Station Road, Yakutpura, Hyderabad - 500023
GSTIN: 36AABCA1234F1Z5
Contact: 9849012345
Valid Up to: 31/12/2029`,
      },
      {
        label: "Maharashtra Form 20B & 21B (Pharma Distributor / Wholesale)",
        type: "DISTRIBUTOR",
        sampleText: `FOOD AND DRUG ADMINISTRATION, MAHARASHTRA STATE
LICENCE TO SELL, STOCK OR EXHIBIT OR OFFER FOR SALE, OR DISTRIBUTE BY WHOLESALE DRUGS
FORM 20B & FORM 21B
Licence No: MH-TZ4-246810 & MH-TZ4-246811
Trade Name: M/s Medico Pharma Stockists
Partner: Rajesh K. Patel
Address: Gala No. 12, Shreeji Commercial Complex, Thane West, Mumbai - 400601
GSTIN: 27AABCM9876K1Z9
Valid Up to: 15/08/2028
Phone: 9820011223`,
      },
      {
        label: "State Medical Council Registration (Doctor)",
        type: "DOCTOR",
        sampleText: `DELHI MEDICAL COUNCIL
CERTIFICATE OF REGISTRATION UNDER DELHI MEDICAL COUNCIL ACT, 1997
Registration No: DMC/R/54321
Full Name: Dr. Rajesh Verma
Qualification: MBBS, MD (General Medicine)
Date of Registration: 12/04/2016
Clinic Address: Verma Health Clinic, B-42, Vikas Marg, Preet Vihar, New Delhi - 110092
Mobile: 9811223344
Valid Up to: 11/04/2031`,
      },
    ];
  }
}
