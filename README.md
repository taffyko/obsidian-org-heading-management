A personal Obsidian plugin — Implements some heading-related features from Emacs org-mode that I missed having.

# Usage
I haven't published releases anywhere yet,  
but you can clone this repo into `yourvault/.obsidian/plugins/` and `npm install; npm build` if you want to try it out.

# Features

## Heading indentation
Content under a heading is now visually indented based on the depth of the subheading.

## Heading manipulation

- `Alt-Left` and `Alt-Right` to shift the level of a heading in or out, or indent/dedent lines.
- `Shift-Alt-Left` and `Shift-Alt-Right` to shift the level of a whole tree of headings (heading and all its children) in or out.  
  - TODO: implement this for indenting/dedenting subtrees of list items

- `Alt-Up` and `Alt-Down` to shift headings up and down, reordering them among their siblings (preserving all the content and subheadings within)  
  - When the cursor/selection is on something other than a heading, the selected lines are shifted up/down by a line instead.
  - TODO: implement this for reordering subtrees of list items


## Fold cycling
If you're using Vim mode, you can add this to your `.obsidian.vimrc` to get org-like outline fold cycling using Tab/Shift-Tab in normal mode.
```
exmap OrgCycle obcommand org-heading-management:org-cycle
exmap OrgCycleAll obcommand org-heading-management:org-cycle-all

unmap <Tab>
nmap <Tab> :OrgCycle

unmap <S-Tab>
nmap <S-Tab> :OrgCycleAll
```
