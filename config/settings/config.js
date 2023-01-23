const config = {}

config.notionAuth = process.env.NOTION_AUTH || 'secret_123'
config.notionDatabaseId = process.env.NOTION_DATABASE_ID || '123'

config.steamApiKey = process.env.STEAM_API_KEY || '123'

module.exports = config
