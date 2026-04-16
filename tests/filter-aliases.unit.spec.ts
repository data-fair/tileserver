import { test, expect } from '@playwright/test'
import { parseList, parseAliases, filterArtefacts } from '../src/config-parse.ts'

const artefact = (id: string) => ({ _id: id, name: id, category: 'tileset', format: 'file' })

test.describe('parseList', () => {
  test('returns empty array for empty string', () => {
    expect(parseList('')).toEqual([])
  })

  test('splits comma-separated values', () => {
    expect(parseList('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  test('trims whitespace', () => {
    expect(parseList(' a , b , c ')).toEqual(['a', 'b', 'c'])
  })

  test('filters out empty segments', () => {
    expect(parseList('a,,b,')).toEqual(['a', 'b'])
  })
})

test.describe('parseAliases', () => {
  test('returns empty object for empty string', () => {
    expect(parseAliases('')).toEqual({})
  })

  test('parses source:alias pairs', () => {
    expect(parseAliases('world:france')).toEqual({ world: 'france' })
  })

  test('parses multiple pairs', () => {
    expect(parseAliases('world:france,contours-2026:contours')).toEqual({
      world: 'france',
      'contours-2026': 'contours'
    })
  })

  test('trims whitespace around keys and values', () => {
    expect(parseAliases(' world : france , foo : bar ')).toEqual({
      world: 'france',
      foo: 'bar'
    })
  })

  test('skips malformed entries without colon', () => {
    expect(parseAliases('good:pair,nocolon,also:fine')).toEqual({
      good: 'pair',
      also: 'fine'
    })
  })

  test('skips entries with empty source or alias', () => {
    expect(parseAliases(':alias,source:,ok:ok')).toEqual({ ok: 'ok' })
  })
})

test.describe('filterArtefacts', () => {
  const all = [artefact('a'), artefact('b'), artefact('c')]

  test('returns all when include and exclude are empty', () => {
    expect(filterArtefacts(all, [], [])).toEqual(all)
  })

  test('include keeps only matching artefacts', () => {
    const result = filterArtefacts(all, ['a', 'c'], [])
    expect(result.map(a => a._id)).toEqual(['a', 'c'])
  })

  test('exclude removes matching artefacts', () => {
    const result = filterArtefacts(all, [], ['b'])
    expect(result.map(a => a._id)).toEqual(['a', 'c'])
  })

  test('include and exclude combine (include first, then exclude)', () => {
    const result = filterArtefacts(all, ['a', 'b'], ['b'])
    expect(result.map(a => a._id)).toEqual(['a'])
  })

  test('include with no matches returns empty', () => {
    expect(filterArtefacts(all, ['x'], [])).toEqual([])
  })

  test('exclude with no matches returns all', () => {
    expect(filterArtefacts(all, [], ['x'])).toEqual(all)
  })
})
