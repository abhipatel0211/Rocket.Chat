import { isRoomFederated } from '@rocket.chat/core-typings';

import { fileUploadIsValidContentType } from '../../../../app/utils/client';
import FileUploadModal from '../../../views/room/modals/FileUploadModal';
import { imperativeModal } from '../../imperativeModal';
import { prependReplies } from '../../utils/prependReplies';
import type { ChatAPI } from '../ChatAPI';

export const uploadFiles = async (chat: ChatAPI, files: readonly File[], resetFileInput?: () => void): Promise<void> => {
	console.log('uploadFiles', files, chat);
	console.log('uploadFiles');
	const replies = chat.composer?.quotedMessages.get() ?? [];
	console.log(replies);
	const msg = await prependReplies('', replies);
	console.log(msg);
	const room = await chat.data.getRoom();
	console.log(room);
	const queue = [...files];
	const uploadNextFile = (): void => {
		const file = queue[0];

		if (!file) {
			chat.composer?.dismissAllQuotedMessages();
			return;
		}
		console.log('uploadNextFile', file);
		imperativeModal.open({
			component: FileUploadModal,
			props: {
				queue,
				msg,
				chat,
				file,
				fileName: file.name,
				fileDescription: chat.composer?.text ?? '',
				showDescription: room && !isRoomFederated(room),
				onClose: (): void => {
					imperativeModal.close();
					// uploadNextFile();
				},
				onSubmit: (fileName: string, description?: string): void => {
					// console.log('onSubmit', fileName, description);
					Object.defineProperty(file, 'name', {
						writable: true,
						value: fileName,
					});
					chat.uploads.send(queue, {
						description,
						msg,
					});
					chat.composer?.clear();
					imperativeModal.close();
					// uploadNextFile();
				},
				invalidContentType: !(file.type && fileUploadIsValidContentType(file.type)),
			},
		});
	};

	uploadNextFile();
	// }
	resetFileInput?.();
};
