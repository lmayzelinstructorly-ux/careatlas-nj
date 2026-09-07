import { useState } from "react";
import { healthcareAccessChoroplethCategories } from "../../utils/boundaryHealthcareSummary";

export type MapLegendProps = {
  healthcareAccessChoroplethEnabled: boolean;
  showHealthcareMarkers: boolean;
  tractClassificationEnabled: boolean;
};

export function MapLegend({
  healthcareAccessChoroplethEnabled,
  showHealthcareMarkers,
  tractClassificationEnabled
}: MapLegendProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section
      aria-label="Map legend"
      className={`hb-map-legend ${isOpen ? "hb-map-legend--open" : ""}`}
    >
      <div className="hb-map-legend__header">
        <div>
          <p className="hb-map-legend__eyebrow">Map key</p>
          <h2 className="hb-map-legend__title">Legend</h2>
        </div>
        <button
          aria-controls="careatlas-map-legend-content"
          aria-expanded={isOpen}
          className="hb-map-legend__toggle"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? "Hide" : "Show"}
        </button>
      </div>
      {isOpen && (
        <div
          className="hb-map-legend__content"
          id="careatlas-map-legend-content"
        >
          <div className="hb-map-legend__boundary-grid">
            <div className="hb-map-legend__boundary-row">
              <span aria-hidden="true" className="hb-map-legend__boundary-swatch hb-map-legend__boundary-swatch--county" />
              <span>Blue boundaries and navy labels show counties.</span>
            </div>
            <div className="hb-map-legend__boundary-row">
              <span aria-hidden="true" className="hb-map-legend__boundary-swatch hb-map-legend__boundary-swatch--town" />
              <span>Green boundaries and teal labels show towns as you zoom in.</span>
            </div>
          </div>
          {tractClassificationEnabled && (
            <div className="hb-map-legend__tract-section">
              <p className="hb-map-legend__section-label">Potential gap tracts</p>
              <p className="hb-map-legend__note">
                Only tracts meeting the potential access gap rule receive a category color.
              </p>
              <div className="hb-map-legend__tract-grid">
                <div className="hb-map-legend__tract-row">
                  <span aria-hidden="true" className="hb-tract-state-swatch hb-tract-state-swatch--potential" />
                  <span><strong>Potential access gap</strong><span className="mt-0.5 block font-medium">Elevated need or barriers with documented shortage evidence.</span></span>
                </div>
                <div className="hb-map-legend__tract-row">
                  <span aria-hidden="true" className="hb-tract-state-swatch hb-tract-state-swatch--neutral" />
                  <span><strong>Other tract areas</strong><span className="mt-0.5 block font-medium">Shown neutrally; select one to see its screening result.</span></span>
                </div>
                <div className="hb-map-legend__tract-row">
                  <span aria-hidden="true" className="hb-map-legend__tract-flag">!</span>
                  <span><strong>Missing required data</strong><span className="mt-0.5 block font-medium">A map flag opens a short explanation.</span></span>
                </div>
              </div>
              <p className="hb-map-legend__note">
                These are screening results, not rankings or diagnoses. A neutral tract does not prove adequate access.
              </p>
            </div>
          )}
          {showHealthcareMarkers && (
            <div className="hb-map-legend__marker-row">
              <span aria-hidden="true" className="hb-healthcare-legend-dot hb-healthcare-marker--medium" />
              <span>Source-backed facility record; clusters group nearby markers.</span>
            </div>
          )}
          {healthcareAccessChoroplethEnabled && (
            <div className="hb-map-legend__choropleth-section">
              <p className="hb-map-legend__section-label">
                Center count colors
              </p>
              <div
                aria-label="Facility count choropleth colors"
                className="hb-map-legend__choropleth-grid"
              >
                {healthcareAccessChoroplethCategories.map((category) => (
                  <div
                    className="hb-map-legend__choropleth-row"
                    key={category.id}
                  >
                    <span
                      aria-hidden="true"
                      className="hb-map-legend__swatch"
                      style={{
                        backgroundColor: category.color,
                        borderColor: category.lineColor
                      }}
                    />
                    <span>{category.label}</span>
                  </div>
                ))}
              </div>
              <p className="hb-map-legend__note">Colors show loaded center counts, not complete healthcare coverage.</p>
            </div>
          )}
          <div className="hb-map-legend__note">
            Facility pins are limited source-backed context. Missing pins do not mean zero healthcare.
          </div>
        </div>
      )}
    </section>
  );
}
