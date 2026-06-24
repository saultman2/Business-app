---
name: Object upload objectPath source
description: Where to read the storage objectPath in the Uppy ObjectUploader flow
---

When using `@workspace/object-storage-web` `ObjectUploader` (Uppy + AwsS3, presigned PUT to GCS):

- The presigned PUT goes directly to Google Cloud Storage, which returns an **empty body**. So `result.successful[0].response?.body?.objectPath` in `onComplete` is **always undefined** — do not read objectPath there.
- The `objectPath` is returned by `POST /api/storage/uploads/request-url` alongside `uploadURL`. Capture it in `onGetUploadParameters` (store in a `useRef`) and read the ref in `onComplete`.

**Why:** A bug where the logo never displayed after upload traced to reading objectPath from the GCS PUT response. The fix saves logoUrl as `/api/storage${objectPath}`.

**How to apply:** For single-file uploads a single `lastObjectPathRef` ref is fine. If `maxNumberOfFiles > 1`, switch to a per-file map keyed by Uppy `file.id` to avoid mix-ups under concurrent uploads.
