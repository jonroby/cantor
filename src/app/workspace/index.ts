import * as external from '@/external';
import * as state from '@/state';

function persistLayout(
	layout: Partial<external.persistence.PersistedLayout>,
	options?: { saveSnapshot?: boolean }
) {
	const currentLayout = external.persistence.getPersistedLayout();
	external.persistence.setPersistedLayout({ ...currentLayout, ...layout });
	if (options?.saveSnapshot === false) return;
	return external.persistence.saveToStorage({
		chats: state.chats.chatState.chats,
		activeChatIndex: state.chats.chatState.activeChatIndex,
		folders: state.documents.documentState.folders
	});
}

export function getState() {
	return state.workspace.workspaceState;
}

export function rememberOpenDocument(folderId: string, fileId: string) {
	void persistLayout({ openDocument: { folderId, fileId } });
}

export function clearOpenDocument(options?: { saveSnapshot?: boolean }) {
	void persistLayout({ openDocument: undefined }, options);
}

export function setSidebarOpen(open: boolean) {
	state.workspace.setSidebarOpen(open);
	void persistLayout({ sidebarOpen: open });
}

export function setPanels(panels: state.workspace.WorkspacePanel[]) {
	state.workspace.setPanels(panels);
	void persistLayout({ panels });
}

export function setExpandedFolders(expandedFolders: Record<string, boolean>) {
	state.workspace.setExpandedFolders(expandedFolders);
	void persistLayout({ expandedFolders });
}

export function toggleSidebar() {
	setSidebarOpen(!state.workspace.workspaceState.sidebarOpen);
}

export function selectFolderFile(folderId: string, fileId: string) {
	state.workspace.setSelectedFile(folderId, fileId);
}

export function setActiveModel(model: { provider: string; modelId: string } | null) {
	void persistLayout({ activeModel: model ?? undefined });
}
