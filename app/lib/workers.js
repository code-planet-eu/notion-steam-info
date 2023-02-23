const request = require('request')
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
  notion.getDatabaseData(10)
}

notion.on('onData', async data => {
  const { results, next_cursor, has_more } = data
  if (has_more) {
    log('Getting more data from Notion...')
    notion.getDatabaseData(false, next_cursor)
  }
  log('Processing data...')
  workers.steamIds = results.map(item => item.properties.steamID.formula.string)
  workers.getSteamIdsData().then(() => {
    workers.getSteamIdsBans().then(() => {
      results.forEach(item => workers.checkSteam(item))
    })
  })
})

workers.getSteamIdsBans = () =>
  new Promise((resolve, reject) => {
    const steamIds = workers.steamIds.join(',')
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1?key=${config.steamApiKey}&steamids=${steamIds}`
    request(url, (error, response, body) => {
      if (error) {
        reject(error)
      } else {
        workers.steamGetPlayerBans = JSON.parse(body).players
        resolve()
      }
    })
  })

workers.getSteamIdsData = () =>
  new Promise((resolve, reject) => {
    const steamIds = workers.steamIds.join(',')
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${config.steamApiKey}&steamids=${steamIds}`
    request(url, (error, response, body) => {
      if (error) {
        reject(error)
      } else {
        workers.steamGetPlayerSummaries = JSON.parse(body).response.players
        resolve()
      }
    })
  })

// workers.getSteamLevel = steamID =>
//   new Promise((resolve, reject) => {
//     const url = `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1?key=${config.steamApiKey}&steamid=${steamID}`

//     request(url, (error, response, body) => {
//       if (error) {
//         reject(error)
//       } else {
//         resolve(JSON.parse(body).response.player_level)
//       }
//     })
//   })

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

  if (gameextrainfo !== undefined) return 'In-Game'
  else if (personastate === 0) return 'Offline'
  else return 'Online'
}

workers.getSteamBans = steamIdBans => {
  const { CommunityBanned, VACBanned, NumberOfGameBans } = steamIdBans

  if (CommunityBanned) return 'Community Ban'
  else if (VACBanned || NumberOfGameBans > 0) return 'Game / Vac Ban'
  else return 'Clear'
}

workers.getAccountAge = steamIdData => {
  const { timecreated } = steamIdData
  const date = new Date(timecreated * 1000).toISOString()

  return date
}

workers.findSteamIdBans = steamID => {
  const steamIdBans = workers.steamGetPlayerBans.find(item => item.SteamId === steamID)

  return steamIdBans
}

workers.findSteamIdData = steamID => {
  const steamIdData = workers.steamGetPlayerSummaries.find(item => item.steamid === steamID)

  return steamIdData
}

SteamSession.on('authenticated', async ({ session, item }) => {
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

  notion.addComment(item.id, error)
  notion.updateDatabase(item.id, data)
})

module.exports = workers
