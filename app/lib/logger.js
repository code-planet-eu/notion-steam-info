const Logger = require('@ptkdev/logger')
const log = require('log-to-file')
const config = require('../../config/settings/config')

const logger = new Logger()

module.exports.log = (message, type = 'info', file = `${config.node_env}.log`) => {
  logger[type](message)
  log(`[${type.toUpperCase()}] - ${JSON.stringify(message)}`, `./data/log/${file}`)
}
