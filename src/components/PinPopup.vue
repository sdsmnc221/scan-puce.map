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
      v-for="(record, index) in location.records"
      :key="`${zipCode || location.postcodes?.join('-')}-record-${
        record.Author
      }`"
    >
      <div class="text-sm block mt-4">
        <component
          :is="!hasLink ? 'div' : 'a'"
          :href="record.LinkToPost"
          target="_blank"
        >
          <span>{{ record.Author }}</span>

          <span v-if="record.CommuneName">
            {{ ` (${record.CommuneName.trim()}) ` }}</span
          >
        </component>

        <div class="flex flex-row align-center">
          <TextHighlight
            v-if="needToContactAdmin"
            style="font-size: 10px"
            class="rounded-lg bg-gradient-to-r from-sky-200 to-yellow-200 inline-block text-center px-2 py-0 font-bold mr-2 w-[152px]"
            @mouseenter="() => (hoveredIndex = index)"
            @mouseleave="() => (hoveredIndex = null)"
          >
            <span v-if="hoveredIndex === index">{{ contactAdmin }}</span>
            <span v-else> {{ TEXT_CONTACT_ADMIN }}</span>
          </TextHighlight>

          <Badge v-if="record.AccessICAD" style="font-size: 10px"
            >Accès ICAD</Badge
          >
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, Ref } from "vue";
import { uniqBy } from "lodash";

import { Badge } from "../components/ui/badge";
import TextHighlight from "./TextHighlight.vue";

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
      Tel: string;
      Email: string;
    }[];
  };
  isDpt?: boolean;
};

const TEXT_CONTACT_ADMIN = "Prise de contact via Admin";

const props = defineProps<Props>();

const hoveredIndex: Ref<null | number> = ref(null);

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

const hasLink = computed(() =>
  props.location.records?.some((r) => r.LinkToPost?.includes("https"))
);

const needToContactAdmin = computed(() =>
  props.location.records?.some(
    (r) => !r.LinkToPost?.includes("https") && (r.Tel || r.Email)
  )
);

const contactAdmin = computed(() => import.meta.env.VITE_ADMIN);
</script>
