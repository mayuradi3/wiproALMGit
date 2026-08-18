# Wipro ALM — Asset Library Manager

Wipro **ALM** (Asset Library Manager) is a support pipeline for the WP Asset Library extension in **NVIDIA Isaac Sim**. It helps technical artists and developers organize, clean, and package 3D assets so they are ready to drop into the asset library with the correct folder structure, thumbnails, and naming conventions.

This repository contains the web front-end for ALM: a lightweight, browser-based pipeline hub built with **Next.js**.

> **Note:** All asset processing happens locally in the browser. No files are uploaded to any server.

---

## What ALM does

- Takes raw 3D models, textures, and reference images
- Renders and captures **256×256 thumbnails** with the subject fitted to the frame
- Removes backgrounds and normalizes USD scale/units where applicable
- Organizes outputs into a consistent folder layout compatible with the Isaac Sim asset library extension
- Packages everything into a downloadable zip archive

---

## Quick start

1. Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000).
3. Click the plus button to create a workflow.
4. Choose a workflow type:
   - **Ares** — single asset processing
   - **Libra** — bulk / folder processing
5. For Libra, choose **Sorted** to group assets by naming rules, or **Unsorted** to batch by size.
6. Open the workflow and run the pipeline. Download the zip when it finishes.

---

## Deployment

This is a standard **Next.js** static-compatible app. To deploy to **Vercel**, push this repository and import it from the Vercel dashboard, or use the Vercel CLI:

```bash
npm run build
```

The build produces static output ready for Vercel's default Next.js preset.

---

## Workflow types

### Ares — single asset import

Use Ares for one-off assets.

1. Upload a 3D model (`USD`, `USDA`, `USDC`, `OBJ`, `GLB`, `GLTF`).
2. Upload one or more textures (`BaseColor`, `Emissive`, `Normal`, `ORM`).
3. Run the pipeline.
4. Ares loads the model, applies textures, captures a 256×256 thumbnail, removes the background, fits the subject to the frame, normalizes USDA scale/units if needed, and bundles the result into a zip.

Output structure:

```text
{assetName}/
  {model}
  Textures/
    ...texture files
  .thumbs/
    256x256/
      {model}.png
```

### Libra — bulk asset import

Use Libra when you have a folder of assets to process together.

1. Upload a directory containing `.usd` / `.usda` models and matching `_BaseColor`, `_Emissive`, `_Normal`, and `_ORM` textures.
2. Libra scans the directory, pairs models with their textures, and splits them into batches or sorted groups.
3. Each asset is rendered, thumbnailed, normalized if applicable, and bundled.
4. The final zip contains either named group folders (sorted) or a single shared tree (unsorted).

#### Sorted Libra

Sorted workflows use rules to place assets into named folders. Each rule defines a target directory and one or more conditions. A file matches if **any** condition is true. Files that match nothing go into the unlisted fallback directory.

Supported condition types:

- `contains`
- `starts with`
- `ends with`
- `equals`
- `regex`

Example:

- Directory `Heroes` with conditions `contains hero` and `starts with chr`
- Directory `Props` with condition `starts with prop`
- Unlisted directory `Other` catches everything else

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

---

## Storage

Workflow metadata is stored in the browser's `localStorage` under the key `alm-workflows`. Clearing site data will reset your workflow list, but it will not affect any downloaded zips.

---

## Controls

- **Run / Pause** — top-right play/pause button inside a pipeline
- **Download** — appears after the pipeline completes
- **Back** — top-left arrow returns to the workflow list

---

## Tech stack

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Three.js](https://threejs.org/) — local 3D preview and screenshot capture
- [JSZip](https://stuk.github.io/jszip/) — client-side zip generation

---

## License / attribution

Developed by **Wipro Smart Robotics Lab (SRL)**. 
