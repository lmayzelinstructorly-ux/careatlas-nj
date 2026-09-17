import type { TractPublicRecord } from "../../types/tractPublicRecord";

export function TractSourceSummary({ record }: { record: TractPublicRecord }) {
  const sources = Array.from(
    new Map(record.sources.map((source) => [
      `${source.agency}|${source.dataset}|${source.url}`,
      source
    ])).values()
  );
  const checkedDates = sources.flatMap((source) =>
    source.checkedDate ? [source.checkedDate] : []
  ).sort();

  return (
    <section aria-label="Evidence sources" className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-hb-muted">Evidence sources</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        Record built {record.generatedDate}
        {checkedDates.length > 0 && ` · Sources checked ${checkedDates[0]}${checkedDates.at(-1) !== checkedDates[0] ? `–${checkedDates.at(-1)}` : ""}`}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs leading-5">
        {sources.map((source) => (
          <li key={`${source.agency}|${source.dataset}|${source.url}`}>
            {source.url ? (
              <a className="font-semibold text-hb-teal underline decoration-hb-aqua/60 underline-offset-2 hover:text-hb-navy" href={source.url} rel="noreferrer" target="_blank">
                {source.dataset}
              </a>
            ) : <span className="text-slate-600">{source.dataset}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
