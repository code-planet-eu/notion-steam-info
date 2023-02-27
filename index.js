const workers = require('./app/lib/workers')
const { log } = require('./app/lib/logger')

log('Starting app...')

workers.init()
