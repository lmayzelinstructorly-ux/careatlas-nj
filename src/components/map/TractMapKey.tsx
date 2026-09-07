type Props = {
  focusLevel: "county" | "town";
};

export function TractMapKey({ focusLevel }: Props) {
  return (
    <section
      aria-label="Tract map key"
      className="hb-gap-map-key m-3 rounded-lg border border-hb-teal/25 bg-white p-3 text-xs text-slate-700"
    >
      <p className="font-bold text-hb-deepNavy">What the shapes mean</p>
      <div className="mt-2 grid gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-4 w-5 shrink-0 rounded-sm border-[3px] border-hb-deepNavy bg-transparent"
          />
          <span>Dark outline: selected {focusLevel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-4 w-5 shrink-0 rounded-sm border border-[#3D7F88] bg-slate-50"
          />
          <span>Light grid: census tract portions inside it</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-4 w-5 shrink-0 rounded-sm border border-[#6F2E58] bg-[#A0467A]"
          />
          <span>Purple: potential-gap tract area</span>
        </div>
      </div>
      <p className="mt-2 leading-4 text-hb-muted">
        Tract drawing stops at the selected outline. The evidence record still
        describes the full official census tract.
      </p>
    </section>
  );
}
