// Make ethereum property configurable to prevent redefinition errors
if (typeof window.ethereum !== 'undefined') {
  try {
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      writable: true,
      value: window.ethereum
    });
  } catch (e) {
    console.warn('Could not make ethereum configurable:', e);
  }
}
