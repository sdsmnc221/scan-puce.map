import {
  type Ref,
  ref,
  type ComputedRef,
  computed,
  watch,
  onMounted,
} from "vue";
import axios from "axios";
import { uniqBy } from "lodash";

import useSheets from "./useSheets";
import franceDepartments from "../geojson/dptFr.json";

import csvCommunesContent from "../geojson/communes.csv";
import csvDeptsWithCoordinates from "../geojson/departementsfrance_with_coordinates.csv";
import CENTRAL_POSTAL_CODES from "../geojson/central-postcode";

const extractRecId = (linkToUpdate: string): string | null => {
  const match = linkToUpdate?.match(/[?&]id=(rec[A-Za-z0-9]+)/);
  return match ? match[1] : null;
};

// "34XXX" or "34" → "34000", valid "34490" → "34490" unchanged
const normalizeZipCode = (zip: string): string => {
  const trimmed = zip.trim();
  if (/^\d{5}$/.test(trimmed)) return trimmed;
  const digits = trimmed.match(/^\d+/)?.[0] ?? "";
  return digits.length >= 2 ? digits.padEnd(5, "0") : trimmed;
};

// empty → 0, date-only → epoch ms, ISO timestamp (has 'T') → epoch ms + 1e14
// ensures a full timestamp always beats a date-only string regardless of year
const getDateScore = (dateStr: string): number => {
  if (!dateStr?.trim()) return 0;
  const ts = new Date(dateStr).getTime();
  if (isNaN(ts)) return 0;
  return dateStr.includes("T") ? ts + 1e14 : ts;
};

export type VerificationRow = {
  code: string;
  name: string;
  deptCount: number;
  exactCount: number;
  centroidCount: number;
  unresolvedCount: number;
  diff: number;
};

export type CommuneVerificationRow = {
  zipCode: string;
  name: string;
  deptCode: string;
  deptName: string;
  recordCount: number;
  source: "exact" | "centroid" | "unresolved";
};

export type CsvStore = {
  dpt: any[];
  zip: any[];
};

export type BaseRecord = {
  id: string;
  createTime: string;
  Author: string;
  ZipCode: string;
  LinkToPost: string;
  LinkFacebook: string;
  Dept: string;
  LinkToUpdate: string;
  CommuneName: string;
  Notes: string;
  ContactMode: string;
  ContactModeUnfilled: number;
  AccessICAD?: "checked" | "TRUE" | "";
  _recordKey?: string; // internal use only, not from Airtable
};

type City = {
  zipCode: string;
  lat: number;
  lng: number;
  name: string;
  departmentName: string | null;
  departmentCode: string | null;
  baseRecords: BaseRecord[];
  communes: {
    name: string;
    lat: number;
    lng: number;
  }[];
};

type Department = {
  code_departement: string;
  nom_departement: string;
  code_region: number;
  nom_region: string;
  latitude: number;
  longitude: number;
};

// Create lookup maps for faster access
type ZipCodeMap = Map<string, { lat: number; lng: number; name: string }[]>;
type DepartmentMap = Map<string, Department>;

