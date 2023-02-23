const { Client } = require('@notionhq/client')
const EventEmitter = require('events')
const config = require('../../config/settings/config')

const notion = new EventEmitter()

notion.databaseId = config.notionDatabaseId

notion.client = new Client({
  auth: config.notionAuth
})

notion.getDatabase = async start_cursor => {
  const { results, next_cursor, has_more } = await notion.client.databases.query({
    database_id: notion.databaseId,
    start_cursor
  })

  return { results, next_cursor, has_more }
}

notion.getDatabaseData = (interval, start_cursor) => {
  if (interval) {
    setInterval(async () => {
      const { results, next_cursor, has_more } = await notion.getDatabase(start_cursor)
      notion.emit('onData', { results, next_cursor, has_more })
      return results
    }, 1000 * 60 * interval)
  } else {
    notion.getDatabase(start_cursor).then(data => {
      const { results, next_cursor, has_more } = data
      notion.emit('onData', { results, next_cursor, has_more })
      return results
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
