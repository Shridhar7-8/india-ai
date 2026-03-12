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
        fontSize: 12,
        fontWeight: "bold",
        color: "#fbbf24", // Gold color from image
        marginBottom: 8,
        marginTop: 12,
        backgroundColor: "#1e3a8a", // Navy blue background from image
        padding: 8,
        paddingLeft: 12,
        letterSpacing: 1,
        textTransform: "uppercase"
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
        width: "100%",
        marginBottom: 15,
    },
    flagBox: {
        width: "50%",
        padding: 12,
        borderWidth: 1,
    },
    redFlagBox: {
        borderColor: "#dc2626", // Red border
        backgroundColor: "#fef2f2",
        borderRightWidth: 0, // Prevent double border in middle
    },
    greenFlagBox: {
        borderColor: "#16a34a", // Green border
        backgroundColor: "#f0fdf4",
    },
    flagTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    flagTitle: {
        fontSize: 12,
        fontWeight: "bold",
        marginLeft: 6,
    },
    redFlagTitle: { color: "#b91c1c" },
    greenFlagTitle: { color: "#15803d" },
    flagList: {
        marginLeft: 8,
    },
    flagListItem: {
        flexDirection: "row",
        marginBottom: 6,
    },
    flagBullet: {
        width: 10,
        fontSize: 10,
        marginRight: 4,
    },
    flagText: {
        flex: 1,
        fontSize: 10,
        lineHeight: 1.4,
    },
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
    desirabilityGate: string | null;
    flags: {
        red: string;
        green: string;
    };
    missionFit: { score: string; pillar: string; reasoning: string };
    finalScores: Array<{ label: string; score: string }>;
    overallSummary: string;
    raw?: string;
}

