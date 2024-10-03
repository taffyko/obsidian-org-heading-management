A personal Obsidian plugin that implements some of the heading-related features from Emacs org-mode that I missed having.

I haven't published releases anywhere yet,  
but you can clone this repo into `yourvault/.obsidian/plugins/` and `npm install; npm build` if you want to try it out.

# Features

## Heading indentation
Content under a heading is now visually bulleted and indented based on the depth of the subheading.

## Heading manipulation

- `Alt-Left` and `Alt-Right` to shift the level of a heading in or out, or indent/dedent lines.
- `Shift-Alt-Left` and `Shift-Alt-Right` to shift the level of a whole tree of headings (heading and all its children) in or out.  
  - TODO: implement this for indenting/dedenting subtrees of list items

- `Alt-Up` and `Alt-Down` to shift headings up and down, reordering them among their siblings (preserving all the content and subheadings within)  
  - When the cursor/selection is on something other than a heading, the selected lines are shifted up/down by a line instead.
  - TODO: implement this for reordering subtrees of list items
 
[![demo1-1.webp](https://i.postimg.cc/0N4grfFg/demo1-1.webp)](https://postimg.cc/HJbvhQT3)

(Colorful theme not included — but I could share it in the future if anyone wants it!)

## Fold cycling
Quickly cycle between folding all top-level headings — unrolling the tree of all headings but not their content for a quick outline of the document — and unfolding everything.  
Similarly, you can fold-cycle an individual heading to toggle between _folded_ — _immediate children_ — and _fully unfolded_.

[![demo2-1.webp](https://i.postimg.cc/G3QdFZBr/demo2-1.webp)](https://postimg.cc/dDLbvNmS)

If you're using Vim mode, you can add this to your `.obsidian.vimrc` to get org-like outline fold cycling using Tab/Shift-Tab in normal mode.
```
exmap OrgCycle obcommand org-heading-management:org-cycle
exmap OrgCycleAll obcommand org-heading-management:org-cycle-all

unmap <Tab>
nmap <Tab> :OrgCycle

unmap <S-Tab>
nmap <S-Tab> :OrgCycleAll
```
