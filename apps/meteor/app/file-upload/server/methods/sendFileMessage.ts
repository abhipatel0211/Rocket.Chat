import type {
	MessageAttachment,
	FileAttachmentProps,
	IUser,
	IUpload,
	AtLeast,
	FilesAndAttachments,
	IMessage,
	FileProp,
	Dimensions,
	MessageAttachmentBase,
} from '@rocket.chat/core-typings';
import { Rooms, Uploads, Users } from '@rocket.chat/models';
import type { ServerMethods } from '@rocket.chat/ui-contexts';
import { Match, check } from 'meteor/check';
import { Meteor } from 'meteor/meteor';

import { callbacks } from '../../../../lib/callbacks';
import { getFileExtension } from '../../../../lib/utils/getFileExtension';
import { omit } from '../../../../lib/utils/omit';
import { SystemLogger } from '../../../../server/lib/logger/system';
import { canAccessRoomAsync } from '../../../authorization/server/functions/canAccessRoom';
import { executeSendMessage } from '../../../lib/server/methods/sendMessage';
import { FileUpload } from '../lib/FileUpload';

function validateFileRequiredFields(file: Partial<IUpload>): asserts file is AtLeast<IUpload, '_id' | 'name' | 'type' | 'size'> {
	const requiredFields = ['_id', 'name', 'type', 'size'];
	console.log('requiredFields from sendFileMessage' + requiredFields);
	console.log('file from sendFileMessage required' + file + ' file_id ' + file._id);
	requiredFields.forEach((field) => {
		if (!Object.keys(file).includes(field)) {
			console.log('error from sendFileMessage required' + file + ' file_id ' + file._id);
			throw new Meteor.Error('error-invalid-file', 'Invalid file');
		}
	});
}

