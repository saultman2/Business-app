---
name: Object storage upload objectPath
description: objectPath must come from POST /api/storage/uploads/request-url, not the GCS PUT response
---

The GCS PUT response body is empty. The correct objectPath is returned in the JSON response of `POST /api/storage/uploads/request-url` as `{ uploadURL, objectPath }`.

**Why:** GCS PUT returns 200 with no body; the objectPath is only known before the upload (it's the path we generate server-side).

**How to apply:** Always store `objectPath` from the request-url response before initiating the upload. Use a ref (`lastObjectPathRef`) to carry it into the `onComplete` callback.
