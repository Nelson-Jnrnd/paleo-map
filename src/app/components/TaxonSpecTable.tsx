/**
 * Taxon "at a glance" spec table (SPEC-014 REQ-005 / AMEND-002). A plain ruled
 * table — one field per line, no boxes — for the page's right-hand data column:
 * length · height · weight · diet · period · age · occurrences, drawn from the
 * enrichment record with PBDB fallbacks. The compact size-vs-human silhouette
 * (REQ-004) sits beneath it. Rows with no value are omitted (never invented).
 */

import type { ReactElement } from "react";
import type {
  EnrichedMeasurement,
  EnrichmentRecord,
  TimeRange,
} from "../../domain/index.js";
import { formatMaRange } from "../format.js";
import { SizeHero } from "./SizeHero.js";
import styles from "./exploration.module.css";

interface TaxonSpecTableProps {
  taxonName: string;
  enrichment: EnrichmentRecord | null;
  /** Diet from PBDB ecospace, used when enrichment has none. */
  pbdbDiet: string | null;
  /** Recorded span across all occurrences. */
  range: TimeRange | null;
  occurrenceCount: number;
  bodyLengthM: number | null;
  silhouette: string | null;
}

function Measure({ m }: { m: EnrichedMeasurement }): ReactElement {
  return (
    <>
      {m.value} {m.unit}
    </>
  );
}

export function TaxonSpecTable({
  taxonName,
  enrichment,
  pbdbDiet,
  range,
  occurrenceCount,
  bodyLengthM,
  silhouette,
}: TaxonSpecTableProps): ReactElement {
  const e = enrichment;
  const diet = e?.diet ?? pbdbDiet;
  const rows: Array<{ key: string; value: ReactElement; word?: boolean }> = [];
  if (e?.bodyLength)
    rows.push({ key: "Length", value: <Measure m={e.bodyLength} /> });
  if (e?.height) rows.push({ key: "Height", value: <Measure m={e.height} /> });
  if (e?.mass) rows.push({ key: "Weight", value: <Measure m={e.mass} /> });
  if (diet) rows.push({ key: "Diet", value: <>{diet}</>, word: true });
  if (range) rows.push({ key: "Age", value: <>{formatMaRange(range)}</> });
  rows.push({ key: "Occurrences", value: <>{occurrenceCount}</> });

  return (
    <aside className={styles.specAside}>
      <table className={styles.specTable}>
        <caption className={styles.specCaption}>At a glance</caption>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.key}</th>
              <td className={r.word ? undefined : "mono"}>{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {bodyLengthM !== null && bodyLengthM > 0 && (
        <SizeHero
          taxonName={taxonName}
          lengthM={bodyLengthM}
          dinoSilhouette={silhouette}
        />
      )}
    </aside>
  );
}