function parseReportData(markdown: string): ReportData {
    const data: ReportData = {
        title: "",
        founderProfile: [],
        solutionSnapshot: [],
        scorecard: [],
        desirabilityGate: null,
        flags: { red: "None detected.", green: "None detected." },
        missionFit: { score: "", pillar: "", reasoning: "" },
        finalScores: [],
        overallSummary: "",
    };

    const titleMatch = markdown.match(/# INDIAAI MISSION STARTUP EVALUATION\s*\n\*\*(.*?)\*\*/i);
    if (titleMatch) data.title = titleMatch[1];
    else {
        // Fallback for older format
        const altTitleMatch = markdown.match(/# (?:INDIAAI MISSION|BUILDAI PITCH EVENT) STARTUP EVALUATION \| (.*)/i);
        if (altTitleMatch) data.title = altTitleMatch[1];
    }
    
    const sections = markdown.split(/## SECTION \d+ — [^\n]*/);
    if (sections.length < 7) {
        return { ...data, raw: markdown };
    }

    // Helper: split a markdown table line on unescaped pipes only
    const splitTableRow = (line: string) => {
        const PLACEHOLDER = '\u00A6'; // ¦ — never appears in our markdown
        return line.replace(/\\\|/g, PLACEHOLDER)
            .split('|')
            .map(s => s.replace(new RegExp(PLACEHOLDER, 'g'), '|').trim())
            .filter(Boolean);
    };

    // Section 1: Founder Profile
    const s1Lines = sections[1].trim().split('\n');
    let inTable = false;
    for (const line of s1Lines) {
        if (line.includes('| | |')) { inTable = true; continue; }
        if (line.includes('|---|---|')) continue;
        if (inTable && line.startsWith('|')) {
            const parts = splitTableRow(line);
            if (parts.length >= 2) data.founderProfile.push({ field: parts[0], value: parts[1] });
        }
    }

    // Section 2: Solution Snapshot
    const s2Lines = sections[2].trim().split('\n');
    inTable = false;
    for (const line of s2Lines) {
        if (line.includes('| | |')) { inTable = true; continue; }
        if (line.includes('|---|---|')) continue;
        if (inTable && line.startsWith('|')) {
            const parts = splitTableRow(line);
            if (parts.length >= 2) data.solutionSnapshot.push({ field: parts[0], value: parts[1] });
        }
    }

    // Section 3: Scorecard
    const s3Lines = sections[3].trim().split('\n');
    inTable = false;
    for (const line of s3Lines) {
        if (line.includes('| Zone | Score | Analyst Note |')) { inTable = true; continue; }
        if (line.includes('|---|---|---|')) continue;
        if (inTable && line.startsWith('|')) {
            const parts = splitTableRow(line);
            if (parts.length >= 2) {
                // Ignore the empty 3rd column for TOTAL row gracefully
                data.scorecard.push({
                    zone: parts[0],
                    score: parts[1],
                    note: parts[2] || ""
                });
            }
        }
        if (line.includes('**DESIRABILITY GATE:**')) {
            data.desirabilityGate = line.replace(/> ⚠️ \*\*DESIRABILITY GATE:\*\*/g, '').trim();
        }
    }

    // Section 4: Flags
    const s4Lines = sections[4].trim().split('\n');
    inTable = false;
    for (const line of s4Lines) {
         if (line.includes('| 🔴 RED FLAGS | 🟢 GREEN FLAGS |')) { inTable = true; continue; }
         if (line.includes('|---|---|')) continue;
         if (inTable && line.startsWith('|')) {
             const parts = splitTableRow(line);
             if (parts.length >= 2) {
                 data.flags.red = parts[0];
                 data.flags.green = parts[1];
                 break;
             }
         }
    }

    // Section 5: Mission Fit
    const s5Str = sections[5].trim();
    const sfMatch = s5Str.match(/\*\*AI Mission Fit Score: (.*?)\*\*/);
    if (sfMatch) data.missionFit.score = sfMatch[1];
    
    const pMatch = s5Str.match(/\*\*IndiaAI Pillar:\*\* (.*)/);
    if (pMatch) data.missionFit.pillar = pMatch[1];

    const rIdx = s5Str.indexOf('**Reasoning:**');
    if (rIdx !== -1) {
        data.missionFit.reasoning = s5Str.substring(rIdx + 14).trim();
    }

    // Section 6: Verdict & Summary
    const s6Str = sections[6].trim();
    const s6Lines = s6Str.split('\n');
    inTable = false;
    let summaryStarted = false;
    const summaryLines: string[] = [];
    for (const line of s6Lines) {
        if (line.includes('| | Score |')) { inTable = true; continue; }
        if (line.includes('|---|---|')) continue;
        if (line.includes('**OVERALL SUMMARY**')) { inTable = false; summaryStarted = true; continue; }
        if (inTable && line.startsWith('|')) {
             const parts = line.split('|').map((s) => s.trim()).filter(Boolean);
             if (parts.length >= 2) {
                 data.finalScores.push({ label: parts[0], score: parts[1] });
             }
        } else if (summaryStarted) {
            if (line.includes('**System Note:**') || line.includes('*END OF REPORT*')) {
                break;
            }
            if (line !== "---") {
                 summaryLines.push(line);
            }
        }
    }
    data.overallSummary = summaryLines.join('\n').trim();

    return data;
}

// Sub-components
const cleanMarkdownSymbols = (text: string) => {
    let clean = text.replace(/<br>/g, "\n");
    clean = clean.replace(/<ul>/g, "").replace(/<\/ul>/g, "");
    clean = clean.replace(/<li>/g, "• ").replace(/<\/li>/g, "\n").trim();
    clean = clean.replace(/[🔴🟢🚨✅]/g, "").trim();
    clean = clean.replace(/\\\|/g, "|"); // Fix escaped pipes
    return clean;
};

const parseInlineBold = (text: string, defaultColor?: string) => {
    // Regex to find **text**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            const innerText = part.slice(2, -2);
            // If the text looks like a flag title (ends in :), we can optionally color it
            // but for now just use bold
            const isRedFlagTitle = defaultColor === "#b91c1c";
            const isGreenFlagTitle = defaultColor === "#15803d";
            return (
                <Text key={index} style={{ fontWeight: "bold", color: defaultColor || "inherit" }}>
                    {innerText}
                </Text>
            );
        }
        return <Text key={index}>{part}</Text>;
    });
};

