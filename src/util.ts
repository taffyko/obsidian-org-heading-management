import { ChangeSpec, EditorSelection, EditorState, Line } from "@codemirror/state";
import { EditorView } from "@codemirror/view"
import { syntaxTree } from "@codemirror/language"
import { SyntaxNode } from "@lezer/common"

export function getHeadingAt(state: EditorState, pos: number): HeadingNode | null {
	const tree = syntaxTree(state)
	let topNode: SyntaxNode | null = tree.topNode;
	let node = topNode.firstChild;
	let headingNode: SyntaxNode | null = null;
	while (node != null) {
		const nodeLevel = getNodeLevel(node.name);
		if (nodeLevel != null) {
			if (node.from > pos) {
				return toHeadingNode(headingNode);
			} 
			headingNode = node;
		}
		node = node.nextSibling;
	}
	return toHeadingNode(headingNode);
}

function getRangeForHeading(node: SyntaxNode): [number, number] {
	let nextNode = getNextHeading(node, true);
	return [node.from, nextNode?.from ?? node.parent!.to];
}
function getNextHeading(node: SyntaxNode | null | undefined, skipSubheadings = true) {
	return getSiblingHeading(node, skipSubheadings, 'next');
}
function getPreviousHeading(node: SyntaxNode | null | undefined, skipSubheadings = true) {
	const sibling = getSiblingHeading(node, skipSubheadings, 'prev');
	return sibling;
}

export interface HeadingNode extends SyntaxNode {
	level: number;
	contentFrom: number;
	contentTo: number;
	firstLine: (editor: EditorView) => Line;
	lastLine: (editor: EditorView) => Line;
	getSubheadings: () => HeadingNode[];
}

export function toHeadingNode(node: SyntaxNode | null): HeadingNode | null {
	if (node == null) { return null; }
	const level = getNodeLevel(node.name);
	if (level == null) { return null; }
	const [contentFrom, contentTo] = getRangeForHeading(node);
	Object.assign(node, {
		level,
		contentFrom,
		contentTo,
		firstLine: (editor: EditorView) => {
			return editor.state.doc.lineAt(contentFrom);
		},
		lastLine: (editor: EditorView) => {
			return editor.state.doc.lineAt(contentTo - 1);
		},
		getSubheadings: () => { return getImmediateChildren(node).map(node => toHeadingNode(node)!); }
	});
	return node as HeadingNode;
}


export function getSiblingHeading(node: SyntaxNode | null | undefined, skipSubheadings: boolean, dir: 'prev' | 'next'): SyntaxNode | null {
	if (node == null) { return null; }
	const currentLevel = getNodeLevel(node.name);
	if (!currentLevel) { return null; }
	node = dir === 'prev' ? node.prevSibling : node.nextSibling;
	while (node != null) {
		const nodeLevel = getNodeLevel(node.name);
		if (nodeLevel != null) {
			if (skipSubheadings) {
				if (nodeLevel <= currentLevel) { return node; }
			} else {
				return node;
			}
		}
		node = dir === 'prev' ? node.prevSibling : node.nextSibling;
	}
	return null;
}

function getImmediateChildren(parentNode: SyntaxNode): SyntaxNode[] {
	const parentLevel = getNodeLevel(parentNode.name)!;
	const immediateChildren: SyntaxNode[] = [];
	let node: SyntaxNode | null = parentNode;
	while (true) {
		node = getNextHeading(node, false);
		if (!node) { break; }
		const nodeLevel = getNodeLevel(node.name)!;
		if (nodeLevel <= parentLevel) { break; }
		if (nodeLevel === parentLevel + 1) {
			immediateChildren.push(node)
		}
	}
	return immediateChildren;
}

export function getNodeLevel(name: string): number | null {
	if (name.startsWith('HyperMD-header_HyperMD-header-')) {
		return parseInt(name.substring(30), 10);
	}
	return null;
}

export function assertUnreachable(a: never): never {
  throw new Error("Deliberately unreachable case occurred.");
}

export function indentItem(editor: EditorView, dir: 'right' | 'left', pos: number | null = null): ChangeSpec[] {
	pos = pos ?? editor.state.selection.main.head;

	const line = editor.state.doc.lineAt(pos);

	const changes: ChangeSpec[] = [];
	
	if (line.text[0] === '#') {
		// Shift heading
		if (dir === 'right') {
			if (!line.text.startsWith('######')) {
				changes.push({ from: line.from, insert: '#' });
			}
		} else if (dir === 'left') {
			if (line.text.startsWith('##')) {
				changes.push({ from: line.from, to: line.from + 1 });
			}
		}
	} else {
		// Shift indentation
		if (dir === 'right') {
			changes.push({ from: line.from, insert: '    ' });
		} else if (dir === 'left') {
			const match = line.text.match((/ ? ? ? ?|\t?/));
			if (match) {
				changes.push({ from: line.from, to: line.from + match[0].length });
			}
		}
	}

	return changes;
}

export function indentTree(editor: EditorView, dir: 'right' | 'left', pos: number | null = null): ChangeSpec {
	pos = pos ?? editor.state.selection.main.head;
	const line = editor.state.doc.lineAt(pos)
	const changes: ChangeSpec[] = [];
	if (line.text.startsWith('#')) {
		// Shift heading tree
		let node: SyntaxNode | null = getHeadingAt(editor.state, pos);
		if (!node) { return []; }
		const parentLevel = getNodeLevel(node.name)!;
		while (true) {
			const newChanges = indentItem(editor, dir, node.from);
			if (newChanges.length === 0) {
				return [];
			}
			changes.splice(changes.length, 0, ...newChanges)
			node = getNextHeading(node, false);
			if (!node) { break; }
			const level = getNodeLevel(node.name)!
			if (level <= parentLevel) { break; }
		}
	}
	return changes;
}

