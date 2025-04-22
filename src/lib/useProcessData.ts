import { type Ref, ref, type ComputedRef, computed, watch } from "vue";
import axios from "axios";
import { flatten, uniqBy } from "lodash";

import useBase from "./useBase";
import { transformToCapitalize } from "./lexique";

import franceCommunes from "../geojson/communesFr.json";
import franceDepartments from "../geojson/dptFr.json";

import csvCommunesContent from "../geojson/communes.csv";
// Import the new departments data with coordinates
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

// Department data structure to match our updated CSV format
type Department = {
  code_departement: string;
  nom_departement: string;
  code_region: number;
  nom_region: string;
  latitude: number;
  longitude: number;
};

export default function useProcessData(
  usingFilloutBase: Ref<boolean>,
  usingDptCode: Ref<boolean>,
  storedFilloutCsv: Ref<CsvStore>,
  storedCsv: Ref<CsvStore>,
  keyword: Ref<string>,
  pinType: Ref<number[]>,
  loading: Ref<boolean>
) {
  // Constants for pagination
  const BATCH_SIZE = 50;
  const currentCsvBatch = ref(0);
  const currentCitiesBatch = ref(0);

  const { loadRecordsDone, records, batchIndex } = useBase(usingFilloutBase);

  const loadCsvDone = ref(false);

  const cities: Ref<City[]> = ref([]);
  const departments: Ref<Department[]> = ref([]);

  // Process the departments data when the component is initialized
  const initDepartmentsData = () => {
    try {
      // Assuming csvDeptsWithCoordinates is already parsed into objects
      // If it's a string, you would need to parse it first
      departments.value = csvDeptsWithCoordinates.map((dept: any) => ({
        code_departement: dept.code_departement?.toString(),
        nom_departement: dept.nom_departement,
        code_region: parseInt(dept.code_region),
        nom_region: dept.nom_region,
        latitude: parseFloat(dept.latitude),
        longitude: parseFloat(dept.longitude),
      }));
    } catch (error) {
      console.error("Error initializing departments data:", error);
    }
  };

  // Initialize departments data
  initDepartmentsData();

  const filteredCities: ComputedRef<City[]> = computed(() => {
    let filteredResult: City[];

    if (
      !keyword.value.trim().length &&
      pinType.value.length === 1 &&
      pinType.value.includes(2)
    ) {
      return [];
    }

    if (keyword.value.trim().length) {
      if (usingDptCode.value) {
        // Normalize the search keyword for department codes
        // This handles cases like "01" to match with "1"
        const normalizedKeyword = keyword.value.trim();
        const isNumericSearch = /^\d+$/.test(normalizedKeyword);

        // For department filtering, create city-like objects for departments
        const matchedDepts = departments.value.filter((dept) => {
          // For numeric searches, normalize both the search term and department code
          if (isNumericSearch) {
            const normalizedDeptCode = dept.code_departement.replace(/^0+/, "");
            const normalizedSearchTerm = normalizedKeyword.replace(/^0+/, "");

            // Check if the normalized codes match
            if (normalizedDeptCode === normalizedSearchTerm) {
              return true;
            }
            // Also check for partial matches in the original code
            if (dept.code_departement.includes(normalizedKeyword)) {
              return true;
            }
          }

          // For text searches, check department name
          return dept.nom_departement
            .toLowerCase()
            .includes(normalizedKeyword.toLowerCase());
        });

        const deptCities = matchedDepts.map((dept) => {
          // Find records that match this department code
          const deptRecords = loadRecordByDeptCode(dept.code_departement);

          return {
            zipCode: dept.code_departement + "000", // Add '000' to make it look like a ZIP code for consistency
            lat: dept.latitude,
            lng: dept.longitude,
            name: dept.nom_departement,
            departmentName: dept.nom_departement,
            departmentCode: dept.code_departement,
            baseRecords: deptRecords || ([] as BaseRecord[]),
            communes: [
              {
                name: dept.nom_departement,
                lat: dept.latitude,
                lng: dept.longitude,
              },
            ],
          } as City; // Explicitly cast to City type
        });

        return uniqBy(deptCities, "zipCode");
      } else {
        // Original city filtering logic
        filteredResult = cities.value.filter((city) => {
          return (
            city.zipCode.includes(keyword.value.trim()) ||
            city.departmentName
              ?.toLowerCase()
              ?.includes(keyword.value.trim().toLowerCase()) ||
            city.communes.some((commune) =>
              commune.name
                .toLowerCase()
                .includes(keyword.value.trim().toLowerCase())
            )
          );
        });

        return uniqBy(filteredResult, "zipCode");
      }
    }

    console.log(pinType.value);

    // For non-search filtering (by pin type)
    if (usingDptCode.value) {
      // Create department-based cities for filtering
      const deptCities = departments.value
        .map((dept) => {
          // Find records that match this department
          const deptRecords = loadRecordByDeptCode(dept.code_departement);

          if (!deptRecords || deptRecords.length === 0) {
            return null;
          }

          return {
            zipCode: dept.code_departement + "000",
            lat: dept.latitude,
            lng: dept.longitude,
            name: dept.nom_departement,
            departmentName: dept.nom_departement,
            departmentCode: dept.code_departement,
            baseRecords: deptRecords,
            communes: [
              {
                name: dept.nom_departement,
                lat: dept.latitude,
                lng: dept.longitude,
              },
            ],
          };
        })
        .filter((city) => city !== null) as City[];

      filteredResult = deptCities.filter((city: City) => {
        if (pinType.value.includes(0) && pinType.value.includes(1)) {
          return true;
        } else if (pinType.value.includes(0) && !pinType.value.includes(1)) {
          // case red pin (without ICAD)
          return city.baseRecords.some(
            (record: BaseRecord) => !record.AccessICAD
          );
        } else if (pinType.value.includes(1) && !pinType.value.includes(0)) {
          // case blue pin (with ICAD)
          return city.baseRecords.some(
            (record: BaseRecord) => !!record.AccessICAD
          );
        } else if (!pinType.value.includes(0) && !pinType.value.includes(1)) {
          console.log("no pin types selected");
          return false;
        }
        return false;
      });
    } else {
      // Original city filtering by pin type
      filteredResult = cities.value.filter((city: City) => {
        if (pinType.value.includes(0) && pinType.value.includes(1)) {
          return true;
        } else if (pinType.value.includes(0) && !pinType.value.includes(1)) {
          // case red pin (without ICAD)
          return city.baseRecords.some(
            (record: BaseRecord) => !record.AccessICAD
          );
        } else if (pinType.value.includes(1) && !pinType.value.includes(0)) {
          // case blue pin (with ICAD)
          return city.baseRecords.some(
            (record: BaseRecord) => !!record.AccessICAD
          );
        } else if (!pinType.value.includes(0) && !pinType.value.includes(1)) {
          console.log("no pin types selected");
          return false;
        }
        return false;
      });
    }

    return uniqBy(filteredResult, "zipCode");
  });

  const postcodes = computed(() => {
    if (!batchIndex.value) return [];

    let codes;

    if (usingDptCode.value) {
      codes = flatten(
        records.value
          .filter((rec) => !!rec.Dept)
          .map((rec) => rec.Dept?.replaceAll(" ", "")?.split(","))
      ).map((dpt) => dpt + "000"); // This is for compatibility with existing code
    } else {
      codes = flatten(
        records.value
          .filter((rec) => !!rec.ZipCode)
          .map((rec) => rec?.ZipCode?.replaceAll(" ", "")?.split(","))
      );
    }

    return codes;
  });

  const loadRecordByZipCode = (zipCode: string) => {
    const records_ = records.value.filter((rec) => {
      // Split in case there are multiple zip codes
      const zipCodes = rec.ZipCode?.split(",")?.map((code: string) =>
        code.trim()
      );
      // Check for exact match
      return zipCodes?.includes(zipCode);
    });

    return records_ ?? null;
  };

  const loadRecordByDeptCode = (deptCode: string) => {
    // For department mode, we need to normalize the format
    // Remove any trailing zeros that might have been added for compatibility
    const deptPrefix = deptCode.replace(/000$/, "");

    // Also handle leading zeros in department codes (e.g., "01" should match "1")
    const normalizedDeptPrefix = deptPrefix.replace(/^0+/, "");

    const records_ = records.value.filter((rec) => {
      // Split the Dept field in case it contains multiple codes
      const deptCodes = rec.Dept?.split(",")?.map((code: string) => {
        // Normalize each department code by removing leading zeros
        return code.trim().replace(/^0+/, "");
      });

      // Check for exact match with the normalized prefix
      return deptCodes?.includes(normalizedDeptPrefix);
    });

    return records_ ?? null;
  };

  const getDepartmentCode = (zipcode: string) => {
    if (!zipcode) return null;

    // For department codes that were padded with '000'
    if (zipcode.endsWith("000")) {
      let deptCode = zipcode.substring(0, zipcode.length - 3);

      // Handle special cases like Corsica (2A, 2B)
      if (!deptCode.startsWith("2A") && !deptCode.startsWith("2B")) {
        // For numeric department codes, remove leading zeros if present
        if (/^\d+$/.test(deptCode)) {
          deptCode = deptCode.replace(/^0+/, "");
        }
      }

      return deptCode;
    }

    // Standard zip code to department code conversion
    let deptCode = zipcode.substring(0, 2);

    // Special case for overseas departments (3-digit codes)
    if (zipcode.length >= 3 && zipcode.substring(0, 3).match(/^97[1-6]$/)) {
      deptCode = zipcode.substring(0, 3);
    }

    return deptCode;
  };

  const getDepartmentName = (zipcode: string) => {
    const deptCode = getDepartmentCode(zipcode);
    if (!deptCode) return null;

    // First check our departments array
    const deptFromArray = departments.value.find(
      (d) => d.code_departement === deptCode
    );

    if (deptFromArray) {
      return deptFromArray.nom_departement;
    }

    // Fallback to the existing mapping if needed
    return (
      franceDepartments[deptCode as keyof typeof franceDepartments] || null
    );
  };

  const processCsv = (zipCodesBatch: string[]) => {
    // If we're in department mode, use the new department data directly
    if (usingDptCode.value) {
      return zipCodesBatch
        .map((zipCode) => {
          // Extract department code (remove trailing zeros)
          const deptCode = getDepartmentCode(zipCode);
          if (!deptCode) return null;

          // Find the department in our full departments list
          const dept = departments.value.find((d) => {
            // Compare normalized department codes for matching
            const normalizedStoredCode = d.code_departement.replace(/^0+/, "");
            const normalizedSearchCode = deptCode.replace(/^0+/, "");

            // Handle special cases like Corsica (2A, 2B)
            if (d.code_departement === "2A" || d.code_departement === "2B") {
              return d.code_departement === deptCode;
            }

            return normalizedStoredCode === normalizedSearchCode;
          });

          if (!dept) return null;

          // Get records for this department
          const records_ = loadRecordByDeptCode(deptCode);

          return {
            zipCode: zipCode, // Keep original zipcode for compatibility
            lat: dept.latitude,
            lng: dept.longitude,
            name: dept.nom_departement,
            departmentName: dept.nom_departement,
            departmentCode: deptCode,
            baseRecords: records_ || ([] as BaseRecord[]),
          } as City;
        })
        .filter((item) => item !== null) as City[];
    }

    // If not in department mode, use original code for communes
    const store = usingFilloutBase.value ? storedFilloutCsv : storedCsv;

    // Initialize store if empty
    if (!store.value.dpt.length) {
      store.value["dpt"] = csvDeptsWithCoordinates;
    }
    if (!store.value.zip.length) {
      store.value["zip"] = csvCommunesContent;
    }

    const rows = store.value["zip"]; // Always use zip for non-department mode

    const data = rows
      .filter((row) => {
        if (!row) return false;

        // Handle both string and object formats
        if (typeof row === "string") {
          return (
            !row.includes("not-found") && !row.includes("longitude,latitude")
          );
        }
        return true; // Keep all object records
      })
      .filter((row) => {
        // Extract postcode from either string or object
        const postcode =
          typeof row === "string" ? row.split(",")[0] : row.postcode;

        return zipCodesBatch.includes(postcode);
      })
      .map((row) => {
        try {
          let postcode, longitude, latitude, city;

          if (typeof row === "string") {
            const rowData = row.split(",");
            postcode = rowData[0];
            longitude = rowData[2];
            latitude = rowData[3];
            city = rowData[1].replace(/"/g, "");
          } else {
            // Handle object format
            postcode = row.postcode;
            longitude = row.longitude;
            latitude = row.latitude;
            city = row.commune;
          }

          // Parse with explicit parseFloat and validate
          const lat = parseFloat(latitude);
          const lng = parseFloat(longitude);

          if (isNaN(lat) || isNaN(lng)) {
            // console.log("Skipping invalid coordinates for:", postcode);
            return null;
          }

          const records_ = loadRecordByZipCode(postcode);
          const departmentCode = getDepartmentCode(postcode);
          const departmentName = getDepartmentName(postcode);

          return {
            zipCode: postcode,
            lat,
            lng,
            name: city,
            departmentName,
            departmentCode,
            baseRecords: records_,
          };
        } catch (rowError) {
          console.error("Error parsing row:", row, rowError);
          return null;
        }
      })
      .filter((record) => !!record);

    return data;
  };

  const processZipcodesBatch = () => {
    const zipCodes = postcodes.value;
    if (!zipCodes) return;

    if (currentCitiesBatch.value === 0) {
      cities.value = [];
    }

    const startIndex = currentCitiesBatch.value * BATCH_SIZE;
    const endIndex = startIndex + BATCH_SIZE;
    const zipCodesBatch = zipCodes.slice(startIndex, endIndex);

    if (zipCodesBatch.length === 0) return;

    let processCities: City[] = [];

    // Parse CSV response
    const zipCodesResults = processCsv(zipCodesBatch);

    const processedCitiesRecords = zipCodesResults.reduce(
      (acc: City[], current) => {
        let existingEntry: City | undefined = acc.find(
          (entry: City) => entry.zipCode === current.zipCode
        );

        if (existingEntry) {
          existingEntry = existingEntry as City;

          if (existingEntry.communes.find((c) => c.name !== current.name)) {
            // Add the commune to existing entry
            existingEntry.communes.push({
              name: current.name,
              lat: current.lat,
              lng: current.lng,
            });

            // Recalculate center
            const totalLat = existingEntry.communes.reduce(
              (sum, commune) => sum + commune.lat,
              0
            );
            const totalLng = existingEntry.communes.reduce(
              (sum, commune) => sum + commune.lng,
              0
            );
            existingEntry.lat = totalLat / existingEntry.communes.length;
            existingEntry.lng = totalLng / existingEntry.communes.length;
          }
        } else {
          // Create new entry
          acc.push({
            ...current,
            departmentName: current.departmentName,
            departmentCode: current.departmentCode,
            zipCode: current.zipCode,
            baseRecords: current.baseRecords as BaseRecord[],
            lat: current.lat, // Initial center is the first commune
            lng: current.lng,
            communes: [
              {
                name: current.name,
                lat: current.lat,
                lng: current.lng,
              },
            ],
          });
        }

        return acc;
      },
      []
    );

    processCities = processedCitiesRecords;

    cities.value.push(...processCities);

    cities.value = uniqBy(cities.value, "zipCode");
  };

  // Modified to handle departments better
  const fetchCsvRecords = async (zipCodes: string[]) => {
    if (!zipCodes || zipCodes.length === 0) return false;

    // If we're using department codes, we already have all data from the CSV
    if (usingDptCode.value) {
      // We can mark as success immediately since we use the static department data
      return true;
    }

    // Original code for commune data (zip codes)
    // Check all zipcodes against local data
    const localMatches: string[] = [];
    const zipCodesToFetch: string[] = [];

    for (const zipCode of zipCodes) {
      const matches = csvCommunesContent.filter(
        (row: any) =>
          row.postcode === zipCode || row.result_postcode === zipCode
      );

      if (matches.length > 0) {
        const formattedMatches = matches.map(
          (match: any) =>
            `${match.postcode},"${match.commune}",${match.longitude},${match.latitude}`
        );
        localMatches.push(...formattedMatches);
      } else {
        zipCodesToFetch.push(zipCode);
      }
    }

    // Store local matches
    if (!storedFilloutCsv.value["zip"]) {
      storedFilloutCsv.value["zip"] = [];
    }
    storedFilloutCsv.value["zip"].push(...localMatches);

    // If all found locally, we're done
    if (zipCodesToFetch.length === 0) {
      return true;
    }

    // Fetch remaining zipcodes in one API call
    const communes = [];
    for (const zipCode of zipCodesToFetch) {
      const communesOfSameZip = (franceCommunes as any[])
        .filter((c) => c.CodePostal == zipCode)
        .map((c) => ({
          postcode: c.CodePostal,
          city: transformToCapitalize(c.NomCommune),
        }));

      communes.push(...communesOfSameZip);
    }

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

      const newData = response.data.split("\n").slice(1);
      storedFilloutCsv.value["zip"].push(...newData);
      return true;
    } catch (error) {
      console.error("Error fetching missing zipcodes:", error);
      return localMatches.length > 0; // Return true if we at least have some local matches
    }
  };

  const loadCsv = async () => {
    try {
      loading.value = true;
      currentCsvBatch.value = 0;
      const totalBatches = Math.ceil(postcodes.value.length / BATCH_SIZE);

      // For department mode with our comprehensive dataset, we can simplify
      if (usingDptCode.value) {
        // We're using the comprehensive department dataset, so we can proceed directly
        for (let i = 0; i < totalBatches; i++) {
          currentCsvBatch.value = i;
          await loadCitiesForBatch(i);
        }

        loadCsvDone.value = true;
        loading.value = false;
        return;
      }

      // Original code for commune data processing in batches
      const processBatch = async () => {
        const startIndex = currentCsvBatch.value * BATCH_SIZE;
        const endIndex = startIndex + BATCH_SIZE;
        const zipCodesBatch = postcodes.value.slice(startIndex, endIndex);

        if (zipCodesBatch.length === 0) {
          loadCsvDone.value = true;
          return;
        }

        console.log(
          `Processing batch ${currentCsvBatch.value + 1} of ${totalBatches}`
        );

        const success = await fetchCsvRecords(zipCodesBatch);
        if (success) {
          await loadCitiesForBatch(currentCsvBatch.value);
        }

        currentCsvBatch.value++;

        if (currentCsvBatch.value < totalBatches) {
          // Add delay between batches to prevent UI blocking
          await new Promise((resolve) => setTimeout(resolve, 100));
          await processBatch();
        } else {
          loadCsvDone.value = true;
        }
      };

      await processBatch();
    } catch (error) {
      console.error("Error loading cities:", error);
      cities.value = [];
      loadCsvDone.value = true;
    } finally {
      loading.value = false;
    }
  };

  const loadCitiesForBatch = async (batchIndex: number) => {
    try {
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = startIndex + BATCH_SIZE;
      const zipCodes = postcodes.value.slice(startIndex, endIndex);

      if (!zipCodes.length) return;

      currentCitiesBatch.value = batchIndex;
      console.log(`Processing cities for batch ${batchIndex + 1}`);

      await processZipcodesBatch();
    } catch (error) {
      console.error("Error loading cities for batch:", error);
    }
  };

  watch(
    [() => usingDptCode.value, () => loadRecordsDone.value],
    async () => {
      if (loadRecordsDone.value) {
        loadCsv();
      }
    },
    { immediate: true, deep: true, flush: "sync" }
  );

  watch(
    () => currentCsvBatch.value,
    () => {
      console.log(
        currentCsvBatch.value,
        Math.ceil(postcodes.value.length / BATCH_SIZE),
        currentCsvBatch.value === Math.ceil(postcodes.value.length / BATCH_SIZE)
      );
    }
  );

  return {
    records,
    postcodes,
    cities,
    filteredCities,
    processCsv,
    departments, // Expose departments data
  };
}
