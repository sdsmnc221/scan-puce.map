<template>
  <h2 class="font-semibold text-sm">
    {{ location.zipCode }}
  </h2>
  <h3
    class="text-sm font-semibold"
    v-if="!location.postcodes && !location.cityNames"
  >
    {{ communes }}
  </h3>
  <h3 class="text-xs font-semibold" v-else>
    <span>{{ location.postcodes?.join(", ") }}</span>
    <br />
    <span>{{ location.cityNames?.join(", ") }}</span>
  </h3>

  <div class="mt-2" v-if="location.record">
    <a class="text-sm" :href="location.record.LinkToPost" target="_blank">
      {{ location.record.Author }}</a
    >

    <div class="text-xs mt-4" v-if="location.record.AccessICAD">
      <Badge>Accès ICAD</Badge>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Badge } from "../components/ui/badge";

type Props = {
  location: {
    communes: any[];
    name?: string;
    zipCode?: string;
    cityNames?: string[];
    postcodes?: string[];
    record: {
      Author: string;
      LinkToPost: string;
      AccessICAD?: boolean;
    };
  };
};

const props = defineProps<Props>();

const communes = computed(() => {
  return (
    props.location.name || props.location.communes.map((c) => c.name).join(", ")
  );
});
</script>
