const { Client } = require('@notionhq/client')
const EventEmitter = require('events')
const config = require('../../config/settings/config')

const notion = new EventEmitter()

notion.databaseId = config.notionDatabaseId

notion.client = new Client({
  auth: config.notionAuth
})

notion.getDatabase = async () => {
  const { results } = await notion.client.databases.query({
    database_id: notion.databaseId
  })

  return results
}

notion.getDatabaseData = interval => {
  if (interval) {
    setInterval(async () => {
      const data = await notion.getDatabase()
      notion.emit('onData', data)
      return data
    }, interval)
  } else {
    notion.getDatabase().then(data => {
      notion.emit('onData', data)
      return data
    })
  }
}

notion.updateDatabase = (id, properties) =>
  new Promise((resolve, reject) => {
    notion.client.pages
      .update({
        page_id: id,
        properties
      })
      .then(resolve)
      .catch(reject)
  })

notion.addComment = (id, comment) =>
  new Promise((resolve, reject) => {
    notion.client.comments
      .create({
        parent: {
          page_id: id
        },
        rich_text: [{ text: { content: comment } }]
      })
      .then(resolve)
      .catch(reject)
  })

module.exports = notion
