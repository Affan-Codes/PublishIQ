# Cloudinary Storage Migration Summary

This document provides a comprehensive summary of the complete storage backend migration from local disk persistence to **Cloudinary** as the **sole** persistent storage provider for PublishIQ.

---

## 1. Summary of Changes

### Removed Files
- `backend/src/providers/storage/local-disk.provider.ts`: Completely deleted. Local disk is no longer used for persistent media storage.

### Added Files
- `backend/src/providers/storage/cloudinary.provider.ts`: Implements `StorageProvider` using Cloudinary SDK (`upload_stream`, `read` via HTTP GET, `destroy` for deletion).
- `backend/scripts/migrate-media-to-cloudinary.ts`: One-off migration script to transfer legacy `/media/...` files to Cloudinary and update database URLs.
- `CLOUDINARY_MIGRATION_SUMMARY.md`: Migration reference documentation.

### Modified Files

#### Backend
1. **`backend/package.json`**:
   - Added `cloudinary`, `multer`, and `@types/multer`.
2. **`backend/src/config/env.ts`**:
   - Added Zod-validated required environment variables: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
   - Replaced `MEDIA_ROOT` with `TEMP_RENDER_DIR` (default `./tmp/publishiq-render`).
3. **`backend/.env` & `backend/.env.example`**:
   - Configured Cloudinary credentials and `TEMP_RENDER_DIR`. Removed `MEDIA_ROOT`.
4. **`backend/src/services/rendering.service.ts`**:
   - Captures Playwright screenshots directly to `Buffer` and uploads to Cloudinary via `cloudinaryStorageProvider.save()`. Zero local disk persistence.
5. **`backend/src/services/video.service.ts`**:
   - Accepts remote Cloudinary HTTP(S) asset inputs and streams them into scratch space (`TEMP_RENDER_DIR`) for FFmpeg.
   - Compiles video into a temporary local scratch file, uploads the rendered MP4 to Cloudinary, and returns the returned `secure_url`.
   - Uses a `finally` block to delete all local scratch files unconditionally upon job completion or error.
6. **`backend/src/services/maintenance.service.ts`**:
   - Replaced `localDiskStorageProvider` calls with `cloudinaryStorageProvider.delete()` for automated retention cleanup on Cloudinary.
7. **`backend/src/providers/publishing/youtube.provider.ts`**:
   - Removed local disk path resolution and `fs.createReadStream`.
   - Obtains video size via HTTP HEAD/GET request to Cloudinary URL.
   - Streams video bytes directly from Cloudinary URL into YouTube resumable upload sessions. Supports byte-offset resumption via HTTP `Range: bytes=${offset}-` headers.
8. **`backend/src/providers/publishing/facebook.provider.ts`**:
   - Removed local file checks and disk streams. Streams photos and videos directly from Cloudinary URLs into Meta Graph API `FormData`.
9. **`backend/src/providers/publishing/instagram.provider.ts`**:
   - Removed `env.APP_BASE_URL` local path prefixing. Passes Cloudinary `secure_url` directly as `publicMediaUrl` to Instagram Reels/Photos container endpoints.
10. **`backend/src/routes/assets.router.ts`**:
    - Added `multer` memory-storage file upload middleware to `POST /assets` and `PUT /assets/:id`.
11. **`backend/src/controllers/asset.controller.ts`**:
    - Uploads `req.file` buffer to Cloudinary (`assets/<type>/...`) and stores the returned `secure_url` in the database.
    - Deletes corresponding Cloudinary asset when an `Asset` record is deleted.
12. **`backend/src/app.ts`**:
    - Removed `/media` static file serving middleware (`express.static`).

#### Frontend
13. **`frontend/src/routes/assets/AssetsView.tsx`**:
    - Added file picker (`<input type="file" />`) for asset uploads (music, backgrounds, fonts, logos, watermarks).
    - Submits `FormData` with progress indicators to `POST /assets`.
    - Added direct Cloudinary asset links for previewing stored files.

#### Infrastructure
14. **`docker-compose.yml` & `docker-compose.prod.yml`**:
    - Removed `media_data` persistent volume and container volume mounts. Added Cloudinary environment variable bindings.
15. **`Caddyfile`**:
    - Removed `/media/*` proxy route.

---

## 2. Cloudinary Folder Layout

All assets are organized into dedicated, distinct folders under the `publishiq/` namespace on Cloudinary:

| Asset Category | Cloudinary Folder Path | Description |
| :--- | :--- | :--- |
| **Generated Images** | `publishiq/images/` | Rendered Playwright PNG screenshots |
| **Generated Videos** | `publishiq/videos/` | Compiled FFmpeg MP4 videos |
| **Music Tracks** | `publishiq/music/` | Background audio tracks (MP3/WAV) |
| **Backgrounds** | `publishiq/backgrounds/` | Custom image backgrounds |
| **Fonts** | `publishiq/fonts/` | Custom typography font files (TTF/OTF) |
| **Logos** | `publishiq/logos/` | Brand logo image overlays |
| **Watermarks** | `publishiq/watermarks/` | Watermark image overlays |
| **Animations** | `publishiq/animations/` | Motion graphic templates & overlays |
| **Icons** | `publishiq/icons/` | UI and graphic asset icons |

---

## 3. Environment Variables

The following Zod-validated environment variables are **MANDATORY** for application startup:

```env
# Cloudinary Storage Configuration (REQUIRED)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Scratch Directory for Transient Rendering Files (OPTIONAL - Default: ./tmp/publishiq-render)
TEMP_RENDER_DIR=./tmp/publishiq-render
```

If any of `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, or `CLOUDINARY_API_SECRET` are missing, application startup will immediately throw a Zod validation error and exit with status 1.

---

## 4. Confirmation of Full Local-Disk Storage Removal

Local disk persistent storage has been **completely removed** from the codebase:
- There is **no dual-mode/toggle flag** or fallback path to local disk.
- Express static file serving for `/media` has been removed from `app.ts`.
- The `media_data` volume definition and volume mounts have been removed from Docker Compose files.
- The `local-disk.provider.ts` file has been deleted.
- The only remaining use of local disk is short-lived scratch files during video compilation (`video.service.ts`), which are purged in a `finally` block after every job.

---

## 5. One-Off Migration Script Instructions

To migrate legacy database records referencing `/media/...` paths to Cloudinary:

### Run Order Requirements
1. Configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` in `backend/.env`.
2. **Execute this script BEFORE deleting or unmounting the local `media_data` Docker volume or `./media` folder.**
3. Execute the migration script.
4. Verify database records now contain `https://res.cloudinary.com/...` URLs.
5. Manually remove the legacy local `media_data` Docker volume / `./media` directory once spot-checking completes.

### Execution Command

```bash
cd backend
npx tsx scripts/migrate-media-to-cloudinary.ts
```

---

## 6. Verification Results

- **Backend TypeScript Compilation**: Clean (`tsc -p tsconfig.json` exit code 0).
- **Frontend TypeScript & Vite Build**: Clean (`tsc -b && vite build` exit code 0).
- **Unit & Validation Tests**: Passed (15/15 unit tests passing).
