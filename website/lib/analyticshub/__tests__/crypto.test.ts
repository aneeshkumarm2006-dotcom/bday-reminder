import { describe, expect, it } from "vitest";

// A deterministic 32-byte key (set before the module reads it lazily).
process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(32, 3).toString("base64");

import {
  cryptoReady,
  decrypt,
  decryptJson,
  encrypt,
  encryptJson,
  secretKeyStatus,
} from "@/lib/analyticshub/crypto";

describe("analyticshub crypto", () => {
  it("round-trips a string", () => {
    const secret = "refresh-token-abc123";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("produces a different ciphertext each call (random IV)", () => {
    expect(encrypt("same")).not.toBe(encrypt("same"));
  });

  it("round-trips JSON", () => {
    const obj = { a: 1, b: "two", c: [3, 4] };
    expect(decryptJson<typeof obj>(encryptJson(obj))).toEqual(obj);
  });

  it("fails to decrypt tampered ciphertext (GCM auth tag)", () => {
    const packed = encrypt("tamper-me");
    const buf = Buffer.from(packed, "base64");
    buf[buf.length - 1] ^= 0x01; // flip a bit in the ciphertext
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });

  it("reports a healthy key", () => {
    expect(secretKeyStatus().ok).toBe(true);
    expect(cryptoReady()).toBe(true);
  });

  it("reports a wrong-length key with the decoded byte count", () => {
    const prev = process.env.ANALYTICSHUB_SECRET_KEY;
    process.env.ANALYTICSHUB_SECRET_KEY = Buffer.alloc(16, 1).toString("base64");
    const status = secretKeyStatus();
    expect(status.ok).toBe(false);
    expect(status.message).toContain("32 bytes");
    expect(status.message).toContain("16");
    process.env.ANALYTICSHUB_SECRET_KEY = prev;
  });
});
