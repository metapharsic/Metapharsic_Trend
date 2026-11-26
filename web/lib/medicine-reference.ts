export interface ClinicalReference {
  therapeuticClass: string;
  indications: string[];
  mechanismOfAction: string;
  targetSpecialties: string[];
  standardDosage: string;
  detailingHighlights: string[];
  precautionsAndStorage: string;
}

export interface ShelfLifeStatus {
  daysRemaining: number | null;
  monthsRemaining: number | null;
  status: "HEALTHY" | "WATCH" | "EXPIRING_SOON" | "EXPIRED" | "UNKNOWN";
  label: string;
}

const REFERENCE_PROFILES: Array<{
  match: (name: string, composition: string, sku: string) => boolean;
  profile: ClinicalReference;
}> = [
  {
    match: (n, c, s) => s.includes("MET-CV") || /amoxicillin/i.test(c) || /metamox/i.test(n) || /metaclav/i.test(n),
    profile: {
      therapeuticClass: "Beta-Lactam Antibiotic + Beta-Lactamase Inhibitor",
      indications: [
        "Community-acquired pneumonia & lower respiratory tract infections (LRTI)",
        "Acute bacterial sinusitis, otitis media, and streptococcal pharyngitis/tonsillitis",
        "Complicated & uncomplicated urinary tract infections (UTIs)",
        "Skin, soft-tissue infections & acute dental/odontogenic abscesses",
      ],
      mechanismOfAction:
        "Amoxicillin inhibits bacterial cell-wall mucopeptide synthesis for bactericidal kill, while Clavulanic Acid irreversibly inactivates beta-lactamase enzymes produced by resistant pathogens.",
      targetSpecialties: ["General Physician", "ENT", "Pulmonologist", "Dentist", "General Surgeon"],
      standardDosage: "1 tablet twice daily (every 12 hours) preferably at the start of a meal to enhance absorption and GI tolerability.",
      detailingHighlights: [
        "DPCO-compliant formulation in 10x10 moisture-proof Alu-Alu blister packing protecting clavulanate stability.",
        "Dual bactericidal coverage against beta-lactamase producing respiratory & dental pathogens.",
        "Highest single-SKU revenue & profit contributor across field bookings.",
      ],
      precautionsAndStorage:
        "Contraindicated in penicillin hypersensitivity or history of cholestatic jaundice with co-amoxiclav. Store below 25°C in a dry place protected from moisture.",
    },
  },
  {
    match: (n, c, s) => s.includes("MET-CEF") || /cefixime/i.test(c) || /metacef/i.test(n),
    profile: {
      therapeuticClass: "3rd-Generation Oral Cephalosporin Antibiotic",
      indications: [
        "Uncomplicated typhoid / enteric fever (Salmonella typhi)",
        "Acute bronchitis, exacerbations of COPD & upper respiratory infections",
        "Uncomplicated gonococcal urethritis & urinary tract infections",
        "Switch-down oral therapy after IV cephalosporin hospitalization",
      ],
      mechanismOfAction:
        "Binds penicillin-binding proteins (PBPs) to disrupt bacterial cell-wall cross-linking; highly stable against most plasmid-mediated beta-lactamases.",
      targetSpecialties: ["General Physician", "ENT", "Pediatric / Adolescent Clinic", "Gynecologist"],
      standardDosage: "200 mg twice daily (BD) or 400 mg single daily dose for 5–10 days (14 days in enteric fever) with or without food.",
      detailingHighlights: [
        "DPCO-regulated broad-spectrum oral cephalosporin with reliable tissue penetration.",
        "10x10 Alu-Alu strip prevents humidity degradation in hot/humid storage.",
        "Fast-moving antibiotic across high-footfall GP and clinic counters.",
      ],
      precautionsAndStorage:
        "Adjust dose in severe renal impairment (CrCl < 20 mL/min); monitor for hypersensitivity in penicillin-allergic patients. Store in a cool, dry place below 25°C.",
    },
  },
  {
    match: (n, c, s) =>
      s.includes("MET-SP") || (/aceclofenac/i.test(c) && /serratiopeptidase/i.test(c)) || /metace-sp/i.test(n),
    profile: {
      therapeuticClass: "Triple-Action NSAID + Antipyretic + Proteolytic Enzyme",
      indications: [
        "Post-operative surgical swelling, dental extraction pain & trismus",
        "Orthopedic trauma, sprains, strains, tendonitis & acute sports injuries",
        "Rheumatoid arthritis, osteoarthritis & acute musculoskeletal inflammation",
        "ENT mucosal edema (sinusitis / post-procedural inflammation)",
      ],
      mechanismOfAction:
        "Aceclofenac provides COX-2 preferential anti-inflammatory relief; Paracetamol adds central analgesia; Serratiopeptidase breaks down inflammatory exudates and fibrinous clots to speed swelling resolution.",
      targetSpecialties: ["Orthopedics", "Dentist", "General Surgeon", "ENT", "General Physician"],
      standardDosage: "1 tablet twice daily after meals for acute inflammation/pain; swallow whole (do not crush).",
      detailingHighlights: [
        "Targets both pain cascade (Aceclofenac + Paracetamol) and physical edema clearance (Serratiopeptidase 15 mg).",
        "Strong adoption in dental clinics and ortho practices with high unit profit margin.",
        "Alu-Alu packaging preserves enzyme proteolytic activity over shelf life.",
      ],
      precautionsAndStorage:
        "Avoid in active peptic ulcer, GI bleeding, severe hepatic/renal failure, or late pregnancy. Store below 25°C away from heat and moisture.",
    },
  },
  {
    match: (n, c, s) =>
      s.includes("MET-P") || (/aceclofenac/i.test(c) && /paracetamol/i.test(c)) || /metace-p/i.test(n),
    profile: {
      therapeuticClass: "NSAID + Analgesic/Antipyretic Combination",
      indications: [
        "Acute musculoskeletal pain, low backache, cervical & lumbar spondylosis",
        "Osteoarthritis, rheumatoid arthritis & ankylosing spondylitis flare-ups",
        "Dental toothache, myalgia & painful febrile episodes",
      ],
      mechanismOfAction:
        "Aceclofenac inhibits prostaglandin synthesis peripherally via preferential COX-2 blockade, complemented by Paracetamol's central analgesic and antipyretic action.",
      targetSpecialties: ["General Physician", "Orthopedics", "Dentist"],
      standardDosage: "1 tablet twice daily after meals to minimize gastric irritation.",
      detailingHighlights: [
        "Everyday clinic staple with strong PTR-to-cost margin efficiency (over 82% net margin even after schemes).",
        "Balanced tolerability profile compared to non-selective NSAIDs for short-course musculoskeletal care.",
      ],
      precautionsAndStorage:
        "Use cautiously with PPI gastro-protection in elderly or ulcer-prone patients; respect total daily paracetamol limits. Store in a cool, dry place below 25°C.",
    },
  },
  {
    match: (n, c, s) => s.includes("MET-COL") || (/paracetamol/i.test(c) && !/aceclofenac/i.test(c)) || /metacol/i.test(n),
    profile: {
      therapeuticClass: "Central Analgesic & Antipyretic (650 mg Strength)",
      indications: [
        "High-grade pyrexia, viral/seasonal fever & post-vaccination fever",
        "Headache, migraine, neuralgia & mild-to-moderate somatic pain",
        "Fever management where NSAIDs are contraindicated (e.g. dengue/gastritis)",
      ],
      mechanismOfAction:
        "Inhibits central prostaglandin synthesis in the CNS and modulates the hypothalamic heat-regulating center to produce antipyresis and analgesia without platelet inhibition.",
      targetSpecialties: ["General Physician", "Pediatric / Family Medicine", "Dentist"],
      standardDosage: "1 tablet every 6–8 hours as needed (max 4 tablets / 2600–3000 mg in 24 hours unless physician-directed).",
      detailingHighlights: [
        "High-value 10x15 blister pack (15 tablets per strip vs standard 10 tablets) giving patients extended course per strip.",
        "Safe fever-first choice across general medical & GP clinics.",
      ],
      precautionsAndStorage:
        "Avoid exceeding 4 g/day paracetamol from all combined sources; caution in chronic alcohol use or hepatic impairment. Store below 30°C away from moisture.",
    },
  },
  {
    match: (n, c, s) => s.includes("PAN-DSR") || /pantoprazole/i.test(c) || /pantometa/i.test(n),
    profile: {
      therapeuticClass: "Proton Pump Inhibitor (PPI) + Dopamine-Receptor Prokinetic (SR)",
      indications: [
        "Gastroesophageal reflux disease (GERD), heartburn & acid regurgitation",
        "Prophylaxis of NSAID/antibiotic-induced gastritis (ideal co-prescription with Metace-P/SP & Metamox-CV)",
        "Erosive esophagitis, chronic gastritis & functional dyspepsia with bloating",
      ],
      mechanismOfAction:
        "Pantoprazole 40 mg irreversibly blocks gastric H+/K+-ATPase proton pumps for 24h acid suppression; Sustained-Release Domperidone 30 mg enhances lower esophageal sphincter tone and gastric emptying.",
      targetSpecialties: ["General Physician", "Gastroenterologist", "Orthopedics", "General Surgeon"],
      standardDosage: "1 capsule once daily 30–45 minutes before breakfast; swallow intact (do not open or chew SR pellets).",
      detailingHighlights: [
        "Natural co-prescription bundle alongside NSAIDs (Metace-SP / Metace-P) and oral antibiotics.",
        "Highest percentage gross margin in portfolio (~86% net even with free scheme dispatches).",
      ],
      precautionsAndStorage:
        "Caution in severe hepatic impairment or QT prolongation risk (due to domperidone); avoid co-administration with strong CYP3A4 inhibitors. Store below 25°C in moisture-proof Alu-Alu pack.",
    },
  },
  {
    match: (n, c, s) => s.includes("RAB-DSR") || /rabeprazole/i.test(c) || /rabemeta/i.test(n),
    profile: {
      therapeuticClass: "Rapid-Onset Proton Pump Inhibitor + Sustained-Release Prokinetic",
      indications: [
        "Acute acid peptic disorders, hyperacidity & symptomatic GERD",
        "Duodenal/gastric ulcer healing & H. pylori eradication adjunct",
        "Diabetic gastroparesis, post-prandial fullness, nausea & reflux",
      ],
      mechanismOfAction:
        "Rabeprazole 20 mg achieves faster pKa-driven activation in parietal cells for rapid acid suppression; Domperidone 30 mg SR normalizes antroduodenal motility without CNS sedation.",
      targetSpecialties: ["General Physician", "Gastroenterologist", "Cardiologist / Physician"],
      standardDosage: "1 capsule once daily on an empty stomach 30 minutes before morning meal.",
      detailingHighlights: [
        "Fastest onset acid control among PPI+DSR class; less CYP2C19 genetic variability vs older PPIs.",
        "High-margin gastro anchor generating consistent repeat chemist orders.",
      ],
      precautionsAndStorage:
        "Monitor magnesium with long-term therapy; caution in hepatic dysfunction or cardiac conduction disorders. Keep Alu-Alu strips sealed until use below 25°C.",
    },
  },
];

