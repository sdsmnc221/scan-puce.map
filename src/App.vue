<template>
  <div style="height: 100vh; width: 100vw">
    <LMap
      ref="map"
      id="map"
      :zoom="zoom"
      :center="centerFrance"
      :use-global-leaflet="false"
      :max-bounds="franceBounds"
      :max-bounds-viscosity="1.0"
    >
      <LTileLayer
        url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
        attribution="attribution"
        layer-type="base"
        name="OpenStreetMap"
        :bounds="franceBounds"
      />

      <LRectangle
        :bounds="[
          [-90, -180],
          [90, 180],
        ]"
        :options="maskOptions"
      />

      <LGeoJson :geojson="franceOutline" :options="franceOptions" />

      <LPolygon
        v-for="(zone, index) in processedZones"
        :key="`zone-commun-${index}`"
        :lat-lngs="zone.coordinates.map(({ lat, lng }) => [lat, lng])"
        :options="getZoneOptions(zone)"
      >
        <LMarker
          :lat-lng="getZoneCenter(zone.coordinates)"
          @click="
            (e) => {
              const { lat, lng } = e.latlng;
              centerOnMarker([lat, lng]);
              targetPopup(e);
            }
          "
        >
          <LIcon
            icon-url="pin-zone.png"
            :icon-size="[32, 32]"
            :icon-anchor="[16, 16]"
          />
          <LPopup>
            <PinPopup :location="zone"></PinPopup>
          </LPopup>
        </LMarker>
      </LPolygon>

      <template v-if="mapCities?.length">
        <LMarker
          v-for="city in mapCities"
          :key="`commune-${city.zipCode}`"
          :lat-lng="[city.lat, city.lng]"
          @click="
            (e) => {
              centerOnMarker([city.lat, city.lng]);
              targetPopup(e);
            }
          "
          @ready="loading = false"
        >
          <LIcon
            :icon-url="`/pin${
              city?.records?.some((r) => r.AccessICAD === true) ? '-icad' : ''
            }.png`"
            :icon-size="[25, 25]"
            :icon-anchor="[12.5, 12.5]"
          />
          <LPopup>
            <PinPopup :location="city" :is-dpt="usingDptCode"> </PinPopup>
          </LPopup>
        </LMarker>
      </template>
    </LMap>

    <IInput
      id="inputDemo"
      placeholder="Code postal, code de département..."
      container-class="w-full max-w-sm search-input"
      @update:model-value="onSearchInput"
    ></IInput>

    <RippleButton
      class="toggle-dpt"
      @click="() => (usingDptCode = !usingDptCode)"
    >
      Affichage par {{ usingDptCode ? "Département" : "Commune" }}
    </RippleButton>

    <Sheet>
      <SheetTrigger class="toggle-embed">
        <RippleButton class="text-xs rounded-xl"> Embed </RippleButton>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Code à copier-coller</SheetTitle>
          <SheetDescription>
            <CodeEmbed :code="iframeCode" language="html"></CodeEmbed>
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>

    <Sheet>
      <SheetTrigger class="toggle-legal">
        <RippleButton class="text-xs rounded-xl bg-yellow-100">
          Mentions légales & Politique de confidentialité
        </RippleButton>
      </SheetTrigger>
      <SheetContent class="legal-sheet">
        <SheetHeader>
          <SheetTitle
            >Mentions légales & Politique de confidentialité</SheetTitle
          >
          <SheetDescription>
            <LegalNotice></LegalNotice>
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  </div>

  <PWAInstallPrompt></PWAInstallPrompt>

  <MapLoader :loading="loading"></MapLoader>
</template>

<script setup>
import "minireset.css";
import "leaflet/dist/leaflet.css";
import {
  LMap,
  LTileLayer,
  LMarker,
  LPopup,
  LIcon,
  LPolygon,
  LGeoJson,
  LRectangle,
} from "@vue-leaflet/vue-leaflet";
import franceBoundaries from "./geojson/france.json";
import franceDepartments from "./geojson/dptFr.json";
import franceCommunes from "./geojson/communesFr.json";

import { ref, computed, onMounted, watch, nextTick, onUnmounted } from "vue";
import Airtable from "airtable";
import axios from "axios";
import { inject } from "@vercel/analytics";
import { flatten } from "lodash";
import {
  createPolygonFromPoints,
  getZoneOptions,
  extractNumbers,
  getZoneCenter,
} from "./lib/map";
import { transformToCapitalize } from "./lib/lexique";

import IInput from "./components/IInput.vue";
import RippleButton from "./components/RippleButton.vue";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import CodeEmbed from "./components/CodeEmbed.vue";
import PWAInstallPrompt from "./components/PWAInstallPrompt.vue";
import PinPopup from "./components/PinPopup.vue";
import LegalNotice from "./components/LegalNotice.vue";
import MapLoader from "./components/MapLoader.vue";

const usingDptCode = ref(false);
const usingFilloutBase = ref(true);

const defaultZoom = 6;
const zoom = ref(defaultZoom); // Kept zoom level at 6 which is good for viewing France
const franceOutline = ref(franceBoundaries);
const centerFrance = [46.603354, 1.888334];
const attribution =
  '&copy; OpenStreetMap France | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const franceBounds = [
  [41.333, -4.795], // Southwest corner
  [51.124, 9.56], // Northeast corner
];
const maskOptions = {
  color: "#000",
  fillColor: "#000",
  fillOpacity: 0.12,
  stroke: false,
};
const franceOptions = {
  color: "#fff",
  fillColor: "#fff",
  fillOpacity: 0.32,
  stroke: true,
  weight: 0.32,
};
const iframeCode = `<iframe
    src="https://scan-puce.antr.tech"
    width="100%"
    height="600px"
    frameborder="0"
    allowfullscreen
    loading="lazy"
    referrerpolicy="no-referrer-when-downgrade"
    sandbox="allow-scripts allow-same-origin allow-popups">
