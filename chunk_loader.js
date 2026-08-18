(() => {
  'use strict';

  const nativeFetch = window.fetch.bind(window);
  // Change this on each delivery so GitHub Pages cannot reuse an older PCK chunk.
  const BUILD_VERSION = '20260818-popup-input-bgm-fix';
  const chunkMap = {
    'index.wasm': ['index.wasm.part1', 'index.wasm.part2'],
    'index.pck': ['index.pck.part1', 'index.pck.part2'],
  };

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const fileName = url.split('?')[0].split('/').pop();
    const chunks = chunkMap[fileName];
    if (!chunks) {
      return nativeFetch(input, init);
    }
    const baseUrl = url.slice(0, url.lastIndexOf('/') + 1);
    const parts = await Promise.all(chunks.map((name) => nativeFetch(`${baseUrl}${name}?v=${BUILD_VERSION}`).then((response) => {
      if (!response.ok) throw new Error(`Failed to load ${name}`);
      return response.arrayBuffer();
    })));
    const totalLength = parts.reduce((total, part) => total + part.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      merged.set(new Uint8Array(part), offset);
      offset += part.byteLength;
    }
    return new Response(merged, {
      headers: { 'Content-Type': fileName.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream' },
    });
  };
})();
