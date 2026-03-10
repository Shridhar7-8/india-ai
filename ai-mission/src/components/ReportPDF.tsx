import React from "react";
import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
    Link,
    renderToBuffer,
} from "@react-pdf/renderer";

// Register fonts
Font.register({
    family: "Inter",
    fonts: [
        { src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff" }, // Regular
        { src: "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hjp-Ek-_EeA.woff", fontWeight: "bold" }, // Bold
    ],
});

// Create styles
const styles = StyleSheet.create({
    page: {
        paddingTop: 40,
        paddingLeft: 40,
        paddingRight: 40,
        paddingBottom: 60, // Reserved space for the absolute footer
        fontFamily: "Inter",
        fontSize: 10,
        color: "#1e293b",
        backgroundColor: "#ffffff",
    },
    header: {
        marginBottom: 20,
        paddingBottom: 10,
        borderBottomWidth: 2,
        borderBottomColor: "#10b981",
        borderBottomStyle: "solid",
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#065f46",
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 12,
        color: "#64748b",
    },
    section: {
        marginBottom: 16,
    },
    h2: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#0f172a",
        marginBottom: 8,
        marginTop: 12,
        backgroundColor: "#f1f5f9",
        padding: 6,
    },
    p: {
        marginBottom: 6,
        lineHeight: 1.4,
    },
    strong: {
        fontWeight: "bold",
    },
    table: {
        display: "flex",
        flexDirection: "column",
        width: "auto",
        borderStyle: "solid",
        borderWidth: 1,
        borderColor: "#cbd5e1",
        borderRightWidth: 0,
        borderBottomWidth: 0,
        marginBottom: 12,
    },
    tableRow: {
        flexDirection: "row",
        minHeight: 24,
    },
    tableCol: {
        width: "50%",
        borderStyle: "solid",
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: "#cbd5e1",
    },
    tableCol3: {
        width: "33.33%",
        borderStyle: "solid",
        borderWidth: 1,
        borderLeftWidth: 0,
        borderTopWidth: 0,
        borderColor: "#cbd5e1",
    },
    tableCellHeader: {
        margin: 5,
        fontSize: 10,
        fontWeight: "bold",
        color: "#334155",
    },
    tableCell: {
        margin: 5,
        fontSize: 10,
    },
    flagContainer: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 15,
    },
    flagBox: {
        width: "48%",
        padding: 10,
        borderWidth: 1,
        borderRadius: 4,
    },
    redFlagBox: {
        borderColor: "#fca5a5",
        backgroundColor: "#fef2f2",
    },
    greenFlagBox: {
        borderColor: "#86efac",
        backgroundColor: "#f0fdf4",
    },
    flagTitle: {
        fontSize: 12,
        fontWeight: "bold",
        marginBottom: 8,
    },
    redFlagTitle: { color: "#b91c1c" },
    greenFlagTitle: { color: "#15803d" },
    footer: {
        position: "absolute",
        bottom: 30,
        left: 40,
        right: 40,
        height: 20,
        fontSize: 8,
        color: "#94a3b8",
        textAlign: "center",
        borderTopWidth: 1,
        borderTopColor: "#e2e8f0",
        paddingTop: 10,
    },
});

/**
 * A simple utility to parse exactly the structure we output from the Analyst
 * We do some naive parsing for the exact template structure we defined.
 */
interface ReportData {
    title: string;
    founderProfile: Array<{ field: string; value: string }>;
    solutionSnapshot: Array<{ field: string; value: string }>;
    scorecard: Array<{ zone: string; score: string; note: string }>;
    redFlags: string;
    greenFlags: string;
    missionFit: { verdict?: string; pillar?: string; awareness?: string; reasoning?: string };
    verdict: { verdict?: string; reasoning?: string };
    raw?: string;
}

