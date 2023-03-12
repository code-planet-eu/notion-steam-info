const fetch = require('node-fetch')
const jwtDecode = require('jwt-decode')

const config = require('../../config/settings/config')
const { log } = require('./logger')
const notion = require('./notion')
const SteamSession = require('./steam-session')

const workers = {}

workers.steamIds = []
workers.steamGetPlayerBans = []
workers.steamGetPlayerSummaries = []

workers.init = async () => {
  log('Starting workers...')
  log('Getting data from Notion...')
  notion.getDatabaseData(5)
}

notion.on('onData', async ({ results, next_cursor, has_more }) => {
  log('Processing data...')
  try {
    workers.steamIds = results.map(item => item.properties.steamID.formula.string)
    await Promise.all([workers.getSteamIdsData(), workers.getSteamIdsBans()])
    results.forEach(item => workers.checkSteam(item))
    if (has_more) {
      log('Getting more data from Notion...')
      await notion.getDatabaseData(false, next_cursor)
    }
  } catch (error) {
    log(error, 'error')
  }
})

workers.getSteamIdsBans = async () => {
  try {
    const steamIds = workers.steamIds.join(',')
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1?key=${config.steamApiKey}&steamids=${steamIds}`
    const request = await fetch(url)
    const { players } = await request.json()
    workers.steamGetPlayerBans = players
  } catch (error) {
    log(error, 'error')
  }
}

workers.getSteamIdsData = async () => {
  try {
    const steamIds = workers.steamIds.join(',')
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${config.steamApiKey}&steamids=${steamIds}`
    const request = await fetch(url)
    const { response } = await request.json()
    workers.steamGetPlayerSummaries = response.players
  } catch (error) {
    log(error, 'error')
  }
}

workers.checkSteam = async item => {
  const { id, properties } = item
  const steamID = properties.steamID.formula.string
  const login = properties.login.checkbox

  if (login) SteamSession.login(item)

  const steamIdBans = workers.findSteamIdBans(steamID)
  const steamIdData = workers.findSteamIdData(steamID)

  if (steamIdBans === undefined || steamIdData === undefined) return

  const SteamStatus = workers.getSteamStatus(steamIdData)
  const SteamBans = workers.getSteamBans(steamIdBans)
  const AccountAge = workers.getAccountAge(steamIdData)

  const data = {
    'Steam Status': {
      select: {
        name: SteamStatus
      }
    },
    Banned: {
      select: {
        name: SteamBans
      }
    },
    Created: {
      date: {
        start: AccountAge
      }
    }
  }

  notion.updateDatabase(id, data)
}

workers.getSteamStatus = steamIdData => {
  const { personastate, gameextrainfo } = steamIdData

  switch (true) {
    case gameextrainfo !== undefined:
      return 'In-Game'
    case personastate === 0:
      return 'Offline'
    default:
      return 'Online'
  }
}

workers.getSteamBans = steamIdBans => {
  const { CommunityBanned, VACBanned, NumberOfGameBans } = steamIdBans

  switch (true) {
    case CommunityBanned:
      return 'Community Ban'
    case VACBanned || NumberOfGameBans > 0:
      return 'Game / Vac Ban'
    default:
      return 'Clear'
  }
}

workers.getAccountAge = steamIdData => {
  const { timecreated } = steamIdData
  const date = new Date(timecreated * 1000).toISOString()

  return date
}

workers.findSteamIdBans = steamID => workers.steamGetPlayerBans.find(item => item.SteamId === steamID)

workers.findSteamIdData = steamID => workers.steamGetPlayerSummaries.find(item => item.steamid === steamID)

SteamSession.on('authenticated', async ({ session, item }) => {
  const date = new Date(jwtDecode(session.accessToken).rt_exp * 1000).toISOString()

  const data = {
    refreshToken: {
      rich_text: [
        {
          text: {
            content: session.refreshToken
          }
        }
      ]
    },
    login: {
      checkbox: false
    },
    refreshTokenExp: {
      date: {
        start: date
      }
    }
  }
  await notion.updateDatabase(item.id, data)
})

SteamSession.on('error', async ({ error, item }) => {
  const data = {
    login: {
      checkbox: false
    }
  }

  await notion.addComment(item.id, error)
  await notion.updateDatabase(item.id, data)
})

module.exports = workers
