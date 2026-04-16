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
}

const ax = axiosBuilder({
  baseURL: config.registryUrl,
  headers: { 'x-secret-key': config.registrySecret }
})

export const listArtefacts = async (query: Record<string, string | number>): Promise<Artefact[]> => {
  const res = await ax.get<ListResponse>('/api/v1/artefacts', {
    params: { ...query, size: 100 }
  })
  return res.data.results
}
