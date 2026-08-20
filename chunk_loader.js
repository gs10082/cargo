(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  // Bump this on every delivery so a host never serves stale chunks.
  const BUILD_VERSION = '20260820-stage-coming-soon-r23';
  const chunkMap = {
    // .bin files bypass the host's Function route and remain static assets.
    'index.wasm': ['index-wasm-1.bin', 'index-wasm-2.bin'],
    'index.pck': ['index-pck-1.bin', 'index-pck-2.bin'],
  };

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const fileName = url.split('?')[0].split('/').pop();
    const chunks = chunkMap[fileName];
    if (!chunks) return nativeFetch(input, init);

    const baseUrl = url.slice(0, url.lastIndexOf('/') + 1);
    const parts = await Promise.all(chunks.map(async (name) => {
      const response = await nativeFetch(`${baseUrl}${name}?v=${BUILD_VERSION}`);
      if (!response.ok) throw new Error(`Failed to load ${name}`);
      return response.arrayBuffer();
    }));
    const totalLength = parts.reduce((total, part) => total + part.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      merged.set(new Uint8Array(part), offset);
      offset += part.byteLength;
    }
    return new Response(merged, {
      headers: {
        'Content-Type': fileName.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream',
      },
    });
  };
})();
