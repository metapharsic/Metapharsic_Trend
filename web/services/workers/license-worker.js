/**
 * Multi-threaded License Document Extraction Worker
 * Runs inside a Node.js worker_thread to prevent blocking the main event loop
 * during CPU-intensive regex matching, text normalization, and pattern tokenization.
 */
const { parentPort, workerData, threadId } = require("worker_threads");

function parseLicenseText(rawText, customerTypeHint) {
  const startTime = Date.now();
  const text = (rawText || "").replace(/\r\n/g, "\n");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let licenseNo = null;
  let gstNo = null;
  let entityName = null;
  let contactPerson = null;
  let address = null;
  let licenseType = "RETAIL";
  let validTill = null;
  let phone = null;
  let qualification = null;
  let scores = [];

  // 1. GSTIN Regex: 15-character Indian GST format (e.g., 36ABCDE1234F1Z5)
  const gstMatch = text.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
  if (gstMatch) {
    gstNo = gstMatch[1].toUpperCase();
    scores.push(20);
  }

  // 2. Drug License / Medical Registration Regex
  // Matches Form 20, 20B, 21, 21B, and State Medical Council formats
  const dlPatterns = [
    /(?:D\.?L\.?\s*(?:No\.?|Number)|Licence\s*(?:No\.?|Number)|License\s*(?:No\.?|Number)|Reg\.?\s*(?:No\.?|Number))\s*[:\-]?\s*([A-Z0-9\/\-]{5,35})/i,
    /\b([A-Z]{2}[0-9A-Z\/\-]{2,10}(?:20B?|21B?)[0-9A-Z\/\-]{3,15})\b/i,
    /\b(FORM\s*20[B]?\s*[\/&]\s*21[B]?\s*[:\-]?\s*[A-Z0-9\/\-]{4,25})\b/i,
    /\b([A-Z]{2,4}\/(?:FMR|R|MED)\/[0-9]{4,10})\b/i, // State Medical Council
    /\b([A-Z]{2,3}\s*MC\s*[\-\/]\s*[0-9]{4,10})\b/i,
  ];

  for (const pattern of dlPatterns) {
    const match = text.match(pattern);
    if (match) {
      licenseNo = match[1].trim().replace(/\s+/g, " ");
      scores.push(30);
      break;
    }
  }

  // If no labeled match, look for standard Indian DL code format
  if (!licenseNo) {
    const rawDl = text.match(/\b([A-Z]{2}[-\/][A-Z0-9]{2,8}[-\/][0-9]{4,10})\b/i);
    if (rawDl) {
      licenseNo = rawDl[1].toUpperCase();
      scores.push(20);
    }
  }

  // 3. License Type Detection
  if (text.match(/20B|21B|wholesale|stockist|distributor/i) || customerTypeHint === "DISTRIBUTOR") {
    licenseType = "WHOLESALE";
  } else if (text.match(/hospital\s*pharmacy|inpatient/i) || customerTypeHint === "HOSPITAL") {
    licenseType = "HOSPITAL_PHARMACY";
  } else if (text.match(/medical\s*council|clinic|physician|doctor|mci|nmc/i) || customerTypeHint === "DOCTOR") {
    licenseType = "CLINIC";
  } else {
    licenseType = "RETAIL";
  }

  // 4. Entity Name Extraction
  const namePatterns = [
    /(?:M\/s\.?|Firm Name|Trade Name|Name of Shop|Hospital|Clinic)\s*[:\-]?\s*([A-Za-z0-9\s&.',\-]+)/i,
    /(?:Dr\.?\s+[A-Za-z\s]+)/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      const candidate = match[1] || match[0];
      const cleaned = candidate.split("\n")[0].trim().replace(/^[:\-\s]+/, "");
      if (cleaned.length > 3 && cleaned.length < 80) {
        entityName = cleaned;
        scores.push(20);
        break;
      }
    }
  }

  // Fallback entity name based on common pharmacy/clinic keywords
  if (!entityName) {
    for (const line of lines) {
      if (
        line.match(/\b(pharmacy|medicos|medical\s*store|druggists|healthcare|clinic|hospital)\b/i) &&
        !line.match(/act|rules|government|form|licence|license|department/i)
      ) {
        entityName = line.replace(/^(M\/s\.?|Name\s*[:\-])\s*/i, "").trim();
        scores.push(15);
        break;
      }
    }
  }

  // 5. Contact Person / Pharmacist / Proprietor
  const personPatterns = [
    /(?:Proprietor|Partner|Director|Pharmacist|Regd\.?\s*Pharmacist|Qualified Person|Doctor|Dr\.)\s*[:\-]?\s*([A-Za-z\s.]{3,45})/i,
    /(?:Name of Pharmacist)\s*[:\-]?\s*([A-Za-z\s.]{3,45})/i,
  ];

  for (const pattern of personPatterns) {
    const match = text.match(pattern);
    if (match) {
      const person = match[1].split("\n")[0].trim().replace(/^(mr|ms|dr|mrs)\.?\s+/i, "");
      if (person.length > 2 && !person.match(/pharmacy|chemist|licence/i)) {
        contactPerson = person;
        scores.push(15);
        break;
      }
    }
  }

  // 6. Address & Pin Code Extraction
  const pinMatch = text.match(/\b([1-9][0-9]{5})\b/);
  const addressMatch = text.match(/(?:Address|Premises|Situated at|Place of business)\s*[:\-]?\s*([^\n\r]+(?:\n[^\n\r]+)?)/i);
  if (addressMatch) {
    address = addressMatch[1].replace(/\n/g, ", ").trim();
    scores.push(15);
  } else if (pinMatch) {
    // Find the line containing the pin code
    for (const line of lines) {
      if (line.includes(pinMatch[1]) && line.length > 10) {
        address = line.trim();
        scores.push(10);
        break;
      }
    }
  }

  // 7. Phone / Mobile Number Extraction
  const phoneMatch = text.match(/(?:Phone|Mobile|Contact|Tel|WhatsApp)\s*[:\-]?\s*([+0-9\s\-]{10,15})/i) ||
    text.match(/\b(?:(?:\+91|0)?[6-9][0-9]{9})\b/);
  if (phoneMatch) {
    phone = phoneMatch[1] ? phoneMatch[1].replace(/\D/g, "").slice(-10) : phoneMatch[0].replace(/\D/g, "").slice(-10);
    scores.push(10);
  }

  // 8. Expiry / Valid Till Date Extraction
  const expiryPatterns = [
    /(?:Valid\s*(?:Up\s*to|Till|Upto)|Date\s*of\s*Expiry|Expiry\s*Date|Period\s*to)\s*[:\-]?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4})/i,
    /(?:Valid\s*(?:Up\s*to|Till)|Expiry)\s*[:\-]?\s*([0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2})/i,
  ];

  for (const pattern of expiryPatterns) {
    const match = text.match(pattern);
    if (match) {
      validTill = match[1].trim();
      scores.push(10);
      break;
    }
  }

  // 9. Qualifications (B.Pharm, D.Pharm, MBBS, MD)
  const qualMatch = text.match(/\b(B\.?\s*Pharm|D\.?\s*Pharm|M\.?\s*Pharm|MBBS|MD|MS|DNB|BAMS|BHMS)\b/i);
  if (qualMatch) {
    qualification = qualMatch[0].toUpperCase();
  }

  // Calculate overall confidence score (0 to 100)
  const totalScore = scores.reduce((sum, s) => sum + s, 0);
  const confidenceScore = Math.min(100, Math.max(10, totalScore));

  const processingTimeMs = Date.now() - startTime;

  return {
    licenseNo: licenseNo || null,
    gstNo: gstNo || null,
    entityName: entityName || null,
    contactPerson: contactPerson || null,
    address: address || null,
    licenseType,
    validTill: validTill || null,
    phone: phone || null,
    qualification: qualification || null,
    confidenceScore,
    processingTimeMs,
    isMultiThreaded: true,
    workerThreadId: threadId,
    extractedAt: new Date().toISOString(),
  };
}

if (parentPort) {
  // Executed as a Worker Thread
  const input = workerData || {};
  try {
    const result = parseLicenseText(input.text || "", input.customerTypeHint);
    parentPort.postMessage({ success: true, data: result });
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
  }
}

module.exports = { parseLicenseText };
