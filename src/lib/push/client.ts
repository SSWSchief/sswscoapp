import "server-only";
import webpush from "web-push";
import { getPushEnv } from "./env";

let configured = false;

export function getWebPush() {
  if (!configured) {
    const { publicKey, privateKey, subject } = getPushEnv();
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return webpush;
}
