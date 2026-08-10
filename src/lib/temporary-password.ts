import "server-only";
import { randomInt } from "node:crypto";

/**
 * Alphabet without the characters people misread when a password is written on
 * paper or read aloud across a yard: 0/O, 1/l/I, 5/S, 2/Z.
 */
const alphabet = "ABCDEFGHJKMNPQRTUVWXYabcdefghijkmnpqrtuvwxy346789";

/**
 * A temporary password an administrator hands to an employee directly.
 *
 * Length is set above the 12-character minimum enforced at /reset-password so a
 * temporary credential is never weaker than one the employee chooses. Uses
 * `randomInt`, which is uniform and cryptographically secure; `Math.random` is
 * neither and must never be used for credentials.
 */
export function generateTemporaryPassword(length = 16): string {
  if (length < 12) throw new Error("Temporary passwords must be 12+ characters.");
  let value = "";
  for (let index = 0; index < length; index += 1)
    value += alphabet[randomInt(alphabet.length)];
  return value;
}
