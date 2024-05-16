import { ServiceClassInternal } from '@rocket.chat/core-services';
import type { ISendFileLivechatMessageParams, ISendFileMessageParams, IUploadFileParams, IUploadService } from '@rocket.chat/core-services';
import type { IUpload, IUser, FilesAndAttachments } from '@rocket.chat/core-typings';

import { FileUpload } from '../../../app/file-upload/server';
import { parseFileIntoMessageAttachments, sendFileMessage } from '../../../app/file-upload/server/methods/sendFileMessage';
import { sendFileLivechatMessage } from '../../../app/livechat/server/methods/sendFileLivechatMessage';

export class UploadService extends ServiceClassInternal implements IUploadService {
	protected name = 'upload';

	async uploadFile({ buffer, details }: IUploadFileParams): Promise<IUpload> {
		const fileStore = FileUpload.getStore('Uploads');
		console.log('uploadFile from service.ts', fileStore);
		return fileStore.insert(details, buffer);
	}

	async sendFileMessage({ roomId, file, userId, message }: ISendFileMessageParams): Promise<boolean | undefined> {
		console.log('sendFileMessage from service.ts', file + ' roomid ' + roomId + ' userId ' + userId + ' message ' + message);
		return sendFileMessage(userId, { roomId, file, msgData: message });
	}

	async sendFileLivechatMessage({ roomId, visitorToken, file, message }: ISendFileLivechatMessageParams): Promise<boolean> {
		console.log(
			'sendFileLivechatMessage from service.ts',
			file + ' roomid ' + roomId + ' visitorToken ' + visitorToken + ' message ' + message,
		);
		return sendFileLivechatMessage({ roomId, visitorToken, file, msgData: message });
	}

	async getFileBuffer({ file }: { file: IUpload }): Promise<Buffer> {
		const buffer = await FileUpload.getBuffer(file);
		console.log('getFileBuffer from service.ts', buffer);
		if (!(buffer instanceof Buffer)) {
			throw new Error('Unknown error');
		}
		return buffer;
	}

	async extractMetadata(file: IUpload): Promise<{ height?: number; width?: number; format?: string }> {
		console.log('extractMetadata from service.ts', file);
		return FileUpload.extractMetadata(file);
	}

	async parseFileIntoMessageAttachments(file: Partial<IUpload>, roomId: string, user: IUser): Promise<FilesAndAttachments> {
		console.log('parseFileIntoMessageAttachments from service.ts', file + ' roomid ' + roomId + ' user ' + user);
		return parseFileIntoMessageAttachments(file, roomId, user);
	}
}
