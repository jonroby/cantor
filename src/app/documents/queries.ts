import type * as state from '@/state';

export function getFolderFile(
	folders: state.documents.ChatFolder[],
	folderId: string,
	fileId: string
): { folder: state.documents.ChatFolder; file: state.documents.DocFile } | null {
	const folder = folders.find((candidate) => candidate.id === folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!folder || !file) return null;
	return { folder, file };
}
