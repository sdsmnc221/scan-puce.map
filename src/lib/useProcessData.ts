import { type Ref, ref, type ComputedRef, computed, watch } from "vue";
import axios from "axios";
import { flatten, uniqBy } from "lodash";

import useBase from "./useBase";
import { transformToCapitalize } from "./lexique";

import franceCommunes from "../geojson/communesFr.json";
import franceDepartments from "../geojson/dptFr.json";

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

  const { loadRecordsDone, records } = useBase(usingFilloutBase);

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
          city.zipCode.includes(keyword.value) ||
          city.departmentName
            ?.toLowerCase()
            ?.includes(keyword.value.toLowerCase()) ||
          city.communes.some((commune) =>
            commune.name.toLowerCase().includes(keyword.value.toLowerCase())
          )

          // dptOfCity.some(
          //   (csvCity: string) =>
          //     (csvCity.split[","][0] as string) == city.zipCode // csvCity.split[","][0] is postCode
          // )
        );
      });
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
    let codes;

    if (usingDptCode.value) {
      codes = flatten(
        records.value
          .filter((rec) => !!rec.Dept)
          .map((rec) => rec.Dept.replaceAll(" ", "").split(","))
      ).map((dpt) => dpt + "000");
    } else {
      codes = flatten(
        records.value
          .filter((rec) => !!rec.ZipCode)
          .map((rec) => rec.ZipCode.replaceAll(" ", "").split(","))
      );
    }

    return codes;
  });

  const loadRecordByZipCode = (zipCode: string) => {
    const records_ = records.value.filter((rec) => {
      // Split in case there are multiple zip codes
      const zipCodes = rec.ZipCode.split(",").map((code: string) =>
        code.trim()
      );
      // Check for exact match
      return zipCodes.includes(zipCode);
    });

    return records_ ?? null;
  };

  const loadRecordByDeptCode = (deptCode: string) => {
    const deptPrefix = deptCode.slice(0, 2);

    const records_ = records.value.filter((rec) => {
      // Split the Dept field in case it contains multiple codes

      const deptCodes = rec.Dept.split(",").map((code: string) => code.trim());
      // Check for exact match with the prefix
      return deptCodes.includes(deptPrefix);
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

  // Modified fetchCsvRecords to handle batches
  const fetchCsvRecords = async (zipCodes: string[], batchIndex = 0) => {
    if (!zipCodes) return;

    const startIndex = batchIndex * BATCH_SIZE;
    const endIndex = startIndex + BATCH_SIZE;
    const zipCodesBatch = zipCodes.slice(startIndex, endIndex);

    if (zipCodesBatch.length === 0) return;

    const communes = [];
    for (const zipCode of zipCodesBatch) {
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

    // Create formData with the batch CSV content
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

      // Append new batch data
      const newData = response.data.split("\n").slice(1);
      if (!storedFilloutCsv.value[usingDptCode.value ? "dpt" : "zip"]) {
        storedFilloutCsv.value[usingDptCode.value ? "dpt" : "zip"] = [];
      }
      storedFilloutCsv.value[usingDptCode.value ? "dpt" : "zip"].push(
        ...newData
      );

      return true;
    } catch (error) {
      console.error("Error fetching batch:", error);
      return false;
    }
  };

  const processCsv = (zipCodesBatch: string[]) => {
    const store = usingFilloutBase.value ? storedFilloutCsv : storedCsv;
    const rows = store.value[usingDptCode.value ? "dpt" : "zip"];

    const data = rows
      .filter((row) => row.length > 0 && !row.includes("not-found"))
      .filter((row) => {
        // Get the zip code from the first column of the CSV row
        const rowZipCode = row.split(",")[0];
        return zipCodesBatch.includes(rowZipCode);
      })
      .map((row) => {
        try {
          const rowData = row.split(",");

          const postcode = rowData[0];
          const longitude = rowData[2];
          const latitude = rowData[3];
          const result_city = rowData[13];

          const records_ = usingDptCode.value
            ? loadRecordByDeptCode(postcode)
            : loadRecordByZipCode(postcode);

          const departmentName = getDepartmentName(postcode);

          if (!latitude || !longitude) {
            return null;
          }

          return {
            zipCode: postcode,
            lat: parseFloat(latitude),
            lng: parseFloat(longitude),
            name: result_city.replace(/"/g, ""), // Remove quotes from label,
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

  const loadCsv = async () => {
    try {
      loading.value = true;

      const zipCodes = postcodes.value;

      if (!zipCodes.length) return;

      currentCsvBatch.value = 0;
      const totalBatches = Math.ceil(zipCodes.length / BATCH_SIZE);

      // Initial load of first batch
      await fetchCsvRecords(zipCodes, currentCsvBatch.value);

      // Load remaining batches
      const loadNextBatch = async () => {
        currentCsvBatch.value++;
        if (currentCsvBatch.value < totalBatches) {
          const success = await fetchCsvRecords(
            zipCodes,
            currentCsvBatch.value
          );
          if (success) {
            // Schedule next batch with a small delay to prevent UI blocking
            setTimeout(() => loadNextBatch(), 100);
          }
        }
      };

      loadNextBatch();
    } catch (error) {
      console.error("Error loading cities:", error);
      cities.value = []; // Set empty array in case of error
    }
  };

  const loadCities = async () => {
    try {
      loading.value = true;

      const zipCodes = postcodes.value;

      if (!zipCodes.length) return;

      currentCitiesBatch.value = 0;
      const totalBatches = Math.ceil(zipCodes.length / BATCH_SIZE);

      processZipcodesBatch();

      const loadNextBatch = () => {
        currentCitiesBatch.value++;
        if (currentCitiesBatch.value < totalBatches) {
          processZipcodesBatch();

          setTimeout(() => loadNextBatch(), 100);
        }
      };

      loadNextBatch();
    } catch (error) {
      console.error("Error loading cities:", error);
      cities.value = []; // Set empty array in case of error
    }
  };

  watch(
    [() => usingDptCode.value, () => loadRecordsDone.value],
    async () => {
      loadCsv();
    },
    { immediate: true, deep: true, flush: "sync" }
  );

  watch(
    () => currentCsvBatch.value,
    () => {
      console.log(
        currentCsvBatch.value,
        Math.ceil(postcodes.value.length / BATCH_SIZE)
      );

      loadCities();
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
