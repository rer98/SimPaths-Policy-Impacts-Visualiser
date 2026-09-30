/** Connect Data presentation for aggregates supplied by a host application. */
import { comparisonLabel, sourceText } from "./aggregateDataSource";

export default function AggregateDataPanel({ source, error, rowCount }) {
  const label = sourceText(source?.label, "Connected results");
  const message = sourceText(source?.message);
  return (
    <div>
      <p style={{ margin: "0 0 12px", fontSize: 12, lineHeight: 1.5 }}>
        {sourceText(source?.description, "This view uses pre-aggregated results supplied by a connected data source.")}
      </p>
      {source?.controls}
      {error
        ? <p role="alert" style={{ color: "#b91c1c", fontSize: 12 }}>{error}</p>
        : message
          ? <p role="status" style={{ fontSize: 12 }}>{message}</p>
          : rowCount === 0 && <p role="status" style={{ fontSize: 12 }}>No aggregate results are available.</p>}
      <section aria-label="Displayed data source" style={{ fontSize: 12, lineHeight: 1.5 }}>
        <strong>Data source: {label}</strong>
        <p>{comparisonLabel("baseline", source?.names)}</p>
        <p>{comparisonLabel("scenario", source?.names)}</p>
      </section>
    </div>
  );
}
