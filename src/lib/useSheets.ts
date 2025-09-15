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
      fetch(`/api/lecteur-puce?source=${source}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then((newRecords) => {
          const loadRecordsInChunks = async () => {
            // Même logique de chunking que useBase
            const chunksOfRecs = chunk(
              newRecords.map((r: any) => ({
                ...r,
                ZipCode: formatZipCode(r.ZipCode),
              })),
              RECORDS_BATCH_SIZE
            );

            for (let index = 0; index < chunksOfRecs.length; index++) {
              batchIndex.value = index;
              records.value.push(...(chunksOfRecs[index] as any));
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

function formatZipCode(zc: string) {
  //   if (zc.length === 5) return zc;
  if (zc.length === 4) {
    if (zc[0] == "0") {
      return `${zc}0`;
    } else {
      return `0${zc}`;
    }
  } else if (zc.length === 3) {
    if (zc[0] == "0") {
      return `${zc}00`;
    } else {
      return `00${zc}`;
    }
  }

  return zc;
}
