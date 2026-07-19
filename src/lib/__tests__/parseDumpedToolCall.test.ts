import { describe, expect, it } from 'vitest'
import { parseDumpedToolCall } from '../parseDumpedToolCall'

describe('parseDumpedToolCall', () => {
  it('returns null for empty or non-JSON content', () => {
    expect(parseDumpedToolCall('')).toBeNull()
    expect(parseDumpedToolCall('Just a normal assistant reply.')).toBeNull()
  })

  it('parses name + arguments payloads', () => {
    const call = parseDumpedToolCall(
      JSON.stringify({
        name: 'replace_text',
        arguments: { find: 'old', replace: 'new' },
      }),
    )
    expect(call).toEqual({
      name: 'replace_text',
      arguments: { find: 'old', replace: 'new' },
    })
  })

  it('accepts parameters / input aliases and stringified arguments', () => {
    expect(
      parseDumpedToolCall(
        JSON.stringify({
          name: 'replace_story',
          parameters: '{"nodeId":"book/ch-0","text":"Hi"}',
        }),
      ),
    ).toEqual({
      name: 'replace_story',
      arguments: { nodeId: 'book/ch-0', text: 'Hi' },
    })

    expect(
      parseDumpedToolCall(
        JSON.stringify({
          name: 'replace_text',
          input: { find: 'a', replace: 'b' },
        }),
      )?.arguments,
    ).toEqual({ find: 'a', replace: 'b' })
  })

  it('parses tool-key and OpenAI-style function wrappers', () => {
    expect(
      parseDumpedToolCall(
        JSON.stringify({
          tool: 'replace_text',
          find: 'x',
          replace: 'y',
        }),
      ),
    ).toEqual({
      name: 'replace_text',
      arguments: { find: 'x', replace: 'y' },
    })

    expect(
      parseDumpedToolCall(
        JSON.stringify({
          function: {
            name: 'replace_text',
            arguments: { find: 'one', replace: 'two' },
          },
        }),
      ),
    ).toEqual({
      name: 'replace_text',
      arguments: { find: 'one', replace: 'two' },
    })
  })

  it('unwraps fenced JSON and arrays of tool calls', () => {
    const fenced = parseDumpedToolCall(`\`\`\`json
{"name":"replace_text","arguments":{"find":"a","replace":"b"}}
\`\`\``)
    expect(fenced?.name).toBe('replace_text')

    const fromArray = parseDumpedToolCall(
      JSON.stringify([
        { name: 'search_sentences', arguments: { query: 'nope' } },
        { name: 'replace_text', arguments: { find: 'keep', replace: 'safe' } },
      ]),
    )
    expect(fromArray).toEqual({
      name: 'replace_text',
      arguments: { find: 'keep', replace: 'safe' },
    })
  })

  it('ignores non-recoverable tools and recovers JSON buried in prose', () => {
    expect(
      parseDumpedToolCall(
        JSON.stringify({ name: 'search_outline', arguments: { query: 'x' } }),
      ),
    ).toBeNull()

    const buried = parseDumpedToolCall(
      'Sure, here is the call: {"name":"replace_text","arguments":{"find":"old","replace":"new"}} done.',
    )
    expect(buried).toEqual({
      name: 'replace_text',
      arguments: { find: 'old', replace: 'new' },
    })
  })
})
