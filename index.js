const workers = require('./app/lib/workers')
const { log } = require('./app/lib/logger')

const app = {}

app.init = async () => {
  log('Starting app...')
  await workers.init()
}
;(async () => {
  app.init()
})()
