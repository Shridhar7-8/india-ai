import { config } from "dotenv";
config({ path: ".env.local" }); // Load environment variables

import { generateReportPDFBuffer } from "./src/components/ReportPDF";
import { sendReportEmail } from "./src/lib/email";
import * as fs from "fs";
import * as path from "path";

const MOCK_MARKDOWN = `# BUILDAI PITCH EVENT STARTUP EVALUATION | Jane Doe | Acme AI Corp | 6 March 2026

## SECTION 1 — FOUNDER PROFILE

| Field | Details |
|---|---|
| **Who They Are** | 10 years experience in AI, previous founder. |
| **Why Entrepreneurship** | deeply passionate about solving developer productivity |
| **Financial Commitments** | None |
| **Goals** | MVP in 3 months, 1m ARR in 2 years. |
| **Grit Score** | HIGH <br><br> Evidence: Bootstrapped previous company to profitability |
| **Business Thinking** | Understands B2B SaaS and CAC vs LTV |
| **Founder Structure** | Solo Founder |

## SECTION 2 — SOLUTION SNAPSHOT

| Field | Details |
|---|---|
| **IDEA** | AI-powered code reviewer that understands full context. |
| **Macro context** | Developers spend 30% of time reviewing PRs. |
| **Why AI** | Requires deep semantic understanding of code beyond static analysis. |
| **Development Stage** | Prototype |
| **Assets** | Proprietary datasets of reviewed PRs. |
| **Pitch Deck** | Not provided |
| **Website** | https://acme.ai |

## SECTION 3 — 5-ZONE SCORECARD [PASS / MODERATE / FAIL]

| Zone | Score | Analyst Note |
|---|---|---|
| Desirability | PASS | High pain point for engineers |
| Viability and Scalability | PASS | Standard B2B SaaS model |
| Feasibility | MODERATE | High technical risk |
| Defensibility | MODERATE | Relies on data moat over time |
| Affordability | PASS | $50/mo is well within budget |

## SECTION 4 — FLAGS

### 🔴 RED FLAGS
- Solo technical founder without dedicated sales motion
- Currently pre-revenue with no active MRR

### 🟢 GREEN FLAGS
- Previous founder experience
- Deep technical expertise in the domain

## SECTION 5 — AI MISSION FIT [HIGH / MEDIUM / LOW]

**Mission Fit:** HIGH

**IndiaAI Pillar:** IndiaAI Application Development Initiative

**IndiaAI Mission Awareness:** Aware

**Reasoning:** The startup aims to build a core AI application that improves efficiency, aligning directly with the application development pillar.

## SECTION 6 — AI VERDICT [GOOD FIT / UNSURE / DOES NOT SEEM LIKE A GOOD FIT]

**Verdict:** SEEMS LIKE A GOOD FIT

**Reasoning:** Strong technical founder addressing a real problem with a clear business model. Technical risks exist but are offset by the founder's experience.

END OF REPORT
`;

async function runTest() {
    console.log("🚀 Starting Report Generation & Email Test (with MOCK MARKDOWN)...");

    console.log("📄 1. Generating PDF buffer from MOCK markdown...");
    const pdfBuffer = await generateReportPDFBuffer(MOCK_MARKDOWN);
    console.log(`✅ PDF generated (Size: ${pdfBuffer.length} bytes)`);

    const testPdfPath = path.join(process.cwd(), "test-report-output.pdf");
    fs.writeFileSync(testPdfPath, pdfBuffer);
    console.log(`💾 Saved PDF locally to ${testPdfPath} for manual inspection.`);

    console.log("📧 2. Sending Email...");
    const recipientEmail = process.env.REPORT_RECIPIENT_EMAIL || "test@example.com";
    console.log(`Attempting to send email to: ${recipientEmail}`);

    const success = await sendReportEmail({
        recipientEmail,
        pdfBuffer,
        conversationTitle: "E2E Test Session (Mocked)",
        conversationId: 99999,
        companyName: "Acme AI Corp",
    });

    if (success) {
        console.log(`✅ Email step completed successfully!`);
    } else {
        console.log("❌ Failed to send email. Check logs.");
    }

    console.log("🎉 Test complete!");
    process.exit(0);
}

runTest().catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
});
