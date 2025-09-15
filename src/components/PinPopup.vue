<template>
  <div class="location-info-panel">
    <!-- Location Header -->
    <div class="location-header border-b border-amber-200 pb-3 mb-4">
      <div class="flex items-center justify-between">
        <h2 class="font-semibold text-xl text-secondary">
          {{ zipCode || "Zone " + location.postcodes?.join(", ") }}
        </h2>

        <div
          class="location-type px-2 py-1 rounded-full text-xs font-medium"
          :class="
            isDpt ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          "
        >
          {{ isDpt ? "Département" : "Commune" }}
        </div>
      </div>

      <h3 class="text-sm font-semibold text-slate-500 mt-1" v-if="isDpt">
        {{ location.departmentName }}
      </h3>
      <h3 class="text-sm font-semibold text-slate-500 mt-1" v-if="communes">
        {{ communes }}
      </h3>
    </div>

    <!-- Empty State -->
    <div
      v-if="!baseRecords?.length"
      class="empty-state flex flex-col items-center justify-center py-8"
    >
      <div class="empty-icon mb-4 text-amber-300">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="animate-pulse"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
      </div>
      <p class="text-center text-slate-500 font-medium">
        Aucune information disponible
      </p>
      <p class="text-center text-slate-400 text-sm mt-2">
        Aucun lecteur de puce n'a été enregistré à cet emplacement.
      </p>
    </div>

    <!-- Records List -->
    <div class="mt-1" v-if="baseRecords?.length">
      <div
        v-for="(record, index) in baseRecords"
        :key="`${zipCode || location.postcodes?.join('-')}-record-${
          record.Author
        }`"
        class="record-card mb-4 p-3 rounded-lg border border-amber-100 hover:border-amber-200 transition-all duration-200"
      >
        <!-- Record Header -->
        <div class="record-header flex items-start justify-between mb-2">
          <div>
            <p class="text-md font-semibold text-secondary">
              {{ record.Author }}
            </p>

            <p
              class="block text-xs text-gray-500 font-medium"
              v-if="record.CommuneName"
            >
              {{ ` ${record.CommuneName.trim()} (${record.ZipCode}) ` }}
            </p>
          </div>

          <!-- ICAD Badge -->
          <div
            v-if="record.Access === 'checked'"
            class="icad-badge flex flex-basis-1/2 items-center justify-center text-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
          >
            <img alt="icad" src="/pin-icad.png" class="w-6 h-6" />
            <span class="inline-block pr-1">Accès ICAD</span>
          </div>
        </div>

        <!-- Contact Section -->
        <div
          v-if="!record.contactDetails?.needUpdate"
          class="contact-section mt-3 p-2 bg-amber-50 rounded-md"
        >
          <p class="text-xs font-medium text-amber-700 mb-2">
            Informations de contact:
          </p>

          <div class="flex flex-wrap gap-2">
            <a
              v-if="record.contactDetails?.link"
              target="_blank"
              :href="`${record.contactDetails.link}`"
              class="contact-button flex items-center gap-1 px-2 py-1 bg-white border border-amber-200 rounded-md text-xs text-amber-600 hover:bg-amber-100 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"
                ></path>
              </svg>
              Facebook
            </a>

            <a
              v-if="record.contactDetails?.mail"
              target="_blank"
              :href="`mailto:${record.contactDetails.mail}`"
              class="contact-button flex items-center gap-1 px-2 py-1 bg-white border border-amber-200 rounded-md text-xs text-amber-600 hover:bg-amber-100 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                ></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              Email
            </a>

            <a
              v-if="record.contactDetails?.tel"
              target="_blank"
              :href="`tel:${record.contactDetails.tel}`"
              class="contact-button flex items-center gap-1 px-2 py-1 bg-white border border-amber-200 rounded-md text-xs text-amber-600 hover:bg-amber-100 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
                ></path>
              </svg>
              Téléphone
            </a>

            <div
              v-if="record.contactDetails.admin"
              class="contact-button flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-100 to-amber-200 border border-amber-300 rounded-md text-xs text-amber-700 cursor-help"
              @mouseenter="() => (hoveredIndex = index)"
              @mouseleave="() => (hoveredIndex = null)"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              <span v-if="hoveredIndex === index">{{ contactAdmin }}</span>
              <span v-else>{{ TEXT_CONTACT_ADMIN }}</span>
            </div>
          </div>
        </div>

        <!-- Notes Section -->
        <div
          v-if="record.Notes"
          class="notes-section mt-3 p-2 bg-gray-50 rounded-md"
        >
          <p class="text-xs font-medium text-gray-700 mb-1">Notes:</p>
          <p class="text-xs text-gray-600">{{ record.Notes }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Ref } from "vue";
import { uniqBy } from "lodash";

type Record = {
  Author: string;
  LinkToPost: string;
  AccessICAD?: "checked";
  CommuneName?: string;
  Tel?: string;
  Email?: string;
  ContactMode?: string;
  Notes?: string;
  ZipCode?: string;
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

  if (record.Tel) {
    contact.tel = record.Tel;
  }

  if (record.Email) {
    contact.mail = record.Email;
  }

  if (record.LinkToPost && record.LinkToPost.includes("https")) {
    contact.link = record.LinkToPost;
  }

  if (!contact.link && !contact.mail && !contact.admin && !contact.tel) {
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

<style scoped>
.record-card {
  transition: all 0.2s ease;
}

.record-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.contact-button {
  transition: all 0.2s ease;
}

.empty-icon {
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
</style>
