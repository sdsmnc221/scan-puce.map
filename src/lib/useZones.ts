import { computed, type ComputedRef, type Ref, ref, watch } from "vue";

import { type BaseRecord, type CsvStore } from "./useProcessData";

import { createPolygonFromPoints, extractNumbers } from "./map";

export default function useZones(
  usingDptCode: Ref<boolean>,
  postcodes: ComputedRef<string[]>,
  records: Ref<Array<Record<string, any>>>,
  storedFilloutCsv: ReF<CsvStore>,
  processCsv: (zipCodes: string[]) => any
) {
  const communesContours: Ref<any> = ref({});

  const zones: ComputedRef<any[]> = computed(() => {
    let codes;

    if (usingDptCode.value) {
      codes = records.value
        .filter((rec) => rec.Dept.includes(","))
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
        .filter((rec) => rec.ZipCode.includes(","))
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
        .map((city) => {
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
        .filter((entry) => !!entry);

      // First try to use commune contours if available
      const hasContours = zone.postcodes.some(
        (postcode) => communesContours.value[postcode]
      );

      if (hasContours) {
        // Use the contours for coordinates
        const allContourPoints = zone.postcodes
          .filter((postcode) => communesContours.value[postcode])
          .flatMap((postcode) => communesContours.value[postcode]);

        return {
          ...zone,
          postcodes: zone.postcodes,
          coordinates: allContourPoints,
          cityNames: citiesDetails.map((city) => city.name),
          color: "#FFCA3A",
        };
      }

      const coordinates = citiesDetails.map((city) => ({
        lat: city.lat,
        lng: city.lng,
      }));

      const cityNames = citiesDetails.map((city) => city.name);

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

  watch(
    [() => storedFilloutCsv.value, () => zones.value],
    () => {
      processedZones.value = computeZones();
    },
    { deep: true, flush: "sync" }
  );

  return {
    zones,
    processedZones,
  };
}
