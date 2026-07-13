/** Builds the manuscript context block attached to freeform agent chat turns. */
export function withDocumentContext(
  userRequest: string,
  ctx: { selection: string; document: string },
): string {
  const sections: string[] = [
    `You are a writing assistant embedded in a text editor. Use the manuscript context below when answering or rewriting.

When the user asks you to edit, rewrite, improve, fix, or change manuscript text and they have NOT selected a passage, respond EXACTLY in this format (no other commentary):
FIND:
<paste the exact passage from the manuscript that should be replaced>
REPLACE:
<the new passage>

When the user has a Current selection, return ONLY the replacement text for that selection (no FIND/REPLACE wrapper).
When the user asks a question or wants brainstorming (not an edit), answer normally without FIND/REPLACE.`,
  ]

  const document = ctx.document.trim()
  sections.push(document ? `Manuscript:\n"""\n${document}\n"""` : 'Manuscript: (empty)')

  const selection = ctx.selection.trim()
  if (selection) {
    sections.push(`Current selection:\n"""\n${selection}\n"""`)
  }

  sections.push(`User request:\n${userRequest}`)
  return sections.join('\n\n')
}
