/**
 * Taxon search box (SPEC-013). A name-first front door in the exploration header:
 * type a scientific or common name, see a short ranked list (prefix over
 * substring, then notability), and choose one to select that taxon on the map +
 * side panel (REQ-004). Fully in-memory (no fetch); keyboard-navigable combobox
 * with a designed no-match state (REQ-005).
 */

import { useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import {
  SEARCH_MIN_CHARS,
  searchTaxa,
  type SearchableTaxon,
} from "../state/search.js";
import styles from "./exploration.module.css";

interface TaxonSearchProps {
  index: readonly SearchableTaxon[];
  onSelect: (taxonId: string) => void;
}

export function TaxonSearch({
  index,
  onSelect,
}: TaxonSearchProps): ReactElement {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => searchTaxa(query, index), [query, index]);
  const hasQuery = query.trim().length >= SEARCH_MIN_CHARS;
  const showList = open && hasQuery;

  const choose = (taxonId: string): void => {
    onSelect(taxonId);
    setQuery("");
    setOpen(false);
    setActive(0);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      const pick = results[active];
      if (pick) {
        e.preventDefault();
        choose(pick.taxonId);
      }
    } else if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
    }
  };

  return (
    <div className={styles.search}>
      <input
        ref={inputRef}
        type="search"
        className={styles.searchInput}
        placeholder="Search a dinosaur…"
        aria-label="Search a dinosaur by name"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && results[active] ? `${listId}-${active}` : undefined
        }
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {showList && (
        <ul className={styles.searchResults} id={listId} role="listbox">
          {results.length === 0 ? (
            <li className={styles.searchNoMatch} role="status">
              No taxon matches “{query.trim()}”
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.taxonId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`${styles.searchOption} ${
                  i === active ? styles.searchOptionActive : ""
                }`}
                // onMouseDown (not onClick) so the pick fires before the input's
                // blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(r.taxonId);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="sciName">{r.scientificName}</span>
                {r.commonName && (
                  <span className={styles.searchCommon}>{r.commonName}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