export function getMedicineReference(product: {
  name: string;
  sku: string;
  composition?: string | null;
  therapySegment?: string | null;
  packSize?: string | null;
}): ClinicalReference {
  const name = product.name || "";
  const comp = product.composition || "";
  const sku = (product.sku || "").toUpperCase();

  for (const entry of REFERENCE_PROFILES) {
    if (entry.match(name, comp, sku)) {
      return entry.profile;
    }
  }

  return {
    therapeuticClass: product.therapySegment || "Pharmaceutical Formulation",
    indications: [
      `Indicated for therapeutic use under ${product.therapySegment || "general medicine"} care per active composition (${comp || name}).`,
    ],
    mechanismOfAction: comp
      ? `Targeted pharmacological activity delivered via ${comp} in ${product.packSize || "standard commercial"} presentation.`
      : `Standard clinical formulation supplied in ${product.packSize || "commercial"} pack.`,
    targetSpecialties: ["General Physician"],
    standardDosage: "Administer strictly as directed by the prescribing registered medical practitioner.",
    detailingHighlights: [
      `Active SKU (${sku}) in ${product.therapySegment || "General"} therapy portfolio.`,
    ],
    precautionsAndStorage: "Review full prescribing information prior to dispensing. Store in a cool, dry place below 25°C.",
  };
}

