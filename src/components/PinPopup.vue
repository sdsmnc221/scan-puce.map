<template>
  <h3 class="font-semibold" v-if="!location.postcodes && !location.cityNames">
    {{ location.name }} - {{ location.zipCode }}
  </h3>
  <h3 class="font-semibold" v-else>
    <span>{{ location.postcodes?.join(", ") }}</span>
    <br />
    <span>{{ location.cityNames?.join(", ") }}</span>
  </h3>

  <div v-if="location.record">
    <a :href="location.record.LinkToPost" target="_blank">
      {{ location.record.Author }}</a
    >

    <div class="mt-4" v-if="location.record.AccessICAD">
      <Badge>Accès ICAD</Badge>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "../components/ui/badge";

type Props = {
  location: {
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

defineProps<Props>();
</script>
