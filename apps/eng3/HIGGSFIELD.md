# Higgsfield 3D integration

Both `eng` and `eng2` use the equipment models in `apps/assets/warehouse-higgsfield.glb`.
The result screen still uses `Engine.layout` for warehouse dimensions, cell count and inventory placement. The fixed warehouse in the source GLB is not used as the result layout.

`higgsfield-models.js` extracts reusable shuttle, lifter, carriage, forklift and pallet geometry. Stored cargo uses instanced meshes. Resources are cloned per result to keep clipping and disposal independent of the cached templates. `higgsfield.js` loads the models before initialization and ignores stale loads after a reset. Failed model downloads use the original 3D renderer.

Source: https://higgsfield.ai/3d-jutsu/40346564-9b5c-49d9-93a7-3e30cb7c6bb9, GLB revision 11. Official Three.js r185 loaders and their MIT license are bundled locally; no credentials or external generation requests are required at runtime.

The 20-second animation illustrates a pallet transfer. It does not calculate queueing, collisions, throughput or actual inventory changes. Equipment dimensions are adapted for the explanatory layout.

Validation from repository root:

```
node apps/tests/verify-engineering.cjs
node apps/tests/verify-higgsfield.mjs
```

Browser checks: 500-pyeong / 12m / 1,000-pallet inputs, input change to one tier, inbound/outbound playback, section selection, fullscreen return, model badge and console errors.

Keep both themes' adapters and vendor files identical. On future edits, update module query versions and each theme's service-worker cache version together. Deploy `apps/assets` with both app directories.
