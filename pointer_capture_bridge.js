(() => {
  'use strict';

  const canvas = document.getElementById('canvas');
  if (!canvas || !window.PointerEvent) return;

  let activeMousePointerId = null;
  let lastClientX = 0;
  let lastClientY = 0;

  const releasePointer = () => {
    if (activeMousePointerId !== null && canvas.hasPointerCapture(activeMousePointerId)) {
      canvas.releasePointerCapture(activeMousePointerId);
    }
    activeMousePointerId = null;
  };

  const sendReleaseToGodot = () => {
    canvas.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 0,
      clientX: lastClientX,
      clientY: lastClientY,
    }));
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    activeMousePointerId = event.pointerId;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  }, true);

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId === activeMousePointerId) {
      lastClientX = event.clientX;
      lastClientY = event.clientY;
    }
  }, true);

  canvas.addEventListener('pointerup', (event) => {
    if (event.pointerId === activeMousePointerId) releasePointer();
  }, true);

  canvas.addEventListener('pointercancel', (event) => {
    if (event.pointerId !== activeMousePointerId) return;
    sendReleaseToGodot();
    releasePointer();
  }, true);

  window.addEventListener('blur', () => {
    if (activeMousePointerId === null) return;
    sendReleaseToGodot();
    releasePointer();
  });
})();
