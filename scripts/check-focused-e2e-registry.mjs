import { checkFocusedE2eRegistry } from "./focused-e2e-registry.mjs";

const printTextReport = (report) => {
  if (report.findings.length > 0) {
    console.error("Focused e2e registry violations found:");
    for (const finding of report.findings) {
      console.error(`- ${finding}`);
    }
    return;
  }

  console.log(
    `Focused e2e registry check passed: ${report.summary.entryCount} entries, ` +
      `${report.summary.includedInEditorAggregateCount} aggregate-discoverable, ` +
      `${report.summary.standaloneDirectVerificationCount} standalone direct.`
  );
};

const main = async () => {
  const json = process.argv.includes("--json");
  const report = await checkFocusedE2eRegistry();

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextReport(report);
  }

  if (report.verdict !== "pass") {
    process.exitCode = 1;
  }
};

await main();
