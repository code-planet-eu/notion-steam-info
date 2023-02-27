const { Client } = require('@notionhq/client')
const EventEmitter = require('events')
const config = require('../../config/settings/config')

const notion = new EventEmitter()

notion.databaseId = config.notionDatabaseId

notion.client = new Client({
  auth: config.notionAuth
})

notion.getDatabaseResults = async start_cursor => {
  const response = await notion.client.databases.query({
    database_id: notion.databaseId,
    start_cursor,
    filter: {
      property: 'Banned',
      select: {
        equals: 'Clear'
      }
    }
  })

  const { results, next_cursor, has_more } = response
  return { results, next_cursor, has_more }
}

notion.getDatabaseData = async (interval, start_cursor) => {
  const fetchData = async () => {
    const { results, next_cursor, has_more } = await notion.getDatabaseResults(start_cursor)
    notion.emit('onData', { results, next_cursor, has_more })
  }

  if (interval) {
    setInterval(fetchData, 1000 * 60 * interval)
  } else {
    await fetchData()
  }
}

notion.updateDatabase = async (id, properties) => {
  try {
    await notion.client.pages.update({
      page_id: id,
      properties
    })
  } catch (error) {
    /* empty */
  }
}

notion.addComment = async (id, comment) => {
  try {
    await notion.client.comments.create({
      parent: {
        page_id: id
      },
      rich_text: [{ text: { content: comment } }]
    })
  } catch (error) {
    /* empty */
  }
}

module.exports = notion