export const parseFileIntoMessageAttachments = async (
	filearr: Partial<IUpload>[] | Partial<IUpload>,
	roomId: string,
	user: IUser,
): Promise<FilesAndAttachments> => {
	console.log('parseFileIntoMessageAttachments from sendFileMessage', filearr + ' roomid ' + roomId + ' user ' + user);
	// file.forEach((f) => validateFileRequiredFields(f));
	// validateFileRequiredFields(file);
	const attachments: {
		type: 'file';
	}[] &
		{
			image_dimensions?: Dimensions | undefined;
			image_preview?: string | undefined;
			image_url: string;
			image_type?: string | undefined;
			image_size?: number | undefined;
			file?: FileProp | undefined;
		}[] &
		MessageAttachmentBase &
		MessageAttachment[] = [];

	let files: FileProp[] = [];
	const fileupload = async (file: Partial<IUpload>) => {
		validateFileRequiredFields(file);

		console.log('file._id from the sendFileMessage' + file._id + ' user._id ' + user._id + ' file.name ' + file.name);
		await Uploads.updateFileComplete(file._id, user._id, omit(file, '_id'));

		const fileUrl = FileUpload.getPath(`${file._id}/${encodeURI(file.name || '')}`);
		console.log('fileUrl from sendFileMessage' + fileUrl);

		console.log('file._id from the sendFileMessage' + file._id + ' user._id ' + user._id + ' file.name ' + file.name);

		const filesArr = [
			{
				_id: file._id,
				name: file.name || '',
				type: file.type || 'file',
				size: file.size || 0,
				format: file.identify?.format || '',
			},
		];

		console.log('files from sendFileMessage' + filesArr[0].name);

		if (/^image\/.+/.test(file.type as string)) {
			const attachment: FileAttachmentProps = {
				title: file.name,
				type: 'file',
				description: file?.description,
				title_link: fileUrl,
				title_link_download: true,
				image_url: fileUrl,
				image_type: file.type as string,
				image_size: file.size,
				image_dimensions: file.identify?.size,
			};
			console.log('attachment from sendFileMessage' + attachment.title + ' attachment.image_url ' + attachment.image_url);
			if (file.identify?.size) {
				attachment.image_dimensions = file.identify.size;
			}

			try {
				attachment.image_preview = await FileUpload.resizeImagePreview(file);
				const thumbResult = await FileUpload.createImageThumbnail(file);
				console.log('thumbResult from sendFileMessage from try' + thumbResult);
				console.log('attachement.image_preview from sendFileMessage' + attachment.image_preview);
				if (thumbResult) {
					const { data: thumbBuffer, width, height, thumbFileType, thumbFileName, originalFileId } = thumbResult;
					const thumbnail = await FileUpload.uploadImageThumbnail(
						{
							thumbFileName,
							thumbFileType,
							originalFileId,
						},
						thumbBuffer,
						roomId,
						user._id,
					);
					console.log(`file from sendFileMessage thumburl  ${thumbnail._id}/${encodeURI(file.name || '')}`);
					const thumbUrl = FileUpload.getPath(`${thumbnail._id}/${encodeURI(file.name || '')}`);
					console.log('thumbUrl from sendFileMessage' + thumbUrl + ' thumbnail._id ' + thumbnail._id);
					attachment.image_url = thumbUrl;
					attachment.image_type = thumbnail.type;
					attachment.image_dimensions = {
						width,
						height,
					};
					// console.log("attachment.image_url from sendFileMessage"+attachment.image_url+" attachment.image_type "+attachment.image_type + " attachment.image_dimensions "+JSON.stringify(attachment.image_dimensions));

					console.log(
						'file push from sendFileMessage id ' +
							thumbnail._id +
							' thumbnail.name ' +
							thumbnail.name +
							' thumbnail.type ' +
							thumbnail.type +
							' thumbnail.size ' +
							thumbnail.size +
							' thumbnail.identify.format ' +
							thumbnail.identify?.format,
					);
					filesArr.push({
						_id: thumbnail._id,
						name: thumbnail.name || '',
						type: thumbnail.type || 'file',
						size: thumbnail.size || 0,
						format: thumbnail.identify?.format || '',
					});
					console.log('size of filesarr from sendFileMessage' + filesArr.length);
				}
			} catch (e) {
				console.log('here in error from sendFileMessage' + e);
				SystemLogger.error(e);
			}
			// console.log("attachment.image_url from sendFileMessage"+attachment.image_url+" attachment.image_type "+attachment.image_type + " attachment.image_dimensions "+JSON.stringify(attachment.image_dimensions));
			attachments.push(attachment);
			console.log('size of attachments from sendFileMessage' + attachments.length);
		} else if (/^audio\/.+/.test(file.type as string)) {
			const attachment: FileAttachmentProps = {
				title: file.name,
				type: 'file',
				description: file.description,
				title_link: fileUrl,
				title_link_download: true,
				audio_url: fileUrl,
				audio_type: file.type as string,
				audio_size: file.size,
			};
			attachments.push(attachment);
		} else if (/^video\/.+/.test(file.type as string)) {
			const attachment: FileAttachmentProps = {
				title: file.name,
				type: 'file',
				description: file.description,
				title_link: fileUrl,
				title_link_download: true,
				video_url: fileUrl,
				video_type: file.type as string,
				video_size: file.size as number,
			};
			attachments.push(attachment);
		} else {
			const attachment = {
				title: file.name,
				type: 'file',
				format: getFileExtension(file.name),
				description: file.description,
				title_link: fileUrl,
				title_link_download: true,
				size: file.size as number,
			};
			attachments.push(attachment);
			// attachments.push(attachment);
		}
		filesArr.forEach(async (f) => {
			console.log('file._id from the sendFileMessage' + f._id + ' user._id ' + user._id + ' file.name ' + f.name);
			files.push(f);
		});
	};

	if (Array.isArray(filearr)) {
		filearr.forEach(async (file) => {
			fileupload(file);
		});
	} else {
		fileupload(filearr);
	}

	// let fileupload = async (file: Partial<IUpload>) => {
	// 	validateFileRequiredFields(file);

	// console.log("file._id from the sendFileMessage" + file._id + " user._id "+ user._id + " file.name "+ file.name);
	// await Uploads.updateFileComplete(file._id, user._id, omit(file, '_id'));

	// const fileUrl = FileUpload.getPath(`${file._id}/${encodeURI(file.name || '')}`);
	// console.log("fileUrl from sendFileMessage"+fileUrl);

	// console.log("file._id from the sendFileMessage" + file._id + " user._id "+ user._id + " file.name "+ file.name);

	// const filesArr = [
	// 	{
	// 		_id: file._id,
	// 		name: file.name || '',
	// 		type: file.type || 'file',
	// 		size: file.size || 0,
	// 		format: file.identify?.format || '',
	// 	}
	// ];

	// console.log("files from sendFileMessage"+filesArr[0].name);

	// if (/^image\/.+/.test(file.type as string)) {
	// 	const attachment: FileAttachmentProps = {
	// 		title: file.name,
	// 		type: 'file',
	// 		description: file?.description,
	// 		title_link: fileUrl,
	// 		title_link_download: true,
	// 		image_url: fileUrl,
	// 		image_type: file.type as string,
	// 		image_size: file.size,
	// 		image_dimensions: file.identify?.size,

	// 	};
	// 	console.log("attachment from sendFileMessage"+attachment.title+" attachment.image_url "+attachment.image_url);
	// 	if (file.identify?.size) {
	// 		attachment.image_dimensions = file.identify.size;
	// 	}

	// 	try {
	// 		attachment.image_preview = await FileUpload.resizeImagePreview(file);
	// 		const thumbResult = await FileUpload.createImageThumbnail(file);
	// 		console.log("thumbResult from sendFileMessage from try"+thumbResult);
	// 		console.log("attachement.image_preview from sendFileMessage"+attachment.image_preview);
	// 		if (thumbResult) {
	// 			const { data: thumbBuffer, width, height, thumbFileType, thumbFileName, originalFileId } = thumbResult;
	// 			const thumbnail = await FileUpload.uploadImageThumbnail(
	// 				{
	// 					thumbFileName,
	// 					thumbFileType,
	// 					originalFileId,
	// 				},
	// 				thumbBuffer,
	// 				roomId,
	// 				user._id,
	// 			);
	// 			console.log(`file from sendFileMessage thumburl  ${thumbnail._id}/${encodeURI(file.name || '')}`);
	// 			const thumbUrl = FileUpload.getPath(`${thumbnail._id}/${encodeURI(file.name || '')}`);
	// 			console.log("thumbUrl from sendFileMessage"+thumbUrl+" thumbnail._id "+thumbnail._id);
	// 			attachment.image_url = thumbUrl;
	// 			attachment.image_type = thumbnail.type;
	// 			attachment.image_dimensions = {
	// 				width,
	// 				height,
	// 			};
	// 			// console.log("attachment.image_url from sendFileMessage"+attachment.image_url+" attachment.image_type "+attachment.image_type + " attachment.image_dimensions "+JSON.stringify(attachment.image_dimensions));

	// 			console.log("file push from sendFileMessage id " +thumbnail._id + " thumbnail.name "+thumbnail.name+" thumbnail.type "+thumbnail.type+" thumbnail.size "+thumbnail.size+" thumbnail.identify.format "+thumbnail.identify?.format);
	// 			filesArr.push({
	// 				_id: thumbnail._id,
	// 				name: thumbnail.name || '',
	// 				type: thumbnail.type || 'file',
	// 				size: thumbnail.size || 0,
	// 				format: thumbnail.identify?.format || '',
	// 			});
	// 			console.log("size of filesarr from sendFileMessage"+filesArr.length);
	// 		}
	// 	} catch (e) {
	// 		console.log("here in error from sendFileMessage"+e);
	// 		SystemLogger.error(e);
	// 	}
	// 	// console.log("attachment.image_url from sendFileMessage"+attachment.image_url+" attachment.image_type "+attachment.image_type + " attachment.image_dimensions "+JSON.stringify(attachment.image_dimensions));
	// 	attachments.push(attachment);
	// 	console.log("size of attachments from sendFileMessage"+attachments.length);
	// } else if (/^audio\/.+/.test(file.type as string)) {
	// 	const attachment: FileAttachmentProps = {
	// 		title: file.name,
	// 		type: 'file',
	// 		description: file.description,
	// 		title_link: fileUrl,
	// 		title_link_download: true,
	// 		audio_url: fileUrl,
	// 		audio_type: file.type as string,
	// 		audio_size: file.size,
	// 	};
	// 	attachments.push(attachment);
	// } else if (/^video\/.+/.test(file.type as string)) {
	// 	const attachment: FileAttachmentProps = {
	// 		title: file.name,
	// 		type: 'file',
	// 		description: file.description,
	// 		title_link: fileUrl,
	// 		title_link_download: true,
	// 		video_url: fileUrl,
	// 		video_type: file.type as string,
	// 		video_size: file.size as number,
	// 	};
	// 	attachments.push(attachment);
	// } else {
	// 	const attachment = {
	// 		title: file.name,
	// 		type: 'file',
	// 		format: getFileExtension(file.name),
	// 		description: file.description,
	// 		title_link: fileUrl,
	// 		title_link_download: true,
	// 		size: file.size as number,
	// 	};
	// 	attachments.push(attachment);
	// 	// attachments.push(attachment);
	// }
	// filesArr.forEach(async(f) => {
	// 	console.log("file._id from the sendFileMessage" + f._id + " user._id "+ user._id + " file.name "+ f.name);
	// 	files.push(f);
	// })
	// }

	// console.log("file from sendFileMessage after validation" + file );
	// if(Array.isArray(file)){
	// 	console.log("file from sendFileMessage after validation length" + file?.length );
	// }
	// console.log("file._id from the sendFileMessage" + file._id + " user._id "+ user._id + " file.name "+ file.name);
	// await Uploads.updateFileComplete(file._id, user._id, omit(file, '_id'));

	// const fileUrl = FileUpload.getPath(`${file._id}/${encodeURI(file.name || '')}`);
	// console.log("fileUrl from sendFileMessage"+fileUrl);

	// console.log("file._id from the sendFileMessage" + file._id + " user._id "+ user._id + " file.name "+ file.name);

	// const attachments: MessageAttachment[] = [];

	// const files = [
	// 	{
	// 		_id: file._id,
	// 		name: file.name || '',
	// 		type: file.type || 'file',
	// 		size: file.size || 0,
	// 		format: file.identify?.format || '',
	// 	},
	// ];

	// if (/^image\/.+/.test(file.type as string)) {
	// 	const attachment: FileAttachmentProps = {
	// 		title: file.name,
	// 		type: 'file',
	// 		description: file?.description,
	// 		title_link: fileUrl,
	// 		title_link_download: true,
	// 		image_url: fileUrl,
	// 		image_type: file.type as string,
	// 		image_size: file.size,
	// 	};

	// 	if (file.identify?.size) {
	// 		attachment.image_dimensions = file.identify.size;
	// 	}

	// 	try {
	// 		attachment.image_preview = await FileUpload.resizeImagePreview(file);
	// 		const thumbResult = await FileUpload.createImageThumbnail(file);
	// 		if (thumbResult) {
	// 			const { data: thumbBuffer, width, height, thumbFileType, thumbFileName, originalFileId } = thumbResult;
	// 			const thumbnail = await FileUpload.uploadImageThumbnail(
	// 				{
	// 					thumbFileName,
	// 					thumbFileType,
	// 					originalFileId,
	// 				},
	// 				thumbBuffer,
	// 				roomId,
	// 				user._id,
	// 			);
	// 			const thumbUrl = FileUpload.getPath(`${thumbnail._id}/${encodeURI(file.name || '')}`);
	// 			attachment.image_url = thumbUrl;
	// 			attachment.image_type = thumbnail.type;
	// 			attachment.image_dimensions = {
	// 				width,
	// 				height,
	// 			};
	// 			files.push({
	// 				_id: thumbnail._id,
	// 				name: thumbnail.name || '',
	// 				type: thumbnail.type || 'file',
	// 				size: thumbnail.size || 0,
	// 				format: thumbnail.identify?.format || '',
	// 			});
	// 		}
	// 	} catch (e) {
	// 		SystemLogger.error(e);
	// 	}
	// 	attachments.push(attachment);
	// } else if (/^audio\/.+/.test(file.type as string)) {
	// 	const attachment: FileAttachmentProps = {
	// 		title: file.name,
	// 		type: 'file',
	// 		description: file.description,
	// 		title_link: fileUrl,
	// 		title_link_download: true,
	// 		audio_url: fileUrl,
	// 		audio_type: file.type as string,
	// 		audio_size: file.size,
	// 	};
	// 	attachments.push(attachment);
	// } else if (/^video\/.+/.test(file.type as string)) {
	// 	const attachment: FileAttachmentProps = {
	// 		title: file.name,
	// 		type: 'file',
	// 		description: file.description,
	// 		title_link: fileUrl,
	// 		title_link_download: true,
	// 		video_url: fileUrl,
	// 		video_type: file.type as string,
	// 		video_size: file.size as number,
	// 	};
	// 	attachments.push(attachment);
	// } else {
	// 	const attachment = {
	// 		title: file.name,
	// 		type: 'file',
	// 		format: getFileExtension(file.name),
	// 		description: file.description,
	// 		title_link: fileUrl,
	// 		title_link_download: true,
	// 		size: file.size as number,
	// 	};
	// 	attachments.push(attachment);
	// 	attachments.push(attachment);
	// 	attachments.push(attachment);
	// 	// attachments.push(attachment);
	// }

	return { files, attachments };
};

