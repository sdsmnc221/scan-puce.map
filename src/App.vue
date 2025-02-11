<template>
  <nav class="w-1/3 flex flex-col font-serif">
    <div class="flex flex-col items-center">
      <h1 class="font-bold text-xl md:text-3xl text-cente my-3">
        Réseau Lecteurs de Puce France
      </h1>

      <IInput
        id="inputDemo"
        placeholder="Recherche par code postal, code de département, nom de commune..."
        container-class="w-11/12 search-input md:my-3"
        @update:model-value="onSearchInput"
      ></IInput>

      <RippleButton
        class="toggle-dpt my-3 w-11/12 text-sm"
        @click="() => (usingDptCode = !usingDptCode)"
      >
        <span class="font-bold text-sm">
          Affichage par {{ usingDptCode ? "Département" : "Commune" }}</span
        >
        <span class="block md:inline-block md:ml-1">
          (au total :
          <span class="font-bold">{{ mapCities.length }}</span>
          localisations)
        </span>
      </RippleButton>

      <div
        class="mt-4 md:mt-10 sm:w-full md:w-11/12 sm:text-center md:text-left"
      >
        <h2 class="font-bold text-lg md:text-xl">
          Information de la localisation{{ selectedCity ? ":" : "..." }}
        </h2>
        <p class="text-md text-slate-400" v-if="!selectedCity">
          Veuillez choisir une localisation sur la carte.
        </p>
        <div v-else class="hidden md:block my-6">
          <PinPopup :location="selectedCity" :is-dpt="usingDptCode"> </PinPopup>
          <RippleButton class="mt-6 text-sm" @click="resetMapView"
            >Recentrer sur la carte</RippleButton
          >
        </div>

        <Sheet
          :open="citySheetOpen"
          @update:open="(openState) => onUpdateOpenCitySheet"
        >
          <SheetTrigger class="m-0 p-0 fixed"></SheetTrigger>
          <SheetTitle></SheetTitle>
          <SheetContent class="city-sheet font-serif" side="bottom">
            <SheetHeader>
              <SheetTitle></SheetTitle>
              <SheetDescription class="flex flex-col text-left">
                <div v-if="selectedCity" class="flex flex-col">
                  <PinPopup :location="selectedCity" :is-dpt="usingDptCode">
                  </PinPopup>
                  <RippleButton class="mt-6 text-sm" @click="resetMapView"
                    >Recentrer sur la carte</RippleButton
                  >
                </div>
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </div>
    </div>

    <div class="flex justify-between">
      <Sheet>
        <SheetTrigger class="toggle-embed">
          <RippleButton class="text-[10px] md:text-xs rounded-xl">
            Embed
          </RippleButton>
        </SheetTrigger>
        <SheetContent class="embed-sheet">
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
          <RippleButton class="text-[10px] md:text-xs rounded-xl bg-yellow-100">
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

      <PWAInstallPrompt></PWAInstallPrompt>
    </div>
  </nav>
  <div class="map w-2/3">
    <LMap
      ref="map"
      id="map"
      :key="reloadMapCount"
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

      <!-- <LPolygon
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
      </LPolygon> -->

      <div>
        <LMarker
          v-for="city in mapCities"
          :key="`commune-${city.zipCode}`"
          :lat-lng="[city.lat, city.lng]"
          @click="onMarkerClick(city)"
          @ready="loading = false"
        >
          <LIcon
            :icon-url="`/pin${
              city?.baseRecords?.some((r) => r.AccessICAD === true)
                ? '-icad'
                : ''
            }.png`"
            :icon-size="[25, 25]"
            :icon-anchor="[12.5, 12.5]"
          />
        </LMarker>
      </div>
    </LMap>

    <MapLoader :loading="loading"></MapLoader>
  </div>
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
import { isMobile } from "./lib/utils";

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

import markerIconUrl from "/node_modules/leaflet/dist/images/marker-icon.png";
import markerIconRetinaUrl from "/node_modules/leaflet/dist/images/marker-icon-2x.png";
import markerShadowUrl from "/node_modules/leaflet/dist/images/marker-shadow.png";

import L from "leaflet";

import useBase from "./lib/useBase";
import useProcessData from "./lib/useProcessData";

const usingDptCode = ref(false);
const usingFilloutBase = ref(true);

const defaultZoom = isMobile() ? 5.4 : 6;
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

const map = ref(null);
const reloadMapCount = ref(0);

const loading = ref(true);

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

const { cities, filteredCities } = useProcessData(
  usingFilloutBase,
  usingDptCode,
  storedFilloutCsv,
  storedCsv,
  keyword,
  loading
);
const mapCities = ref([]);
const selectedCity = ref(null);

const citySheetOpen = computed({
  get: () => (isMobile() ? selectedCity.value !== null : false),
  set: (open) => {
    if (!open) {
      selectedCity.value = null;
    }
  },
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

const onSearchInput = (inputValue) => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value);

  searchTimeout.value = setTimeout(() => {
    keyword.value = inputValue;
  }, 480);
};

// const zones = computed(() => {
//   let codes;

//   if (usingDptCode.value) {
//     codes = records.value
//       .filter((rec) => rec.Dept.includes(","))
//       .map((rec) => ({
//         postcodes: rec.Dept.replaceAll(" ", "")
//           .split(",")
//           .map((dpt) => {
//             const dptCode = extractNumbers(dpt);
//             return dptCode.length === 2 ? dptCode + "000" : dptCode;
//           }),
//         records: [rec],
//       }));
//   } else {
//     codes = records.value
//       .filter((rec) => rec.ZipCode.includes(","))
//       .map((rec) => ({
//         postcodes: rec.ZipCode.replaceAll(" ", "").split(","),
//         records: [rec],
//       }));
//   }

//   return codes;
// });

// const computeZones = () => {
//   return zones.value.map((zone, index) => {
//     const store = usingFilloutBase.value ? storedFilloutCsv : storedCsv;
//     const rows = store.value[usingDptCode.value ? "dpt" : "zip"];
//     const zipCodesResults = processCsv(rows);

//     const citiesDetails = zone.postcodes
//       .map((city) => {
//         return zipCodesResults.find((entry) => {
//           // Split in case there are multiple zip codes
//           const entryCodes = entry.zipCode
//             .split(",")
//             .map((code) => code.trim());
//           // Check for exact match with either full code or department code
//           return (
//             entryCodes.includes(city) || entryCodes.includes(city.slice(0, 2))
//           );
//         });
//       })
//       .filter((entry) => !!entry);

//     // First try to use commune contours if available
//     const hasContours = zone.postcodes.some(
//       (postcode) => communesContours.value[postcode]
//     );

//     if (hasContours) {
//       // Use the contours for coordinates
//       const allContourPoints = zone.postcodes
//         .filter((postcode) => communesContours.value[postcode])
//         .flatMap((postcode) => communesContours.value[postcode]);

//       return {
//         ...zone,
//         postcodes: zone.postcodes,
//         coordinates: allContourPoints,
//         cityNames: citiesDetails.map((city) => city.name),
//         color: "#FFCA3A",
//       };
//     }

//     const coordinates = citiesDetails.map((city) => ({
//       lat: city.lat,
//       lng: city.lng,
//     }));

//     const cityNames = citiesDetails.map((city) => city.name);

//     return {
//       ...zone,
//       postcodes: zone.postcodes,
//       coordinates: createPolygonFromPoints(coordinates), // Changed this line
//       cityNames,
//       color: "#FFCA3A",
//     };
//   });
// };

// const processedZones = ref(computeZones());

const centerOnMarker = ([lat, lng]) => {
  map.value?.leafletObject?.setView([lat, lng], 10);
};

const resetMapView = async () => {
  citySheetOpen.value = false;

  await nextTick();

  if (map.value?.leafletObject) {
    map.value.leafletObject.setView(centerFrance, defaultZoom);
  }
  selectedCity.value = null;
};

const onMarkerClick = (city) => {
  centerOnMarker([city.lat, city.lng]);
  selectedCity.value = city;
};

const onUpdateOpenCitySheet = (open) => {
  if (!open) {
    selectedCity.value = null;
  }
};

onMounted(() => {
  nextTick(() => {
    inject();

    L.Icon.Default.imagePath = "/";
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIconRetinaUrl,
      iconUrl: markerIconUrl,
      shadowUrl: markerShadowUrl,
    });
  });
});

onUnmounted(() => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value);
});

// watch(
//   [() => storedCsv.value, () => storedFilloutCsv.value, () => zones.value],
//   () => {
//     processedZones.value = computeZones();
//   },
//   { deep: true, flush: "sync" }
// );

watch(
  [cities, filteredCities],
  async () => {
    const usingCities =
      filteredCities.value.length > 0 ? filteredCities : cities;
    try {
      if (!map.value?._leaflet_id) {
        console.log("error map display");

        await nextTick();
        mapCities.value = [];
        mapCities.value = [...usingCities.value];

        return;
      }

      await nextTick();
      mapCities.value = [];
      mapCities.value = [...usingCities.value];

      return;
    } catch (error) {
      console.log("Map error:", error);
      reloadMapCount.value++;
    }
  },
  { deep: true, flush: "sync" }
);

watch(
  () => reloadMapCount.value,
  () => {
    setTimeout(() => {
      // document.querySelector("#map").innerHTML =
      //   "<div id='map' style='width: 100%; height: 100%;'></div>";

      loading.value = false;
    }, 480);

    console.log(reloadMapCount.value);
  },
  { immediate: true }
);
</script>

<style lang="scss">
@import "./output.css";

body,
* {
  box-sizing: border-box;
}

#app {
  padding: 16px;
  width: 100vw;
  height: 100dvh;
  display: flex;
  overflow: hidden;

  & > * {
    position: relative;
  }
}

.map {
  right: 0;
  height: 100%;
  flex: 1;

  #map {
    border-radius: 16px;
  }
}

.leaflet-container {
  z-index: 10;
}

nav {
  height: 100%;
  padding-right: 16px;
  gap: 16px;
  justify-content: space-between;

  .search-input {
  }

  .toggle-dpt {
    // position: fixed;
    // top: 24px;
    // right: 24px;
    // z-index: 49;
  }

  .toggle-legal {
    // position: fixed;
    // bottom: 50px;
    // right: 24px;
    // z-index: 49;
  }

  .toggle-embed {
    // position: fixed;
    // bottom: 100px;
    // right: 24px;
    // z-index: 49;
  }
}

.legal-sheet,
.embed-sheet {
  width: 50vw;
  max-width: unset;
}

@media screen and (max-width: 768px) {
  #app {
    flex-direction: column;
    flex-direction: column-reverse;

    nav {
      height: 36vh;
      width: 100%;
      padding: 0;
    }

    .map {
      flex: 1;
      width: 100%;
    }
  }

  .legal-sheet,
  .embed-sheet {
    width: 90vw;
    max-width: unset;
  }

  .city-sheet {
    max-height: 48vh;
    overflow-y: scroll;

    & > button {
      display: none;
    }
  }

  .fixed.inset-0 {
    background-color: rgba(0, 0, 0, 0.32);
  }
}
</style>
