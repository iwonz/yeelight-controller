const assert = require('node:assert/strict');
const test = require('node:test');

const { parseYeelightDiscoveryMessage } = require('../dist/cjs');

test('parses discovery headers case-insensitively and without required whitespace', () => {
  const message = parseYeelightDiscoveryMessage(
    [
      'HTTP/1.1 200 OK',
      'ID:0xabc',
      'LOCATION:yeelight://192.168.1.20:55443',
      'Fw_Ver: 42',
      'MODEL:color',
      'SUPPORT: get_prop   set_power toggle',
      'POWER:on',
      '',
    ].join('\r\n'),
  );

  assert.deepEqual(message, {
    kind: 'response',
    id: '0xabc',
    location: 'yeelight://192.168.1.20:55443',
    host: '192.168.1.20',
    port: 55443,
    model: 'color',
    version: 42,
    support: ['get_prop', 'set_power', 'toggle'],
    headers: {
      id: '0xabc',
      location: 'yeelight://192.168.1.20:55443',
      fw_ver: '42',
      model: 'color',
      support: 'get_prop   set_power toggle',
      power: 'on',
    },
  });
});

test('accepts valid alive advertisement messages', () => {
  const message = parseYeelightDiscoveryMessage(
    [
      'NOTIFY * HTTP/1.1',
      'NTS: ssdp:alive',
      'id: device-id',
      'Location: yeelight://10.0.0.8:55443',
      '',
    ].join('\r\n'),
  );

  assert.equal(message.kind, 'advertisement');
  assert.equal(message.id, 'device-id');
});

test('rejects malformed start lines and invalid Yeelight locations', () => {
  const invalidMessages = [
    'HTTP/1.1 404 Not Found\r\nid: x\r\nLocation: yeelight://10.0.0.8:55443\r\n',
    'NOTIFY * HTTP/1.1\r\nNTS: ssdp:byebye\r\nid: x\r\nLocation: yeelight://10.0.0.8:55443\r\n',
    'HTTP/1.1 200 OK\r\nid: x\r\nLocation: http://10.0.0.8:55443\r\n',
    'HTTP/1.1 200 OK\r\nid: x\r\nLocation: yeelight://10.0.0.8\r\n',
    'HTTP/1.1 200 OK\r\nLocation: yeelight://10.0.0.8:55443\r\n',
  ];

  for (const message of invalidMessages) {
    assert.equal(parseYeelightDiscoveryMessage(message), null);
  }
});
