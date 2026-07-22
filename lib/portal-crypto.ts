import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Get the AES-256-GCM encryption key from environment.
 * Throws at startup if PORTAL_CREDENTIAL_KEY is missing or invalid (fail-closed).
 */
function getKey(): Buffer {
    const hex = process.env.PORTAL_CREDENTIAL_KEY;
    if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
        throw new Error(
            "PORTAL_CREDENTIAL_KEY must be 64 hex chars (32 bytes). Generate: openssl rand -hex 32"
        );
    }
    return Buffer.from(hex, "hex");
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns base64(iv + authTag + ciphertext).
 */
export function encrypt(plaintext: string): string {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a base64 blob produced by encrypt().
 * Throws if the auth tag mismatches (tampered or wrong key).
 */
export function decrypt(blob: string): string {
    const key = getKey();
    const data = Buffer.from(blob, "base64");

    if (data.length < IV_LENGTH + TAG_LENGTH) {
        throw new Error("Invalid credential blob: too short");
    }

    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
}

export interface CredentialData {
    username: string;
    password: string;
    extra?: Record<string, string>;
}

/**
 * Encrypt a CredentialData object to a storable blob.
 */
export function encryptCredential(cred: CredentialData): string {
    return encrypt(JSON.stringify(cred));
}

/**
 * Decrypt a blob back to CredentialData.
 */
export function decryptCredential(blob: string): CredentialData {
    return JSON.parse(decrypt(blob)) as CredentialData;
}
