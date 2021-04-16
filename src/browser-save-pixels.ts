import ndarray from 'ndarray';
import ops from 'ndarray-ops';

export interface SavePixelsOptions {quality?: number};

export function savePixels(array: ndarray, type: 'canvas'): HTMLCanvasElement;
export function savePixels(array: ndarray, type: 'png'): Readable;
export function savePixels(array: ndarray, type: 'jpeg' | 'jpg', options?: SavePixelsOptions): Readable;
export function savePixels(array: ndarray, type: 'canvas' | 'png' | 'jpeg' | 'jpg', options: SavePixelsOptions = {}): Readable | HTMLCanvasElement {
	// Create HTMLCanvasElement and write pixel data.
	const canvas = document.createElement('canvas');
	canvas.width = array.shape[0];
	canvas.height = array.shape[1];

	const context = canvas.getContext('2d')!;
	const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

	try {
		handleData(array, imageData.data);
	} catch (e) {
		// Pass errors to stream, to match 'save-pixels' behavior.
		return Readable.from(Promise.reject(e));
	}

	context.putImageData(imageData, 0, 0);

	// Encode to target format.
	switch (type) {
		case 'canvas':
			return canvas;
		case 'jpg':
		case 'jpeg':
			return streamCanvas(canvas, 'image/jpeg', options.quality ? options.quality / 100 : undefined);
		case 'png':
			return streamCanvas(canvas, 'image/png');
		default:
			throw new Error('[ndarray-pixels] Unsupported file type: ' + type);
	}
}

/** Creates readable stream from given HTMLCanvasElement and options. */
function streamCanvas(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Readable {
	const promise = new Promise<Uint8Array>(async (resolve, reject) => {
		canvas.toBlob(async (blob) => {
			if (blob) {
				resolve(new Uint8Array(await blob.arrayBuffer()));
			} else {
				reject(new Error('[ndarray-pixels] Failed to canvas.toBlob().'));
			}
		}, mimeType, quality);
	});
	return Readable.from(promise);
}

function handleData(array: ndarray, data: Uint8Array | Uint8ClampedArray, frame = -1): Uint8Array | Uint8ClampedArray {
	if (array.shape.length === 4) {
		return handleData(array.pick(frame), data, 0);
	} else if (array.shape.length === 3) {
		if (array.shape[2] === 3) {
			ops.assign(
				ndarray(
					data,
					[array.shape[0], array.shape[1], 3],
					[4, 4 * array.shape[0], 1]
				),
				array
			);
			ops.assigns(
				ndarray(
					data,
					[array.shape[0] * array.shape[1]],
					[4],
					3
				),
				255
			);
		} else if (array.shape[2] === 4) {
			ops.assign(
				ndarray(
					data,
					[array.shape[0], array.shape[1], 4],
					[4, array.shape[0] * 4, 1]
				),
				array
			);
		} else if (array.shape[2] === 1) {
			ops.assign(
				ndarray(
					data,
					[array.shape[0], array.shape[1], 3],
					[4, 4 * array.shape[0], 1]
				),
				ndarray(
					array.data,
					[array.shape[0], array.shape[1], 3],
					[array.stride[0], array.stride[1], 0],
					array.offset
				)
			);
			ops.assigns(
				ndarray(
					data,
					[array.shape[0] * array.shape[1]],
					[4],
					3
				),
				255
			);
		} else {
			throw new Error('[ndarray-pixels] Incompatible array shape.');
		}
	} else if (array.shape.length === 2) {
		ops.assign(
			ndarray(data,
			[array.shape[0], array.shape[1], 3],
			[4, 4 * array.shape[0], 1]),
			ndarray(array.data,
			[array.shape[0], array.shape[1], 3],
			[array.stride[0], array.stride[1], 0],
			array.offset)
		);
		ops.assigns(
			ndarray(data,
			[array.shape[0] * array.shape[1]],
			[4],
			3),
			255
		);
	} else {
		throw new Error('[ndarray-pixels] Incompatible array shape.');
	}
	return data;
}

class Readable {
	constructor (private _promise: Promise<Uint8Array>) {}

	on(event: 'data' | 'error' | 'end', fn: (res?: Uint8Array | Error) => void): this {
		if (event === 'data') {
			this._promise.then(fn);
		} else if (event === 'error') {
			this._promise.catch(fn)
		} else if (event === 'end') {
			this._promise.finally(fn);
		}
		return this;
	}

	static from (promise: Promise<Uint8Array>): Readable {
		return new Readable(promise);
	}
}
