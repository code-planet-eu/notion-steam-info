const workers = require('./app/lib/workers')
const { log } = require('./app/lib/logger')

const app = {}

app.init = () => {
  log('Starting app...')

  workers.init()
}
;(async () => {
  app.init()
})()
