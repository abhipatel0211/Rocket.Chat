import type { ReactElement } from 'react';
import React from 'react';

import { isIE11 } from '../../../../lib/utils/isIE11';
import GenericPreview from './GenericPreview';
import MediaPreview from './MediaPreview';

export enum FilePreviewType {
	IMAGE = 'image',
	AUDIO = 'audio',
	VIDEO = 'video',
}

const getFileType = (fileType: File['type']): FilePreviewType | undefined => {
	if (!fileType) {
		return;
	}
	for (const type of Object.values(FilePreviewType)) {
		if (fileType.indexOf(type) > -1) {
			return type;
		}
	}
};

const shouldShowMediaPreview = (file: File, fileType: FilePreviewType | undefined): boolean => {
	if (!fileType) {
		return false;
	}
	if (isIE11) {
		return false;
	}
	// Avoid preview if file size bigger than 10mb
	if (file.size > 10000000) {
		return false;
	}
	if (!Object.values(FilePreviewType).includes(fileType)) {
		return false;
	}
	return true;
};

type FilePreviewProps = {
	file: File;
	key: string;
	index: number; // Index of the file in the queue
	onRemove: (index: number) => void; // Function to remove file from queue
};

const FilePreview = ({ file, index, onRemove }: FilePreviewProps): ReactElement => {
	const fileType = getFileType(file.type);

	const handleRemove = () => {
		onRemove(index); // Call the onRemove function with index
	};

	if (shouldShowMediaPreview(file, fileType)) {
		return <MediaPreview file={file} fileType={fileType as FilePreviewType} />;
	}

	return <GenericPreview file={file} onRemove={handleRemove} index={index} />;
};

export default FilePreview;
