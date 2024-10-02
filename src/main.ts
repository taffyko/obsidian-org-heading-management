import { App, Editor, FoldPosition, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { applyIndentClassesPlugin } from './editorViewPlugin';
import { getHeadingAt, HeadingNode, indentItem, indentTree, queueRestoreScrollPosition, shiftItem } from './util';

interface OrgPluginSettings {
	enableIndentation: boolean;
	reduceMargins: boolean;
	enableBullets: boolean,
}

const DEFAULT_SETTINGS: OrgPluginSettings = {
	enableIndentation: true,
	reduceMargins: true,
	enableBullets: true,
}

// TODO: shift headings without disrupting folding
// TODO: run cursor over headings without unfolding them
// TODO: partial folding of arbitrary spans of content
export default class OrgPlugin extends Plugin {
	settings: OrgPluginSettings;
	outlineState: 'OVERVIEW' | 'CONTENTS' | 'SHOW ALL' = 'SHOW ALL';

	async onload() {
		await this.loadSettings();
		this.registerEditorExtension([applyIndentClassesPlugin()]);


		this.addCommand({
			id: 'org-shift-item-left',
			name: 'Shift Heading Left',
			editorCallback: (obsidianEditor: Editor, view) => {
				// @ts-expect-error
				const editor = view.editor.cm as EditorView;
				editor.dispatch(editor.state.update({
					changes: indentItem(editor, 'left')
				}))
			},
			hotkeys: [
				{ modifiers: ['Alt'], key: 'ArrowLeft' }
			]
		});
		
		this.addCommand({
			id: 'org-shift-item-right',
			name: 'Shift Heading Right',
			editorCallback: (obsidianEditor: Editor, view) => {
				// @ts-expect-error
				const editor = view.editor.cm as EditorView;
				editor.dispatch(editor.state.update({
					changes: indentItem(editor, 'right')
				}))
			},
			hotkeys: [
				{ modifiers: ['Alt'], key: 'ArrowRight' }
			]
		});

		this.addCommand({
			id: 'org-shift-tree-left',
			name: 'Shift Tree Left',
			editorCallback: (obsidianEditor: Editor, view) => {
				// @ts-expect-error
				const editor = view.editor.cm as EditorView;
				editor.dispatch(editor.state.update({
					changes: indentTree(editor, 'left')
				}))
			},
			hotkeys: [
				{ modifiers: ['Shift', 'Alt'], key: 'ArrowLeft' }
			]
		});

		this.addCommand({
			id: 'org-shift-tree-right',
			name: 'Shift Tree Right',
			editorCallback: (obsidianEditor: Editor, view) => {
				// @ts-expect-error
				const editor = view.editor.cm as EditorView;
				editor.dispatch(editor.state.update({
					changes: indentTree(editor, 'right')
				}))
			},
			hotkeys: [
				{ modifiers: ['Shift', 'Alt'], key: 'ArrowRight' }
			]
		});
		
		this.addCommand({
			id: 'org-cycle',
			name: 'Cycle Heading Fold',
			editorCallback: (obsidianEditor, view) => {
				// @ts-expect-error
				const editor = view.editor.cm as EditorView;
				if (view instanceof MarkdownView) {
					this.orgCycle(editor, view);
				}
			}
		})

		this.addCommand({
			id: 'org-cycle-all',
			name: 'Cycle Outline Fold',
			editorCallback: (obsidianEditor, view) => {
				// @ts-expect-error
				const editor = view.editor.cm as EditorView;
				if (view instanceof MarkdownView) {
					this.orgCycleAll(editor, view);
				}
			}
		})

		this.addCommand({
			id: 'org-shift-item-up',
			name: 'Shift Heading Up',
			editorCallback: (obsidianEditor, view) => {
				// @ts-expect-error
				const editor = view.editor.cm as EditorView;
				shiftItem(editor, 'up');
			},
			hotkeys: [
				{ modifiers: ['Alt'], key: 'ArrowUp' }
			]
		});
		
		this.addCommand({
			id: 'org-shift-item-down',
			name: 'Shift Heading Down',
			editorCallback: (obsidianEditor: Editor, view) => {
				// @ts-expect-error
				const editor = view.editor.cm as EditorView;
				shiftItem(editor, 'down');
			},
			hotkeys: [
				{ modifiers: ['Alt'], key: 'ArrowDown' }
			]
		});
		
		this.addSettingTab(new OrgSettingsTab(this.app, this));
	}
	
	onunload() {
		document.body.removeClass('org-heading-management__reduced-margins')
		document.body.removeClass('org-heading-management__indentation')
		document.body.removeClass('org-heading-management__bullets')
	}

	applySettings() {
		if (this.settings.enableIndentation) {
			document.body.addClass('org-heading-management__indentation')
		} else {
			document.body.removeClass('org-heading-management__indentation')
		}

		if (this.settings.reduceMargins) {
			document.body.addClass('org-heading-management__reduced-margins')
		} else {
			document.body.removeClass('org-heading-management__reduced-margins')
		}

		if (this.settings.enableBullets) {
			document.body.addClass('org-heading-management__bullets')
		} else {
			document.body.removeClass('org-heading-management__bullets')
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		this.applySettings();
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.applySettings();
	}
	
	orgCycleAll(editor: EditorView, view: MarkdownView) {
		if (!view.file) { return; }
		const headings = this.app.metadataCache.getFileCache(view.file)?.headings ?? [];
		
		let folds: FoldPosition[] = [];
		
		const topLevelHeadings = headings.map(headingInfo => {
			return getHeadingAt(editor.state, headingInfo.position.start.offset)!;
		})

		if (this.outlineState === 'SHOW ALL') {
			// if unfolded, fold all top-level headings
			for (const heading of topLevelHeadings) {
				folds.push(this.foldForHeading(editor, heading));
			}
			this.outlineState = 'OVERVIEW';
		} else if (this.outlineState === 'OVERVIEW') {
			// if folded, unfold outline
			// (fold only headings that have no children)
			const recurse = (heading: HeadingNode) => {
				const children = heading.getSubheadings();
				if (children.length) {
					for (const child of children) {
						recurse(child);
					}
				} else {
					const headingFold = this.foldForHeading(editor, heading);
					if (headingFold.to > headingFold.from) {
						folds.push(headingFold);
					}
				}
			}
			for (const heading of topLevelHeadings) {
				recurse(heading);
			}
			this.outlineState = 'CONTENTS';
		} else {
			// else, unfold all
			folds = [];
			this.outlineState = 'SHOW ALL';
		}

		queueRestoreScrollPosition(editor);
		
		view.currentMode.applyFoldInfo({
			folds,
			lines: view.editor.lineCount(),
		});
		view.onMarkdownFold();
	}

	orgCycle(editor: EditorView, view: MarkdownView) {
		if (!view.file) { return; }
		const pos = editor.state.selection.main.head;
		const parent = getHeadingAt(editor.state, pos);
		if (!parent) { return; }
		
		let previousMode: 'FOLDED' | 'SUBTREE' | 'CHILDREN' = 'SUBTREE';

		const parentFirstLine = parent.firstLine(editor);
		const parentLastLine = parent.lastLine(editor);

		const foldInfo = view.currentMode.getFoldInfo();
		const unrelatedFolds = [];
		const existingFolds = [];
		const allExistingFolds = foldInfo?.folds ?? [];
		
		const children = parent.getSubheadings();
		let foldedChildren = 0;
		const foldableChildren = children.filter(child => {
			if (child.firstLine(editor).number === child.lastLine(editor).number) {
				return false;
			}
			return true;
		});

		for (const fold of allExistingFolds) {
			if (fold.from >= parentFirstLine.number - 1 && fold.to <= parentLastLine.number) {
				if (previousMode === 'SUBTREE') {
					if (this.foldMatchesHeading(editor, fold, parent)) {
						previousMode = 'FOLDED'
					}
					for (const child of foldableChildren) {
						if (this.foldMatchesHeading(editor, fold, child )) {
							++foldedChildren;
							break;
						}
					}
				}
				existingFolds.push(fold);
			} else {
				unrelatedFolds.push(fold);
			}
		}

		if (foldableChildren.length > 0 && foldedChildren === foldableChildren.length) {
			previousMode = 'CHILDREN';
		}
		let newFolds: FoldPosition[] = [];
		if (previousMode === 'FOLDED') {
			// If FOLDED, go to CHILDREN mode (unfold parent, but fold all subheadings)
			newFolds = foldableChildren.map(child => this.foldForHeading(editor, child));
		} else if (previousMode === 'CHILDREN') {
			// If in CHILDREN mode, go to SUBTREE mode
			newFolds = [];
		} else {
			// fold the parent heading completely (FOLDED mode)
			newFolds = [this.foldForHeading(editor, parent)];
		}

		const folds = [
			...unrelatedFolds,
			...newFolds,
		];

		queueRestoreScrollPosition(editor);

		view.currentMode.applyFoldInfo({
			folds,
			lines: view.editor.lineCount(),
		});
		view.onMarkdownFold();
	}

	foldForHeading(editor: EditorView, heading: HeadingNode): FoldPosition {
		const firstLine = heading.firstLine(editor);
		const lastLine = heading.lastLine(editor);
		const foldFrom = Math.max(0, firstLine.number - 1)
		let foldTo = lastLine.number - 1;
		if (lastLine.number === editor.state.doc.lines - 1) {
			foldTo = lastLine.number;
		}

		return {
			from: foldFrom,
			to: foldTo,
		};
	}
	foldMatchesHeading(editor: EditorView, fold: FoldPosition, heading: HeadingNode): boolean {
		const headingFold = this.foldForHeading(editor, heading);
		return fold.from === headingFold.from && fold.to === headingFold.to;
	}
}

class OrgSettingsTab extends PluginSettingTab {
	plugin: OrgPlugin;

	constructor(app: App, plugin: OrgPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable indentation")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableIndentation)
				.onChange(async (value) => {
					this.plugin.settings.enableIndentation = value;
					await this.plugin.saveSettings();
				})
			)

		new Setting(containerEl)
			.setName("Reduce left margin")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.reduceMargins)
				.onChange(async (value) => {
					this.plugin.settings.reduceMargins = value;
					await this.plugin.saveSettings();
				})
			)

		new Setting(containerEl)
			.setName("Enable bullets")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBullets)
				.onChange(async (value) => {
					this.plugin.settings.enableBullets = value;
					await this.plugin.saveSettings();
				})
			)

	}
}
