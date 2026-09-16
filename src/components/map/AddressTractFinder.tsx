import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import { careAtlasMapResetEvent } from "./mapReset";

export type AddressLocationMatch = {
  address: string;
  addressType: string;
  county: string;
  latitude: number;
  longitude: number;
  score: number;
};

export type AddressResolutionState = {
  message: string | null;
  status: "idle" | "loading" | "ready" | "error";
};

type AddressSuggestion = {
  magicKey: string;
  text: string;
};

type Props = {
  onClear: () => void;
  onLocationMatch: (match: AddressLocationMatch) => void;
  resolution: AddressResolutionState;
};

async function postJson<T>(url: string, body: unknown, signal: AbortSignal) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    signal
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "The address lookup could not be completed.");
  }
  return payload;
}

export function AddressTractFinder({
  onClear,
  onLocationMatch,
  resolution
}: Props) {
  const listboxId = useId();
  const geocodeControllerRef = useRef<AbortController | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [chosenText, setChosenText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const canSuggest = query.trim().length >= 2;

  useEffect(() => {
    setSuggestions([]);
    setActiveIndex(-1);
    setError(null);
    if (!canSuggest || query === chosenText) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    const controller = new AbortController();
    setIsLoadingSuggestions(true);
    const timer = window.setTimeout(() => {
      setIsLoadingSuggestions(true);
      setError(null);
      void postJson<{ suggestions: AddressSuggestion[] }>(
        "/api/address/suggest",
        { query },
        controller.signal
      )
        .then((payload) => {
          if (controller.signal.aborted) return;
          setSuggestions(payload.suggestions);
          setActiveIndex(payload.suggestions.length > 0 ? 0 : -1);
          if (payload.suggestions.length === 0) {
            setError(
              "No New Jersey address suggestions were found. Include the street number and municipality."
            );
          }
        })
        .catch((requestError: unknown) => {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "The address suggestions could not be loaded."
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoadingSuggestions(false);
        });
    }, 275);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canSuggest, chosenText, query]);

  useEffect(() => {
    return () => geocodeControllerRef.current?.abort();
  }, []);

  useEffect(() => {
    window.addEventListener(careAtlasMapResetEvent, clearLocalSearch);
    return () =>
      window.removeEventListener(careAtlasMapResetEvent, clearLocalSearch);
  }, []);

  async function chooseSuggestion(suggestion: AddressSuggestion) {
    geocodeControllerRef.current?.abort();
    const controller = new AbortController();
    geocodeControllerRef.current = controller;
    setQuery(suggestion.text);
    setChosenText(suggestion.text);
    setSuggestions([]);
    setActiveIndex(-1);
    setError(null);
    setIsGeocoding(true);

    try {
      const payload = await postJson<{ match: AddressLocationMatch }>(
        "/api/address/geocode",
        suggestion,
        controller.signal
      );
      if (controller.signal.aborted) return;
      onLocationMatch(payload.match);
      setIsFocused(false);
    } catch (requestError) {
      if (!controller.signal.aborted) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "That address could not be located."
        );
      }
    } finally {
      if (!controller.signal.aborted) setIsGeocoding(false);
    }
  }

  function clearLocalSearch() {
    geocodeControllerRef.current?.abort();
    setQuery("");
    setChosenText(null);
    setSuggestions([]);
    setActiveIndex(-1);
    setError(null);
    setIsGeocoding(false);
    setIsLoadingSuggestions(false);
    setIsFocused(false);
  }

  function resetSearch() {
    clearLocalSearch();
    onClear();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsFocused(false);
      return;
    }
    if (!isOpen) {
      if (event.key === "ArrowDown") { event.preventDefault(); setIsFocused(true); }
      return;
    }
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      void chooseSuggestion(suggestions[activeIndex]);
    }
  }

  const isOpen =
    isFocused &&
    query !== chosenText &&
    (suggestions.length > 0 || isLoadingSuggestions || Boolean(error));
  const statusMessage = error ?? resolution.message;
  const statusTone =
    error || resolution.status === "error"
      ? "text-rose-700"
      : resolution.status === "ready"
        ? "text-emerald-800"
        : "text-hb-muted";

  return (
    <section
      aria-label="Find your census tract by address"
      className="relative w-full"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocused(false);
        }
      }}
    >
      <div className="rounded-lg border border-slate-300 bg-white/95 p-2.5 shadow-[0_10px_24px_rgb(0_43_77_/_0.16)] backdrop-blur">
        <label
          className="mb-1 block text-[11px] font-black uppercase tracking-[0.1em] text-hb-teal"
          htmlFor="address-tract-finder"
        >
          Find the census tract for an address
        </label>
        <div className="relative">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hb-teal"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="10" r="2" fill="currentColor" />
          </svg>
          <input
            aria-activedescendant={
              isOpen && !isLoadingSuggestions && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 bg-white py-2.5 pl-9 pr-9 text-sm font-semibold text-hb-deepNavy outline-none placeholder:font-medium placeholder:text-hb-muted focus:border-hb-aqua focus:ring-2 focus:ring-cyan-100"
            id="address-tract-finder"
            onChange={(event) => {
              geocodeControllerRef.current?.abort();
              setIsGeocoding(false);
              setSuggestions([]);
              setActiveIndex(-1);
              setQuery(event.target.value);
              setChosenText(null);
              setError(null);
              setIsFocused(true);
              onClear();
            }}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder="Example: 123 Main St, Newark"
            role="combobox"
            value={query}
          />
          {query && (
            <button
              aria-label="Clear address search"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg text-hb-muted hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-hb-aqua"
              onClick={resetSearch}
              type="button"
            >
              ×
            </button>
          )}
        </div>
        <p className="mt-1.5 text-xs leading-5 text-hb-muted">
          Type at least two characters for suggestions. Add the building number and municipality to narrow the results; a street name alone may cross several tracts. A Census tract is a small area used to publish local statistics. Choose a full address to find its tract.
        </p>
        <p className="mt-1 text-xs leading-5 text-hb-muted">
          New Jersey only · Suggestions from the{" "}
          <a
            className="font-semibold underline"
            href="https://www.nj.gov/njgin/edata/geocoding/"
            rel="noreferrer"
            target="_blank"
          >
            NJ Office of GIS
          </a>{" "}
          · Your address is used for this lookup and is not saved by CareAtlas.
        </p>
        {(isGeocoding || resolution.status === "loading" || statusMessage) && (
          <p aria-live="polite" className={`mt-1 text-xs font-semibold ${statusTone}`}>
            {isGeocoding
              ? "Confirming the selected address..."
              : resolution.status === "loading"
                ? "Finding the official Census tract..."
                : statusMessage}
          </p>
        )}
      </div>

      {isOpen && (
        <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_16px_34px_rgb(0_43_77_/_0.2)]">
          {isLoadingSuggestions ? (
            <p className="px-3 py-3 text-sm text-hb-muted">Loading NJ address suggestions...</p>
          ) : suggestions.length > 0 ? (
            <ul className="max-h-72 overflow-y-auto py-1" id={listboxId} role="listbox">
              {suggestions.map((suggestion, index) => (
                <li key={suggestion.magicKey}>
                  <button
                    aria-selected={index === activeIndex}
                    className={`w-full px-3 py-2.5 text-left text-sm font-semibold transition ${
                      index === activeIndex
                        ? "bg-cyan-50 text-hb-deepNavy"
                        : "text-hb-text hover:bg-slate-50"
                    }`}
                    id={`${listboxId}-option-${index}`}
                    onClick={() => void chooseSuggestion(suggestion)}
                    onMouseEnter={() => setActiveIndex(index)}
                    role="option"
                    type="button"
                  >
                    {suggestion.text}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-3 text-sm text-rose-700">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}
