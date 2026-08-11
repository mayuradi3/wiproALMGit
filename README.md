# Cerberus

Cerberus is a Next.js web app for bulk and single 3D asset processing. It takes uploaded models, textures, and thumbnails and produces clean, folder-organized exports ready for a game engine or asset library.

## Quick start

1. Open the app.
2. On the home screen, click the plus button to create a workflow.
3. Choose a name, then pick a mode:
   - **Ares** – single asset processing.
   - **Libra** – bulk / folder processing.
4. Configure any sorting rules (for sorted Libra workflows) and create the workflow.
5. Click the workflow card to open its pipeline and run it.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment

This is a standard Next.js app ready for [Vercel](https://vercel.com):

```bash
npm run build
```

## Workflows

A workflow is a saved project. Each workflow remembers its name, type, and (for Libra) sorting rules. Workflow cards appear on the home screen and can be opened, run, or deleted.

Workflow metadata is stored in the browser's `localStorage`. Clearing site data will reset workflows.

## Pipelines

### Ares – single asset import

Use Ares when you want to process one asset at a time.

1. Upload a 3D model (USD, OBJ, GLB, GLTF).
2. Upload one or more textures (Base Color, Emissive, Normal, ORM).
3. Run the pipeline. Ares loads the model, applies the textures, captures a 256×256 thumbnail, removes the background, fits the subject to the frame, and bundles everything into a zip.

The output zip contains:

```text
{assetName}/
  {model}
  Textures/
    ...texture files
  .thumbs/
    256x256/
      {model}.png
```

### Libra – bulk asset import

Use Libra when you have a folder of assets to process together.

1. Choose a directory containing `.usd` / `.usda` models and matching `_BaseColor`, `_Emissive`, `_Normal`, and `_ORM` textures.
2. Libra scans the directory, pairs models with their textures, and splits them into batches.
3. Each asset is rendered, thumbnailed, and bundled.
4. The final zip contains either one shared output tree (unsorted) or named batch folders (sorted).

#### Sorted Libra

Sorted workflows use rules to place assets into named folders. Each listed rule defines a target directory and one or more conditions. A file matches a directory if any of its conditions are true. Files that match nothing go into the unlisted fallback directory.

Conditions support:

- contains
- starts with
- ends with
- equals
- regex

Example:

- Directory `Heroes` with conditions `contains hero` and `starts with chr`.
- Directory `Props` with condition `starts with prop`.
- Unlisted directory `Other` catches everything else.

Output:

```text
Heroes/
  {asset}.usd
  Textures/
    ...
  .thumbs/256x256/{asset}.png
Props/
  ...
Other/
  ...
```

#### Unsorted Libra

Unsorted workflows keep the original order and batch assets by size. The final zip uses a single shared folder tree:

```text
{workflowName}/
  {asset}/
    {asset}.usd
    Textures/
      ...
    .thumbs/256x256/{asset}.png
```

## Keyboard / controls

- **Run / pause** – top-right play button inside a pipeline.
- **Download** – available after the pipeline finishes.
- **Back** – top-left arrow returns to the workflow list.

## Notes

- The app stores workflow metadata in `localStorage`.
- Pipelines run entirely in the client browser using a local Three.js viewer.
- Exporting does not require an internet connection.
# Cerberus
