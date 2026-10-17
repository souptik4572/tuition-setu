// Prints this laptop's Wi-Fi address for the phone: the first non-internal IPv4 (SPEC §9.4).
import { networkInterfaces } from "node:os";

const address = Object.values(networkInterfaces())
  .flat()
  .find((a) => a?.family === "IPv4" && !a.internal)?.address;
if (!address) {
  console.error("No Wi-Fi address found. Is the laptop connected to Wi-Fi?");
  process.exit(1);
}
console.log(address);
