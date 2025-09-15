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
import { transformToCapitalize } from "./lexique";

import franceCommunes from "../geojson/communesFr.json";
import franceDepartments from "../geojson/dptFr.json";

import csvCommunesContent from "../geojson/communes.csv";
import csvDeptsWithCoordinates from "../geojson/departementsfrance_with_coordinates.csv";

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
  Dept: string;
  LinkToUpdate: string;
  CommuneName: string;
  Notes: string;
  ContactMode: string;
  ContactModeUnfilled: number;
  AccessICAD?: boolean;
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
  storedFilloutCsv: Ref<CsvStore>,
  keyword: Ref<string>,
  pinType: Ref<number[]>,
  loading: Ref<boolean>
) {
  const { records, loadRecordsDone } = useSheets(usingFilloutBase);

  const loadCsvDone = ref(false);
  const cities: Ref<City[]> = ref([]);
  const departments: Ref<Department[]> = ref([]);

  // Create indexed maps for fast lookups
  const zipCodeLookup: Ref<ZipCodeMap> = ref(new Map());
  const departmentLookup: Ref<DepartmentMap> = ref(new Map());

  // Initialize data structures
  onMounted(() => {
    // Pre-process department data once
    initDepartmentsData();

    // Pre-process commune data once
    initCommunesData();
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

    records.value.forEach((record) => {
      if (record.ZipCode) {
        const codes = record.ZipCode.replaceAll(" ", "").split(",");
        codes.forEach((code: string) => {
          if (!map.has(code)) {
            map.set(code, []);
          }
          map.get(code)?.push(record as any);
        });
      }
    });

    return map;
  });

  const recordsByDeptCode = computed(() => {
    const map = new Map<string, BaseRecord[]>();

    records.value.forEach((record) => {
      if (record.Dept) {
        const codes = record.Dept.replaceAll(" ", "").split(",");
        codes.forEach((code: string) => {
          const normalizedCode = code.replace(/^0+/, "");
          if (!map.has(normalizedCode)) {
            map.set(normalizedCode, []);
          }
          map.get(normalizedCode)?.push(record as any);
        });
      }
    });

    return map;
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
        await fetchMissingZipcodes(allCodes);
        const communeCities = createCommuneCities(allCodes);
        cities.value = communeCities;
      }

      loadCsvDone.value = true;
    } catch (error) {
      console.error("Error processing data:", error);
      cities.value = [];
    } finally {
      loading.value = false;
    }
  };

  // Get all unique codes (zip or dept) from records
  const getAllCodes = () => {
    let codes: string[] = [];

    if (usingDptCode.value) {
      // Get all unique department codes
      records.value.forEach((record) => {
        if (record.Dept) {
          const deptCodes = record.Dept.replaceAll(" ", "").split(",");
          deptCodes.forEach((code: string) => {
            // Add "000" suffix for compatibility with existing code
            codes.push(code.trim() + "000");
          });
        }
      });
    } else {
      // Get all unique zip codes
      records.value.forEach((record) => {
        if (record.ZipCode) {
          const zipCodes = record.ZipCode.replaceAll(" ", "").split(",");
          zipCodes.forEach((code: string) => {
            codes.push(code.trim());
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

      // Get commune data from lookup
      const communes = zipCodeLookup.value.get(zipCode) || [];
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

    return Array.from(cityMap.values());
  };

  // Fetch any missing zip codes
  const fetchMissingZipcodes = async (zipCodes: string[]) => {
    // Filter out zip codes that we already have data for
    const missingZipCodes = zipCodes.filter(
      (code: string) => !zipCodeLookup.value.has(code)
    );

    if (missingZipCodes.length === 0) return;

    // Find communes that match the missing zip codes
    const communes = [];
    for (const zipCode of missingZipCodes) {
      const communesOfSameZip = (franceCommunes as any[])
        .filter((c) => c.CodePostal == zipCode)
        .map((c) => ({
          postcode: c.CodePostal,
          city: transformToCapitalize(c.NomCommune),
        }));

      communes.push(...communesOfSameZip);
    }

    if (communes.length === 0) return;

    const csvRows = communes.map(
      (match) => `${match.postcode},"${match.city}"`
    );

    const csvContent = csvRows.join("\n");
    const formData = new FormData();
    formData.append(
      "data",
      new Blob([csvContent], { type: "text/csv" }),
      "zipCodes.csv"
    );

    try {
      const response = await axios.post(
        "https://api-adresse.data.gouv.fr/search/csv/",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Process the response and update the lookup
      const newData = response.data.split("\n").slice(1);

      newData.forEach((row: string) => {
        if (
          !row ||
          row.includes("not-found") ||
          row.includes("longitude,latitude")
        )
          return;

        const parts = row.split(",");
        const postcode = parts[0];
        const name = parts[1].replace(/"/g, "");
        const lng = parseFloat(parts[2]);
        const lat = parseFloat(parts[3]);

        if (isNaN(lat) || isNaN(lng)) return;

        if (!zipCodeLookup.value.has(postcode)) {
          zipCodeLookup.value.set(postcode, []);
        }

        zipCodeLookup.value.get(postcode)?.push({ lat, lng, name });
      });

      // Update stored CSV data
      storedFilloutCsv.value["zip"] = storedFilloutCsv.value["zip"] || [];
      storedFilloutCsv.value["zip"].push(...newData);
    } catch (error) {
      console.error("Error fetching missing zipcodes:", error);
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
              commune.name.toLowerCase().includes(searchTerm)
            )
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
        return city.baseRecords.some((record) => !record.AccessICAD);
      } else if (pinTypeArray.includes(1) && !pinTypeArray.includes(0)) {
        // Blue pin (with ICAD)
        return city.baseRecords.some((record) => !!record.AccessICAD);
      } else {
        return false;
      }
    });

    return uniqBy(result, "zipCode");
  });

  // Execute data processing when records are loaded
  watch(
    [
      () => loadRecordsDone.value,
      () => usingDptCode.value,
      () => keyword.value,
    ],
    async ([recordsLoaded, _]) => {
      if (recordsLoaded) {
        await processAllData();
      }
    },
    { immediate: true }
  );

  return {
    records,
    cities,
    filteredCities,
    departments,
    loadCsvDone,
  };
}