</iframe>`;

Airtable.configure({
  endpointUrl: "https://api.airtable.com",
  apiKey: import.meta.env.VITE_AIRTABLE_ACCESS_TOKEN,
});

const base = ref(Airtable.base(import.meta.env.VITE_AIRTABLE_BASE_ID));

const map = ref(null);

const loading = ref(true);

const records = ref([]);
const loadRecordsDone = ref(false);
const cities = ref([]);
const mapCities = ref([]);

const searchTimeout = ref(null);
const keyword = ref("");

const communesContours = ref({});
const communesNames = ref({});

const storedCsv = ref({
  dpt: [],
  zip: [],
});

const storedFilloutCsv = ref({
  dpt: [],
  zip: [],
});

const csvRowsCount = ref(0);

const departmentGeoJson = ref(null);
const geoJsonOptions = {
  style: (feature) => {
    return {
      color: "#3388ff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.2,
    };
  },
};

const loadRecordByZipCode = (zipCode) => {
  const records_ = records.value.filter((rec) => {
    // Split in case there are multiple zip codes
    const zipCodes = rec.ZipCode.split(",").map((code) => code.trim());
    // Check for exact match
    return zipCodes.includes(zipCode);
  });

  return records_ ?? null;
};

const loadRecordByDeptCode = (deptCode) => {
  const deptPrefix = deptCode.slice(0, 2);

  const records_ = records.value.filter((rec) => {
    // Split the Dept field in case it contains multiple codes

    const deptCodes = rec.Dept.split(",").map((code) => code.trim());
    // Check for exact match with the prefix
    return deptCodes.includes(deptPrefix);
  });

  return records_ ?? null;
};

const getDepartmentCode = (zipcode) => {
  if (!zipcode) return null;
  return zipcode.substring(0, 2);
};

// Function to get department name from zipcode
const getDepartmentName = (zipcode) => {
  const deptCode = getDepartmentCode(zipcode);
  return franceDepartments[deptCode] || null;
};

const findCommunesByZipCodes = (zipCodes) => {
  if (!zipCodes || !zipCodes.length) return [];

  // Create a Set for faster lookup
  const zipCodeSet = new Set(zipCodes);

  return franceCommunes.filter((commune) => zipCodeSet.has(commune.CodePostal));
};

const fetchCsvRecords = async (zipCodes) => {
  if (!zipCodes) return;

  const communes = [];
  for (const zipCode of zipCodes) {
    const communesOfSameZip = franceCommunes
      .filter((c) => c.CodePostal == zipCode)
      .map((c) => ({
        postcode: c.CodePostal,
        city: transformToCapitalize(c.NomCommune),
      }));

    communesOfSameZip.forEach((c) => {
      communes.push(c);
    });
  }
  const csvRows = communes.map((match) => `${match.postcode},"${match.city}"`);

  // Create CSV content with header - add name of commune to help filter
  const csvHeader = "postcode,city\n";
  const csvContent = csvRows.join("\n");

  let store = usingFilloutBase.value ? storedFilloutCsv : storedCsv;

  if (
    csvRowsCount.value == 0 ||
    store.value[usingDptCode.value ? "dpt" : "zip"].length !==
      csvRowsCount.value
  ) {
    // Create formData with the new CSV content
    const formData = new FormData();
    formData.append(
      "data",
      new Blob([csvContent], { type: "text/csv" }),
      "zipCodes.csv"
    );

    // Make the request with formData
    const response = await axios.post(
      "https://api-adresse.data.gouv.fr/search/csv/",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    store.value[usingDptCode.value ? "dpt" : "zip"] = response.data
      .split("\n")
      .slice(1); // Skip header row
  }
};

const processCsv = (rows) => {
  csvRowsCount.value = rows.length;

  const data = rows
    .filter((row) => row.length > 0 && !row.includes("not-found"))
    .map((row) => {
      try {
        const [
          postcode,
          city,
          latitude,
          longitude,
          result_label,
          result_score,
          result_score_next,
          result_type,
          result_id,
          result_housenumber,
          result_name,
          result_street,
          result_postcode,
          result_city,
          result_context,
          result_citycode,
          result_oldcitycode,
          result_oldcity,
          result_district,
          result_status,
        ] = row.split(",");

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
          records: records_,
        };
      } catch (rowError) {
        console.error("Error parsing row:", row, rowError);
        return null;
      }
    })
    .filter((record) => !!record);

  return data;
};

async function loadCities() {
  try {
    loading.value = true;

    const zipCodes = postcodes.value;
    cities.value = [];

    await fetchCsvRecords(zipCodes);

    // Parse CSV response
    const store = usingFilloutBase.value ? storedFilloutCsv : storedCsv;
    const rows = store.value[usingDptCode.value ? "dpt" : "zip"];
    const zipCodesResults = processCsv(rows);

    const processedCitiesRecords = zipCodesResults.reduce((acc, current) => {
      const existingEntry = acc.find(
        (entry) => entry.zipCode === current.zipCode
      );

      if (
        existingEntry &&
        existingEntry.communes.find((c) => c.name !== current.name)
      ) {
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
      } else {
        // Create new entry
        acc.push({
          ...current,
          zipCode: current.zipCode,
          records: current.records,
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
    }, []);

    if (keyword.value) {
      const filteredCitiesByKeyword = processedCitiesRecords.filter((city) => {
        return (
          city.zipCode.includes(keyword.value) ||
          (usingDptCode.value
            ? city.departmentName
                .toLowerCase()
                .includes(keyword.value.toLowerCase())
            : city.communes.some((commune) =>
                commune.name.toLowerCase().includes(keyword.value.toLowerCase())
              ))
        );
      });

      cities.value = [];

      nextTick(() => {
        cities.value = new Set(filteredCitiesByKeyword);
      });
    } else {
      cities.value = [];
      cities.value = processedCitiesRecords;
    }
  } catch (error) {
    console.error("Error loading cities:", error);
    cities.value = []; // Set empty array in case of error
  }
}

const onSearchInput = (inputValue) => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value);

  searchTimeout.value = setTimeout(() => {
    keyword.value = inputValue;
  }, 480);
};

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

const zones = computed(() => {
  let codes;

  if (usingDptCode.value) {
    codes = records.value
      .filter((rec) => rec.Dept.includes(","))
      .map((rec) => ({
        postcodes: rec.Dept.replaceAll(" ", "")
          .split(",")
          .map((dpt) => {
            const dptCode = extractNumbers(dpt);
            return dptCode.length === 2 ? dptCode + "000" : dptCode;
          }),
        records: [rec],
      }));
  } else {
    codes = records.value
      .filter((rec) => rec.ZipCode.includes(","))
      .map((rec) => ({
        postcodes: rec.ZipCode.replaceAll(" ", "").split(","),
        records: [rec],
      }));
  }

  return codes;
});

const computeZones = () => {
  return zones.value.map((zone, index) => {
    const store = usingFilloutBase.value ? storedFilloutCsv : storedCsv;
    const rows = store.value[usingDptCode.value ? "dpt" : "zip"];
    const zipCodesResults = processCsv(rows);

    const citiesDetails = zone.postcodes
      .map((city) => {
        return zipCodesResults.find((entry) => {
          // Split in case there are multiple zip codes
          const entryCodes = entry.zipCode
            .split(",")
            .map((code) => code.trim());
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

const centerOnMarker = ([lat, lng]) => {
  map.value?.leafletObject?.setView([lat, lng], 10);
};

const resetMapView = () => {
  map.value?.leafletObject?.setView(centerFrance, defaultZoom);
};

const targetPopup = (e) => {
  nextTick(() => {
    e.target._popup._closeButton?.addEventListener("click", (target) => {
      resetMapView();
    });
  });
};

onMounted(() => {
  nextTick(() => {
    inject();
  });
});

onUnmounted(() => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value);
});

watch(
  () => usingFilloutBase.value,
  () => {
    records.value = [];

    base
      .value(usingFilloutBase.value ? "filloutBase" : "draftBase")
      .select({
        // Selecting the first 3 records in Grid view:
        maxRecords: 100,
        view: "Grid view",
      })
      .eachPage(
        function page(recs, fetchNextPage) {
          // This function (`page`) will get called for each page of records.

          recs.forEach(function (record) {
            records.value.push(record.fields);
          });

          loadRecordsDone.value = true;

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.

          fetchNextPage();
        },
        function done(err) {
          if (err) {
            console.error(err);
            loadRecordsDone.value = false;
            return;
          }
        }
      );
  },
  { immediate: true }
);

watch(
  [() => usingDptCode.value, () => loadRecordsDone.value],
  async () => {
    loadCities();
  },
  { immediate: true, deep: true, flush: "sync" }
);

watch(
  () => keyword.value,
  () => {
    loadCities();
  }
);

watch(
  [() => storedCsv.value, () => storedFilloutCsv.value, () => zones.value],
  () => {
    processedZones.value = computeZones();
  },
  { deep: true, flush: "sync" }
);

watch(
  cities,
  async () => {
    try {
      await nextTick();
      if (!map.value?._leaflet_id) {
        console.log("error map display");

        // map.value = document.querySelector("#map");

        mapCities.value = [];
        nextTick(() => {
          mapCities.value = [...cities.value];
        });
      }

      mapCities.value = [];

      nextTick(() => {
        mapCities.value = [...cities.value];
      });
    } catch (error) {
      console.error("Map error:", error);
      // cities.value = [...cities.value];
    }
  },
  { deep: true, flush: "sync" }
);
</script>

<style lang="scss">
@import "./output.css";

.leaflet-container {
  z-index: 10;
}

.search-input {
  position: fixed;
  bottom: 24px;
  left: 24px;
  z-index: 99;
}

.toggle-dpt {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 49;
}

.toggle-legal {
  position: fixed;
  bottom: 50px;
  right: 24px;
  z-index: 49;
}

.toggle-embed {
  position: fixed;
  bottom: 100px;
  right: 24px;
  z-index: 49;
}

.legal-sheet {
  width: 50vw;
  max-width: unset;
}

@media screen and (max-width: 768px) {
  .search-input {
    bottom: 0;
    left: 0;
  }

  .legal-sheet {
    width: 100vw;
  }
}
</style>
