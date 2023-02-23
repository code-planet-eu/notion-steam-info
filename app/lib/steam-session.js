const EventEmitter = require('events')
const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const request = require('request')
const { EAuthSessionGuardType, EAuthTokenPlatformType, LoginSession, EResult } = require('steam-session')

const { log } = require('./logger')

const SteamSession = new EventEmitter()

SteamSession.login = async item => {
  const session = new LoginSession(EAuthTokenPlatformType.SteamClient)

  await SteamSession.loginWithCred(item, session)

  if (session.result?.actionRequired) SteamSession.guard(item, session)

  session.on('error', error => {
    log(error, 'error')

    SteamSession.emit('error', { error, item })
  })

  session.on('timeout', () => {
    const error = 'This login attempt has timed out.'

    log(error, 'error')

    SteamSession.emit('error', { error, item })
  })

  session.on('authenticated', async () => {
    log(`[${item.properties.Username.rich_text[0].plain_text}] Logged in.`)

    SteamSession.emit('authenticated', { session, item })

    return session.refreshToken
  })

  session.on('steamGuardMachineToken', async () => {
    const { steamGuardMachineToken } = session

    SteamSession.emit('steamGuardMachineToken', { steamGuardMachineToken, item })
  })
}

SteamSession.loginWithCred = async (item, session) => {
  const accountName = item.properties.Username.rich_text[0].plain_text
  const password = item.properties.Password.rich_text[0].plain_text

  log(`[${accountName}] Logging in...`)

  if (accountName === '' || password === '') {
    const error = 'No credentials found.'

    log(error, 'error')

    SteamSession.emit('error', { error, item })

    return
  }

  await session
    .startWithCredentials({
      accountName,
      password
    })
    .catch(error => {
      log(error, 'error')
      error = error.eresult === EResult.InvalidPassword && 'Invalid password.'
      SteamSession.emit('error', { error, item })
    })
    .then(result => {
      session.result = result
    })
}

SteamSession.guard = async (item, session) => {
  log(`[${item.properties.Username.rich_text[0].plain_text}] Guard required.`)

  const guardType = session.result.validActions[0].type

  if (guardType === EAuthSessionGuardType.EmailCode) await SteamSession.getGuardEmailCode(item, session)
}

SteamSession.getGuardEmailCode = async (item, session) => {
  dayjs.extend(utc)

  const mailID = item.properties.mailID.formula.string
  const minAgo = dayjs().subtract(5, 'minute').utc()
  const url = `https://mail.code-planet.eu/api/show/${mailID}?after=${minAgo.format('YYYY-MM-DDTHH:mm:ss.SSS')}Z`

  request(url, async (error, response, body) => {
    if (error || response.statusCode !== 200) return
    body = JSON.parse(body)
    session.submitSteamGuardCode(body.guard || body[0].guard)
  })
}

module.exports = SteamSession
