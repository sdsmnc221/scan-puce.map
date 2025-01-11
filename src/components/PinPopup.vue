<template>
  <h2 class="font-semibold text-sm">
    {{ zipCode || "Zone " + location.postcodes?.join(", ") }}
  </h2>

  <h3 class="text-xs font-semibold" v-if="isDpt">
    {{ location.departmentName }}
  </h3>
  <h3 class="text-xs font-semibold" v-if="communes">
    {{ communes }}
  </h3>

  <div class="mt-2" v-if="location.records">
    <div
      v-for="record in location.records"
      :key="`${zipCode || location.postcodes?.join('-')}-record-${
        record.Author
      }`"
    >
      <div class="text-sm">
        <a :href="record.LinkToPost" target="_blank"> {{ record.Author }}</a>
        <span v-if="record.CommuneName">
          ({{ record.CommuneName.trim() }})</span
        >
      </div>

      <div class="text-xs mt-4" v-if="record.AccessICAD">
        <Badge>Accès ICAD</Badge>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { Badge } from "../components/ui/badge";
import { uniqBy } from "lodash";

type Props = {
  location: {
    communes: any[];
    name?: string;
    zipCode?: string;
    cityNames?: string[];
    postcodes?: string[];
    departmentCode: string;
    departmentName: string;
    records: {
      Author: string;
      LinkToPost: string;
      AccessICAD?: boolean;
      CommuneName?: string;
    }[];
  };
  isDpt?: boolean;
};

const props = defineProps<Props>();

const zipCode = computed(() => {
  return props.isDpt
    ? "Zone " + props.location.departmentCode
    : props.location.zipCode;
});

const communes = computed(() => {
  return props.isDpt
    ? ""
    : uniqBy(props.location.communes, "name")
        .map((c) => c.name)
        .join(", ");
});
</script>
