import "server-only";
import { randomInt } from "node:crypto";
import {
  MINIMUM_PASSWORD_LENGTH,
  satisfiesPasswordPolicy,
} from "./password-policy";

/**
 * Alphabet without the characters people misread when a password is written on
 * paper or read aloud across a yard: 0/O, 1/l/I, 5/S, 2/Z.
 */
const uppercase = "ABCDEFGHJKMNPQRTUVWXY";
const lowercase = "abcdefghijkmnpqrtuvwxy";
const digits = "346789";
const alphabet = uppercase + lowercase + digits;

const pick = (source: string) => source[randomInt(source.length)];

/**
 * A temporary password an administrator hands to an employee directly.
 *
 * Length is set above the 12-character minimum so a temporary credential is
 * never weaker than one the employee chooses. Uses `randomInt`, which is
 * uniform and cryptographically secure; `Math.random` is neither and must never
 * be used for credentials.
 *
 * One character of each class is placed first and the result shuffled, rather
 * than drawing every character freely. Dropping the ambiguous glyphs leaves
 * only six digits among forty-nine characters, so a free draw of sixteen omits
 * digits entirely about one time in eight — which would silently break roughly
 * that share of onboardings the day anyone enables the documented
 * `lower_upper_letters_digits` requirement on the hosted project.
 */
export function generateTemporaryPassword(
  length = 16,
  // Injectable purely so tests can prove the shuffle never leaves the seeded
  // characters in their original positions.
  random: (limit: number) => number = randomInt,
): string {
  if (length < MINIMUM_PASSWORD_LENGTH)
    throw new Error(
      `Temporary passwords must be ${MINIMUM_PASSWORD_LENGTH}+ characters.`,
    );

  const characters = [pick(uppercase), pick(lowercase), pick(digits)];
  while (characters.length < length) characters.push(pick(alphabet));

  // Fisher-Yates, so the guaranteed characters do not sit in fixed positions.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swap = random(index + 1);
    [characters[index], characters[swap]] = [
      characters[swap],
      characters[index],
    ];
  }

  const value = characters.join("");
  // The generator is the one place a password is produced rather than chosen,
  // so a policy change that outpaced this function would fail at the point of
  // onboarding an employee. Fail here instead, where it is obvious.
  if (!satisfiesPasswordPolicy(value))
    throw new Error("Generated password did not satisfy the password policy.");
  return value;
}
