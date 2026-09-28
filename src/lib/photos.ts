import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

// Evidence photos. Cloudinary (free tier) when CLOUDINARY_* is configured; otherwise stored locally
// under DATA_DIR/photos and served by an unguessable id. Credentials must come from env, never code.

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function storePhoto(data: Buffer, mime: string): Promise<string | null> {
  if (!mime.startsWith("image/")) return null;
  const { cloudinaryCloud, cloudinaryKey, cloudinarySecret } = config;
  if (cloudinaryCloud && cloudinaryKey && cloudinarySecret) {
    try {
      const { v2: cloudinary } = await import("cloudinary");
      cloudinary.config({ cloud_name: cloudinaryCloud, api_key: cloudinaryKey, api_secret: cloudinarySecret, secure: true });
      const res = await cloudinary.uploader.upload(`data:${mime};base64,${data.toString("base64")}`, { folder: "civicpulse_reports" });
      return res.secure_url;
    } catch (e) {
      console.error("[photos] cloudinary upload failed, storing locally", (e as Error).message);
    }
  }
  const id = `${randomUUID()}.${EXT[mime] ?? "jpg"}`;
  const dir = path.join(config.dataDir, "photos");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, id), data);
  return `/api/v1/public/photos/${id}`;
}

export async function readLocalPhoto(id: string): Promise<{ data: Buffer; mime: string } | null> {
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp|heic)$/.test(id)) return null;
  try {
    const data = await fs.readFile(path.join(config.dataDir, "photos", id));
    const ext = id.split(".").pop()!;
    const mime = Object.entries(EXT).find(([, e]) => e === ext)?.[0] ?? "image/jpeg";
    return { data, mime };
  } catch {
    return null;
  }
}
