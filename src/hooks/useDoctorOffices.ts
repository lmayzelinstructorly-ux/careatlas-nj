import { startTransition, useEffect, useState } from "react";
import type { DoctorOfficeArtifact } from "../types/doctorOffice";

export type DoctorOfficeLoadState =
  | "idle"
  | "loading"
  | "ready"
  | "error";

const dataPath = "/data/doctor-offices/nj.json";
let cachedRequest: Promise<DoctorOfficeArtifact> | null = null;

function requestDoctorOffices() {
  if (cachedRequest) return cachedRequest;

  cachedRequest = fetch(dataPath)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data: unknown = await response.json();
      if (
        !data ||
        typeof data !== "object" ||
        !("offices" in data) ||
        !Array.isArray(data.offices) ||
        !("specialties" in data) ||
        !Array.isArray(data.specialties)
      ) {
        throw new Error("Doctor-office data has an invalid shape.");
      }

      return data as DoctorOfficeArtifact;
    })
    .catch((error) => {
      cachedRequest = null;
      throw error;
    });

  return cachedRequest;
}

export function useDoctorOffices(enabled: boolean) {
  const [data, setData] = useState<DoctorOfficeArtifact | null>(null);
  const [loadState, setLoadState] = useState<DoctorOfficeLoadState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoadState("idle");
      setError("");
      return;
    }

    let isMounted = true;
    setLoadState("loading");
    setError("");

    requestDoctorOffices()
      .then((artifact) => {
        if (!isMounted) return;
        startTransition(() => {
          setData(artifact);
          setLoadState("ready");
        });
      })
      .catch((loadError) => {
        if (!isMounted) return;
        setData(null);
        setLoadState("error");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Doctor-office data could not be loaded."
        );
      });

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  return { data, dataPath, error, loadState };
}

