import express from 'express'
const source = express.Router()

import { needauth } from './auth.js'
source.use(needauth)

import { getenv } from './cfenv.js'
const env = getenv()

export default source
