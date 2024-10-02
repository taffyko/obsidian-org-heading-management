import {Decoration, DecorationSet, ViewPlugin, ViewUpdate, EditorView} from "@codemirror/view"
import {RangeSetBuilder} from "@codemirror/state";
import {syntaxTree} from "@codemirror/language"
import { SyntaxNode } from "@lezer/common"
import { getNodeLevel } from "./util";

const line1 = Decoration.line({ class: 'cm-indent-1' });
const line2 = Decoration.line({ class: 'cm-indent-2' });
const line3 = Decoration.line({ class: 'cm-indent-3' });
const line4 = Decoration.line({ class: 'cm-indent-4' });
const line5 = Decoration.line({ class: 'cm-indent-5' });
const line6 = Decoration.line({ class: 'cm-indent-6' });

const lineLevels = [
	line1,
	line2,
	line3,
	line4,
	line5,
	line6,
];

let recursing = false;

class ViewPluginClass {
	decorations: DecorationSet;
	ranges: DecorationSet;
	
	constructor(view: EditorView) {
		this.decorations = this.computeDecorations(view);
	}
	
	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.decorations = this.computeDecorations(update.view);
		}
	}
	
	computeDecorations(view: EditorView) {
		let lineBuilder = new RangeSetBuilder<Decoration>();
		let rangeBuilder = new RangeSetBuilder<Decoration>();
		
		const doc = view.state.doc;

		const tree = syntaxTree(view.state)
		let topNode: SyntaxNode | null = tree.topNode;
		const docEnd = topNode.to;
		
		
		// convert mark range to line decorations
		function addLineDecorations(startPos: number, endPos: number, lineDeco: Decoration) {
			rangeBuilder.add(startPos, endPos, lineDeco);
			const startLine = doc.lineAt(startPos).number;
			const endLine = doc.lineAt(Math.max(startPos, endPos - 1)).number;
			for (let i = startLine; i <= endLine; i++) {
				const line = doc.line(i)
				lineBuilder.add(line.from, line.from, lineDeco);
			}
		}

		function recurse(level: number, node: SyntaxNode | null): SyntaxNode | null {
			let deco = lineLevels[level - 1];
			// char pos at which indented children start
			let start: number | null = null;
			while (true) {
				if (node == null) {
					// reached the end of the document
					if (start) { addLineDecorations(start, docEnd, deco); }
					return node;
				}
				let nodeLevel = getNodeLevel(node.name);
				if (nodeLevel == null) {
					node = node.nextSibling;
				} else if (nodeLevel === level) {
					// reached a sibling heading
					if (start) { addLineDecorations(start, node.from, deco); }
					start = node.to; // children region starts at the end of the heading text
					node = node.nextSibling;
				} else if (nodeLevel < level) {
					// reached a parent heading
					if (start) { addLineDecorations(start, node.from, deco); }
					return node;
				} else if (nodeLevel > level) {
					// reached a child heading
					if (start) { addLineDecorations(start, node.from, deco); }
					start = null;
					node = recurse(nodeLevel, node);
				}
			}
		}
		recurse(1, topNode.firstChild);
		
		const rangeSet = lineBuilder.finish();
		
		this.ranges = rangeBuilder.finish();
		
		return rangeSet;
	}
	
	destroy() {}
}
// Define a function to create the plugin
export function applyIndentClassesPlugin() {
	let instance: ViewPluginClass;

	return ViewPlugin.define(
		(view: EditorView) => {
			if (!recursing) {
				instance = new ViewPluginClass(view);
			}
			return instance;
		},
		{
			decorations: v => v.decorations
		}
	);
}
