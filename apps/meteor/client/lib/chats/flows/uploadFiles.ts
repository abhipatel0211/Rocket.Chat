import type { IMessage } from '@rocket.chat/core-typings';
import { isRoomFederated } from '@rocket.chat/core-typings';
import { Random } from '@rocket.chat/random';

import { e2e } from '../../../../app/e2e/client';
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
	let queue = [...files];

	const uploadFile = (file: File[], description?: string, extraData?: Pick<IMessage, 't' | 'e2e'>) => {
		console.log('uploadFile from uploadFiles.ts ', file, description, extraData);
		chat.uploads.send(file, {
			description,
			msg,
			...extraData,
		});
		chat.composer?.clear();
		imperativeModal.close();
		// uploadNextFile();
	};

	const uploadNextFile = (): void => {
		const file = queue[0];

		const updateQueue = (updatedQueue: File[]) => {
			console.log('form updateQueue from uploadfiles.ts', updateQueue);
			queue = updatedQueue; // Update queue
			console.log('updated queue from uploadfiles.ts', queue);
		};

		if (!file) {
			chat.composer?.dismissAllQuotedMessages();
			return;
		}
		console.log('uploadNextFile', file);
		imperativeModal.open({
			component: FileUploadModal,
			props: {
				queue,
				updateQueue,
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
				onSubmit: async (fileName: string, description?: string): Promise<void> => {
					Object.defineProperty(file, 'name', {
						writable: true,
						value: fileName,
					});

					// encrypt attachment description
					const e2eRoom = await e2e.getInstanceByRoomId(room._id);

					if (!e2eRoom) {
						uploadFile(queue, description);
						return;
					}

					const shouldConvertSentMessages = e2eRoom.shouldConvertSentMessages({ msg });

					if (!shouldConvertSentMessages) {
						uploadFile(queue, description);
						return;
					}

					const encryptedDescription = await e2eRoom.encryptAttachmentDescription(description, Random.id());

					uploadFile(queue, encryptedDescription, { t: 'e2e', e2e: 'pending' });
				},
				invalidContentType: !(file.type && fileUploadIsValidContentType(file.type)),
			},
		});
	};

	uploadNextFile();
	// }
	resetFileInput?.();
};
