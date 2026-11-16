import pi from './pi_sample.json';
import po from './po_sample.json';
import prismsuite from './prismsuite_sample.json';
import { catalog } from './catalog';

/*
  Sample documents. The JSON next to this file is anonymised (invented customer, GSTIN, address and contact; same
  structure and prices) and is the only sample data that is tracked, because the repository is public.

  The real sample PDFs are recognised by their SHA-256. In development only, when the private extractions exist in the
  repository's samples folder, they are read instead, so the real files show their real content. They are matched by the
  document type inside the file, never by file name, and a build made without the folder simply finds none.
*/
export const SAMPLE_HASHES = {
  '9e684ee5e183db8db8a0cd9eeb1c350f9c5b0b57da3f44b2845402de54447c93': 'pi',
  '55cf3602eff5664bda0f4afe10dd8f8fc44df14175a8b397c458d3b515540d35': 'po',
  fecfbb372d4a522db6e135653634a84c226906b037792d53a3abca9765f4fc59: 'prismsuite',
};

const ANONYMISED = { pi, po, prismsuite };
// Only the dev server reads the private folder; the constant condition lets the build drop it, so no private data is ever bundled
const privateExtractions = import.meta.env.DEV ? import.meta.glob('../../../../samples/*_extracted.json') : {};

export function createFixtures({ allowPrivate = true } = {}) {
  const load = async (type) => {
    if (allowPrivate) {
      for (const loader of Object.values(privateExtractions)) {
        try {
          const mod = await loader();
          const json = mod.default ?? mod;
          if (json.document_type === type) return json;
        } catch {
          // an unreadable private file is skipped; the anonymised copy is used instead
        }
      }
    }
    return ANONYMISED[type] ?? null;
  };
  return {
    /* Component catalogue, checklist templates and questionnaire definitions */
    catalog,
    /* "pi", "po" or "prismsuite" when the bytes are one of the known sample files, else null */
    lookupByHash: (hash) => SAMPLE_HASHES[hash] ?? null,
    load,
    loadAll: async () => ({ pi: await load('pi'), po: await load('po'), prismsuite: await load('prismsuite') }),
  };
}
