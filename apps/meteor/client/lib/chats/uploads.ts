import type { IMessage, IRoom } from '@rocket.chat/core-typings';
import { Emitter } from '@rocket.chat/emitter';
import { Random } from '@rocket.chat/random';

import { UserAction, USER_ACTIVITIES } from '../../../app/ui/client/lib/UserAction';
import { sdk } from '../../../app/utils/client/lib/SDKClient';
import { getErrorMessage } from '../errorHandling';
import type { UploadsAPI } from './ChatAPI';
import type { Upload } from './Upload';

let uploads: readonly Upload[] = [];

const emitter = new Emitter<{ update: void; [x: `cancelling-${Upload['id']}`]: void }>();

const updateUploads = (update: (uploads: readonly Upload[]) => readonly Upload[]): void => {
	console.log('updateupload from uploads', uploads);
	uploads = update(uploads);
	console.log('updateupload from uploads', uploads);
	emitter.emit('update');
};

const get = (): readonly Upload[] => {
	console.log('get from Uploads.ts:', uploads);
	return uploads;
};

const subscribe = (callback: () => void): (() => void) => emitter.on('update', callback);

const cancel = (id: Upload['id']): void => {
	emitter.emit(`cancelling-${id}`);
};

const wipeFailedOnes = (): void => {
	updateUploads((uploads) => uploads.filter((upload) => !upload.error));
};

