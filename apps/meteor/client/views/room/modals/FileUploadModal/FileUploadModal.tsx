import {
	Modal,
	Box,
	Field,
	FieldGroup,
	FieldLabel,
	FieldRow,
	FieldError,
	TextInput,
	Button,
	Scrollable,
	Tile,
	Icon,
} from '@rocket.chat/fuselage';
import { useAutoFocus } from '@rocket.chat/fuselage-hooks';
import { useToastMessageDispatch, useTranslation, useSetting } from '@rocket.chat/ui-contexts';
import fileSize from 'filesize';
import type { ReactElement, ChangeEvent, FormEventHandler, ComponentProps } from 'react';
import React, { memo, useState, useEffect } from 'react';

import FilePreview from './FilePreview';

type FileUploadModalProps = {
	onClose: () => void;
	queue?: File[];
	msg: any;
	chat: any;
	onSubmit: (name: string, description?: string) => void;
	file: File;
	fileName: string;
	fileDescription?: string;
	invalidContentType: boolean;
	showDescription?: boolean;
};

const FileUploadModal = ({
	onClose,
	queue = [],
	msg,
	chat,
	file,
	fileName,
	fileDescription,
	onSubmit,
	invalidContentType,
	showDescription = true,
}: FileUploadModalProps): ReactElement => {
	const [name, setName] = useState<string>(fileName);
	const [description, setDescription] = useState<string>(fileDescription || '');
	const t = useTranslation();
	const dispatchToastMessage = useToastMessageDispatch();
	const maxFileSize = useSetting('FileUpload_MaxFileSize') as number;

	const ref = useAutoFocus<HTMLInputElement>();

	const handleName = (e: ChangeEvent<HTMLInputElement>): void => {
		setName(e.currentTarget.value);
	};

	const handleDescription = (e: ChangeEvent<HTMLInputElement>): void => {
		setDescription(e.currentTarget.value);
	};
	const [que, setQue] = useState<File[]>([]); // Initialize your queue state

	const removeFromQue = (fileNameToRemove: string) => {
		setQue((prevQue) => prevQue.filter((file) => file.name !== fileNameToRemove));
	};
	const handleAddfile = () => {
		console.log('handleAddfile');
	};

	const handleSubmit: FormEventHandler<HTMLFormElement> = async (e): Promise<void> => {
		e.preventDefault();
		if (queue.length > 6) {
			dispatchToastMessage({
				type: 'error',
				message: "You can't upload more than 6 files at once",
				// message: t('error-the-field-is-required', { field: t('Name') }),
			});
			onClose();
			return;
		}

		// Iterate over each file in the queue
		for (const queuedFile of queue) {
			const { name: queuedFileName, size: queuedFileSize, type: queuedFileType } = queuedFile;

			// Validate file name
			if (!queuedFileName) {
				dispatchToastMessage({
					type: 'error',
					message: t('error-the-field-is-required', { field: t('Name') }),
				});
				return;
			}

			// Validate file size
			if (maxFileSize > -1 && (queuedFileSize || 0) > maxFileSize) {
				onClose();
				dispatchToastMessage({
					type: 'error',
					message: `${t('File_exceeds_allowed_size_of_bytes', { size: fileSize(maxFileSize) })}+" hello testing"`,
				});
				return;
			}

			// Validate file content type
			if (invalidContentType) {
				dispatchToastMessage({
					type: 'error',
					message: t('FileUpload_MediaType_NotAccepted__type__', { type: queuedFileType }),
				});
				onClose();
				return;
			}

			// Perform any necessary modifications or checks on the file
			// For example, can modify the file name or perform additional validation

			// Send the file using chat.uploads.send or any other relevant method
		}
		// await chat.uploads.send(queue, {
		// 	description,
		// 	msg, // Assuming msg is defined elsewhere
		// });

		// Clear the composer after each file submission
		// chat.composer?.clear();
		onSubmit(name, description);

		// Close the modal after all files are submitted
		// imperativeModal.close();
	};

	// const handleSubmit: FormEventHandler<HTMLFormElement> = (e): void => {
	// 	e.preventDefault();

	// 	// Validate each file in the queue and call onSubmit for each valid file
	// 	queue.forEach((queuedFile) => {
	// 		const { name: queuedFileName, size: queuedFileSize, type: queuedFileType } = queuedFile;

	// 		// Validate file name
	// 		if (!queuedFileName) {
	// 			dispatchToastMessage({
	// 				type: 'error',
	// 				message: t('error-the-field-is-required', { field: t('Name') }),
	// 			});
	// 			return;
	// 		}

	// 		// Validate file size
	// 		if (maxFileSize > -1 && (queuedFileSize || 0) > maxFileSize) {
	// 			onClose();
	// 			dispatchToastMessage({
	// 				type: 'error',
	// 				message: t('File_exceeds_allowed_size_of_bytes', { size: fileSize(maxFileSize) }),
	// 			});
	// 			return;
	// 		}

	// 		// Validate file content type
	// 		if (invalidContentType) {
	// 			dispatchToastMessage({
	// 				type: 'error',
	// 				message: t('FileUpload_MediaType_NotAccepted__type__', { type: queuedFileType }),
	// 			});
	// 			onClose();
	// 			return;
	// 		}

	// 		// Call onSubmit for valid file
	// 		onSubmit(queuedFileName, description);
	// 	});
	// };

	// const handleSubmit: FormEventHandler<HTMLFormElement> = (e): void => {
	// 	e.preventDefault();
	// 	console.log(queue);
	// 	console.log('submit', name, description);
	// 	if (!name) {
	// 		return dispatchToastMessage({
	// 			type: 'error',
	// 			message: t('error-the-field-is-required', { field: t('Name') }),
	// 		});
	// 	}
	// 	if (maxFileSize > -1 && (file.size || 0) > maxFileSize) {
	// 		onClose();
	// 		return dispatchToastMessage({
	// 			type: 'error',
	// 			message: t('File_exceeds_allowed_size_of_bytes', { size: fileSize(maxFileSize) }),
	// 		});
	// 	}

	// 	onSubmit(name, description);

	// 	queue.map((file) => {
	// 		console.log(file);
	// 		console.log('test');
	// 		console.log(file.name);
	// 		if (!file.name) {
	// 			return dispatchToastMessage({
	// 				type: 'error',
	// 				message: t('error-the-field-is-required', { field: t('Name') }),
	// 			});
	// 		}

	// 		// -1 maxFileSize means there is no limit
	// 		if (maxFileSize > -1 && (file.size || 0) > maxFileSize) {
	// 			onClose();
	// 			return dispatchToastMessage({
	// 				type: 'error',
	// 				message: t('File_exceeds_allowed_size_of_bytes', { size: fileSize(maxFileSize) }),
	// 			});
	// 		}

	// 		onSubmit(file.name, description);
	// 	});
	// };

	useEffect(() => {
		if (invalidContentType) {
			dispatchToastMessage({
				type: 'error',
				message: t('FileUpload_MediaType_NotAccepted__type__', { type: file.type }),
			});
			onClose();
			return;
		}

		if (file.size === 0) {
			dispatchToastMessage({
				type: 'error',
				message: t('FileUpload_File_Empty'),
			});
			onClose();
		}
	}, [file, dispatchToastMessage, invalidContentType, t, onClose]);

	console.log('fileupload model here from file', file, queue, queue.length);

	return (
		<Modal wrapperFunction={(props: ComponentProps<typeof Box>) => <Box is='form' onSubmit={handleSubmit} {...props} />}>
			<Box display='flex' flexDirection='column' height='100%'>
				<Modal.Header>
					<Modal.Title>{t('FileUpload')}</Modal.Title>
					<Modal.Close onClick={onClose} />
				</Modal.Header>
				<Modal.Content>
					<Scrollable vertical>
						<Tile padding='none'>{queue.length > 0 && queue.map((file) => <FilePreview key={file.name} file={file} />)}</Tile>
					</Scrollable>
					{/* <Scrollable vertical>
						<Tile padding='none' height={100}> */}

					{/* <FilePreview key={file.name} file={file} /> */}
					{/* {queue.length > 0 && queue.map((file) => <FilePreview key={file.name} file={file} />)} */}
					{/* <Box
								overflow={'scroll'}
								display='flex-col'
								justifyContent='center'
								alignContent='center'
								mbe={16}
								style={{ overflowY: 'scroll' }}
							>
								<FilePreview file={file} />
								<FilePreview file={file} />
								<FilePreview file={file} />
								<FilePreview file={file} />
							</Box>
							<Box display='flex-col' justifyContent='center' alignContent='center' mbe={16} style={{ overflowY: 'scroll' }}>
								<FilePreview file={file} />
							</Box> */}
					{/* </Tile>
					</Scrollable> */}
					<FieldGroup>
						{/* <Field>
							<FieldLabel>{t('Upload_file_name')}</FieldLabel>
							<FieldRow>
								<TextInput value={name} onChange={handleName} />
							</FieldRow>
							{!name && <FieldError>{t('error-the-field-is-required', { field: t('Name') })}</FieldError>}
						</Field> */}
						{showDescription && (
							<Field>
								<FieldLabel>{t('Upload_file_description')}</FieldLabel>
								<FieldRow>
									<TextInput value={description} onChange={handleDescription} placeholder={t('Description')} ref={ref} />
								</FieldRow>
							</Field>
						)}
					</FieldGroup>
				</Modal.Content>
				<Modal.Footer justifyContent='space-between'>
					<Modal.FooterAnnotation>
						<Button secondary onClick={handleAddfile} disabled={!name}>
							<Icon name='plus-small' size='x20' />
							<input style={{ display: 'none' }} onChange={handleAddfile} type='file' id='fileInput' />
							Add File
						</Button>
					</Modal.FooterAnnotation>
					<Modal.FooterControllers>
						<Button secondary onClick={onClose}>
							{t('Cancel')}
						</Button>
						<Button primary type='submit' disabled={!name}>
							{t('Send')}
						</Button>
					</Modal.FooterControllers>
				</Modal.Footer>
			</Box>
		</Modal>
	);
};

export default memo(FileUploadModal);