function parseReportData(markdown: string): ReportData {
    const data: ReportData = {
        title: "",
        founderProfile: [],
        solutionSnapshot: [],
        scorecard: [],
        redFlags: "",
        greenFlags: "",
        missionFit: {},
        verdict: {},
    };

    // Extract title
    const titleMatch = markdown.match(/# (?:INDIAAI MISSION|BUILDAI PITCH EVENT) STARTUP EVALUATION \| (.*)/i);
    if (titleMatch) data.title = titleMatch[1];

    // Split into sections safely. The regex matches the full header line for any section.
    // '## SECTION X — Anything...'
    const sections = markdown.split(/## SECTION \d+ — [^\n]*/);
    if (sections.length < 7) {
        // Fallback: If parsing fails entirely (unexpected format), just return raw body
        return { ...data, raw: markdown };
    }

    // Section 1: Founder Profile (Table)
    const founderLines = sections[1].trim().split('\n');
    let inTable = false;
    for (const line of founderLines) {
        if (line.includes('| Field | Details |')) { inTable = true; continue; }
        if (line.includes('|---|---|')) continue;
        if (inTable && line.startsWith('|')) {
            const parts = line.split('|').map((s) => s.trim()).filter(Boolean);
            if (parts.length >= 2) data.founderProfile.push({ field: parts[0].replace(/\*\*/g, ""), value: parts[1] });
        }
    }

    // Section 2: Solution Snapshot (Table)
    const solutionLines = sections[2].trim().split('\n');
    inTable = false;
    for (const line of solutionLines) {
        if (line.includes('| Field | Details |')) { inTable = true; continue; }
        if (line.includes('|---|---|')) continue;
        if (inTable && line.startsWith('|')) {
            const parts = line.split('|').map((s) => s.trim()).filter(Boolean);
            if (parts.length >= 2) data.solutionSnapshot.push({ field: parts[0].replace(/\*\*/g, ""), value: parts[1] });
        }
    }

    // Section 3: Scorecard (Table)
    const scorecardLines = sections[3].trim().split('\n');
    inTable = false;
    for (const line of scorecardLines) {
        if (line.includes('| Zone | Score | Analyst Note |')) { inTable = true; continue; }
        if (line.includes('|---|---|---|')) continue;
        if (inTable && line.startsWith('|')) {
            const parts = line.split('|').map((s) => s.trim()).filter(Boolean);
            if (parts.length >= 3) data.scorecard.push({
                zone: parts[0],
                score: parts[1],
                note: parts[2]
            });
        }
    }

    // Section 4: Flags (bullet-point format)
    const flagLines = sections[4].trim().split('\n');
    let currentFlagType: 'red' | 'green' | null = null;
    const redFlagItems: string[] = [];
    const greenFlagItems: string[] = [];
    for (const line of flagLines) {
        if (line.includes('RED FLAGS')) { currentFlagType = 'red'; continue; }
        if (line.includes('GREEN FLAGS')) { currentFlagType = 'green'; continue; }
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') && trimmed.length > 2) {
            const flagText = trimmed.substring(2).trim();
            if (flagText && flagText !== 'None') {
                if (currentFlagType === 'red') redFlagItems.push(flagText);
                else if (currentFlagType === 'green') greenFlagItems.push(flagText);
            }
        }
    }
    data.redFlags = redFlagItems.length > 0 ? redFlagItems.join('\n') : "None";
    data.greenFlags = greenFlagItems.length > 0 ? greenFlagItems.join('\n') : "None";

    // Section 5: Mission Fit
    const missionLines = sections[5].trim().split(/\n\n+/);
    for (const block of missionLines) {
        if (block.includes('**Mission Fit:**')) {
            data.missionFit.verdict = block.replace('**Mission Fit:**', '').trim();
        } else if (block.includes('**IndiaAI Pillar:**')) {
            data.missionFit.pillar = block.replace('**IndiaAI Pillar:**', '').trim();
        } else if (block.includes('**IndiaAI Mission Awareness:**')) {
            data.missionFit.awareness = block.replace('**IndiaAI Mission Awareness:**', '').trim();
        } else if (block.includes('**Reasoning:**')) {
            data.missionFit.reasoning = block.replace('**Reasoning:**', '').trim();
        }
    }

    // Section 6: Verdict
    const verdictLines = sections[6].trim().split(/\n\n+/);
    for (const block of verdictLines) {
        if (block.includes('**Verdict:**')) {
            data.verdict.verdict = block.replace('**Verdict:**', '').trim();
        } else if (block.includes('**Reasoning:**')) {
            data.verdict.reasoning = block.replace('**Reasoning:**', '').trim();
        }
    }

    return data;
}

// Sub-components
const StripMarkdown = ({ text }: { text?: string }) => {
    // Strip markdown bold asterisks and <br> tags for standard text elements
    if (!text) return null;
    let clean = text.replace(/\*\*/g, "").replace(/<br>/g, "\n");
    // Strip emojis since React-PDF basic fonts don't support them well
    clean = clean.replace(/[🔴🟢]/g, "").trim();
    return <Text>{clean}</Text>;
};

const cleanField = (field: string) => {
    // Removes things like "[Try to keep it as close as possible...]" or "[1 line]"
    return field.replace(/\[.*?\]/g, "").trim();
};

// Renders cell value with clickable links if markdown link syntax is found
const RenderCellValue = ({ text }: { text?: string }) => {
    if (!text) return null;
    // Match markdown links: [label](url)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/;
    const match = text.match(linkRegex);
    if (match) {
        const label = match[1];
        const url = match[2];
        return <Link src={url} style={{ color: "#2563eb", textDecoration: "underline" }}>{label}</Link>;
    }
    // Fallback: if it looks like a URL, make it clickable
    const trimmed = text.replace(/\*\*/g, "").trim();
    if (trimmed.match(/^https?:\/\//)) {
        return <Link src={trimmed} style={{ color: "#2563eb", textDecoration: "underline" }}>{trimmed}</Link>;
    }
    let clean = text.replace(/\*\*/g, "").replace(/<br>/g, "\n");
    clean = clean.replace(/[🔴🟢]/g, "").trim();
    return <Text>{clean}</Text>;
};

const ReportTemplate = ({ markdown }: { markdown: string }) => {
    const data = parseReportData(markdown);

    if (data.raw) {
        // Fallback for malformed markdown
        return (
            <Document>
                <Page size="A4" style={styles.page}>
                    <Text style={styles.h2}>Raw Output (Parse Failed)</Text>
                    <Text style={styles.p}>{data.raw}</Text>
                </Page>
            </Document>
        );
    }

    return (
        <Document>
            <Page size="A4" style={styles.page} wrap>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>BuildAI Pitch Event</Text>
                    <Text style={styles.subtitle}>Startup Evaluation Report | {data.title}</Text>
                </View>

                {/* Section */}
                <View style={styles.section}>
                    <Text style={styles.h2}>SECTION 1 — FOUNDER PROFILE</Text>
                    <View style={styles.table}>
                        {data.founderProfile.map((row: { field: string; value: string }, i: number) => (
                            <View style={styles.tableRow} key={i}>
                                <View style={[styles.tableCol, { width: "30%" }]}>
                                    <Text style={styles.tableCellHeader}>{cleanField(row.field)}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: "70%" }]}>
                                    <Text style={styles.tableCell}><StripMarkdown text={row.value} /></Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Section 2 */}
                <View style={styles.section}>
                    <Text style={styles.h2}>SECTION 2 — SOLUTION SNAPSHOT</Text>
                    <View style={styles.table}>
                        {data.solutionSnapshot.map((row: { field: string; value: string }, i: number) => (
                            <View style={styles.tableRow} key={i}>
                                <View style={[styles.tableCol, { width: "30%" }]}>
                                    <Text style={styles.tableCellHeader}>{cleanField(row.field)}</Text>
                                </View>
                                <View style={[styles.tableCol, { width: "70%" }]}>
                                    <Text style={styles.tableCell}><RenderCellValue text={row.value} /></Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Section 3 */}
                <View style={styles.section}>
                    <Text style={styles.h2}>SECTION 3 — 5-ZONE SCORECARD [PASS / MODERATE / FAIL]</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableCol3, { width: "20%" }]}><Text style={styles.tableCellHeader}>Zone</Text></View>
                            <View style={[styles.tableCol3, { width: "20%" }]}><Text style={styles.tableCellHeader}>Score</Text></View>
                            <View style={[styles.tableCol3, { width: "60%" }]}><Text style={styles.tableCellHeader}>Analyst Note</Text></View>
                        </View>
                        {data.scorecard.map((row: { zone: string; score: string; note: string }, i: number) => (
                            <View style={styles.tableRow} key={i}>
                                <View style={[styles.tableCol3, { width: "20%" }]}><Text style={styles.tableCellHeader}>{row.zone}</Text></View>
                                <View style={[styles.tableCol3, { width: "20%" }]}>
                                    <Text style={[styles.tableCell, { fontWeight: "bold", color: row.score === "PASS" ? "#10b981" : row.score === "FAIL" ? "#ef4444" : "#f59e0b" }]}>
                                        {row.score}
                                    </Text>
                                </View>
                                <View style={[styles.tableCol3, { width: "60%" }]}><Text style={styles.tableCell}><StripMarkdown text={row.note} /></Text></View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Section 4 */}
                <View style={styles.section}>
                    <Text style={styles.h2}>SECTION 4 — FLAGS</Text>
                    <View style={styles.flagContainer}>
                        <View style={[styles.flagBox, styles.redFlagBox]}>
                            <Text style={[styles.flagTitle, styles.redFlagTitle]}>RED FLAGS</Text>
                            <Text style={styles.p}><StripMarkdown text={data.redFlags} /></Text>
                        </View>
                        <View style={[styles.flagBox, styles.greenFlagBox]}>
                            <Text style={[styles.flagTitle, styles.greenFlagTitle]}>GREEN FLAGS</Text>
                            <Text style={styles.p}><StripMarkdown text={data.greenFlags} /></Text>
                        </View>
                    </View>
                </View>

                {/* Section 5 */}
                <View style={styles.section}>
                    <Text style={styles.h2}>SECTION 5 — AI MISSION FIT [HIGH / MEDIUM / LOW]</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableCol, { width: "30%" }]}><Text style={styles.tableCellHeader}>Mission Fit</Text></View>
                            <View style={[styles.tableCol, { width: "70%" }]}>
                                <Text style={[styles.tableCell, { fontWeight: "bold", color: data.missionFit.verdict === "HIGH" ? "#10b981" : data.missionFit.verdict === "LOW" ? "#ef4444" : "#f59e0b" }]}>
                                    {data.missionFit.verdict || "TBD"}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableCol, { width: "30%" }]}><Text style={styles.tableCellHeader}>IndiaAI Pillar</Text></View>
                            <View style={[styles.tableCol, { width: "70%" }]}><Text style={styles.tableCell}><StripMarkdown text={data.missionFit.pillar} /></Text></View>
                        </View>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableCol, { width: "30%" }]}><Text style={styles.tableCellHeader}>Awareness & Alignment</Text></View>
                            <View style={[styles.tableCol, { width: "70%" }]}><Text style={styles.tableCell}><StripMarkdown text={data.missionFit.awareness} /></Text></View>
                        </View>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableCol, { width: "30%" }]}><Text style={styles.tableCellHeader}>Reasoning</Text></View>
                            <View style={[styles.tableCol, { width: "70%" }]}><Text style={styles.tableCell}><StripMarkdown text={data.missionFit.reasoning} /></Text></View>
                        </View>
                    </View>
                </View>

                {/* Section 6 */}
                <View style={styles.section}>
                    <Text style={styles.h2}>SECTION 6 — AI VERDICT</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableCol, { width: "30%" }]}><Text style={styles.tableCellHeader}>Verdict</Text></View>
                            <View style={[styles.tableCol, { width: "70%" }]}>
                                <Text style={[styles.tableCell, { fontWeight: "bold", color: data.verdict.verdict?.includes("GOOD FIT") ? "#10b981" : data.verdict.verdict?.includes("UNSURE") ? "#f59e0b" : "#ef4444" }]}>
                                    {data.verdict.verdict}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.tableRow}>
                            <View style={[styles.tableCol, { width: "30%" }]}><Text style={styles.tableCellHeader}>Reasoning</Text></View>
                            <View style={[styles.tableCol, { width: "70%" }]}><Text style={styles.tableCell}><StripMarkdown text={data.verdict.reasoning} /></Text></View>
                        </View>
                    </View>
                </View>

                {/* Footer Component */}
                <Text style={styles.footer} fixed>
                    Generated by ITEL Foundation AI • This is a preliminary screening report
                </Text>
            </Page>
        </Document>
    );
};

export async function generateReportPDFBuffer(markdown: string): Promise<Buffer> {
    try {
        const doc = <ReportTemplate markdown={markdown} />;
        const buffer = await renderToBuffer(doc);
        return buffer;
    } catch (e) {
        console.error("PDF generation failed, returning text fallback buffer:", e);
        return Buffer.from(markdown, "utf-8");
    }
}
