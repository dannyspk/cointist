import '@testing-library/jest-dom';

// Polyfills for jsdom environment: TextEncoder/TextDecoder are used by
// some url/jsdom dependencies in Node >= v18. Add minimal globals so
// tests that import jsdom/dompurify won't fail.
if (typeof global.TextEncoder === 'undefined') {
	const { TextEncoder, TextDecoder } = require('util');
	global.TextEncoder = TextEncoder;
	global.TextDecoder = TextDecoder;
}
