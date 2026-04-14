import neostandard from 'neostandard'

export default [
  { ignores: ['dev/*', 'node_modules/*'] },
  ...neostandard({ ts: true })
]