export function shiftItem(editor: EditorView, dir: 'up' | 'down') {
	const pos = editor.state.selection.main.head;
	const line = editor.state.doc.lineAt(pos);
	if (!line.text.startsWith('#')) {
		/// Shift line
		shiftLine(editor, dir);
		return;
	}
	// Shift heading
	const node = getHeadingAt(editor.state, pos);
	if (!node) { return; }
	const docEnd = node.parent!.to;
	let nextNode = dir === 'up' ? getPreviousHeading(node) : getNextHeading(node);
	if (!nextNode) { return; }
	let [srcStart, srcEnd] = getRangeForHeading(node);
	let text = editor.state.sliceDoc(srcStart, srcEnd);
	
	const anchorRel = editor.state.selection.main.anchor - srcStart;
	const headRel = editor.state.selection.main.head - srcStart;
	let changes: ChangeSpec[] = [];
	let destStart: number;
	let destEnd: number;
	let startOffset = 0;
	if (dir === 'up') {
		if (srcEnd === docEnd) {
			// If moving the last heading up, delete the preceding linebreak
			startOffset = -1;
			// And add a linebreak to the end of the inserted content
			text = text + '\n';
		}
		changes.push({ from: srcStart + startOffset, to: srcEnd });
		destStart = nextNode.from;
		destEnd = destStart + text.length;
		changes.push({ from: destStart, insert: text })
	} else if (dir === 'down') {
		destEnd = getNextHeading(nextNode)?.from ?? docEnd;
		if (destEnd === docEnd){
			startOffset = 1;
			text = text.replace(/\n$/, '');
			text = '\n'+ text;
		}
		destStart = destEnd - text.length;
		changes.push({ from: srcStart, to: srcEnd });
		changes.push({ from: destEnd, insert: text })
	} else { assertUnreachable(dir) }

	queueRestoreScrollPosition(editor);

	const transaction = editor.state.update({
		changes
	});
	editor.dispatch(transaction);
	if (dir === 'up') {
		let selectionUpdate = editor.state.update({
			selection: EditorSelection.range(
				anchorRel + destStart,
				headRel + destStart,
			)
		});
		editor.dispatch(selectionUpdate);
	} else if (dir === 'down') {
		let selectionUpdate = editor.state.update({
			selection: EditorSelection.range(
				anchorRel + destStart + startOffset,
				headRel + destStart + startOffset,
			)
		});
		editor.dispatch(selectionUpdate);
	} else { assertUnreachable(dir) }
}

export function shiftLine(editor: EditorView, dir: 'up' | 'down') {
	const anchorPos = editor.state.selection.main.anchor;
	const headPos = editor.state.selection.main.head;

	const startLine = editor.state.doc.lineAt(Math.min(anchorPos, headPos))
	const endLine = editor.state.doc.lineAt(Math.max(anchorPos, headPos))

	const changes: ChangeSpec[] = [];

	const isFirstLine = startLine.from === 0;
	const isLastLine = endLine.to === editor.state.doc.length - 1;
	if (isFirstLine && isLastLine) { return; }
	const text = editor.state.sliceDoc(startLine.from, endLine.to);
	
	let offset = 0;
	
	if (dir === 'up') {
		if (isFirstLine) { return; }
		const prevLine = editor.state.doc.lineAt(startLine.from - 1);
		offset = -(prevLine.to - prevLine.from + 1)
		changes.push({ from: startLine.from, to: endLine.to + 1 });
		changes.push({ from: prevLine.from, insert: text + '\n' });
	} else if (dir === 'down') {
		if (isLastLine) { return; }
		const nextLine = editor.state.doc.lineAt(endLine.to + 1);
		offset = (nextLine.to - nextLine.from + 1);
		changes.push({ from: startLine.from, to: endLine.to + 1 });
		changes.push({ from: nextLine.to + 1, insert: text + '\n' });
	} else { assertUnreachable(dir) }
	
	queueRestoreScrollPosition(editor);

	const transaction = editor.state.update({
		changes,
		selection: EditorSelection.range(
			anchorPos + offset,
			headPos + offset,
		)
	});
	editor.dispatch(transaction);
}

export function queueRestoreScrollPosition(editor: EditorView) {
	const pos = editor.state.selection.main.head;
	const beforeTop = editor.lineBlockAt(pos).top;
	const difference = beforeTop - editor.scrollDOM.scrollTop;

	Promise.resolve().then(() => {
		const pos = editor.state.selection.main.head;
		const afterTop = editor.lineBlockAt(pos).top;
		editor.scrollDOM.scrollTop = afterTop - difference;
	});

	setTimeout(() => {
		const pos = editor.state.selection.main.head;
		const afterTop = editor.lineBlockAt(pos).top;
		editor.scrollDOM.scrollTop = afterTop - difference;
	}, 0);
}

export function getLevelAt(view: EditorView, char: number): number {
	const doc = view.state.doc;
	for (const text of doc.iterRange(char, 0)) {
		if (text.startsWith('#')) {
			const match = text.match(/^#+/)!;
			return match[0].length;
		}
	}
	return 0;
}
