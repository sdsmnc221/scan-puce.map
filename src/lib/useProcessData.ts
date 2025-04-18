import { type Ref, ref, type ComputedRef, computed, watch } from "vue";
import axios from "axios";
import { flatten, uniqBy } from "lodash";

import useBase from "./useBase";
import { transformToCapitalize } from "./lexique";

import franceCommunes from "../geojson/communesFr.json";
import franceDepartments from "../geojson/dptFr.json";

import csvCommunesContent from "../geojson/communes.csv";
import csvDeptsContent from "../geojson/depts.csv";

export type CsvStore = {
  dpt: any[];
  zip: any[];
};

export type BaseRecord = {
  id: string;
  createTime: string;
  // fields: {
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
  // };
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
  const filteredCities: ComputedRef<City[]> = computed(() => {
    let filteredResult;

    if (
      !keyword.value.trim().length &&
      pinType.value.length === 1 &&
      pinType.value.includes(2)
    ) {
      return [];
    }

    if (keyword.value.trim().length) {
      filteredResult = cities.value.filter((city) => {
        // const dptOfCity = storedFilloutCsv.value["dpt"].filter((row: string) =>
        //   row.toLowerCase().includes(keyword.value.toLowerCase())
        // );

        // dptOfCity.forEach((csvCity: string) => {
        //   console.log(csvCity.split(","));
        //   return (csvCity.split[","][0] as string) == city.zipCode; // csvCity.split[","][0] is postCode
        // });

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

          // dptOfCity.some(
          //   (csvCity: string) =>
          //     (csvCity.split[","][0] as string) == city.zipCode // csvCity.split[","][0] is postCode
          // )
        );
      });

      return uniqBy(filteredResult, "zipCode");
    }

    console.log(pinType.value);

    filteredResult = cities.value.filter((city: City) => {
      if (pinType.value.includes(0) && pinType.value.includes(1)) {
        return true;
      } else if (pinType.value.includes(0) && !pinType.value.includes(1)) {
        // case red pin (withoud ICAD)
        return city.baseRecords.some(
          (record: BaseRecord) => !record.AccessICAD
        );
      } else if (pinType.value.includes(1) && !pinType.value.includes(0)) {
        // case blue pin (without ICAD)
        return city.baseRecords.some(
          (record: BaseRecord) => !!record.AccessICAD
        );
      } else if (!pinType.value.includes(0) && !pinType.value.includes(1)) {
        console.log("here");
        return false;
      }
    });

    // console.log(filteredResult);

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
      ).map((dpt) => dpt + "000");
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
    const deptPrefix = deptCode.slice(0, 2);

    const records_ = records.value.filter((rec) => {
      // Split the Dept field in case it contains multiple codes

      const deptCodes = rec.Dept?.split(",")?.map((code: string) =>
        code.trim()
      );
      // Check for exact match with the prefix
      return deptCodes?.includes(deptPrefix);
    });

    return records_ ?? null;
  };

  const getDepartmentCode = (zipcode: string) => {
    if (!zipcode) return null;
    return zipcode.substring(0, 2);
  };

  const getDepartmentName = (zipcode: string) => {
    const deptCode = getDepartmentCode(zipcode);
    if (!deptCode) return null;
    return (
      franceDepartments[deptCode as keyof typeof franceDepartments] || null
    );
  };

  const processCsv = (zipCodesBatch: string[]) => {
    const store = usingFilloutBase.value ? storedFilloutCsv : storedCsv;

    // Initialize store if empty
    if (!store.value.dpt.length) {
      store.value["dpt"] = csvDeptsContent;
    }
    if (!store.value.zip.length) {
      store.value["zip"] = csvCommunesContent;
    }

    const rows = store.value[usingDptCode.value ? "dpt" : "zip"];

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

          const records_ = usingDptCode.value
            ? loadRecordByDeptCode(postcode)
            : loadRecordByZipCode(postcode);

          const departmentName = getDepartmentName(postcode);

          return {
            zipCode: postcode,
            lat,
            lng,
            name: city,
            departmentName,
            departmentCode: getDepartmentCode(postcode),
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
            // Add the commune to existing entryg
            existingEntry.communes.push({
              ...current,
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

  const fetchCsvRecords = async (zipCodes: string[]) => {
    if (!zipCodes || zipCodes.length === 0) return false;

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
    if (!storedFilloutCsv.value[usingDptCode.value ? "dpt" : "zip"]) {
      storedFilloutCsv.value[usingDptCode.value ? "dpt" : "zip"] = [];
    }
    storedFilloutCsv.value[usingDptCode.value ? "dpt" : "zip"].push(
      ...localMatches
    );

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
      storedFilloutCsv.value[usingDptCode.value ? "dpt" : "zip"].push(
        ...newData
      );
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
      const BATCH_SIZE = 50; // Adjust batch size as needed
      const totalBatches = Math.ceil(postcodes.value.length / BATCH_SIZE);

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
  };
}
