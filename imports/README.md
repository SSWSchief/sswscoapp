# Secure import workspace

Place sanitized staging JSON files here. Everything except this README is ignored by Git. Production source files must arrive through the client-approved secure channel and must never be committed.

Run `npm run import:validate -- imports/operations.json`. Applying requires the production secret and an explicit `--apply` flag: `npm run import:validate -- imports/operations.json --apply`.

The manifest contains `users`, `customers`, `trucks`, `dumpsters`, and `jobs` arrays. Every record requires a stable `id`; jobs also require a stable `reference` and references to imported/existing records.
