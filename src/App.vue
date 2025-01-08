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

      <LMarker
        v-for="city in cities"
        :key="city.zipCode"
        :lat-lng="[city.lat, city.lng]"
      >
        <LIcon
          icon-url="/pin.png"
          :icon-size="[25, 25]"
          :icon-anchor="[12, 41]"
        />
        <LPopup>
          <div>{{ city.name }} {{ city.zipCode }}</div>
          <div v-if="city.record">
            <a :href="city.record.LinkToPost" target="_blank">
              {{ city.record.Author }}</a
            >
          </div>
        </LPopup>
      </LMarker>
    </LMap>

    <IInput
      id="inputDemo"
      placeholder="Code postal, code de département..."
      container-class="w-full max-w-sm search-input"
      @update:model-value="onSearchInput"
    ></IInput>
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
  LGeoJson,
  LRectangle,
} from "@vue-leaflet/vue-leaflet";
import franceBoundaries from "../public/geojson/france.json";

import { ref, computed, onMounted, watch } from "vue";
import Airtable from "airtable";
import axios from "axios";
import { flatten } from "lodash";

import IInput from "./components/IInput.vue";

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

Airtable.configure({
  endpointUrl: "https://api.airtable.com",
  apiKey: import.meta.env.VITE_AIRTABLE_ACCESS_TOKEN,
});

const base = Airtable.base(import.meta.env.VITE_AIRTABLE_BASE_ID);

const records = ref([]);
const cities = ref([]);

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
  const record = records.value.find((rec) => rec.ZipCode === zipCode);

  return record ?? null;
};

const loadRecordByDeptCode = (deptCode) => {
  const record = records.value.find((rec) => rec.Dept === deptCode.slice(0, 2));

  return record ?? null;
};

async function loadCities(zipCodes) {
  try {
    // Create CSV content with header (the API expects 'q' as header for queries)
    const csvHeader = "postcode\n";
    const csvContent = csvHeader + zipCodes.join("\n");

    console.log(zipCodes);

    // Create a Blob/File from the CSV content
    const aCsvFile = new Blob([csvContent], { type: "text/csv" });

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

    // Parse CSV response
    const rows = response.data.split("\n").slice(1); // Skip header row

    const zipCodesResults = rows
      .filter((row) => row.length > 0 && !row.includes("not-found"))
      .map((row) => {
        try {
          const [
            postcode,
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

          const record = loadRecordByDeptCode(postcode);

          if (!latitude || !longitude) {
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

    cities.value = zipCodesResults;
  } catch (error) {
    console.error("Error loading cities:", error);
    cities.value = []; // Set empty array in case of error
  }
}

async function loadDepartmentBoundaries(departmentList) {
  try {
    // You can get French departments GeoJSON from IGN's API or other open data sources
    const response = await axios.get(
      "https://geo.api.gouv.fr/departements?fields=nom,code,centre"
    );

    // Filter only the departments we want
    const filteredDepartments = response.data.filter((dept) =>
      departmentList.includes(dept.code)
    );

    // Create GeoJSON from the filtered departments
    departmentGeoJson.value = {
      type: "FeatureCollection",
      features: filteredDepartments.map((dept) => ({
        type: "Feature",
        properties: {
          code: dept.code,
          name: dept.nom,
        },
        geometry: {
          type: "Point",
          coordinates: [dept.centre.coordinates[0], dept.centre.coordinates[1]],
        },
      })),
    };
  } catch (error) {
    console.error("Error loading department boundaries:", error);
  }
}

base("draftBase")
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

const onSearchInput = (inputValue) => {
  const zipCodes = flatten(
    records.value
      .filter((rec) => !!rec.ZipCode)
      .map((rec) => rec.ZipCode.split(","))
  ).filter((zc) => zc.includes(inputValue));

  loadCities(zipCodes);
};

watch(
  () => records.value.length,
  () => {
    const zipCodes = flatten(
      records.value
        .filter((rec) => !!rec.ZipCode)
        .map((rec) => rec.ZipCode.split(","))
    );

    const dptCodes = flatten(
      records.value
        .filter((rec) => !!rec.Dept)
        .map((rec) => rec.Dept.split(","))
    ).map((dpt) => dpt + "000");

    loadCities(dptCodes);

    // loadDepartmentBoundaries(["75"]);
  }
);
</script>

<style lang="scss">
@import "./output.css";

.search-input {
  position: fixed;
  bottom: 24px;
  left: 24px;
  z-index: 9999;

  @media screen and (max-width: 768px) {
    bottom: 0;
    left: 0;
  }
}
</style>