const StripMarkdown = ({ text }: { text?: string }) => {
    if (!text) return null;
    return <Text>{parseInlineBold(cleanMarkdownSymbols(text))}</Text>;
};

const RenderFlagsList = ({ text, colorClass }: { text: string, colorClass: "red" | "green" }) => {
    // We split by standard • bullets we just created in cleanMarkdownSymbols
    const clean = cleanMarkdownSymbols(text);
    const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
    
    if (lines.length === 0 || (lines.length === 1 && lines[0].toLowerCase().includes("none"))) {
        return <Text style={styles.p}>{lines[0] || "None"}</Text>;
    }

    const titleColor = colorClass === "red" ? "#b91c1c" : "#15803d";

    return (
        <View style={styles.flagList}>
            {lines.map((line, i) => {
                let actualText = line;
                if (line.startsWith("• ")) {
                    actualText = line.substring(2);
                }
                
                // Often LLM formats as "**Flag Type:** Description"
                return (
                    <View key={i} style={styles.flagListItem}>
                        <Text style={styles.flagBullet}>•</Text>
                        <Text style={styles.flagText}>
                            {parseInlineBold(actualText, titleColor)}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
};

const cleanField = (field: string) => {
    return cleanMarkdownSymbols(field).replace(/\*\*/g, "").replace(/\[.*?\]/g, "").trim();
};

const RenderCellValue = ({ text }: { text?: string }) => {
    if (!text) return null;
    
    const clean = cleanMarkdownSymbols(text);

    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let lastIndex = 0;
    const parts = [];
    let match;
    while ((match = linkRegex.exec(clean)) !== null) {
        if (match.index > lastIndex) {
            parts.push(<Text key={lastIndex}>{clean.substring(lastIndex, match.index)}</Text>);
        }
        parts.push(<Link key={"l"+match.index} src={match[2]} style={{ color: "#2563eb", textDecoration: "underline" }}>{match[1]}</Link>);
        lastIndex = linkRegex.lastIndex;
    }
    if (lastIndex < clean.length) {
        parts.push(<Text key={lastIndex}>{clean.substring(lastIndex)}</Text>);
    }

    if (parts.length > 0) {
        return <Text>{parts}</Text>;
    }

    return <Text>{clean}</Text>;
};

const ReportTemplate = ({ markdown }: { markdown: string }) => {
    const data = parseReportData(markdown);

    if (data.raw) {
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
                    <Text style={styles.title}>INDIAAI MISSION STARTUP EVALUATION</Text>
                    <Text style={styles.subtitle}>{data.title}</Text>
                </View>

                {/* Section 1 */}
                <View style={styles.section}>
                    <Text style={styles.h2}>SECTION 1 — FOUNDER PROFILE</Text>
                    <View style={styles.table}>
                        {data.founderProfile.map((row: { field: string; value: string }, i: number) => (
                            <View style={styles.tableRow} key={i} wrap={false}>
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
                            <View style={styles.tableRow} key={i} wrap={false}>
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
                    <Text style={styles.h2}>SECTION 3 — 5-ZONE SCORECARD</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow} wrap={false}>
                            <View style={[styles.tableCol3, { width: "20%" }]}><Text style={styles.tableCellHeader}>Zone</Text></View>
                            <View style={[styles.tableCol3, { width: "20%" }]}><Text style={styles.tableCellHeader}>Score</Text></View>
                            <View style={[styles.tableCol3, { width: "60%" }]}><Text style={styles.tableCellHeader}>Analyst Note</Text></View>
                        </View>
                        {data.scorecard.map((row: { zone: string; score: string; note: string }, i: number) => {
                            const isTotals = row.zone.includes("TOTAL");
                            return (
                                <View style={styles.tableRow} key={i} wrap={false}>
                                    <View style={[styles.tableCol3, { width: "20%" }]}><Text style={[styles.tableCell, { fontWeight: isTotals ? "bold" : "normal" }]}><StripMarkdown text={row.zone} /></Text></View>
                                    <View style={[styles.tableCol3, { width: "20%" }]}><Text style={[styles.tableCell, { fontWeight: "bold" }]}><StripMarkdown text={row.score} /></Text></View>
                                    <View style={[styles.tableCol3, { width: "60%" }]}><Text style={styles.tableCell}><StripMarkdown text={row.note} /></Text></View>
                                </View>
                            );
                        })}
                    </View>
                    {data.desirabilityGate && (
                        <View style={{ backgroundColor: "#fef08a", padding: 8, marginTop: 4, borderRadius: 4 }}>
                            <Text style={{ color: "#854d0e", fontWeight: "bold" }}>⚠️ DESIRABILITY GATE</Text>
                            <Text style={{ color: "#854d0e" }}>{data.desirabilityGate}</Text>
                        </View>
                    )}
                </View>

                {/* Section 4 */}
                <View style={[styles.section, { padding: 0 }]}>
                    <Text style={styles.h2}>SECTION 4 — FLAGS</Text>
                    <View style={styles.flagContainer}>
                        <View style={[styles.flagBox, styles.redFlagBox]}>
                            <View style={styles.flagTitleRow}>
                                {/* Circle icon placeholder using View since SVGs work better but simple borders work */}
                                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#dc2626", opacity: 0.8 }} />
                                <Text style={[styles.flagTitle, styles.redFlagTitle]}>RED FLAGS</Text>
                            </View>
                            <RenderFlagsList text={data.flags.red} colorClass="red" />
                        </View>
                        <View style={[styles.flagBox, styles.greenFlagBox]}>
                            <View style={styles.flagTitleRow}>
                                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: "#16a34a", opacity: 0.8 }} />
                                <Text style={[styles.flagTitle, styles.greenFlagTitle]}>GREEN FLAGS</Text>
                            </View>
                            <RenderFlagsList text={data.flags.green} colorClass="green" />
                        </View>
                    </View>
                </View>

                {/* Section 5 */}
                <View style={styles.section} wrap={false}>
                    <Text style={styles.h2}>SECTION 5 — AI MISSION FIT SCORE</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow} wrap={false}>
                            <View style={[styles.tableCol, { width: "30%" }]}><Text style={styles.tableCellHeader}>AI Mission Fit Score</Text></View>
                            <View style={[styles.tableCol, { width: "70%" }]}>
                                <Text style={[styles.tableCell, { fontWeight: "bold" }]}>
                                    {data.missionFit.score || "TBD"}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.tableRow} wrap={false}>
                            <View style={[styles.tableCol, { width: "30%" }]}><Text style={styles.tableCellHeader}>Reasoning</Text></View>
                            <View style={[styles.tableCol, { width: "70%" }]}><Text style={styles.tableCell}><StripMarkdown text={data.missionFit.reasoning} /></Text></View>
                        </View>
                    </View>
                </View>

                {/* Section 6 */}
                <View style={styles.section}>
                    <Text style={styles.h2}>SECTION 6 — FINAL SCORE & OVERALL SUMMARY</Text>
                    <View style={styles.table}>
                        <View style={styles.tableRow} wrap={false}>
                            <View style={[styles.tableCol, { width: "70%" }]}><Text style={styles.tableCellHeader}>Field</Text></View>
                            <View style={[styles.tableCol, { width: "30%" }]}><Text style={styles.tableCellHeader}>Score</Text></View>
                        </View>
                        {data.finalScores.map((row: { label: string; score: string }, i: number) => {
                            const isTotals = row.label.includes("FINAL SCORE");
                            return (
                                <View style={styles.tableRow} key={i} wrap={false}>
                                    <View style={[styles.tableCol, { width: "70%" }]}><Text style={[styles.tableCell, { fontWeight: isTotals ? "bold" : "normal" }]}><StripMarkdown text={row.label} /></Text></View>
                                    <View style={[styles.tableCol, { width: "30%" }]}><Text style={[styles.tableCell, { fontWeight: isTotals ? "bold" : "normal" }]}><StripMarkdown text={row.score} /></Text></View>
                                </View>
                            );
                        })}
                    </View>
                    <Text style={styles.h2}>OVERALL SUMMARY</Text>
                    <Text style={styles.p}><StripMarkdown text={data.overallSummary} /></Text>
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
