// tests/sna-format.test.js
'use strict';
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

let parsedPayload = null;
installStubs({
  SCRFormat: {
    parse: (buffer) => {
      parsedPayload = new Uint8Array(buffer);
      return { success: parsedPayload.length === 6912 };
    }
  }
});
loadModule('js/io/sna-format.js');

function makeSna(totalSize) {
  const sna = new Uint8Array(totalSize);
  for (let i = 0; i < 6912; i++) sna[27 + i] = (i * 3 + 5) & 0xFF;
  return sna;
}

for (const size of [49179, 131103, 147487]) {
  parsedPayload = null;
  const res = SNAFormat.parse(makeSna(size).buffer);
  check(`${size}-byte SNA parses`, res.success === true, res.error);
  check(`${size}-byte SNA screen extracted at offset 27`,
    parsedPayload && parsedPayload.every((v, i) => v === ((i * 3 + 5) & 0xFF)));
}

check('reject wrong size', SNAFormat.parse(new Uint8Array(1000).buffer).success === false);
summary();
