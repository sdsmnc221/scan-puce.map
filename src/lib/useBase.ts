import { watch, type Ref, ref } from "vue";
import Airtable from "airtable";

const RECORDS_BATCH_SIZE = 50;

export default function useBase(usingFilloutBase: Ref<boolean>) {
  Airtable.configure({
    endpointUrl: "https://api.airtable.com",
    apiKey: import.meta.env.VITE_AIRTABLE_ACCESS_TOKEN,
  });

  const base = ref(Airtable.base(import.meta.env.VITE_AIRTABLE_BASE_ID));

  const records = ref<Array<Record<string, any>>>([]);

  const loadRecordsDone = ref(false);

  watch(
    () => usingFilloutBase.value,
    () => {
      records.value = [];

      base
        .value(usingFilloutBase.value ? "filloutBase" : "draftBase")
        .select({
          view: "Grid view",
          pageSize: RECORDS_BATCH_SIZE,
          // maxRecords: 50,
        })
        .eachPage(
          function page(recs, fetchNextPage) {
            // This function (`page`) will get called for each page of records.

            const newRecords = recs.map((record) => record.fields);
            records.value.push(...newRecords);

            // To fetch the next page of records, call `fetchNextPage`.
            // If there are more records, `page` will get called again.
            // If there are no more records, `done` will get called.

            // Small delay before next batch
            setTimeout(() => fetchNextPage(), 50);
          },
          function done(err) {
            if (err) {
              console.error(err);
              loadRecordsDone.value = false;
              return;
            } else {
              loadRecordsDone.value = true;
              return;
            }
          }
        );
    },
    { immediate: true }
  );

  return {
    records,
    loadRecordsDone,
  };
}
