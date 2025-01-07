<template>
  <div style="height: 100vh; width: 100vw">
    <LMap
      ref="map"
      :zoom="zoom"
      :center="[46.603354, 1.888334]"
      :use-global-leaflet="false"
    >
      <LTileLayer
        url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
        attribution="attribution"
        layer-type="base"
        name="OpenStreetMap"
      />

      <LMarker
        v-for="city in cities"
        :key="city.zipcode"
        :lat-lng="[city.lat, city.lng]"
      >
        <LIcon
          icon-url="/pin.png"
          :icon-size="[25, 25]"
          :icon-anchor="[12, 41]"
        />
        <LPopup>
          <div>{{ city.name }} {{ city.zipcode }}</div>
          <div v-if="city.record">
            <a :href="city.record.LinkToPost" target="_blank">
              {{ city.record.Author }}</a
            >
          </div>
        </LPopup>
      </LMarker>

      <LGeoJson
        v-if="departmentGeoJson"
        :geojson="departmentGeoJson"
        :options="geoJsonOptions"
      />
    </LMap>
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
} from "@vue-leaflet/vue-leaflet";

import { ref, computed, onMounted, watch } from "vue";
import Airtable from "airtable";
import axios from "axios";
import { flatten } from "lodash";

const zoom = ref(6); // Kept zoom level at 6 which is good for viewing France
const attribution =
  '&copy; OpenStreetMap France | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

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

const loadRecord = (zipcode) => {
  const record = records.value.find((rec) => rec.ZipCode === zipcode);

  return record ?? null;
};

async function loadCities(zipcodes) {
  try {
    // Create CSV content with header (the API expects 'q' as header for queries)
    const csvHeader = "postcode\n";
    const csvContent = csvHeader + zipcodes.join("\n");

    // Create a Blob/File from the CSV content
    const aCsvFile = new Blob([csvContent], { type: "text/csv" });

    const formData = new FormData();
    formData.append(
      "data",
      new Blob([csvContent], { type: "text/csv" }),
      "zipcodes.csv"
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

    const zipcodesResults = rows
      .filter((row) => row.length > 0)
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

          const record = loadRecord(postcode);

          return {
            zipcode: postcode,
            lat: parseFloat(latitude),
            lng: parseFloat(longitude),
            name: result_city.replace(/"/g, ""), // Remove quotes from label,
            record,
          };
        } catch (rowError) {
          console.error("Error parsing row:", row, rowError);
          return null;
        }
      });

    cities.value = zipcodesResults;
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

watch(
  () => records.value.length,
  () => {
    const zipcodes = flatten(
      records.value
        .filter((rec) => !!rec.ZipCode)
        .map((rec) => rec.ZipCode.split(","))
    );

    loadCities(zipcodes);

    // loadDepartmentBoundaries(["75"]);
  }
);
</script>
