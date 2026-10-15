import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function loadKey(): Buffer {
  const configured = process.env.WEBHOOK_SECRET_MASTER_KEY;

  if (!configured) {
    throw new Error(
      "WEBHOOK_SECRET_MASTER_KEY is required for webhook secret encryption.",
    );
  }

  let key: Buffer;

  try {
    key = Buffer.from(configured, "base64");
  } catch {
    key = Buffer.alloc(0);
  }

  if (key.length !== 32) {
    throw new Error(
      "WEBHOOK_SECRET_MASTER_KEY must be a base64-encoded 32-byte key.",
    );
  }

  return key;
}

export function encryptWebhookSecret(secret: string) {
  const key = loadKey();
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    sha256: createHash("sha256").update(secret).digest("hex"),
  };
}

export function decryptWebhookSecret(input: {
  ciphertext: string;
  iv: string;
  tag: string;
}) {
  const key = loadKey();

  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(input.iv, "base64"),
  );

  decipher.setAuthTag(Buffer.from(input.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, "base64")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
