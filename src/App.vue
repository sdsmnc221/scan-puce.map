<template>
  <div style="height: 100vh; width: 100vw">
    <LMap
      ref="map"
      :zoom="zoom"
      :center="[46.603354, 1.888334]"
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

      <template
        v-for="zone in processedZones"
        :key="`communes-${zone.postcodes.join('-')}`"
      >
        <template
          v-for="postcode in zone.postcodes"
          :key="`commune-${postcode}`"
        >
          <LPolygon
            v-if="communesContours[postcode]"
            :lat-lngs="zone.coordinates.map(({ lat, lng }) => [lat, lng])"
            :options="{
              color: zone.color,
              fillColor: zone.color,
              fillOpacity: 0.1,
              weight: 1,
            }"
          >
            <LPopup>
              <PinPopup :location="zone"></PinPopup>
            </LPopup>
          </LPolygon>
        </template>
      </template>

      <LMarker
        v-for="city in cities"
        :key="city.zipCode"
        :lat-lng="[city.lat, city.lng]"
      >
        <LIcon
          :icon-url="`/pin${city?.record?.AccessICAD ? '-icad' : ''}.png`"
          :icon-size="[25, 25]"
          :icon-anchor="[12, 41]"
        />
        <LPopup>
          <PinPopup :location="city"> </PinPopup>
        </LPopup>
      </LMarker>
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

    <RippleButton
      class="toggle-base text-sm rounded-xl bg-yellow-300"
      @click="() => (usingFilloutBase = !usingFilloutBase)"
    >
      Base :
      {{ usingFilloutBase ? "En cours d'alimentation" : "Test" }}
    </RippleButton>

    <Sheet>
      <SheetTrigger class="toggle-embed">
        <RippleButton class="text-sm rounded-xl"> Embed </RippleButton>
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
  </div>

  <PWAInstallPrompt></PWAInstallPrompt>
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

import { ref, computed, onMounted, watch } from "vue";
import Airtable from "airtable";
import axios from "axios";
import { flatten } from "lodash";
import {
  createPolygonFromPoints,
  getZoneOptions,
  extractNumbers,
} from "./lib/map";

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

const usingDptCode = ref(false);
const usingFilloutBase = ref(true);

const zoom = ref(6); // Kept zoom level at 6 which is good for viewing France
const franceOutline = ref(franceBoundaries);
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

const records = ref([]);
const cities = ref([]);
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
  const record = records.value.find((rec) => {
    // Split in case there are multiple zip codes
    const zipCodes = rec.ZipCode.split(",").map((code) => code.trim());
    // Check for exact match
    return zipCodes.includes(zipCode);
  });

  return record ?? null;
};

const loadRecordByDeptCode = (deptCode) => {
  const deptPrefix = deptCode.slice(0, 2);

  const record = records.value.find((rec) => {
    // Split the Dept field in case it contains multiple codes

    const deptCodes = rec.Dept.split(",").map((code) => code.trim());
    // Check for exact match with the prefix
    return deptCodes.includes(deptPrefix);
  });

  return record ?? null;
};

const loadCommunesForPostcode = async (postcode) => {
  try {
    const response = await axios.get(
      `https://geo.api.gouv.fr/communes?codePostal=${postcode}&fields=nom,code,codesPostaux,contour`
    );
    return response.data;
  } catch (error) {
    console.error(`Error fetching communes for ${postcode}:`, error);
    return [];
  }
};

const fetchCommunesContours = async (postcode) => {
  const communes = await loadCommunesForPostcode(postcode);

  if (communes.length > 0) {
    communesNames.value[postcode] = communes.map((c) => c.nom);

    const allPoints = communes.flatMap((commune) => {
      if (commune.contour) {
        return commune.contour.coordinates[0];
      }
      return [];
    });

    if (allPoints.length > 0) {
      communesContours.value[postcode] = allPoints;
    }
  }
};

