import type { ChatFolder, DocFile } from '@/state';

export function getFolderFile(
	folders: ChatFolder[],
	folderId: string,
	fileId: string
): { folder: ChatFolder; file: DocFile } | null {
	const folder = folders.find((candidate) => candidate.id === folderId);
	const file = folder?.files?.find((candidate) => candidate.id === fileId);
	if (!folder || !file) return null;
	return { folder, file };
}
