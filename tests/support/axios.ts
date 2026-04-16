import { axiosBuilder } from '@data-fair/lib-node/axios.js'

const basePath = process.env.TEST_TILESERVER_BASE_PATH ?? '/tileserver'
export const baseURL = (process.env.TEST_TILESERVER_URL ?? '') + basePath

export const anonymousAx = axiosBuilder({ baseURL })
