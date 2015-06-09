'use strict';

var utils = require('./lib');

function sanitizeConfig(config) {
  if (!config.auth) return false
  return {
    url: config.url,
    display_url: config.display_url,
    auth: {
      type: config.auth.type,
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
      type: { type: String, enum: ['ssh', 'https', 'http'] },
      privkey: String,
      pubkey: String,
      username: String,
      password: String
    }
  },
  getBranches: function (userConfig, config, project, done) {
    utils.getBranches(config, project.privkey, done);
  },
  // native git doesn't have a great way to just get a single file at an arbitrary revision
  fastFile: false,
  getFile: function (filename, ref, config, project, done) {
    done(new Error('not implemented'));
    // utils.gitcmd('git archive --remote=' + url + ' ' + (ref.fetch || ref.id) + ' .strider.json', ...);
  },
  routes: function (app, context) {
    app.get('config', context.auth.requireProjectAdmin, function (req, res) {
      res.send(req.providerConfig());
    });
    app.put('config', context.auth.requireProjectAdmin, function (req, res) {
      // validate the config
      var config = sanitizeConfig(req.body);
      req.providerConfig(config, function (err) {
        if (err) {
          return res.status(500).send({errors: [err.message]});
        }
        res.send({success: true, message: 'Saved git config!', config: config});
      });
    });
  }
};

