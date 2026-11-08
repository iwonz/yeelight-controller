import { URL } from 'url';
import { YEELIGHT_PROPS, YeelightDeviceProps } from './types';

export interface YeelightDiscoveryMessage {
  kind: 'response' | 'advertisement';
  id: string;
  location: string;
  host: string;
  port: number;
  model?: string;
  version?: number;
  support?: string[];
  props: YeelightDeviceProps;
  headers: Record<string, string>;
}

export const parseYeelightDiscoveryMessage = (input: string | Buffer): YeelightDiscoveryMessage | null => {
  const lines = input.toString().split('\r\n');
  const startLine = lines.shift()?.trim();
  let kind: YeelightDiscoveryMessage['kind'];

  if (startLine === 'HTTP/1.1 200 OK') {
    kind = 'response';
  } else if (startLine === 'NOTIFY * HTTP/1.1') {
    kind = 'advertisement';
  } else {
    return null;
  }

  const headers: Record<string, string> = {};
  lines.forEach((line) => {
    const separator = line.indexOf(':');
    if (separator <= 0) {
      return;
    }

    const name = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers[name] = value;
  });

  if (kind === 'advertisement' && headers.nts !== 'ssdp:alive') {
    return null;
  }

  if (!headers.id || !headers.location) {
    return null;
  }

  let location: URL;
  try {
    location = new URL(headers.location);
  } catch {
    return null;
  }

  const port = Number(location.port);
  if (location.protocol !== 'yeelight:' || !location.hostname || !Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }

  const version = headers.fw_ver === undefined ? undefined : Number(headers.fw_ver);
  const support = headers.support?.split(/\s+/).filter(Boolean);
  const props: YeelightDeviceProps = {};
  YEELIGHT_PROPS.forEach((prop) => {
    if (headers[prop] !== undefined) {
      props[prop] = headers[prop];
    }
  });

  return {
    kind,
    id: headers.id,
    location: headers.location,
    host: location.hostname,
    port,
    ...(headers.model ? { model: headers.model } : {}),
    ...(Number.isFinite(version) ? { version } : {}),
    ...(support ? { support } : {}),
    props,
    headers,
  };
};
