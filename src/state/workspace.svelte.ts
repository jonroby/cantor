export type WorkspacePanel =
	| { type: 'chat' }
	| { type: 'document'; folderId: string; fileId: string }
	| { type: 'folder'; folderId: string };

export interface WorkspaceState {
	panels: WorkspacePanel[];
	sidebarOpen: boolean;
	expandedFolders: Record<string, boolean>;
	selectedFileIdsByFolderId: Record<string, string>;
}

export const workspaceState: WorkspaceState = $state({
	panels: [{ type: 'chat' }],
	sidebarOpen: true,
	expandedFolders: {},
	selectedFileIdsByFolderId: {}
});

export function hydrate(layout: Partial<WorkspaceState>) {
	workspaceState.panels = layout.panels ?? [];
	workspaceState.sidebarOpen = layout.sidebarOpen ?? true;
	workspaceState.expandedFolders = layout.expandedFolders ?? {};
	workspaceState.selectedFileIdsByFolderId = layout.selectedFileIdsByFolderId ?? {};
}

export function setPanels(panels: WorkspacePanel[]) {
	workspaceState.panels = panels;
}

export function setSidebarOpen(open: boolean) {
	workspaceState.sidebarOpen = open;
}

export function setExpandedFolders(expandedFolders: Record<string, boolean>) {
	workspaceState.expandedFolders = expandedFolders;
}

export function setSelectedFile(folderId: string, fileId: string) {
	workspaceState.selectedFileIdsByFolderId = {
		...workspaceState.selectedFileIdsByFolderId,
		[folderId]: fileId
	};
}
