import { watch, type Ref, ref } from "vue";
import Airtable from "airtable";
import { chunk } from "lodash";

const RECORDS_BATCH_SIZE = 50;

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default function useBase(usingFilloutBase: Ref<boolean>) {
  Airtable.configure({
    endpointUrl: "https://api.airtable.com",
    apiKey: import.meta.env.VITE_AIRTABLE_ACCESS_TOKEN,
  });

  const base = ref(Airtable.base(import.meta.env.VITE_AIRTABLE_BASE_ID));

  const records = ref<Array<Record<string, any>>>([]);

  const loadRecordsDone = ref(false);

  const batchIndex = ref<number | null>(null);

  watch(
    () => usingFilloutBase.value,
    () => {
      records.value = [];

      base
        .value(usingFilloutBase.value ? "filloutBase" : "draftBase")
        .select({
          view: "Grid view",
          // pageSize: RECORDS_BATCH_SIZE,
          // maxRecords: 50,
        })
        .all()
        .then((recs) => {
          const loadRecordsInChunks = async () => {
            const newRecords = recs.map((record) => record.fields);
            const chunksOfRecs = chunk(newRecords, RECORDS_BATCH_SIZE);

            for (let index = 0; index < chunksOfRecs.length; index++) {
              batchIndex.value = index;

              records.value.push(...chunksOfRecs[index]);

              await delay(100); // Wait 50ms between each chunk
            }

            loadRecordsDone.value = true;
          };

          loadRecordsInChunks();

          return;
        })
        .catch((err) => {
          if (err) {
            console.error(err);
            loadRecordsDone.value = false;
            return;
          } else {
            loadRecordsDone.value = true;
            return;
          }
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
