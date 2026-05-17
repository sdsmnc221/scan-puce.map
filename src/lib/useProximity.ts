import { ref, type Ref } from "vue";
import axios from "axios";

export type ZipCoord = { lat: number; lng: number };

type ZipEntry = { lat: number; lng: number; name: string };
type ZipCodeMap = Map<string, ZipEntry[]>;

// Step 1 — resolve a 5-digit zip to GPS coordinates.
// Order: local CSV lookup → geo.api.gouv.fr → error.
export async function resolveZipToLatLng(
  zip: string,
  zipCodeLookup: ZipCodeMap,
): Promise<ZipCoord> {
  const entries = zipCodeLookup.get(zip);
  if (entries?.length) return { lat: entries[0].lat, lng: entries[0].lng };

  const res = await axios.get("https://geo.api.gouv.fr/communes", {
    params: { codePostal: zip, fields: "centre", format: "json" },
    timeout: 5000,
  });
  const communes = res.data as Array<{
    centre?: { coordinates: [number, number] };
  }>;
  if (communes?.length && communes[0].centre?.coordinates) {
    const [lng, lat] = communes[0].centre.coordinates;
    return { lat, lng };
  }

  throw new Error("Code postal introuvable, vérifiez votre saisie");
}

// Step 2 — compute road distances (km) from one origin to N destinations.
// Uses OSRM public table API, chunked at 100 destinations to stay within server limits.
export async function fetchOsrmDistances(
  origin: ZipCoord,
  destinations: ZipCoord[],
): Promise<number[]> {
  if (!destinations.length) return [];

  const CHUNK = 100;
  if (destinations.length <= CHUNK) {
    return _osrmChunk(origin, destinations);
  }

  const results: number[] = [];
  for (let i = 0; i < destinations.length; i += CHUNK) {
    const partial = await _osrmChunk(origin, destinations.slice(i, i + CHUNK));
    results.push(...partial);
  }
  return results;
}

async function _osrmChunk(
  origin: ZipCoord,
  destinations: ZipCoord[],
): Promise<number[]> {
  const coords = [
    `${origin.lng},${origin.lat}`,
    ...destinations.map((d) => `${d.lng},${d.lat}`),
  ].join(";");

  const res = await axios.get(
    `https://router.project-osrm.org/table/v1/driving/${coords}`,
    { params: { sources: 0, annotations: "distance" }, timeout: 15000 },
  );

  // distances[0] = [0, d_to_dest1, d_to_dest2, ...] (self-distance first)
  const raw: (number | null)[] = res.data.distances[0].slice(1);
  return raw.map((d) => (d == null ? Infinity : Math.round(d / 100) / 10));
}

// Composable — owns the proximity UI state.
export default function useProximity(zipCodeLookup: Ref<ZipCodeMap>) {
  const proximityZip = ref("");
  const proximityActive = ref(false);
  const proximityError = ref("");
  const proximityLoading = ref(false);
  const proximityOrigin = ref<ZipCoord | null>(null);

  const activate = async (zip: string) => {
    if (!/^\d{5}$/.test(zip)) {
      proximityError.value = "Code postal invalide (5 chiffres attendus)";
      return;
    }
    proximityError.value = "";
    proximityLoading.value = true;
    try {
      proximityOrigin.value = await resolveZipToLatLng(zip, zipCodeLookup.value);
      proximityZip.value = zip;
      proximityActive.value = true;
    } catch (e: unknown) {
      proximityError.value =
        e instanceof Error ? e.message : "Code postal introuvable";
    } finally {
      proximityLoading.value = false;
    }
  };

  const deactivate = () => {
    proximityActive.value = false;
    proximityZip.value = "";
    proximityOrigin.value = null;
    proximityError.value = "";
  };

  return {
    proximityZip,
    proximityActive,
    proximityError,
    proximityLoading,
    proximityOrigin,
    activate,
    deactivate,
  };
}
