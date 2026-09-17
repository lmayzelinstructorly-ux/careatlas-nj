import { useEffect, useMemo, useState } from "react";
import type { GeographyData } from "../hooks/useGeographyData";
import { useDoctorOffices } from "../hooks/useDoctorOffices";
import type { DoctorOfficeSpecialtyId } from "../types/doctorOffice";
import { filterDoctorOffices } from "../utils/doctorOfficeDiscovery";
import { DoctorOfficeControls } from "./DoctorOfficeControls";
import DoctorOfficeMarkers from "./DoctorOfficeMarkers";
import { careAtlasMapResetEvent } from "./map/mapReset";

export function DoctorOfficeMode({
  countyData,
  countyMode
}: {
  countyData: GeographyData;
  countyMode: boolean;
}) {
  const [specialtyId, setSpecialtyId] =
    useState<DoctorOfficeSpecialtyId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [listRequestId, setListRequestId] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const doctorOffices = useDoctorOffices(true);
  const matchingOffices = useMemo(
    () => filterDoctorOffices(
      doctorOffices.data?.offices ?? [],
      specialtyId,
      searchQuery
    ),
    [doctorOffices.data?.offices, searchQuery, specialtyId]
  );

  function selectSpecialty(nextSpecialtyId: DoctorOfficeSpecialtyId | null) {
    setSpecialtyId(nextSpecialtyId);
    setSearchQuery("");
    setListRequestId(0);
  }

  useEffect(() => {
    const reset = () => {
      setSpecialtyId(null);
      setSearchQuery("");
      setListRequestId(0);
    };
    window.addEventListener(careAtlasMapResetEvent, reset);
    return () => window.removeEventListener(careAtlasMapResetEvent, reset);
  }, []);

  return <>
    {specialtyId && doctorOffices.data && (
      <DoctorOfficeMarkers
        countyData={countyData}
        countyMode={countyMode}
        offices={matchingOffices}
        listRequestId={listRequestId}
        onPanelOpenChange={setPanelOpen}
        specialtyId={specialtyId}
      />
    )}
    <DoctorOfficeControls
      data={doctorOffices.data}
      error={doctorOffices.error}
      loadState={doctorOffices.loadState}
      matchingOfficeCount={matchingOffices.length}
      onViewSearchResults={() => setListRequestId((id) => id + 1)}
      onSearchQueryChange={setSearchQuery}
      onSpecialtyChange={selectSpecialty}
      searchQuery={searchQuery}
      selectedSpecialtyId={specialtyId}
      panelOpen={panelOpen}
    />
  </>;
}