export function computeShelfLife(
  expDateInput: string | Date | null | undefined,
  now: Date = new Date()
): ShelfLifeStatus {
  if (!expDateInput) {
    return { daysRemaining: null, monthsRemaining: null, status: "UNKNOWN", label: "No expiry set" };
  }
  const exp = expDateInput instanceof Date ? expDateInput : new Date(expDateInput);
  if (Number.isNaN(exp.getTime())) {
    return { daysRemaining: null, monthsRemaining: null, status: "UNKNOWN", label: "Invalid expiry date" };
  }
  const diffDays = Math.floor((exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  const monthsRemaining = Math.round((diffDays / 30.4375) * 10) / 10;

  if (diffDays <= 0) {
    return { daysRemaining: diffDays, monthsRemaining, status: "EXPIRED", label: "Expired" };
  }
  if (diffDays < 90) {
    return { daysRemaining: diffDays, monthsRemaining, status: "EXPIRING_SOON", label: `${diffDays}d left (<3 mo)` };
  }
  if (diffDays < 180) {
    return { daysRemaining: diffDays, monthsRemaining, status: "WATCH", label: `${monthsRemaining} mo left` };
  }
  return { daysRemaining: diffDays, monthsRemaining, status: "HEALTHY", label: `${monthsRemaining} mo left` };
}