export default function useProcessData(
  usingFilloutBase: Ref<boolean>,
  usingDptCode: Ref<boolean>,
  keyword: Ref<string>,
  pinType: Ref<number[]>,
  loading: Ref<boolean>,
) {
  const { records, loadRecordsDone } = useSheets(usingFilloutBase);

  const deduplicatedRecords = computed(() => {
    const map = new Map<string, any>();
    let fallback = 0;
    records.value.forEach((record) => {
      const recId = extractRecId(record.LinkToUpdate || "");
      const key = recId ?? `__noid_${fallback++}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...record, _recordKey: key });
      } else {
        const existingScore = getDateScore(
          existing["Date de MAJ d'informations"] ?? "",
        );
        const currentScore = getDateScore(
          record["Date de MAJ d'informations"] ?? "",
        );
        if (currentScore > existingScore)
          map.set(key, { ...record, _recordKey: key });
      }
    });
    return Array.from(map.values());
  });

  const loadCsvDone = ref(false);
  const cities: Ref<City[]> = ref([]);
  const departments: Ref<Department[]> = ref([]);

  // Create indexed maps for fast lookups
  const zipCodeLookup: Ref<ZipCodeMap> = ref(new Map());
  const departmentLookup: Ref<DepartmentMap> = ref(new Map());

  // Initialize data structures
  onMounted(async () => {
    initDepartmentsData();
    initCommunesData();
    await loadZipCache();
  });

  // Process the departments data when the component is initialized
  const initDepartmentsData = () => {
    try {
      // Create the departments array
      departments.value = csvDeptsWithCoordinates.map((dept: any) => ({
        code_departement: dept.code_departement?.toString(),
        nom_departement: dept.nom_departement,
        code_region: parseInt(dept.code_region),
        nom_region: dept.nom_region,
        latitude: parseFloat(dept.latitude),
        longitude: parseFloat(dept.longitude),
      }));

      // Build the department lookup map for O(1) access
      departmentLookup.value = new Map();
      departments.value.forEach((dept) => {
        // Store both normalized and original codes for robust lookups
        const normalizedCode = dept.code_departement.replace(/^0+/, "");
        departmentLookup.value.set(dept.code_departement, dept);
        departmentLookup.value.set(normalizedCode, dept);
      });
    } catch (error) {
      console.error("Error initializing departments data:", error);
    }
  };

  // Pre-process commune data for faster lookups
  const initCommunesData = () => {
    try {
      // Pre-process all communes for fast lookup by zip code
      zipCodeLookup.value = new Map();

      Object.entries(CENTRAL_POSTAL_CODES).forEach(([zipCode, data]) => {
        zipCodeLookup.value.set(zipCode, [data]);
      });

      // Backfill dept-centroid codes ("34000", "21000" …) so that wildcard
      // zip codes normalised by normalizeZipCode always find a coordinate entry.
      departmentLookup.value.forEach((dept, code) => {
        if (!/^\d{2,3}$/.test(code)) return; // skip normalised single-digit duplicates
        const centroidCode = code.padEnd(5, "0");
        if (!zipCodeLookup.value.has(centroidCode)) {
          zipCodeLookup.value.set(centroidCode, [
            {
              lat: dept.latitude,
              lng: dept.longitude,
              name: dept.nom_departement,
            },
          ]);
        }
      });

      csvCommunesContent.forEach((commune: any) => {
        if (!commune || typeof commune !== "object") return;

        const zipCode = commune.postcode;
        const communeData = {
          lat: parseFloat(commune.latitude),
          lng: parseFloat(commune.longitude),
          name: commune.commune,
        };

        if (!isNaN(communeData.lat) && !isNaN(communeData.lng)) {
          if (!zipCodeLookup.value.has(zipCode)) {
            zipCodeLookup.value.set(zipCode, []);
          }
          zipCodeLookup.value.get(zipCode)?.push(communeData);
        }
      });
    } catch (error) {
      console.error("Error initializing communes data:", error);
    }
  };

  // Optimized to use lookup maps instead of filtering arrays repeatedly
  const getDepartmentCode = (zipcode: string) => {
    if (!zipcode) return null;

    // For department codes that were padded with '000'
    if (zipcode.endsWith("000")) {
      return zipcode.substring(0, zipcode.length - 3);
    }

    // Standard zip code to department code conversion
    let deptCode = zipcode.substring(0, 2);

    // Special case for overseas departments
    if (zipcode.length >= 3 && zipcode.substring(0, 3).match(/^97[1-6]$/)) {
      deptCode = zipcode.substring(0, 3);
    }

    return deptCode;
  };

  // Use the lookup map for fast department name retrieval
  const getDepartmentName = (zipcode: string) => {
    const deptCode = getDepartmentCode(zipcode);
    if (!deptCode) return null;

    // Try both original and normalized codes
    const normalizedCode = deptCode.replace(/^0+/, "");
    const dept =
      departmentLookup.value.get(deptCode) ||
      departmentLookup.value.get(normalizedCode);

    if (dept) {
      return dept.nom_departement;
    }

    // Fallback to the existing mapping if needed
    return (
      franceDepartments[deptCode as keyof typeof franceDepartments] || null
    );
  };

  // Create record lookup maps for faster filtering
  const recordsByZipCode = computed(() => {
    const map = new Map<string, BaseRecord[]>();

    deduplicatedRecords.value.forEach((record) => {
      if (record.ZipCode) {
        const codes = record.ZipCode.replaceAll(" ", "").split(",");
        codes.forEach((code: string) => {
          const trimmed = code.trim();
          if (!trimmed) return;
          if (!map.has(trimmed)) map.set(trimmed, []);
          map.get(trimmed)?.push(record as any);
        });
      }
    });

    return map;
  });

  const recordsByDeptCode = computed(() => {
    const map = new Map<string, BaseRecord[]>();

    deduplicatedRecords.value.forEach((record) => {
      let deptCodes: string[] = [];

      if (record.Dept) {
        deptCodes = record.Dept.split(/[\s,]+/)
          .map((c: string) => c.trim())
          .filter(Boolean)
          .map((c: string) => c.replace(/^0+/, ""));
      } else if (record.ZipCode) {
        // infer dept from zip when Dept field is not filled
        deptCodes = record.ZipCode.replaceAll(" ", "")
          .split(",")
          .map((zip: string) => getDepartmentCode(zip.trim()))
          .filter((c: any): c is string => !!c)
          .map((c: any) => c.replace(/^0+/, ""));
      }

      deptCodes.forEach((code: string) => {
        if (!map.has(code)) {
          map.set(code, []);
        }
        map.get(code)?.push(record as any);
      });
    });

    return map;
  });

  const verificationData = computed((): VerificationRow[] => {
    const rows: VerificationRow[] = [];

    recordsByDeptCode.value.forEach((deptRecords, code) => {
      const dept =
        departmentLookup.value.get(code) ||
        departmentLookup.value.get(code.padStart(2, "0"));
      const name = dept?.nom_departement ?? code;

      const exactKeys = new Set<string>();
      const centroidKeys = new Set<string>();
      const unresolvedKeys = new Set<string>();

      deptRecords.forEach((record) => {
        const key = record._recordKey;
        if (!record.ZipCode) {
          unresolvedKeys.add(key as string);
          return;
        }

        const rawZips = record.ZipCode.split(" ").join("").split(",");
        let bestTier: "exact" | "centroid" | "unresolved" = "unresolved";

        rawZips.forEach((rawZip: string) => {
          const trimmed = rawZip.trim();

          if (zipCodeLookup.value.has(trimmed)) {
            bestTier = "exact";
            return;
          }
          const normalized = normalizeZipCode(trimmed);
          if (zipCodeLookup.value.has(normalized)) {
            bestTier = "centroid";
            return;
          }
          const deptCode = getDepartmentCode(trimmed);
          if (deptCode && zipCodeLookup.value.has(deptCode.padEnd(5, "0"))) {
            bestTier = "centroid";
          }
        });

        // ts-ignore because we know _recordKey is always set in deduplicatedRecords
        // @ts-ignore
        if (bestTier === "exact") exactKeys.add(key);
        // @ts-ignore
        else if (bestTier === "centroid") centroidKeys.add(key);
        else unresolvedKeys.add(key as string);
      });

      const deptCount = new Set(deptRecords.map((r: any) => r._recordKey)).size;

      rows.push({
        code,
        name,
        deptCount,
        exactCount: exactKeys.size,
        centroidCount: centroidKeys.size,
        unresolvedCount: unresolvedKeys.size,
        diff: deptCount - exactKeys.size,
      });
    });

    return rows.sort((a, b) =>
      b.diff !== a.diff
        ? b.diff - a.diff
        : a.code.localeCompare(b.code, "fr", { numeric: true }),
    );
  });

  const communeVerificationData = computed((): CommuneVerificationRow[] => {
    const rows: CommuneVerificationRow[] = [];

    recordsByZipCode.value.forEach((zipRecords, zipCode) => {
      const recordCount = new Set(zipRecords.map((r: any) => r._recordKey))
        .size;

      // Classify source using same three-tier logic as createCommuneCities
      let source: CommuneVerificationRow["source"] = "unresolved";
      if (zipCodeLookup.value.has(zipCode)) {
        source = "exact";
      } else if (zipCodeLookup.value.has(normalizeZipCode(zipCode))) {
        source = "centroid";
      } else {
        const deptCode = getDepartmentCode(zipCode);
        if (deptCode && zipCodeLookup.value.has(deptCode.padEnd(5, "0"))) {
          source = "centroid";
        }
      }

      // Commune name from lookup
      const coords =
        zipCodeLookup.value.get(zipCode) ||
        zipCodeLookup.value.get(normalizeZipCode(zipCode));
      const name = coords?.[0]?.name ?? "—";

      // Dept info
      const deptCode = getDepartmentCode(zipCode) ?? "";
      const normalizedDept = deptCode.replace(/^0+/, "");
      const dept =
        departmentLookup.value.get(deptCode) ||
        departmentLookup.value.get(normalizedDept);
      const deptName = dept?.nom_departement ?? deptCode;

      rows.push({
        zipCode,
        name,
        deptCode: normalizedDept,
        deptName,
        recordCount,
        source,
      });
    });

    const sourceOrder = { unresolved: 0, centroid: 1, exact: 2 };
    return rows.sort((a, b) =>
      sourceOrder[a.source] !== sourceOrder[b.source]
        ? sourceOrder[a.source] - sourceOrder[b.source]
        : a.deptCode.localeCompare(b.deptCode, "fr", { numeric: true }) ||
          a.zipCode.localeCompare(b.zipCode),
    );
  });

  // Process all data at once instead of in batches
  const processAllData = async () => {
    try {
      loading.value = true;

      // Clear existing data
      cities.value = [];

      // Get all unique zip/department codes from records
      const allCodes = getAllCodes();

      // Process all codes at once instead of in batches
      if (usingDptCode.value) {
        // Department mode - create department-based cities
        const deptCities = createDepartmentCities(allCodes);
        cities.value = deptCities;
      } else {
        // Zip code mode - create commune-based cities
        try {
          await fetchMissingZipcodes(allCodes);
        } catch {
          // geocoding API unavailable — build cities from whatever is already in the lookup
        }
        const communeCities = createCommuneCities(allCodes);
        cities.value = communeCities;
      }

      loadCsvDone.value = true;
    } catch (error) {
      console.error("Error processing data:", error);
    } finally {
      loading.value = false;
    }
  };

  // Get all unique codes (zip or dept) from records
  const getAllCodes = () => {
    let codes: string[] = [];

    if (usingDptCode.value) {
      // Get all unique department codes
      deduplicatedRecords.value.forEach((record) => {
        if (record.Dept) {
          const deptCodes = record.Dept.split(/[\s,]+/)
            .map((c: string) => c.trim())
            .filter(Boolean);
          deptCodes.forEach((code: string) => {
            const normalized = code.replace(/^0+/, "") || code;
            codes.push(normalized + "000");
          });
        } else if (record.ZipCode) {
          // infer dept from zip when Dept field is not filled
          record.ZipCode.replaceAll(" ", "")
            .split(",")
            .forEach((zip: string) => {
              const deptCode = getDepartmentCode(zip.trim());
              if (deptCode) {
                const normalized = deptCode.replace(/^0+/, "") || deptCode;
                codes.push(normalized + "000");
              }
            });
        }
      });
    } else {
      // Get all unique zip codes
      deduplicatedRecords.value.forEach((record) => {
        if (record.ZipCode) {
          const zipCodes = record.ZipCode.replaceAll(" ", "").split(",");
          zipCodes.forEach((code: string) => {
            const trimmed = code.trim();
            if (trimmed) codes.push(trimmed);
          });
        }
      });
    }

    // Remove duplicates
    return [...new Set(codes)];
  };

  // Create city objects for departments
  const createDepartmentCities = (deptCodes: string[]) => {
    return deptCodes
      .map((zipCode) => {
        // Extract department code (remove trailing zeros)
        const deptCode = getDepartmentCode(zipCode);
        if (!deptCode) return null;

        // Find the department
        const normalizedCode = deptCode.replace(/^0+/, "");
        const dept =
          departmentLookup.value.get(deptCode) ||
          departmentLookup.value.get(normalizedCode);

        if (!dept) return null;

        // Get records for this department
        const deptRecords = recordsByDeptCode.value.get(normalizedCode) || [];

        return {
          zipCode,
          lat: dept.latitude,
          lng: dept.longitude,
          name: dept.nom_departement,
          departmentName: dept.nom_departement,
          departmentCode: deptCode,
          baseRecords: deptRecords,
          communes: [
            {
              name: dept.nom_departement,
              lat: dept.latitude,
              lng: dept.longitude,
            },
          ],
        } as City;
      })
      .filter((city) => city !== null) as City[];
  };

  // Create city objects for communes
  const createCommuneCities = (zipCodes: string[]) => {
    const cityMap = new Map<string, City>();

    zipCodes.forEach((zipCode) => {
      // Skip if we already processed this zip code
      if (cityMap.has(zipCode)) return;

      // Get commune data from lookup — fall back to normalised code for
      // wildcard/partial entries (e.g. "34XXX" → "34000"), then to dept
      // centroid for valid zip codes not in csvCommunesContent.
      const deptCentroidFallback = (): {
        lat: number;
        lng: number;
        name: string;
      }[] => {
        const deptCode = getDepartmentCode(zipCode);
        if (!deptCode) return [];
        const centroidKey = deptCode.padEnd(5, "0");
        return zipCodeLookup.value.get(centroidKey) || [];
      };
      const communes =
        zipCodeLookup.value.get(zipCode) ||
        zipCodeLookup.value.get(normalizeZipCode(zipCode)) ||
        deptCentroidFallback();
      if (communes.length === 0) return;

      // Get records for this zip code
      const zipRecords = recordsByZipCode.value.get(zipCode) || [];

      // Calculate center coordinates
      const totalLat = communes.reduce((sum, commune) => sum + commune.lat, 0);
      const totalLng = communes.reduce((sum, commune) => sum + commune.lng, 0);
      const centerLat = communes.length > 0 ? totalLat / communes.length : 0;
      const centerLng = communes.length > 0 ? totalLng / communes.length : 0;

      // Get department info
      const departmentCode = getDepartmentCode(zipCode);
      const departmentName = getDepartmentName(zipCode);

      // Create city object
      cityMap.set(zipCode, {
        zipCode,
        lat: centerLat,
        lng: centerLng,
        name: communes[0].name,
        departmentName,
        departmentCode,
        baseRecords: zipRecords,
        communes: communes.map((c) => ({
          name: c.name,
          lat: c.lat,
          lng: c.lng,
        })),
      });
    });

    // Merge cities that share the same coordinates (dept-centroid fallback stacking)
    const locationMap = new Map<string, City>();
    Array.from(cityMap.values()).forEach((city) => {
      const key = `${city.lat},${city.lng}`;
      const existing = locationMap.get(key);
      if (!existing) {
        locationMap.set(key, { ...city, baseRecords: [...city.baseRecords] });
      } else {
        existing.baseRecords.push(...city.baseRecords);
      }
    });
    return Array.from(locationMap.values());
  };

  const blobAvailable = ref(false);

  const loadZipCache = async () => {
    try {
      const res = await axios.get("/api/zip-cache", { timeout: 5000 });
      if (res.status === 503) return;
      const cache: Record<
        string,
        { lat: number; lng: number; name: string }[]
      > = res.data ?? {};
      Object.entries(cache).forEach(([zip, coords]) => {
        if (!zipCodeLookup.value.has(zip)) {
          zipCodeLookup.value.set(zip, coords);
        }
      });
      blobAvailable.value = true;
    } catch {
      // blob unavailable — skip fetchMissingZipcodes too
    }
  };

  const fetchMissingZipcodes = async (zipCodes: string[]) => {
    if (!blobAvailable.value) return;

    const missing = zipCodes.filter(
      (zip) => /^\d{5}$/.test(zip) && !zipCodeLookup.value.has(zip),
    );
    if (missing.length === 0) return;

    const newEntries: Record<
      string,
      { lat: number; lng: number; name: string }[]
    > = {};

    for (const zip of missing) {
      try {
        const response = await axios.get(
          `https://geo.api.gouv.fr/communes?codePostal=${zip}&fields=nom,centre`,
          { timeout: 5000 },
        );
        const communes: {
          nom: string;
          centre: { coordinates: [number, number] };
        }[] = response.data ?? [];
        if (communes.length === 0) continue;

        const coords = communes
          .filter((c) => c.centre?.coordinates)
          .map((c) => ({
            name: c.nom,
            lng: c.centre.coordinates[0],
            lat: c.centre.coordinates[1],
          }));

        zipCodeLookup.value.set(zip, coords);
        newEntries[zip] = coords;
      } catch {
        // silently skip — dept-centroid fallback covers this zip
      }
    }

    // Persist newly resolved entries to Vercel Blob so future loads skip the API
    if (Object.keys(newEntries).length > 0) {
      axios.post("/api/zip-cache", newEntries, { timeout: 8000 }).catch(() => {
        /* non-blocking — cache write failure is acceptable */
      });
    }
  };

  // Optimized filtered cities computed property
  const filteredCities: ComputedRef<City[]> = computed(() => {
    // Quick return for edge cases
    if (!cities.value.length) return [];

    // Make sure pinType.value is an array and handle edge cases
    const pinTypeArray = Array.isArray(pinType.value) ? pinType.value : [];

    if (
      typeof keyword.value === "string" &&
      !keyword.value.trim().length &&
      pinTypeArray.length === 1 &&
      pinTypeArray.includes(2)
    ) {
      return [];
    }

    // Filter by keyword if present
    let result = cities.value;

    if (typeof keyword.value === "string" && keyword.value.trim().length) {
      const searchTerm = keyword.value.trim().toLowerCase();

      if (usingDptCode.value) {
        // Department search (optimize with the lookup maps)
        const isNumericSearch = /^\d+$/.test(searchTerm);

        result = result.filter((city) => {
          // Check department code
          if (isNumericSearch) {
            const normalizedDeptCode = city.departmentCode?.replace(/^0+/, "");
            const normalizedSearchTerm = searchTerm.replace(/^0+/, "");

            if (normalizedDeptCode === normalizedSearchTerm) return true;
            if (city.departmentCode?.includes(searchTerm)) return true;
          }

          // Check department name
          return city.departmentName?.toLowerCase().includes(searchTerm);
        });
      } else {
        // City/commune search
        result = result.filter(
          (city) =>
            city.zipCode.includes(searchTerm) ||
            city.departmentName?.toLowerCase().includes(searchTerm) ||
            city.communes.some((commune) =>
              commune.name.toLowerCase().includes(searchTerm),
            ),
        );
      }

      return uniqBy(result, "zipCode");
    }

    // Filter by pin type if no keyword
    result = result.filter((city) => {
      // Make sure pinType.value is an array and handle edge cases
      const pinTypeArray = Array.isArray(pinType.value) ? pinType.value : [];

      if (pinTypeArray.includes(0) && pinTypeArray.includes(1)) {
        return true;
      } else if (pinTypeArray.includes(0) && !pinTypeArray.includes(1)) {
        // Red pin (without ICAD)
        return !city.baseRecords.some(
          (record) =>
            record.AccessICAD === "checked" || record.AccessICAD === "TRUE",
        );
      } else if (pinTypeArray.includes(1) && !pinTypeArray.includes(0)) {
        // Blue pin (with ICAD)
        return city.baseRecords.some(
          (record) =>
            record.AccessICAD === "checked" || record.AccessICAD === "TRUE",
        );
      } else {
        return false;
      }
    });

    return uniqBy(result, "zipCode");
  });

  // Execute data processing when records are loaded
  watch(
    [() => loadRecordsDone.value, () => usingDptCode.value],
    async ([recordsLoaded]) => {
      if (recordsLoaded) {
        await processAllData();
      }
    },
    { immediate: true },
  );

  return {
    records: deduplicatedRecords,
    cities,
    filteredCities,
    departments,
    loadCsvDone,
    verificationData,
    communeVerificationData,
  };
}
