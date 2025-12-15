import React from "react";

export default function ExportPanel({
  onExportSentences,
  onExportLogs,
  onClearLogs,
}) {
  return (
    <div className="panel export-panel">
      <h2>Export</h2>

      <button onClick={onExportSentences}>Export Sentences</button>
      <button onClick={onExportLogs}>Export Logs</button>
      <button onClick={onClearLogs}>Clear Logs</button>
    </div>
  );
}
