import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GeographyData } from "../../hooks/useGeographyData";
import { BoundaryAutocomplete, type BoundaryAutocompleteCandidate } from "./BoundaryAutocomplete";
import { GapExplorer } from "./GapExplorer";

import { newarkExampleUrl } from "./mapExamples";

type Props = {
  countyData: GeographyData | null;
  townData: GeographyData | null;
  onSelect: (candidate: BoundaryAutocompleteCandidate) => void;
  selectionId: string | null;
  addressSearch: ReactNode;
  children: ReactNode;
};

export function GapSidebar({ countyData, townData, onSelect, selectionId, addressSearch, children }: Props) {
  const [searchOpen, setSearchOpen] = useState(!selectionId);
  const sidebarRef = useRef<HTMLElement>(null);
  useEffect(() => {
    setSearchOpen(!selectionId);
    if (sidebarRef.current) sidebarRef.current.scrollTop = 0;
  }, [selectionId]);

  return (
    <aside aria-label="Explore your area" className="hb-gap-sidebar" ref={sidebarRef}>
      <div className="hb-gap-search p-4">
        <details open={searchOpen} onToggle={(event) => setSearchOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer text-base font-bold text-hb-deepNavy">
            {selectionId ? "Choose another place" : "Explore your area"}
          </summary>
          <p className="mb-3 mt-2 text-sm leading-5 text-slate-700">
            Find your town to see where public data suggest getting primary care may be harder.
          </p>
          <BoundaryAutocomplete countyData={countyData} townData={townData} onSelect={onSelect} embedded />
          {!selectionId && (
            <div className="my-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
              <a className="text-sm font-bold text-hb-navy underline focus:outline-none focus:ring-2 focus:ring-hb-aqua" href={newarkExampleUrl}>
                Explore an example: Newark
              </a>
              <p className="mt-1 text-xs leading-5 text-slate-700">A real town summary to help you learn the map. It is not a ranking of towns.</p>
            </div>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-semibold text-hb-navy">Or search by street address</summary>
            <div className="mt-2">{addressSearch}</div>
          </details>
          <div className="mt-3"><GapExplorer countyData={countyData} townData={townData} onSelect={onSelect} /></div>
        </details>
      </div>
      {children}
    </aside>
  );
}