const send = async (
	file: File[],
	{
		description,
		msg,
		rid,
		tmid,
		t,
		e2e,
	}: {
		description?: string;
		msg?: string;
		rid: string;
		tmid?: string;
		t?: IMessage['t'];
		e2e?: IMessage['e2e'];
	},
): Promise<void> => {
	console.log('send from uploads.ts', file);

	if (!Array.isArray(file)) {
		file = [file]; // Convert single file to an array if it's not already
	}
	console.log('converted to array file from uploads.ts', file);

	// const uploadPromises = file.map(async (files) => {
	const id = Random.id();
	console.log(
		'uploadPromises from uploads.ts',
		' file ' + file + ' id ' + id,
		+' rid ' + rid + ' tmid ' + tmid + ' description ' + description + ' msg ' + msg,
	);
	console.log('file', file);
	updateUploads((uploads) => [
		...uploads,
		{
			id,
			file,
			name: file[0].name,
			percentage: 0,
		},
	]);
	let ans;
	try {
		const ans = await new Promise((resolve, reject) => {
			// Ensure 'await' is used with 'new Promise'
			const xhr = sdk.rest.upload(
				`/v1/rooms.upload/${rid}`,
				{
					msg,
					tmid,
					file,
					description,
					t,
					e2e,
				},
				{
					load: (event) => {
						console.log('Upload load event from uploads.ts:', event);
						resolve(event); // Resolve the promise when the upload is loaded
					},
					progress: (event) => {
						console.log('Upload progress event from uploads.ts:', event);
						if (!event.lengthComputable) {
							return;
						}
						const progress = (event.loaded / event.total) * 100;
						if (progress === 100) {
							return;
						}
						updateUploads((uploads) =>
							uploads.map((upload) => {
								if (upload.id !== id) {
									console.log('id not match from uploads.ts:', upload.id, id);
									return upload;
								}
								console.log('Upload updateupload event from uploads.ts:', upload);

								return {
									...upload,
									percentage: Math.round(progress) || 0,
								};
							}),
						);
					},
					error: (event) => {
						console.error('Upload error event:', event);
						updateUploads((uploads) =>
							uploads.map((upload) => {
								if (upload.id !== id) {
									return upload;
								}

								return {
									...upload,
									percentage: 0,
									error: new Error(xhr.responseText),
								};
							}),
						);
						reject(event); // Reject the promise in case of an error
					},
				},
			);

			if (uploads.length) {
				UserAction.performContinuously(rid, USER_ACTIVITIES.USER_UPLOADING, { tmid });
			}
			console.log('xhr from uploads.ts' + xhr);
			emitter.once(`cancelling-${id}`, () => {
				xhr.abort();
				updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
			});
		});

		// Update uploads if needed
		updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
	} catch (error: unknown) {
		// Handle errors
		updateUploads((uploads) =>
			uploads.map((upload) => {
				if (upload.id !== id) {
					return upload;
				}

				return {
					...upload,
					percentage: 0,
					error: new Error(getErrorMessage(error)),
				};
			}),
		);
	} finally {
		// Perform cleanup actions
		if (!uploads.length) {
			console.log('STOP upload from uploads.ts:');
			UserAction.stop(rid, USER_ACTIVITIES.USER_UPLOADING, { tmid });
		}
	}

	// try {
	// 	ans = await new Promise((resolve, reject) => {
	// 		const xhr = sdk.rest.upload(
	// 			`/v1/rooms.upload/${rid}`,
	// 			{
	// 				msg,
	// 				tmid,
	// 				file,
	// 				description,
	// 			},
	// 			{
	// 				load: (event) => {
	// 					console.log('Upload load event from uploads.ts:', event);
	// 					resolve(event);
	// 				},
	// 				progress: (event) => {
	// 					console.log('Upload progress event from uploads.ts:', event);
	// 					if (!event.lengthComputable) {
	// 						return;
	// 					}
	// 					const progress = (event.loaded / event.total) * 100;
	// 					if (progress === 100) {
	// 						return;
	// 					}

	// 					updateUploads((uploads) =>
	// 						uploads.map((upload) => {
	// 							if (upload.id !== id) {
	// 								console.log('id not match from uploads.ts:', upload.id, id);
	// 								return upload;
	// 							}
	// 							console.log('Upload updateupload event from uploads.ts:', upload);

	// 							return {
	// 								...upload,
	// 								percentage: Math.round(progress) || 0,
	// 							};
	// 						}),
	// 					);
	// 				},
	// 				error: (event) => {
	// 					console.error('Upload error event:', event);
	// 					updateUploads((uploads) =>
	// 						uploads.map((upload) => {
	// 							if (upload.id !== id) {
	// 								return upload;
	// 							}

	// 							return {
	// 								...upload,
	// 								percentage: 0,
	// 								error: new Error(xhr.responseText),
	// 							};
	// 						}),
	// 					);
	// 					reject(event);
	// 				},
	// 			},
	// 		);

	// 		if (uploads.length) {
	// 			UserAction.performContinuously(rid, USER_ACTIVITIES.USER_UPLOADING, { tmid });
	// 		}
	// 		console.log('xhr from uploads.ts' + xhr);
	// 		emitter.once(`cancelling-${id}`, () => {
	// 			xhr.abort();
	// 			updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
	// 		});
	// 	});

	// 	{
	// 		// await new Promise((resolve, reject) => {
	// 		// 	const xhr = sdk.rest.upload(
	// 		// 		`/v1/rooms.upload/${rid}`,
	// 		// 		{
	// 		// 			msg,
	// 		// 			tmid,
	// 		// 			file,
	// 		// 			description,
	// 		// 		},
	// 		// 		{
	// 		// 			load: (event) => {
	// 		// 				resolve(event);
	// 		// 			},
	// 		// 			progress: (event) => {
	// 		// 				if (!event.lengthComputable) {
	// 		// 					return;
	// 		// 				}
	// 		// 				const progress = (event.loaded / event.total) * 100;
	// 		// 				if (progress === 100) {
	// 		// 					return;
	// 		// 				}
	// 		// 				updateUploads((uploads) =>
	// 		// 					uploads.map((upload) => {
	// 		// 						if (upload.id !== id) {
	// 		// 							return upload;
	// 		// 						}
	// 		// 						return {
	// 		// 							...upload,
	// 		// 							percentage: Math.round(progress) || 0,
	// 		// 						};
	// 		// 					}),
	// 		// 				);
	// 		// 			},
	// 		// 			error: (event) => {
	// 		// 				updateUploads((uploads) =>
	// 		// 					uploads.map((upload) => {
	// 		// 						if (upload.id !== id) {
	// 		// 							return upload;
	// 		// 						}
	// 		// 						return {
	// 		// 							...upload,
	// 		// 							percentage: 0,
	// 		// 							error: new Error(xhr.responseText),
	// 		// 						};
	// 		// 					}),
	// 		// 				);
	// 		// 				reject(event);
	// 		// 			},
	// 		// 		},
	// 		// 	);
	// 		// 	if (uploads.length) {
	// 		// 		UserAction.performContinuously(rid, USER_ACTIVITIES.USER_UPLOADING, { tmid });
	// 		// 	}
	// 		// 	emitter.once(`cancelling-${id}`, () => {
	// 		// 		xhr.abort();
	// 		// 		updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
	// 		// 	});
	// 		// });
	// 	}

	// 	updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
	// } catch (error: unknown) {
	// 	updateUploads((uploads) =>
	// 		uploads.map((upload) => {
	// 			if (upload.id !== id) {
	// 				return upload;
	// 			}

	// 			return {
	// 				...upload,
	// 				percentage: 0,
	// 				error: new Error(getErrorMessage(error)),
	// 			};
	// 		}),
	// 	);
	// } finally {
	// 	if (!uploads.length) {
	// 		console.log('STOP upload from uploads.ts:');
	// 		UserAction.stop(rid, USER_ACTIVITIES.USER_UPLOADING, { tmid });
	// 	}
	// }
	// });

	// const ans = await Promise.all(uploadPromises);
	console.log('All uploads completed', ans);

	// Add console.log statement here
	console.log('All uploads completed');
};

