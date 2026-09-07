import { Link } from "react-router-dom";

export function SiteBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      aria-label="CareAtlas NJ home"
      className="group flex min-w-0 items-center gap-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-hb-aqua"
      to="/"
    >
      <img
        alt=""
        aria-hidden="true"
        className={compact ? "h-10 w-10 shrink-0" : "h-11 w-11 shrink-0 sm:h-12 sm:w-12"}
        src="/favicon.svg"
      />
      <span className="min-w-0">
        <span className="block truncate text-base font-black tracking-[-0.025em] text-hb-deepNavy transition group-hover:text-hb-teal sm:text-lg">
          CareAtlas NJ
        </span>
        {!compact && (
          <span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-hb-muted sm:text-[11px]">
            Transparent New Jersey healthcare access mapping
          </span>
        )}
      </span>
    </Link>
  );
}
