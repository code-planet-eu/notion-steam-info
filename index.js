const workers = require('./app/lib/workers')
const { log } = require('./app/lib/logger')

const app = {}

app.init = () => {
  const now = new Date()
  const delay = 30 - (now.getMinutes() % 30)

  log(`Waiting ${delay} minutes to start...`)

  setTimeout(() => {
    log('Starting app...')

    workers.init()
  }, delay * 60 * 1000)
}
;(async () => {
  app.init()
})()
