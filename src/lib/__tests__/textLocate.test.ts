import { describe, expect, it } from 'vitest'
import {
  expandRangeToSentence,
  isLikelyTitlePhrase,
  listHeadingRanges,
  locateAllSentencesContaining,
  locateAllTextInDoc,
  locateBestRewriteTarget,
  locateHeadingMatches,
  locateTextInDoc,
  mergeOverlappingRanges,
  parseFindReplace,
  proposedFromAssistant,
  rangesOverlap,
} from '../textLocate'
import { heading, paragraph, simpleDoc } from './helpers'

describe('parseFindReplace / proposedFromAssistant', () => {
  it('parses a complete FIND/REPLACE block', () => {
    const parsed = parseFindReplace('FIND:\nold line\nREPLACE:\nnew line')
    expect(parsed).toEqual({
      find: 'old line',
      replace: 'new line',
      findComplete: true,
    })
    expect(proposedFromAssistant('FIND:\nold line\nREPLACE:\nnew line')).toBe('new line')
  })

  it('marks streaming FIND as incomplete', () => {
    const parsed = parseFindReplace('FIND:\npartial passage still typing')
    expect(parsed?.findComplete).toBe(false)
    expect(parsed?.replace).toBe('')
    expect(proposedFromAssistant('FIND:\npartial passage still typing')).toBe('')
  })

  it('returns unstructured content as the proposal', () => {
    expect(proposedFromAssistant('Just rewrite this paragraph entirely.')).toBe(
      'Just rewrite this paragraph entirely.',
    )
  })

  it('finds FIND/REPLACE buried in surrounding prose', () => {
    const parsed = parseFindReplace(
      'Here is the edit:\nFIND:\nalpha\nREPLACE:\nbeta\nThanks!',
    )
    expect(parsed).toEqual({
      find: 'alpha',
      replace: 'beta\nThanks!',
      findComplete: true,
    })
  })
})

describe('isLikelyTitlePhrase / rangesOverlap / mergeOverlappingRanges', () => {
  it('detects short title-like phrases', () => {
    expect(isLikelyTitlePhrase("The Garden's Secret")).toBe(true)
    expect(isLikelyTitlePhrase('Midnight at the Lake')).toBe(true)
    expect(isLikelyTitlePhrase('Hi')).toBe(false)
    expect(isLikelyTitlePhrase('a')).toBe(false)
  })

  it('detects overlapping ranges', () => {
    expect(rangesOverlap({ from: 0, to: 10 }, { from: 5, to: 15 })).toBe(true)
    expect(rangesOverlap({ from: 0, to: 10 }, { from: 10, to: 20 })).toBe(false)
  })

  it('merges overlapping ranges and preserves gaps', () => {
    expect(
      mergeOverlappingRanges([
        { from: 0, to: 5, text: 'a' },
        { from: 4, to: 10, text: 'b' },
        { from: 20, to: 25, text: 'c' },
      ]),
    ).toEqual([
      { from: 0, to: 10, text: 'a' },
      { from: 20, to: 25, text: 'c' },
    ])
  })
})

describe('locateTextInDoc', () => {
  it('finds an exact passage and returns its document range', () => {
    const doc = simpleDoc(paragraph('She walked into the garden quietly.'))
    const hit = locateTextInDoc(doc, 'the garden')

    expect(hit).not.toBeNull()
    expect(hit!.text).toBe('the garden')
    expect(doc.textBetween(hit!.from, hit!.to)).toBe('the garden')
  })

  it('matches across whitespace differences', () => {
    const doc = simpleDoc(paragraph('She   walked   into   the garden.'))
    const hit = locateTextInDoc(doc, 'She walked into the garden.')

    expect(hit).not.toBeNull()
    expect(hit!.text.replace(/\s+/g, ' ').trim()).toContain('walked into the garden')
  })

  it('prefers heading title matches over body text', () => {
    const doc = simpleDoc(
      heading(1, 'The Garden'),
      paragraph('They spoke of The Garden as a metaphor.'),
    )
    const hit = locateTextInDoc(doc, 'The Garden')

    expect(hit).not.toBeNull()
    expect(hit!.text).toBe('The Garden')
    expect(listHeadingRanges(doc).some((h) => h.from === hit!.from && h.to === hit!.to)).toBe(true)
  })

  it('returns null for empty needles and missing text in exact-only mode', () => {
    const doc = simpleDoc(paragraph('Hello world'))
    expect(locateTextInDoc(doc, '   ')).toBeNull()
    expect(locateTextInDoc(doc, 'completely absent phrase', { exactOnly: true })).toBeNull()
  })
})

describe('locateAllTextInDoc / headings / sentences', () => {
  it('finds every case-insensitive occurrence', () => {
    const doc = simpleDoc(paragraph('Rose rose from the rose bed.'))
    const hits = locateAllTextInDoc(doc, 'rose')
    expect(hits).toHaveLength(3)
    expect(hits.map((h) => h.text.toLowerCase())).toEqual(['rose', 'rose', 'rose'])
  })

  it('lists headings and matches titles exactly', () => {
    const doc = simpleDoc(heading(1, 'Act I'), heading(2, 'Chapter One'), paragraph('Body'))
    expect(listHeadingRanges(doc).map((h) => h.text)).toEqual(['Act I', 'Chapter One'])
    expect(locateHeadingMatches(doc, 'chapter one')).toHaveLength(1)
    expect(locateHeadingMatches(doc, 'Body')).toHaveLength(0)
  })

  it('expands word hits to containing passages for replace_all', () => {
    // expandRangeToSentence uses newline bounds (paragraph-as-passage), matching search_sentences usage
    const doc = simpleDoc(
      paragraph('Alpha holds the key.'),
      paragraph('Beta waits by the door.'),
      paragraph('Gamma leaves.'),
    )
    const hits = locateAllSentencesContaining(doc, 'the key')
    expect(hits).toHaveLength(1)
    expect(hits[0]!.text.trim()).toBe('Alpha holds the key.')
  })

  it('expandRangeToSentence stays within paragraph bounds', () => {
    const doc = simpleDoc(
      paragraph('One. Two three. Four.'),
      paragraph('Other paragraph.'),
    )
    const word = locateAllTextInDoc(doc, 'three')[0]!
    const sentence = expandRangeToSentence(doc, word.from, word.to)
    expect(sentence.text.trim()).toBe('One. Two three. Four.')
    expect(sentence.text).not.toContain('Other paragraph')
  })
})

describe('locateBestRewriteTarget', () => {
  it('picks the paragraph most similar to a proposed rewrite', () => {
    const doc = simpleDoc(
      paragraph('Unrelated weather chatter about rain.'),
      paragraph('She walked into the garden and paused by the fountain.'),
      paragraph('Another aside about dinner plans.'),
    )
    const hit = locateBestRewriteTarget(
      doc,
      'She walked into the garden and stopped beside the fountain.',
    )
    expect(hit).not.toBeNull()
    expect(hit!.text).toContain('fountain')
  })

  it('rejects proposals with no meaningful overlap', () => {
    const doc = simpleDoc(paragraph('The cat sat on the mat.'))
    expect(locateBestRewriteTarget(doc, 'Quantum chromodynamics forever.')).toBeNull()
  })
})
