import assert from "node:assert/strict";
import { test } from "node:test";
import { keywordMatches } from "../src/lib/engine/inbound";
import { renderTemplate } from "../src/lib/engine/template";
import { decodePostback, encodePostback, validateGraph } from "../src/lib/flow/types";
import { FLOW_TEMPLATES } from "../src/lib/flow/templates";
import { isPrivateAddress } from "../src/lib/ssrf";
import { decryptJson, encryptJson, hashPassword, verifyPassword } from "../src/lib/crypto";

test("keyword matching", () => {
  assert.ok(keywordMatches("What is your PRICING?", { keywords: ["pricing"], match: "contains" }));
  assert.ok(!keywordMatches("unpricingly", { keywords: ["pricing"], match: "contains" }));
  assert.ok(keywordMatches("help", { keywords: ["help"], match: "exact" }));
  assert.ok(!keywordMatches("help me", { keywords: ["help"], match: "exact" }));
  assert.ok(keywordMatches("help me", { keywords: ["help"], match: "starts_with" }));
});

test("template rendering with fallbacks", () => {
  assert.equal(renderTemplate("Hi {{first_name|there}}!", {}), "Hi there!");
  assert.equal(renderTemplate("Hi {{ first_name }}!", { first_name: "Ada" }), "Hi Ada!");
});

test("postback payload round-trip fits Telegram's 64 bytes", () => {
  const p = encodePostback("cmwdci2xm0004f67d1nj4velc", "abcd1234", "b.abcd1234", false);
  assert.ok(p.length <= 64);
  assert.deepEqual(decodePostback(p), { flowId: "cmwdci2xm0004f67d1nj4velc", nodeId: "abcd1234", handle: "b.abcd1234", preview: false });
  assert.equal(decodePostback("garbage"), null);
});

test("every gallery template is publishable", () => {
  for (const t of FLOW_TEMPLATES) assert.deepEqual(validateGraph(t.build()), [], t.id);
});

test("SSRF guard rejects private addresses", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.1", "::1", "fd00::1"]) assert.ok(isPrivateAddress(ip), ip);
  assert.ok(!isPrivateAddress("8.8.8.8"));
});

test("crypto helpers", async () => {
  const blob = encryptJson({ token: "secret" });
  assert.deepEqual(decryptJson(blob), { token: "secret" });
  assert.equal(decryptJson(blob.slice(0, -2) + "xx"), null);
  const hash = await hashPassword("hunter22");
  assert.ok(await verifyPassword("hunter22", hash));
  assert.ok(!(await verifyPassword("wrong", hash)));
});
