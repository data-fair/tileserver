import { axiosBuilder } from '@data-fair/lib-node/axios.js'
import config from '#config'

export interface Artefact {
  _id: string
  name: string
  category: string
  format: string
  title?: string | { fr?: string, en?: string }
  [key: string]: unknown
}

interface ListResponse {
  results: Artefact[]
  count: number
}

const ax = axiosBuilder({
  baseURL: config.registryUrl,
  headers: { 'x-secret-key': config.registrySecret }
})

export const listArtefacts = async (query: Record<string, string | number>): Promise<Artefact[]> => {
  const size = config.artefactsPageSize
  const results: Artefact[] = []
  let skip = 0
  for (;;) {
    const res = await ax.get<ListResponse>('/api/v1/artefacts', {
      params: { ...query, size, skip }
    })
    results.push(...res.data.results)
    skip += res.data.results.length
    if (skip >= res.data.count || res.data.results.length === 0) break
  }
  return results
}
