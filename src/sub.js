import express from 'express'
const sub = express.Router()

import { getenv } from './cfenv.js'
const env = getenv()

import pLimit from 'p-limit'
const limit = pLimit(3)

const ECH_DOMAINS = ['cloudflare-ech.com', 'crypto.cloudflare.com', 'godotengine.org', 'www.britannica.com', 'www.prometheus.io', 'www.kyocera.com']
const ECH_DNS = ['https://dns.alidns.com/dns-query', 'https://sm2.doh.pub/dns-query', 'https://doh.360.cn/dns-query', 'https://doh.onedns.net/dns-query']
const INSECURE_PARAMS_REGEX = /([?&])(allowInsecure|insecure|skip-cert-verify)=[^&]*&?/g

const ALL_ECH_PAIRS = []
for (const domain of ECH_DOMAINS) {
    for (const dns of ECH_DNS) {
        ALL_ECH_PAIRS.push(`${domain}+${dns}`)
    }
}

const shufflePairs = array => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[array[i], array[j]] = [array[j], array[i]]
    }
}

shufflePairs(ALL_ECH_PAIRS)

let currentIndex = 0
const randomECH = () => {
    if (currentIndex >= ALL_ECH_PAIRS.length) {
        shufflePairs(ALL_ECH_PAIRS)
        currentIndex = 0
    }

    return ALL_ECH_PAIRS[currentIndex++]
}

const decodeBase64 = str => {
    try {
        return typeof atob === 'function' ? decodeURIComponent(escape(atob(str.trim()))) : Buffer.from(str, 'base64').toString('utf-8')
    } catch {
        return ''
    }
}

const processNode = (node, prefixName, excludes, isCF) => {
    node = node.trim()
    if (!node) return null

    const idx = node.lastIndexOf('#')
    const rawUrl = idx !== -1 ? node.slice(0, idx) : node
    const rawName = idx !== -1 ? node.slice(idx + 1) : ''

    let decodedName = rawName
    try {
        decodedName = decodeURIComponent(rawName)
    } catch {}

    if (excludes.length > 0 && excludes.some(item => decodedName.includes(item))) {
        return null
    }

    const formatedName = `${prefixName} - ${decodedName}`
    const queryIdx = rawUrl.indexOf('?')

    if (queryIdx === -1) {
        return `${rawUrl}#${formatedName}`
    }

    let [baseUrl, search] = [rawUrl.slice(0, queryIdx), rawUrl.slice(queryIdx + 1)]
    search = search.replace(INSECURE_PARAMS_REGEX, '$1').replace(/[?&]$/, '')

    if (isCF && !search.includes('ech=')) {
        const echParam = `ech=${encodeURIComponent(randomECH())}`
        search = search ? `${search}&${echParam}` : echParam
    }

    return `${baseUrl}${search ? '?' + search : ''}#${formatedName}`
}

const processItem = async (name, url, exclude) => {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'v2rayN/7.22.7' }
    })

    if (!res.ok) return []

    let text = await res.text()
    if (!text.includes('://')) {
        text = decodeBase64(text)
    }

    const excludes = exclude
        ? exclude
              .split(',')
              .map(s => s.trim())
              .filter(Boolean)
        : []

    const isCF = name.startsWith('CF')
    const lines = text.split(/\r?\n/)
    const result = []

    for (let i = 0; i < lines.length; i++) {
        const processed = processNode(lines[i], name, excludes, isCF)
        if (processed) {
            result.push(processed)
        }
    }

    return result
}

const fetchAllSubs = async () => {
    const trueSecret = await env.data.get('sub_secret')
    if (typeof trueSecret !== 'string' || trueSecret === '') {
        return { error: '订阅密钥未指定', code: 500 }
    }

    const keys = (await env.data.list()).keys
    const subNames = keys.map(item => item.name).filter(item => item !== 'sub_secret')
    if (subNames.length === 0) {
        return { error: '未配置订阅', code: 500 }
    }

    const values = await env.data.get(subNames)
    const subs = Object.fromEntries(values)

    const promises = Object.entries(subs).map(([key, value]) => {
        const { url, exclude } = JSON.parse(value)
        return limit(() => processItem(key, url, exclude))
    })

    const result = (await Promise.all(promises)).flat()
    return { subNames, result, secret: trueSecret }
}

sub.get('/info', async (req, res) => {
    const data = await fetchAllSubs()
    if (data.error) return res.status(data.code).send(data.error)

    const { secret } = req.query
    if (secret !== data.secret) return res.status(403).send('密钥错误')

    return res.status(200).json({
        subs: data.subNames,
        total_node: data.result.length
    })
})

sub.get('/get', async (req, res) => {
    const data = await fetchAllSubs()
    if (data.error) return res.status(data.code).send(data.error)

    const { secret } = req.query
    if (secret !== data.secret) return res.status(403).send('密钥错误')

    return res.status(200).send(data.result.join('\n'))
})

const subSecret = express.Router()
sub.use('/secret', subSecret)

import { needauth } from './auth.js'
subSecret.use(needauth)

subSecret.get('/get', async (req, res) => {
    const secret = (await env.data.get('sub_secret')) || ''
    return res.status(200).json({ secret })
})

subSecret.post('/set', async (req, res) => {
    const { secret } = req.body
    if (typeof secret !== 'string' || secret === '') {
        return res.status(400).send('请求错误')
    }

    await env.data.put('sub_secret', secret)
    return res.status(200).send('操作成功')
})

export default sub