const loadCsvRecords = async (zipCodes) => {
  // Create CSV content with header - add name of commune to help filter
  const csvHeader = "postcode,city\n";
  // Get communes data for each postal code
  const communesData = await Promise.all(
    zipCodes.map(async (zipCode) => {
      try {
        // First get all communes for this postal code
        const communesResponse = await axios.get(
          `https://geo.api.gouv.fr/communes?codePostal=${zipCode}&fields=nom,code,codesPostaux`
        );

        // Create CSV rows for each commune with same postal code
        return communesResponse.data.map(
          (commune) => `${zipCode},${commune.nom}`
        );
      } catch (error) {
        console.error(`Error fetching communes for ${zipCode}:`, error);
        return [`${zipCode},`]; // Return empty commune name if error
      }
    })
  );

  // Flatten array and create CSV content
  const csvContent = csvHeader + communesData.flat().join("\n");

  let store = usingFilloutBase.value ? storedFilloutCsv : storedCsv;

  if (
    store.value[usingDptCode.value ? "dpt" : "zip"].length !==
    records.value.length
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
  return rows
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

        const record = usingDptCode.value
          ? loadRecordByDeptCode(postcode)
          : loadRecordByZipCode(postcode);

        if (
          !latitude ||
          !longitude ||
          (keyword.value && !postcode.includes(keyword.value))
        ) {
          return null;
        }

        return {
          zipCode: postcode,
          lat: parseFloat(latitude),
          lng: parseFloat(longitude),
          name: result_city.replace(/"/g, ""), // Remove quotes from label,
          record,
        };
      } catch (rowError) {
        console.error("Error parsing row:", row, rowError);
        return null;
      }
    })
    .filter((record) => !!record);
};

async function loadCities(zipCodes) {
  try {
    await loadCsvRecords(zipCodes);

    // Parse CSV response

    let store = usingFilloutBase.value ? storedFilloutCsv : storedCsv;
    const rows = store.value[usingDptCode.value ? "dpt" : "zip"];

    const zipCodesResults = processCsv(rows);

    const groupedZipCodes = zipCodesResults.reduce((acc, current) => {
      const existingEntry = acc.find(
        (entry) => entry.zipCode === current.zipCode
      );

      if (existingEntry) {
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
      } else {
        // Create new entry
        acc.push({
          zipCode: current.zipCode,
          record: current.record,
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

    cities.value = groupedZipCodes;

    console.log(groupedZipCodes);
  } catch (error) {
    console.error("Error loading cities:", error);
    cities.value = []; // Set empty array in case of error
  }
}

const onSearchInput = (inputValue) => {
  keyword.value = inputValue;
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

  return keyword.value
    ? codes.filter((zc) => zc.includes(keyword.value))
    : codes;
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
        record: rec,
      }));
  } else {
    codes = records.value
      .filter((rec) => rec.ZipCode.includes(","))
      .map((rec) => ({
        postcodes: rec.ZipCode.replaceAll(" ", "").split(","),
        record: rec,
      }));
  }

  return keyword.value
    ? codes.filter((zc) => zc.includes(keyword.value))
    : codes;
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

    const coordinates = citiesDetails.map((city) => ({
      lat: city.lat,
      lng: city.lng,
    }));

    const cityNames = citiesDetails.map((city) => city.name);

    return {
      postcodes: zone.postcodes,
      coordinates: createPolygonFromPoints(coordinates), // Changed this line
      cityNames,
      color: "#FFCA3A",
      record: zone.record,
    };
  });
};

const processedZones = ref(computeZones());

watch(
  [() => usingDptCode.value, () => records.value],
  () => {
    loadCities(postcodes.value);
  },
  { immediate: true, deep: true }
);

watch(
  () => keyword.value,
  () => {
    loadCities(postcodes.value);
  }
);

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

          // To fetch the next page of records, call `fetchNextPage`.
          // If there are more records, `page` will get called again.
          // If there are no more records, `done` will get called.

          fetchNextPage();
        },
        function done(err) {
          if (err) {
            console.error(err);
            return;
          }
        }
      );
  },
  { immediate: true }
);

watch(
  [() => storedCsv.value, () => storedFilloutCsv.value, () => zones.value],
  () => {
    processedZones.value = computeZones();
  },
  { deep: true, flush: "sync" }
);

watch(
  () => zones.value,
  async (newZones) => {
    for (const zone of newZones) {
      for (const postcode of zone.postcodes) {
        await fetchCommunesContours(postcode);
      }
    }
  },
  { immediate: true }
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

.toggle-base {
  position: fixed;
  bottom: 48px;
  right: 24px;
  z-index: 49;
}

.toggle-embed {
  position: fixed;
  bottom: 96px;
  right: 24px;
  z-index: 49;
}

@media screen and (max-width: 768px) {
  .search-input {
    bottom: 0;
    left: 0;
  }
}
</style>
