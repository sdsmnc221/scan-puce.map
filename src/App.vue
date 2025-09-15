<template>
  <nav
    class="px-4 pb-14 md:pb-10 md:p-10 md:pr-0 w-1/3 flex flex-col justify-between font-sans bg-white"
  >
    <div class="flex flex-col items-center">
      <div
        class="flex flex-col items-center justify-between overflow-hidden w-full h-1/2 md:h-auto"
      >
        <h1
          class="font-bold text-xl md:text-3xl text-center mt-3 text-secondary"
        >
          Réseau Lecteurs de Puce France
        </h1>

        <h2
          class="font-bold text-[0.9rem] mt-1 mb-3 text-center text-secondary"
        >
          <span class="underline"
            >Affichage par {{ usingDptCode ? "Département" : "Commune" }}</span
          >
          <span class="md:ml-1 text-xs text-slate-400">
            (
            <span class="font-bold">{{ mapCities.length }}</span> localisations
            )</span
          >
        </h2>

        <IInput
          id="inputDemo"
          placeholder="Tapez ici le n° de département recherché (ex. 75)"
          container-class="w-full md:w-11/12 search-input md:my-3"
          @update:model-value="onSearchInput"
        ></IInput>

        <div
          class="mt-2 md:mt-5 sm:w-full md:w-11/12 sm:text-center md:text-left"
        >
          <h2
            class="font-bold text-lg md:text-xl text-left md:text-left text-secondary mb-4"
          >
            Les épingles :
          </h2>

          <div
            class="w-full mb-4 flex md:flex-col sm:justify-center md:justify-start sm:items-center md:items-start mt-4"
          >
            <button
              class="pin-toggle-card relative flex items-center p-3 rounded-lg border transition-all duration-200 w-full"
              :class="[
                Array.isArray(pinType) && pinType.includes(0)
                  ? 'bg-amber-50 border-amber-300 shadow-md'
                  : 'bg-gray-100 border-gray-200 opacity-70',
              ]"
              @click="togglePinType(0)"
            >
              <div class="absolute top-2 right-2">
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200"
                  :class="[
                    Array.isArray(pinType) && pinType.includes(0)
                      ? 'border-amber-500 bg-amber-100'
                      : 'border-gray-400 bg-gray-200',
                  ]"
                >
                  <div
                    v-if="Array.isArray(pinType) && pinType.includes(0)"
                    class="w-2 h-2 rounded-full bg-amber-500"
                  ></div>
                </div>
              </div>

              <div class="flex flex-col md:flex-row items-center">
                <div class="mr-3 flex-shrink-0">
                  <img class="w-[32px] h-[32px]" src="/pin.png" />
                </div>
                <div class="text-center md:text-left">
                  <p class="font-medium text-sm text-secondary">
                    Lecteurs de puce
                    <span class="font-bold">sans accès à ICAD</span>
                  </p>
                  <p class="text-[10px] text-gray-500 mt-1">
                    Affiche les localisations sans accès à la base ICAD
                  </p>
                </div>
              </div>
            </button>

            <button
              class="pin-toggle-card ml-2 md:ml-0 md:mt-4 relative flex items-center p-3 rounded-lg border transition-all duration-200 w-full"
              :class="[
                Array.isArray(pinType) && pinType.includes(1)
                  ? 'bg-amber-50 border-amber-300 shadow-md'
                  : 'bg-gray-100 border-gray-200 opacity-70',
              ]"
              @click="togglePinType(1)"
            >
              <div class="absolute top-2 right-2">
                <div
                  class="w-4 h-4 rounded-full border flex items-center justify-center transition-all duration-200"
                  :class="[
                    Array.isArray(pinType) && pinType.includes(1)
                      ? 'border-amber-500 bg-amber-100'
                      : 'border-gray-400 bg-gray-200',
                  ]"
                >
                  <div
                    v-if="Array.isArray(pinType) && pinType.includes(1)"
                    class="w-2 h-2 rounded-full bg-amber-500"
                  ></div>
                </div>
              </div>

              <div class="flex flex-col md:flex-row items-center">
                <div class="mr-3 flex-shrink-0">
                  <img class="w-[32px] h-[32px]" src="/pin-icad.png" />
                </div>
                <div class="text-center md:text-left">
                  <p class="font-medium text-sm text-secondary">
                    Lecteurs de puce
                    <span class="font-bold">avec accès à ICAD</span>
                  </p>
                  <p class="text-[10px] text-gray-500 mt-1">
                    Affiche les localisations avec accès à la base ICAD
                  </p>
                </div>
              </div>
            </button>

            <!-- <button
            class="mb-2 flex flex-col md:flex-row sm:text-center md:text-left md:justify-start items-center text-[8px] md:text-[12px] text-700"
            :class="{ 'line-through': !pinType.includes(2) }"
            @click="togglePinType(2)"
          >
            <img class="w-[24px] h-[24px] inline-block" src="/pin-zone.png" />
            <span
              >Localisation des lecteurs de puce
              <span class="font-bold"
                >sur une Zone (multi-communale ou multi-départementale)</span
              >.</span
            >
          </button> -->
          </div>
        </div>
      </div>

      <div
        class="my-2 mb-5 md:mt-5 md:mb-0 sm:w-full md:w-11/12 sm:text-center md:text-left"
      >
        <!-- Empty State when no location is selected -->
        <div
          v-if="!selectedCity"
          class="md:flex flex-col items-center justify-center p-6 my-4 bg-white rounded-lg border border-dashed border-amber-300 text-center"
        >
          <div class="empty-state-icon mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-amber-400 mx-auto"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          </div>
          <h3 class="text-base md:text-lg font-medium text-secondary mb-2">
            Aucune localisation sélectionnée
          </h3>
          <p class="text-slate-500 mb-4 text-sm md:text-base">
            Cliquez sur une épingle sur la carte pour afficher les informations
            de cette localisation.
          </p>
        </div>

        <div
          v-if="selectedCity"
          class="city-details hidden md:block mt-2 mb-4 max-h-[40vh] p-5 md:overflow-scroll bg-white md:rounded-lg md:shadow-lg border border-amber-200"
        >
          <PinPopup :location="selectedCity" :is-dpt="usingDptCode"> </PinPopup>
        </div>

        <Sheet
          :open="citySheetOpen"
          ref="citySheetRef"
          @update:open="(openState) => onUpdateOpenCitySheet"
        >
          <SheetTrigger class="m-0 p-0 fixed"></SheetTrigger>
          <SheetTitle></SheetTitle>
          <SheetContent class="city-sheet font-sans" side="bottom">
            <SheetHeader>
              <SheetTitle> </SheetTitle>
              <SheetDescription
                class="flex flex-col text-left relative top-[-10px]"
              >
                <div v-if="selectedCity" class="flex flex-col">
                  <PinPopup :location="selectedCity" :is-dpt="usingDptCode">
                  </PinPopup>
                </div>
              </SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </div>
    </div>

    <div class="flex absolute bottom-0 w-11/12 justify-between mb-4 gap-1">
      <Sheet>
        <SheetTrigger class="toggle-embed">
          <RippleButton
            class="text-[10px] md:text-xs rounded-xl bg-secondary hover:bg-amber-200"
          >
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

      <div class="flex flex-1 gap-2 justify-end items-center">
        <RippleButton
          @click="promptingPWA = true"
          class="xs:text-[8px] text-[8px] md:text-[10px] rounded-xl px-2 bg-amber-100 text-secondary hover:bg-amber-200"
        >
          Installer sur votre appareil
        </RippleButton>

        <Sheet>
          <SheetTrigger class="toggle-legal">
            <RippleButton
              :class="[
                `xs:text-[${
                  doSupportsPWA ? 8 : 10
                }px] text-[8px] md:text-[10px]`,
                `rounded-${doSupportsPWA ? 'xl' : 'lg'}`,
                'px-2 bg-amber-100 text-secondary hover:bg-amber-200',
              ]"
            >
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

      <PWAInstallPrompt
        :is-prompted="promptingPWA"
        :prompt="installPrompt"
        @installed="onPWAInstalled"
        @dismissed="onPWADismissed"
      ></PWAInstallPrompt>
    </div>
  </nav>

  <div class="map w-2/3 watercolor-map-container relative">
    <!-- Question mark pattern overlay -->
    <div class="absolute inset-0 z-20 pointer-events-none">
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="question-mark-pattern"
            x="0"
            y="0"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <text
              x="20"
              y="70"
              font-family="Arial"
              font-size="60"
              fill="#FAC142"
              opacity="0.32"
            >
              ?
            </text>
            <text
              x="60"
              y="40"
              font-family="Arial"
              font-size="40"
              fill="#000000"
              opacity="0.08"
            >
              ?
            </text>
          </pattern>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#question-mark-pattern)"
          opacity="0.32"
        />
      </svg>
    </div>

    <!-- SVG Filters definition -->
    <svg class="filters" style="position: absolute; top: 0; left: 0">
      <defs>
        <filter id="watercolor-map">
          <!-- Paper texture effect -->
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015"
            numOctaves="2"
            result="noise"
          />

          <!-- Displacement for organic edges -->
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="12"
            result="displacement"
          />

          <!-- Soft edges -->
          <feGaussianBlur stdDeviation="0.3" result="blur" />

          <!-- Color adjustments -->
          <feColorMatrix type="saturate" values="0.8" result="saturated" />
        </filter>
      </defs>
    </svg>

    <LMap
      ref="map"
      id="map"
      :key="reloadMapCount"
      :zoom="zoom"
      :center="centerFrance"
      :use-global-leaflet="false"
      :max-bounds="franceBounds"
      :max-bounds-viscosity="1.0"
      @click="resetMapViewGlobal"
    >
      <LTileLayer
        url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors & CARTOdb"
        layer-type="base"
        name="OpenStreetMap"
        :bounds="franceBounds"
        :options="{
          maxZoom: 19,
          attribution: '© OpenStreetMap contributors',
        }"
      />

      <LRectangle
        :bounds="[
          [-90, -180],
          [90, 180],
        ]"
        :options="maskOptions"
      />

      <LGeoJson :geojson="franceOutline" :options="franceOptions" />

      <!-- <template v-if="pinType.includes(2)">
        <LPolygon
          v-for="(zone, index) in usingZones"
          :key="`zone-commun-${index}`"
          :lat-lngs="zone.coordinates.map(({ lat, lng }) => [lat, lng])"
          :options="getZoneOptions(zone)"
        >
          <LMarker
            :lat-lng="getZoneCenter(zone.coordinates)"
            @click="
              (e) => {
                const { lat, lng } = e.latlng;
                onMarkerClick(zone, {
                  coordinates: [lat, lng],
                });
              }
            "
          >
            <LIcon
              icon-url="pin-zone.png"
              :icon-size="[32, 32]"
              :icon-anchor="[16, 16]"
            />
          </LMarker>
        </LPolygon>
      </template> -->

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
              city?.baseRecords?.some((r) => r.AccessICAD === 'checked')
                ? '-icad'
                : ''
            }.png`"
            :icon-size="[25, 25]"
            :icon-anchor="[12.5, 12.5]"
          />
        </LMarker>
      </div>

      <RippleButton
        class="toggle-dpt absolute z-[9999] mb-2 right-2 rounded-full bottom-4 bg-sky-200 border-blue-500 hover:bg-yellow-400"
        @click="() => (usingDptCode = !usingDptCode)"
      >
        <span class="font-bold text-black sm:text-sm md:text-xl">
          Changer en affichage par
          {{ !usingDptCode ? "Département" : "Commune" }}</span
        >
      </RippleButton>
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

import {
  ref,
  computed,
  onMounted,
  onBeforeMount,
  watch,
  nextTick,
  onUnmounted,
  useTemplateRef,
} from "vue";
import { onClickOutside } from "@vueuse/core";
import Airtable from "airtable";
import axios from "axios";
import { inject } from "@vercel/analytics";
import { flatten } from "lodash";

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

import { getZoneOptions, getZoneCenter } from "./lib/map";
import {
  getUrlParams,
  clearUrlParams,
  getAllUrlParams,
} from "./lib/path-utils";
import { delay } from "./lib/useBase";

import useBase from "./lib/useBase";
import useProcessData from "./lib/useProcessData";

const usingDptCode = ref(true);
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

const promptingPWA = ref(false);
const doSupportsPWA = ref(false);

const searchTimeout = ref(null);
const keyword = ref("");
const pinType = ref([0, 1]);

const storedCsv = ref({
  dpt: [],
  zip: [],
});

const storedFilloutCsv = ref({
  dpt: [],
  zip: [],
});

const citySheetRef = useTemplateRef("citySheetRef");

onClickOutside(citySheetRef, () => {
  citySheetOpen.value = false;
});

const { records, postcodes, cities, filteredCities, processCsv } =
  useProcessData(
    usingFilloutBase,
    usingDptCode,
    storedCsv,
    keyword,
    pinType,
    loading
  );

const processedZones = ref([]);
const filteredZones = ref([]);

const usingZones = computed(() => {
  if (keyword.value?.trim().length) {
    return filteredZones.value;
  } else {
    return processedZones.value;
  }
});

const installPrompt = ref(null);

const mapCities = ref([]);
const selectedCity = ref(null);

const selectedCityZip = computed(() => {
  if (!selectedCity.value) return "";

  if (selectedCity.value.postcodes?.length) {
    return "Zone " + selectedCity.value.postcodes.join(", ");
  }
  return usingDptCode.value
    ? "Département " + selectedCity.value.departmentCode
    : "Commune(s) " + selectedCity.value.zipCode;
});

const usingCities = computed(() => {
  let toUse;

  const pinTypeArray = Array.isArray(pinType.value) ? pinType.value : [];

  if (
    pinType.value.length ||
    (Array.isArray(pinType.value) && !pinType.value.includes(2)) ||
    keyword.value
  ) {
    toUse = filteredCities.value;
  } else {
    toUse = cities.value;
  }

  return toUse;
});

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
    const zipCodes = rec.ZipCode?.split(",").map((code) => code.trim());
    // Check for exact match
    return zipCodes.includes(zipCode);
  });

  return records_ ?? null;
};

const loadRecordByDeptCode = (deptCode) => {
  const deptPrefix = deptCode.slice(0, 2);

  const records_ = records.value.filter((rec) => {
    // Split the Dept field in case it contains multiple codes

    const deptCodes = rec.Dept?.split(",").map((code) => code.trim());
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

const togglePinType = (pinValue) => {
  if (Array.isArray(pinType.value) && pinType.value.includes(pinValue)) {
    // Create a new array with the filtered values
    pinType.value = pinType.value.filter((type) => type !== pinValue);
  } else {
    // Create a new array with the added value
    pinType.value = [...pinType.value, pinValue];
  }
};

const centerOnMarker = ([lat, lng]) => {
  map.value?.leafletObject?.setView([lat, lng], 10);
};

const resetMapViewGlobal = async () => {
  citySheetOpen.value = false;

  await nextTick();

  if (map.value?.leafletObject) {
    map.value.leafletObject.setView(centerFrance, defaultZoom);
  }

  selectedCity.value = null;
};

const onMarkerClick = (city, zoneOptions = null) => {
  // centerOnMarker(zoneOptions ? zoneOptions.coordinates : [city.lat, city.lng]);
  selectedCity.value = city;
};

const onUpdateOpenCitySheet = (open) => {
  if (!open) {
    selectedCity.value = null;
  }
};

const triggerPWAInstall = () => {
  console.log("Déclenchement du prompt d'installation PWA");
  promptingPWA.value = true;
};

const onCheckPWA = ({ supportsPWA }) => {
  console.log("onCheckPWA appelé avec:", supportsPWA);
  doSupportsPWA.value = supportsPWA;
};

const onPWAInstalled = () => {
  console.log("PWA installée avec succès");
  promptingPWA.value = false;
  // installPrompt.value = null;
};

const onPWADismissed = () => {
  console.log("Installation PWA refusée ou fermée");
  promptingPWA.value = false;
  // installPrompt.value = null;
};

onMounted(() => {
  nextTick(() => {
    inject();

    window.addEventListener("pwa:ready", (e) => {
      installPrompt.value = e.detail.prompt;
    });

    L.Icon.Default.imagePath = "/";
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: markerIconRetinaUrl,
      iconUrl: markerIconUrl,
      shadowUrl: markerShadowUrl,
    });

    // addSvgFilters();

    if (window.location.search) {
      const params = getAllUrlParams();

      if (Object.hasOwnProperty.call(params, "dptCode")) {
        usingDptCode.value = true;
        keyword.value = params["dptCode"];

        return;
      } else if (Object.hasOwnProperty.call(params, "zipCode")) {
        usingDptCode.value = false;
        keyword.value = params["zipCode"];

        return;
      } else if (Object.hasOwnProperty.call(params, "city")) {
        usingDptCode.value = false;
        keyword.value = params["city"].toLowerCase();

        return;
      }
    }
  });
});

onUnmounted(() => {
  if (searchTimeout.value) clearTimeout(searchTimeout.value);
});

watch(
  usingCities,
  async () => {
    try {
      if (!map.value?._leaflet_id) {
        console.log("error map display");

        await delay(1000); // Wait 50ms between each chunk
        mapCities.value = [];
        mapCities.value = [...usingCities.value];

        return;
      }

      await delay(1000); // Wait 50ms between each chunk
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
      // loading.value = false;
    }, 480);
  },
  { immediate: true }
);

watch([() => keyword.value, () => cities.value], ([newKeyword, newCities]) => {
  setTimeout(() => {
    const city = cities.value.find(
      (c) =>
        c.departmentCode == newKeyword ||
        c.zipCode == newKeyword ||
        c.name.toLowerCase() == newKeyword
    );

    if (city) {
      selectedCity.value = city;
    } else if (newKeyword) {
      // Ne vide plus le keyword ni ne force le mode
      selectedCity.value = null;
    }
  }, 640);
});

watch(usingDptCode, () => {
  // Relance la recherche avec le keyword courant après un switch de mode
  if (keyword.value) {
    // Force le déclenchement du filtrage
    keyword.value = keyword.value + " ";
    keyword.value = keyword.value.trim();
  }
});
</script>

<style lang="scss">
@import "./output.css";

body,
* {
  box-sizing: border-box;
  text-wrap: balance;
}

#app {
  width: 100vw;
  height: 100dvh;
  display: flex;
  overflow: hidden;
  justify-content: center;

  & > * {
    position: relative;
  }
}

.map {
  right: 0;
  height: 100%;
  flex: 1;
  overflow-x: visible;
}

.leaflet-container {
  z-index: 10;
}

.leaflet-tile-container img {
  filter: saturate(0.64) contrast(1.1) brightness(1.05);
  transition: all 0.3s ease;
}

/* Apply both SVG and CSS filters for better effect */
.watercolor-tiles {
  filter: url(#watercolor-map) saturate(0.85) contrast(1.1) brightness(1.05) !important;
}

/* Soften the background */
.leaflet-container {
  background: #f5f5f0;
}

/* Smooth tile transitions */
.leaflet-tile-container img {
  transition: opacity 0.2s ease-in-out;
}

nav {
  height: 100%;
  gap: 16px;
  justify-content: space-between;
  z-index: 98;

  .city-details {
    position: relative;
    z-index: 5;
    width: 100%;
    border-radius: 16px;
  }
}

.legal-sheet,
.embed-sheet {
  width: 50vw;
  max-width: unset;
  z-index: 99;
}

.fixed.inset-0 {
  z-index: 99;
}

@media screen and (max-width: 768px) {
  #app {
    min-height: 100dvh;
    height: auto;
    overflow-y: scroll;
    justify-content: center;
    flex-direction: column-reverse;

    nav {
      width: 100%;

      z-index: unset;
    }

    .map {
      width: 100%;
      height: 50vh;
      overflow: hidden;
      flex: unset;

      mask-size: 100vw 56vh, cover;

      #map {
        height: 100% !important;
      }
    }
  }

  .empty-state-icon {
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(0.95);
      opacity: 0.7;
    }
    50% {
      transform: scale(1.05);
      opacity: 1;
    }
    100% {
      transform: scale(0.95);
      opacity: 0.7;
    }
  }

  .legal-sheet,
  .embed-sheet {
    width: 90vw;
    max-width: unset;
  }

  .city-sheet {
    height: 36vh;
    overflow-y: scroll;
    border-top-left-radius: 36px;
    border-top-right-radius: 36px;
    box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);

    & > button {
      display: none;
    }
  }

  .fixed.inset-0 {
    opacity: 0;
    pointer-events: none !important;
  }
}
</style>
