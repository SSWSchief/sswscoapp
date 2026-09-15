import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const STRIPE_MAX_BYTES = 512 * 1024;

function pngDimensions(path) {
  const data = readFileSync(path);
  assert.equal(data.subarray(1, 4).toString(), "PNG", `${path} must be PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

test("Stripe branding assets use the supplied logo and meet upload limits", () => {
  const logo = "public/brand/sswsco-stripe-logo.png";
  const icon = "public/icons/icon-512.png";
  const source = "IMG_4983.PNG";

  assert.ok(statSync(source).size > 0, "the client-supplied source logo is missing");
  for (const path of [logo, icon]) {
    assert.ok(
      statSync(path).size < STRIPE_MAX_BYTES,
      `${path} must remain below Stripe's 512 KB limit`,
    );
    const { width, height } = pngDimensions(path);
    assert.ok(width >= 128 && height >= 128, `${path} must be at least 128px`);
  }

  const logoSize = pngDimensions(logo);
  const iconSize = pngDimensions(icon);
  assert.notEqual(logoSize.width, logoSize.height, "Stripe logo must be non-square");
  assert.equal(iconSize.width, iconSize.height, "Stripe icon must be square");
});
