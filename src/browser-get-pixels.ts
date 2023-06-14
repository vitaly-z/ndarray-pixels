import ndarray from 'ndarray';
import type { NdArray } from 'ndarray';

export default getPixels;

function getPixels(buffer: Uint8Array, mimeType: string): Promise<NdArray> {
	// Warn for Data URIs, URLs, and file paths. Support removed in v3.
	if (!(buffer instanceof Uint8Array)) {
		throw new Error('[ndarray-pixels] Input must be Uint8Array or Buffer.');
	}

	const blob = new Blob([buffer], { type: mimeType });
	const path = URL.createObjectURL(blob);

	// Decode image with Canvas API.
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = function () {
			URL.revokeObjectURL(path as string);

			const canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			const context = canvas.getContext('2d')!;
			context.drawImage(img, 0, 0);
			const pixels = context.getImageData(0, 0, img.width, img.height);
			resolve(
				ndarray(
					new Uint8Array(pixels.data),
					[img.width, img.height, 4],
					[4, 4 * img.width, 1],
					0
				)
			);
		};
		img.onerror = (err) => {
			URL.revokeObjectURL(path as string);
			reject(err);
		};
		img.src = path;
	});
}
