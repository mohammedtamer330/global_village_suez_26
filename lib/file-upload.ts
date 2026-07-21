const maxBytes = 5 * 1024 * 1024;

// ─── why this file changed ────────────────────────────────────────────────────
// The previous version saved uploaded ID/payment photos to public/uploads on
// local disk. On Vercel, production servers have a READ-ONLY filesystem, so
// that write fails and the uploaded image is lost — which is also why the
// Google Drive copy step downstream never had a file to copy.
//
// This version uploads directly to Vercel Blob storage, which returns a
// permanent public HTTPS URL you can store in the registration record, show
// in the admin panel, and write into Google Sheets.
// ────────────────────────────────────────────────────────────────────────────

export async function saveUploadedFile(file: File | null, referenceId: string, label: string) {
  if (!file || file.size === 0) return "";
  if (!file.type.startsWith("image/")) {
    throw new Error(`${label} must be an image.`);
  }
  if (file.size > maxBytes) {
    throw new Error(`${label} must be smaller than 5MB.`);
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeName = `${referenceId}-${label.toLowerCase().replaceAll(" ", "-")}.${extension}`;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error(
      "File uploads aren't set up yet. In Vercel: Dashboard → Storage → Create Database → " +
        "Blob → Connect to this project, then redeploy. See DEPLOYMENT_FIX_GUIDE.md."
    );
  }

  const { put } = await import("@vercel/blob");
  const blob = await put(`uploads/${safeName}`, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return blob.url;
}
