import { addJob } from "../client.js";

// Valid calls — should compile without error
addJob("scan", { scanId: "s1", url: "https://example.com" });
addJob("fix", { scanId: "s1", checkIds: ["llms-txt"] });
addJob("report", { scanId: "s1", format: "pdf" });
addJob("analysis", { scanId: "s1", type: "semantic" });
addJob("analysis", { scanId: "s1", type: "citation" });

// Invalid calls — should fail to compile

// @ts-expect-error - wrong data for queue name (scan data to fix queue)
addJob("fix", { scanId: "s1", url: "https://example.com" });

// @ts-expect-error - missing required field (url)
addJob("scan", { scanId: "s1" });

// @ts-expect-error - invalid queue name
addJob("nonexistent", { scanId: "s1" });

// @ts-expect-error - wrong analysis type
addJob("analysis", { scanId: "s1", type: "invalid" });

// @ts-expect-error - userId is not part of ScanJobData
addJob("scan", { scanId: "s1", url: "https://example.com", userId: "u1" });

// @ts-expect-error - userId is not part of FixJobData
addJob("fix", { scanId: "s1", checkIds: ["llms-txt"], userId: "u1" });

// @ts-expect-error - userId is not part of ReportJobData
addJob("report", { scanId: "s1", format: "pdf", userId: "u1" });

// @ts-expect-error - userId is not part of AnalysisJobData
addJob("analysis", { scanId: "s1", type: "semantic", userId: "u1" });