declare module '@rocket.chat/ui-contexts' {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	interface ServerMethods {
		sendFileMessage: (roomId: string, _store: string, file: Partial<IUpload>[], msgData?: Record<string, any>) => boolean;
	}
}

export const sendFileMessage = async (
	userId: string,
	{
		roomId,
		file,
		msgData,
	}: {
		roomId: string;
		file: Partial<IUpload>[];
		msgData?: Record<string, any>;
	},
): Promise<boolean> => {
	const user = await Users.findOneById(userId);
	if (!user) {
		throw new Meteor.Error('error-invalid-user', 'Invalid user', {
			method: 'sendFileMessage',
		} as any);
	}

	const room = await Rooms.findOneById(roomId);
	if (!room) {
		return false;
	}

	if (user?.type !== 'app' && !(await canAccessRoomAsync(room, user))) {
		return false;
	}

	check(
		msgData,
		Match.Maybe({
			avatar: Match.Optional(String),
			emoji: Match.Optional(String),
			alias: Match.Optional(String),
			groupable: Match.Optional(Boolean),
			msg: Match.Optional(String),
			tmid: Match.Optional(String),
			customFields: Match.Optional(String),
			t: Match.Optional(String),
			e2e: Match.Optional(String),
		}),
	);

	if (!file) {
		console.log('no file from sendFileMessage');
	}
	console.log('file found from sendFileMessage', file);
	console.log('file LENGTH  from sendFileMessage', file.length);

	console.log('user found and file user and roomid sended to parsefileintomessage attachments');
	const { files, attachments } = await parseFileIntoMessageAttachments(file, roomId, user);
	console.log('attachments from sendFileMessage' + attachments);
	// file.forEach((file)=>{

	// })

	const msg = await executeSendMessage(userId, {
		rid: roomId,
		ts: new Date(),
		file: files[0],
		files,
		attachments,
		...(msgData as Partial<IMessage>),
		...(msgData?.customFields && { customFields: JSON.parse(msgData.customFields) }),
		msg: msgData?.msg ?? '',
		groupable: msgData?.groupable ?? false,
	});

	callbacks.runAsync('afterFileUpload', { user, room, message: msg });

	return msg;
};

Meteor.methods<ServerMethods>({
	async sendFileMessage(roomId, _store, file, msgData = {}) {
		console.log('file from sendFileMessage and metoeor methods ' + file);
		const userId = Meteor.userId();
		if (!userId) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', {
				method: 'sendFileMessage',
			} as any);
		}

		return sendFileMessage(userId, { roomId, file, msgData });
	},
});
