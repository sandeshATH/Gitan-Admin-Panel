import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

let memoizedKey: Buffer | null = null;

function getEncryptionKey() {
  if (memoizedKey) {
    return memoizedKey;
  }

  const secret = process.env.CLIENT_ENCRYPTION_KEY;
  if (!secret || !secret.trim()) {
    throw new Error(
      "CLIENT_ENCRYPTION_KEY is not configured. Update your environment variables."
    );
  }

  memoizedKey = createHash("sha256").update(secret).digest();
  return memoizedKey;
}

export function encryptSecret(value: string) {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptSecret(payload: string) {
  const [ivB64, tagB64, cipherTextB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !cipherTextB64) {
    throw new Error("Invalid encrypted payload.");
  }

  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherTextB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
