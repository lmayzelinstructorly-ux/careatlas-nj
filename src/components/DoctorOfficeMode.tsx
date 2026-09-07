import { useEffect, useMemo, useState } from "react";
import type { GeographyData } from "../hooks/useGeographyData";
import { useDoctorOffices } from "../hooks/useDoctorOffices";
import type { DoctorOfficeSpecialtyId } from "../types/doctorOffice";
import { filterDoctorOffices } from "../utils/doctorOfficeDiscovery";
import { DoctorOfficeControls } from "./DoctorOfficeControls";
import DoctorOfficeMarkers from "./DoctorOfficeMarkers";
import { careAtlasMapResetEvent } from "./map/mapReset";

const ignorePanelState = () => undefined;

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
  }

  useEffect(() => {
    const reset = () => {
      setSpecialtyId(null);
      setSearchQuery("");
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
        onPanelOpenChange={ignorePanelState}
        specialtyId={specialtyId}
      />
    )}
    <DoctorOfficeControls
      data={doctorOffices.data}
      error={doctorOffices.error}
      loadState={doctorOffices.loadState}
      matchingOfficeCount={matchingOffices.length}
      onSearchQueryChange={setSearchQuery}
      onSpecialtyChange={selectSpecialty}
      searchQuery={searchQuery}
      selectedSpecialtyId={specialtyId}
    />
  </>;
}