// {
// const send = async (
// 	file: File[],
// 	{
// 		description,
// 		msg,
// 		rid,
// 		tmid,
// 	}: {
// 		description?: string;
// 		msg?: string;
// 		rid: string;
// 		tmid?: string;
// 	},
// ): Promise<void> => {
// 	const id = Random.id();

// 	updateUploads((uploads) => [
// 		...uploads,
// 		{
// 			id,
// 			name: file.name,
// 			percentage: 0,
// 		},
// 	]);

// 	try {
// 		await new Promise((resolve, reject) => {
// 			const xhr = sdk.rest.upload(
// 				`/v1/rooms.upload/${rid}`,
// 				{
// 					msg,
// 					tmid,
// 					file,
// 					description,
// 				},
// 				{
// 					load: (event) => {
// 						resolve(event);
// 					},
// 					progress: (event) => {
// 						if (!event.lengthComputable) {
// 							return;
// 						}
// 						const progress = (event.loaded / event.total) * 100;
// 						if (progress === 100) {
// 							return;
// 						}

// 						updateUploads((uploads) =>
// 							uploads.map((upload) => {
// 								if (upload.id !== id) {
// 									return upload;
// 								}

// 								return {
// 									...upload,
// 									percentage: Math.round(progress) || 0,
// 								};
// 							}),
// 						);
// 					},
// 					error: (event) => {
// 						updateUploads((uploads) =>
// 							uploads.map((upload) => {
// 								if (upload.id !== id) {
// 									return upload;
// 								}

// 								return {
// 									...upload,
// 									percentage: 0,
// 									error: new Error(xhr.responseText),
// 								};
// 							}),
// 						);
// 						reject(event);
// 					},
// 				},
// 			);

// 			if (uploads.length) {
// 				UserAction.performContinuously(rid, USER_ACTIVITIES.USER_UPLOADING, { tmid });
// 			}

// 			emitter.once(`cancelling-${id}`, () => {
// 				xhr.abort();
// 				updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
// 			});
// 		});

// 		updateUploads((uploads) => uploads.filter((upload) => upload.id !== id));
// 	} catch (error: unknown) {
// 		updateUploads((uploads) =>
// 			uploads.map((upload) => {
// 				if (upload.id !== id) {
// 					return upload;
// 				}

// 				return {
// 					...upload,
// 					percentage: 0,
// 					error: new Error(getErrorMessage(error)),
// 				};
// 			}),
// 		);
// 	} finally {
// 		if (!uploads.length) {
// 			UserAction.stop(rid, USER_ACTIVITIES.USER_UPLOADING, { tmid });
// 		}
// 	}
// 	console.log("file upload done from uploads.ts");
// };
// }

export const createUploadsAPI = ({ rid, tmid }: { rid: IRoom['_id']; tmid?: IMessage['_id'] }): UploadsAPI => ({
	get,
	subscribe,
	wipeFailedOnes,
	cancel,
	send: (
		file: File[],
		{ description, msg, t, e2e }: { description?: string; msg?: string; t?: IMessage['t']; e2e?: IMessage['e2e'] },
	): Promise<void> => {
		console.log('File received in createUploadsAPI:', file); // Added console.log statement
		return send(file, { description, msg, rid, tmid });
	},
});

{
	// export const createUploadsAPI = ({ rid, tmid }: { rid: IRoom['_id']; tmid?: IMessage['_id'] }): UploadsAPI => ({
	// 	get,
	// 	subscribe,
	// 	wipeFailedOnes,
	// 	cancel,
	// 	send: (file: File[], { description, msg }: { description?: string; msg?: string }): Promise<void> => {
	// 		console.log('createUploadsAPI from uploads.ts', file); // Add console.log statement here
	// 		return send(file, { description, msg, rid, tmid });
	// 	},
	// });
}
{
	// export const createUploadsAPI = ({ rid, tmid }: { rid: IRoom['_id']; tmid?: IMessage['_id'] }): UploadsAPI => ({
	// 	get,
	// 	subscribe,
	// 	wipeFailedOnes,
	// 	cancel,
	// 	send: (file: File, { description, msg }: { description?: string; msg?: string }): Promise<void> =>
	// 		send(file, { description, msg, rid, tmid }),
	// });
}
