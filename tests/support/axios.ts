import { axiosBuilder } from '@data-fair/lib-node/axios.js'

export const baseURL = process.env.TEST_TILESERVER_URL ?? ''

export const anonymousAx = axiosBuilder({ baseURL })
