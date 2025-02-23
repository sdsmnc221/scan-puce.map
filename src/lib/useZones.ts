import { computed, type ComputedRef, type Ref, ref, watch } from "vue";

import { type CsvStore } from "./useProcessData";

import { createPolygonFromPoints, extractNumbers } from "./map";

export default function useZones(
  usingDptCode: Ref<boolean>,
  postcodes: ComputedRef<string[]>,
  records: Ref<Array<Record<string, any>>>,
  storedFilloutCsv: Ref<CsvStore>,
  keyword: Ref<string>,
  processCsv: (zipCodes: string[]) => any
) {
  const communesContours: Ref<any> = ref({});

  const zones: ComputedRef<any[]> = computed(() => {
    if (!records.value?.length) return [];

    let codes;

    if (usingDptCode.value) {
      codes = records.value
        .filter((rec) => rec.Dept?.includes(","))
        .map((rec) => ({
          postcodes: rec.Dept.replaceAll(" ", "")
            .split(",")
            .map((dpt: string) => {
              const dptCode = extractNumbers(dpt);
              return dptCode.length === 2 ? dptCode + "000" : dptCode;
            }),
          baseRecords: [rec],
        }));
    } else {
      codes = records.value
        .filter((rec) => rec.ZipCode?.includes(","))
        .map((rec) => ({
          postcodes: rec.ZipCode.replaceAll(" ", "").split(","),
          baseRecords: [rec],
        }));
    }

    return codes;
  });

  const computeZones = () => {
    return zones.value.map((zone) => {
      const zipCodesResults = processCsv(postcodes.value);

      const citiesDetails = zone.postcodes
        .map((city: string) => {
          return zipCodesResults.find((entry: any) => {
            // Split in case there are multiple zip codes
            const entryCodes = entry.zipCode
              .split(",")
              .map((code: string) => code.trim());
            // Check for exact match with either full code or department code
            return (
              entryCodes.includes(city) || entryCodes.includes(city.slice(0, 2))
            );
          });
        })
        .filter((entry: any) => !!entry);

      // First try to use commune contours if available
      const hasContours = zone.postcodes.some(
        (postcode: string) => communesContours.value[postcode]
      );

      if (hasContours) {
        // Use the contours for coordinates
        const allContourPoints = zone.postcodes
          .filter((postcode: string) => communesContours.value[postcode])
          .flatMap((postcode: string) => communesContours.value[postcode]);

        return {
          ...zone,
          postcodes: zone.postcodes,
          coordinates: allContourPoints,
          cityNames: citiesDetails.map((city: { name: string }) => city.name),
          color: "#FFCA3A",
        };
      }

      const coordinates = citiesDetails.map(
        (city: { lat: number; lng: number }) => ({
          lat: city.lat,
          lng: city.lng,
        })
      );

      const cityNames = citiesDetails.map(
        (city: { name: string }) => city.name
      );

      return {
        ...zone,
        postcodes: zone.postcodes,
        coordinates: createPolygonFromPoints(coordinates), // Changed this line
        cityNames,
        color: "#FFCA3A",
      };
    });
  };

  const processedZones = ref(computeZones());
  const filteredZones: Ref<any[]> = ref([]);

  watch(
    [() => storedFilloutCsv.value, () => zones.value],
    () => {
      processedZones.value = computeZones();
    },
    { deep: true, flush: "sync" }
  );

  watch(
    () => keyword.value,
    () => {
      if (keyword.value.trim().length) {
        filteredZones.value = processedZones.value.filter(
          (zone: any) =>
            zone.postcodes.some((code: string) =>
              code.includes(keyword.value.trim())
            ) ||
            zone.cityNames.some((city: string) =>
              city.toLowerCase().includes(keyword.value.trim().toLowerCase())
            )
        );
      } else {
        filteredZones.value = [];
      }
    }
  );

  return {
    zones,
    processedZones,
    filteredZones,
  };
}
