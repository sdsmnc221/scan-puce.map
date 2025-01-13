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

  <div class="mt-2" v-if="records?.length">
    <div
      v-for="(record, index) in records"
      :key="`${zipCode || location.postcodes?.join('-')}-record-${
        record.Author
      }`"
    >
      <div class="text-sm block mt-4">
        <div>
          <span>{{ record.Author }}</span>

          <span v-if="record.CommuneName">
            {{ ` (${record.CommuneName.trim()}) ` }}</span
          >
        </div>

        <div
          v-if="!record.contactDetails?.needUpdate"
          class="flex flex-col"
          style="font-size: 10px"
        >
          <div class="flex flex-row">
            <a
              v-if="record.contactDetails?.link"
              target="_blank"
              :href="`${record.contactDetails.link}`"
              class="p-0 m-0 mr-2"
              >Contact par Facebook</a
            >

            <a
              v-if="record.contactDetails?.mail"
              target="_blank"
              :href="`mailto:${record.contactDetails.mail}`"
              class="p-0 m-0 mr-2"
              >Contact par mail</a
            >

            <a
              v-if="record.contactDetails?.tel"
              target="_blank"
              :href="`telto:${record.contactDetails.tel}`"
              class="p-0 m-0"
              >Contact par téll</a
            >
          </div>

          <TextHighlight
            v-if="record.contactDetails.admin"
            style="font-size: 10px"
            class="rounded-lg bg-gradient-to-r from-sky-200 to-yellow-200 inline-block text-center px-2 py-0 font-bold mr-2 w-[152px]"
            @mouseenter="() => (hoveredIndex = index)"
            @mouseleave="() => (hoveredIndex = null)"
          >
            <span v-if="hoveredIndex === index">{{ contactAdmin }}</span>
            <span v-else> {{ TEXT_CONTACT_ADMIN }}</span>
          </TextHighlight>
        </div>

        <Badge
          v-else
          variant="destructive"
          class="mr-2"
          style="font-size: 10px"
        >
          Contact à mettre à jour
        </Badge>
        <Badge v-if="record.AccessICAD" style="font-size: 10px"
          >Accès ICAD</Badge
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { uniqBy } from "lodash";

import { Badge } from "../components/ui/badge";
import TextHighlight from "./TextHighlight.vue";

type Record = {
  Author: string;
  LinkToPost: string;
  AccessICAD?: boolean;
  CommuneName?: string;
  Tel?: string;
  Email?: string;
  ContactMode?: string;
};

type Props = {
  location: {
    communes: any[];
    name?: string;
    zipCode?: string;
    cityNames?: string[];
    postcodes?: string[];
    departmentCode: string;
    departmentName: string;
    records: Record[];
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

type ContactDetails = {
  tel?: string;
  mail?: string;
  link?: string;
  admin?: boolean;
  needUpdate?: boolean;
};

const getContactDetails = (record: Record): ContactDetails => {
  let contact: ContactDetails = {};

  if (!record.ContactMode) {
    if (!record.LinkToPost?.includes("https")) {
      contact.needUpdate = true;
    } else {
      contact.link = record.LinkToPost;
      contact.needUpdate = false;
    }
  }

  switch (record.ContactMode) {
    case "TelOrMail":
      contact.tel = record.Tel;
      contact.mail = record.Email;
      contact.admin = false;
      break;
    case "LinkToPost":
      if (record.LinkToPost.includes("https")) {
        contact.link = record.LinkToPost;
        contact.admin = false;
      } else {
        contact.admin = true;
      }
      break;

    case "ViaAdmin":
      contact.admin = true;
      break;
    default:
      break;
  }

  if (!contact.link && !contact.mail && !contact.admin) {
    // console.log(record);
    contact.needUpdate = true;
  } else {
    contact.needUpdate = false;
  }

  return contact;
};

const records = computed(() =>
  props.location.records.map((r) => ({
    ...r,
    contactDetails: getContactDetails(r),
  }))
);
const contactAdmin = computed(() => import.meta.env.VITE_ADMIN);
</script>
