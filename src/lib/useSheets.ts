import { watch, type Ref, ref } from "vue";
import { chunk } from "lodash";

const RECORDS_BATCH_SIZE = 50;

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default function useSheets(usingFilloutBase: Ref<boolean>) {
  const records = ref<Array<Record<string, any>>>([]);
  const loadRecordsDone = ref(false);
  const batchIndex = ref<number | null>(null);

  watch(
    () => usingFilloutBase.value,
    () => {
      records.value = [];
      loadRecordsDone.value = false;

      const source = usingFilloutBase.value ? "filloutBase" : "draftBase";

      // Appel à votre API Vercel au lieu d'Airtable
      fetch(`/api/lecteurs-puce?source=${source}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((newRecords) => {
          const loadRecordsInChunks = async () => {
            // Même logique de chunking que useBase
            const chunksOfRecs = chunk(newRecords, RECORDS_BATCH_SIZE);

            for (let index = 0; index < chunksOfRecs.length; index++) {
              batchIndex.value = index;
              records.value.push(...chunksOfRecs[index]);
              await delay(100); // Même délai que useBase
            }

            loadRecordsDone.value = true;
          };

          loadRecordsInChunks();
        })
        .catch((err) => {
          console.error("Erreur chargement Google Sheets:", err);
          loadRecordsDone.value = false;
        });
    },
    { immediate: true }
  );

  return {
    records,
    loadRecordsDone,
    batchIndex,
  };
}
