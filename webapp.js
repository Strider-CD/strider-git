
var utils = require('./lib')

function sanitizeConfig(config) {
  if (!config.auth) return false
  return {
    url: config.url,
    display_url: config.display_url,
    auth: {
      type: config.auth.type === 'ssh' ? 'ssh' : 'https',
      privkey: config.auth.privkey,
      pubkey: config.auth.pubkey,
      username: config.auth.username,
      password: config.auth.password
    }
  }
}


module.exports = {
  config: {
    url: String,
    display_url: String,
    auth: {
      type: { type: String, enum: ['ssh', 'https'] },
      privkey: String,
      pubkey: String,
      username: String,
      password: String
    }
  },
  getBranches: function (userConfig, config, project, done) {
    utils.getBranches(config, project.privkey, done)
  },
  getFile: function (config, filename) {
    filename = filename || '.strider.json'
    throw new Error('Not implemented')
  },
  routes: function (app, context) {
    app.get('config', context.auth.projectAdmin, function (req, res) {
      res.send(req.providerConfig())
    })
    app.put('config', context.auth.projectAdmin, function (req, res) {
      // validate the config
      var config = sanitizeConfig(req.body)
      req.providerConfig(config, function (err) {
        if (err) {
          res.status(500)
          return res.send({errors: [err.message]})
        }
        res.send({success: true, message: 'Saved git config!', config: config})
      })
    })
  }
}

