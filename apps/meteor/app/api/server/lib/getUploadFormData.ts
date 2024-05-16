import type { Readable } from 'stream';

import { MeteorError } from '@rocket.chat/core-services';
import type { ValidateFunction } from 'ajv';
import busboy from 'busboy';
import type { Request } from 'express';

type UploadResult<K> = {
	file: Readable & { truncated: boolean };
	fieldname: string;
	filename: string;
	encoding: string;
	mimetype: string;
	fileBuffer: Buffer;
	fields: K;
};

export async function getUploadFormData<
	T extends string,
	K extends Record<string, string> = Record<string, string>,
	V extends ValidateFunction<K> = ValidateFunction<K>,
>(
	{ request }: { request: Request },
	options: {
		field?: T;
		validate?: V;
		sizeLimit?: number;
	} = {},
): Promise<(UploadResult<K> | undefined)[]> {
	// const sizeLimit = options.sizeLimit || 1024 * 1024 * 1024; // 1GB limit
	console.log('options from getUploadFormData', options.field + ' ' + options.validate + ' ' + options.sizeLimit);
	const limits = {
		files: 6,
		...(options.sizeLimit && options.sizeLimit > -1 && { fileSize: options.sizeLimit }),
	};
	console.log('inside getUploadFormData', limits);

	const bb = busboy({ headers: request.headers, defParamCharset: 'utf8', limits, highWaterMark: 2 * 1024 * 1024 });
	const fields = Object.create(null) as K;
	console.log('fields from getUploadFormData', fields);

	let uploadedFile: UploadResult<K> | undefined;

	let uploadedArray: (UploadResult<K> | undefined)[] = [];

	// // let uploadedFile: (UploadResult<K> | undefined) = {};
	// const uploadResultArray = Object.values(uploadedFile);

	let returnResult = (_values: (UploadResult<K> | undefined)[]) => {
		console.log(_values + ' from getUploadFormData');
		// Your implementation here
	};
	let returnError = (_error?: Error | string | null | undefined) => {
		// noop
	};

	function onField(fieldname: keyof K, value: K[keyof K]) {
		console.log('key value form getUploadFormData', fieldname, value);
		console.log('value form getUploadFormData', value);
		if (Array.isArray(value)) {
			for (let i = 0; i < value.length; i++) {
				console.log('value form getUploadFormData', value[i]);
				// onField(fieldname, value[i]);
			}
		}
		console.log('onfield called from the getuploadformdaata');
		fields[fieldname] = value;
	}
	console.log('fields from getUploadFormData2 ', fields);
	function onEnd() {
		console.log('onend from getUploadFormData');
		uploadedArray.forEach((file) => {
			if (!file) {
				console.log('error from getUploadFormData uploadedfile');
				return returnError(new MeteorError('No file uploaded'));
			}
			if (options.validate !== undefined && !options.validate(fields)) {
				console.log('error from getUploadFormData', options.validate.errors?.join(', '));
				return returnError(new MeteorError(`Invalid fields ${options.validate.errors?.join(', ')}`));
			}
			console.log('returnResult from getUploadFormData');
			console.log(file);
		});
		if (!uploadedFile) {
			console.log('error from getUploadFormData uploadedfile');
			return returnError(new MeteorError('No file uploaded'));
		}
		// if (options.validate !== undefined && !options.validate(fields)) {
		// 	console.log("error from getUploadFormData", options.validate.errors?.join(', '));
		// 	return returnError(new MeteorError(`Invalid fields ${options.validate.errors?.join(', ')}`));
		// }
		console.log('return very last Result from getUploadFormData ');

		// if (uploadedArray.length > 0) {
		// 	const validResults = uploadedArray.filter((result): result is UploadResult<K> => result !== undefined);
		// 	return returnResult(validResults);
		// }
		// if(uploadedArray.length > 0) {
		// 	return returnResult(uploadedArray);
		// }
		// console.log(uploadedFile);
		if (uploadedArray.length < 1) {
			return returnError(new MeteorError('No file uploaded'));
		}
		console.log('return result from the getuploadformdata ' + uploadedArray[0]);
		return returnResult(uploadedArray);
	}

	function onFile(
		fieldname: string,
		file: Readable & { truncated: boolean },
		{ filename, encoding, mimeType: mimetype }: { filename: string; encoding: string; mimeType: string },
	) {
		// here only single file comes in the array format
		console.log(`onFile: ${fieldname}, ${filename}, ${encoding}, ${mimetype}`);
		console.log('file from getuploadformdata', file);

		console.log('key value form the onfile in gertuploadformdata', file, filename);
		if (options.field && fieldname !== options.field) {
			file.resume();
			return returnError(new MeteorError('invalid-field'));
		}
		console.log('from onfield ');
		const fileChunks: Uint8Array[] = [];
		file.on('data', (chunk) => {
			fileChunks.push(chunk);
			// console.log("chunks here");
		});
		console.log('made chunks from getuploadformdata.ts ' + fileChunks);

		file.on('end', () => {
			if (file.truncated) {
				fileChunks.length = 0;
				return returnError(new MeteorError('error-file-too-large'));
			}

			uploadedFile = {
				file,
				filename,
				encoding,
				mimetype,
				fieldname,
				fields,
				fileBuffer: Buffer.concat(fileChunks),
			};
			console.log('inside onend from getuploadformdata.ts' + uploadedFile);
			uploadedArray.push(uploadedFile);
			console.log(uploadedArray.length);
		});
	}

	function cleanup() {
		request.unpipe(bb);
		request.on('readable', request.read.bind(request));
		bb.removeAllListeners();
	}

	bb.on('field', onField);
	bb.on('file', onFile);
	bb.on('close', cleanup);
	bb.on('end', onEnd);
	bb.on('finish', onEnd);
	bb.on('error', (err: Error) => {
		console.log('bb error', err);
		returnError(err);
	});

	bb.on('partsLimit', () => {
		console.log('bb partsLimit');
		returnError();
	});
	bb.on('filesLimit', () => {
		returnError(`Just ${limits.files} file is allowed`);
	});
	bb.on('fieldsLimit', () => {
		console.log('bb fieldsLimit');
		returnError();
	});

	request.pipe(bb);

	return new Promise((resolve, reject) => {
		returnResult = resolve;
		returnError = reject;
	});
}
