import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

// Explicitly approved for the user's app-wide dropdown-search and themed picker requests.
// Pin BOTH upstream and edited content; unlisted files still require exact source parity.
// Behavior is covered by test-dropdown-search.mjs, test-date-time-pickers.mjs and browser checks.
const adaptations = {
  "components/record/date-time-field.tsx": {
    "upstream": "b19e47df7f6aee4b7085b32bd7ddc1f851b0cf523da02e4d6790965d6faa2735",
    "client": "70bb97a21caba04e407a8a7e77792b4678608582a8812e5f8b9fd2cd6b87dd2e"
  },
  "components/record/record-field.tsx": {
    "upstream": "c66671764b1d5b51ed35b24833bcca2feea1640dba30bec23a6327e8ac1ba7f0",
    "client": "f5e933608418450fa46d98e1a1dc4ef75db2cc751f756b335aa68120abf6b349"
  },
  "components/data-table/import-dialog.tsx": {
    "upstream": "853e34601ce72465e4beb917695933de8307c40620315b663e9fb39569941bc1",
    "client": "5e6ee0a1816f69536f176e8e699377ef1f32ad0b6e4264a25489717881664ad0"
  },
  "components/data-table/record-view-bar.tsx": {
    "upstream": "19d4bd6a9ae45b6e36499b1f41019defdde601d802098d6f9c1f16f438708283",
    "client": "a26342fdf4d64dbe3f0eeafd59a2ef23f34cfede95b9ac21e046cd4a7a59a579"
  },
  "components/data-table/data-table-view-options.tsx": {
    "upstream": "fc4f055760f01c469324a6b1fb03e3a888c4086d3a94f6686bad4d65d90d18e9",
    "client": "a702938d873978a15f80c91e47dd2d41d8f218c06150314a34fc0d12c2c9dbcf"
  },
  "components/calendar/record-calendar.tsx": {
    "upstream": "ee4960a324ba4cfb53142ce2a958ac4b5abffcb491fc93fc86325c8eba995de0",
    "client": "b3baf586293302de64f3cfb7dbac266c3d532fe9b600633cdc4190aac7caf175"
  }
}
const hash = source => createHash('sha256').update(source).digest('hex')
export function verifySearchAdaptation(file, upstream, client) {
  if (!Object.hasOwn(adaptations, file)) return false
  assert.equal(hash(upstream), adaptations[file].upstream, 'Upstream search adaptation changed: ' + file)
  assert.equal(hash(client), adaptations[file].client, 'Unreviewed search UI drift: ' + file)
  return true
}
