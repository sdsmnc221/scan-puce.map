<template>
  <h2 class="font-semibold text-xl">
    {{ zipCode || "Zone " + location.postcodes?.join(", ") }}
  </h2>

  <h3 class="text-sm font-semibold text-slate-400" v-if="isDpt">
    {{ location.departmentName }}
  </h3>
  <h3 class="text-sm font-semibold text-slate-400" v-if="communes">
    {{ communes }}
  </h3>

  <div class="mt-2" v-if="baseRecords?.length">
    <div
      v-for="(record, index) in baseRecords"
      :key="`${zipCode || location.postcodes?.join('-')}-record-${
        record.Author
      }`"
    >
      <div class="block mt-4">
        <div>
          <span class="text-md font-semibold">{{ record.Author }}</span>

          <span
            class="block text-xs text-slate-500 mb-2"
            v-if="record.CommuneName"
          >
            {{ ` (${record.CommuneName.trim()}) ` }}</span
          >
        </div>

        <div
          v-if="!record.contactDetails?.needUpdate"
          class="flex flex-col text-xs text-sky-600 underline"
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
              >Contact par tél</a
            >
          </div>

          <TextHighlight
            v-if="record.contactDetails.admin"
            class="rounded-lg bg-gradient-to-r from-sky-200 to-yellow-200 inline-block text-center px-2 py-0 font-semibold text-xs mr-2 w-[152px]"
            @mouseenter="() => (hoveredIndex = index)"
            @mouseleave="() => (hoveredIndex = null)"
          >
            <span v-if="hoveredIndex === index">{{ contactAdmin }}</span>
            <span v-else> {{ TEXT_CONTACT_ADMIN }}</span>
          </TextHighlight>
        </div>

        <div class="my-1">
          <Badge
            v-if="
              record.contactDetails.admin || record.contactDetails.needUpdate
            "
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

        <p v-if="record.Notes" class="my-1 text-slate-500 text-[12px]">
          <span class="font-bold">Notes: </span> {{ record.Notes }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Ref } from "vue";
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
  Notes?: string;
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
    baseRecords: Record[];
  };
  isDpt?: boolean;
};

const TEXT_CONTACT_ADMIN = "Prise de contact via Admin";

const props = defineProps<Props>();

const hoveredIndex: Ref<null | number> = ref(null);

const zipCode = computed(() => {
  if (props.location.postcodes?.length) {
    return "Zone " + props.location.postcodes.join(", ");
  }
  return props.isDpt
    ? "Département " + props.location.departmentCode
    : "Commune(s) " + props.location.zipCode;
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
        contact.needUpdate = true;
      }
      break;

    case "ViaAdmin":
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

const baseRecords = computed(() =>
  props.location.baseRecords.map((r) => ({
    ...r,
    contactDetails: getContactDetails(r),
  }))
);
const contactAdmin = computed(() => import.meta.env.VITE_ADMIN);
</script>
