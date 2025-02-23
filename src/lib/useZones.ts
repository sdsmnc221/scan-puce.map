import { computed, type ComputedRef, type Ref, ref, watch } from "vue";
import { type CsvStore } from "./useProcessData";
import { createPolygonFromPoints, extractNumbers } from "./map";

// Define type interfaces
interface Zone {
  postcodes: string[];
  baseRecords: Record<string, any>[];
  coordinates?: { lat: number; lng: number }[];
  cityNames?: string[];
  color?: string;
}

interface CityDetail {
  zipCode: string;
  name: string;
  lat: number;
  lng: number;
}

export default function useZones(
  usingDptCode: Ref<boolean>,
  postcodes: ComputedRef<string[]>,
  records: Ref<Array<Record<string, any>>>,
  storedFilloutCsv: Ref<CsvStore>,
  keyword: Ref<string>,
  processCsv: (zipCodes: string[]) => CityDetail[]
) {
  const communesContours: Ref<Record<string, any>> = ref({});

  // Memoize processed CSV results
  const zipCodesResultsCache = ref<CityDetail[]>([]);

  // Optimize zones computation with proper typing
  const zones: ComputedRef<Zone[]> = computed(() => {
    if (!records.value?.length) return [];

    const processRecord = (rec: Record<string, any>) => {
      const field = usingDptCode.value ? "Dept" : "ZipCode";
      if (!rec[field]?.includes(",")) return null;

      const postcodes = rec[field]
        .replaceAll(" ", "")
        .split(",")
        .map((code: string) => {
          if (!usingDptCode.value) return code;
          const dptCode = extractNumbers(code);
          return dptCode.length === 2 ? dptCode + "000" : dptCode;
        });

      return {
        postcodes,
        baseRecords: [rec],
      };
    };

    return records.value
      .map(processRecord)
      .filter((zone): zone is Zone => zone !== null);
  });

  const computeZones = () => {
    // Update cache only when needed
    zipCodesResultsCache.value = processCsv(postcodes.value);

    return zones.value.map((zone) => {
      const citiesDetails = zone.postcodes
        .map((city: string) => {
          return zipCodesResultsCache.value.find((entry) => {
            const entryCodes = entry.zipCode
              .split(",")
              .map((code) => code.trim());
            return (
              entryCodes.includes(city) || entryCodes.includes(city.slice(0, 2))
            );
          });
        })
        .filter((entry): entry is CityDetail => !!entry);

      // Check contours availability
      const hasContours = zone.postcodes.some(
        (postcode) => communesContours.value[postcode]
      );

      if (hasContours) {
        const allContourPoints = zone.postcodes
          .filter((postcode) => communesContours.value[postcode])
          .flatMap((postcode) => communesContours.value[postcode]);

        return {
          ...zone,
          coordinates: allContourPoints,
          cityNames: citiesDetails.map((city) => city.name),
          color: "#FFCA3A",
        };
      }

      // Process regular coordinates
      const coordinates = citiesDetails.map((city) => ({
        lat: city.lat,
        lng: city.lng,
      }));

      return {
        ...zone,
        coordinates: createPolygonFromPoints(coordinates),
        cityNames: citiesDetails.map((city) => city.name),
        color: "#FFCA3A",
      };
    });
  };

  const processedZones = ref<Zone[]>(computeZones());
  const filteredZones = ref<Zone[]>([]);

  // Optimize watchers
  watch(
    [storedFilloutCsv, zones],
    () => {
      processedZones.value = computeZones();
    },
    { deep: true }
  );

  // Debounce keyword filtering
  const debouncedFilter = (value: string) => {
    const trimmedKeyword = value.trim().toLowerCase();
    if (trimmedKeyword) {
      filteredZones.value = processedZones.value.filter(
        (zone) =>
          zone.postcodes.some((code) => code.includes(trimmedKeyword)) ||
          zone.cityNames?.some((city) =>
            city.toLowerCase().includes(trimmedKeyword)
          )
      );
    } else {
      filteredZones.value = [];
    }
  };

  watch(() => keyword.value, debouncedFilter);

  return {
    zones,
    processedZones,
    filteredZones,
  };
}
