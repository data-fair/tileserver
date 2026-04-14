import { axiosBuilder } from '@data-fair/lib-node/axios.js'

export const baseURL = `http://localhost:${process.env.DEV_PORT}`

export const anonymousAx = axiosBuilder({ baseURL })
