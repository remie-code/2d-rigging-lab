import type { RuntimePlayerInputConnectRequest } from "../preload/input-bridge-contract";
import { IFACIALMOCAP_DEFAULT_UDP_PORT } from "./input-adapters/ifacialmocap/ifacialmocap-udp-start-request";
import type { RuntimePlayerInputSessionConfig } from "./input-session-state";

export function readInputConnectRequest(
  request: unknown
): RuntimePlayerInputSessionConfig {
  const rawRequest = request === undefined ? {} : request;

  if (!isRecord(rawRequest)) {
    throw new Error("Input connect request must be an object.");
  }

  if (
    rawRequest.source !== undefined &&
    rawRequest.source !== "ifacialmocap"
  ) {
    throw new Error("Runtime Player supports only iFacialMocap input.");
  }

  if (rawRequest.transport !== undefined && rawRequest.transport !== "udp") {
    throw new Error("Runtime Player supports only UDP input.");
  }

  const receivePort = readReceivePort(rawRequest.receivePort);
  const iphoneHost = readOptionalHost(rawRequest.iphoneHost);

  return {
    source: "ifacialmocap",
    transport: "udp",
    receivePort,
    ...(iphoneHost === undefined ? {} : { iphoneHost })
  };
}

function readReceivePort(value: unknown): number {
  if (value === undefined) {
    return IFACIALMOCAP_DEFAULT_UDP_PORT;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 65535
  ) {
    throw new Error("Receive port must be an integer from 1 to 65535.");
  }

  return value;
}

function readOptionalHost(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("iPhone host must be a string.");
  }

  const host = value.trim();

  if (host.length === 0) {
    return undefined;
  }

  if (host.length > 255 || /\s/.test(host)) {
    throw new Error("iPhone host must be a valid host or IP address.");
  }

  return host;
}

function isRecord(
  value: unknown
): value is Partial<RuntimePlayerInputConnectRequest> {
  return typeof value === "object" && value !== null;
}
