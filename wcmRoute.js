
const url = require('url');
const joinPath = require('path.join');

module.exports = function(pluginConf, web, wcmSettings) {

  var nunjucks = web.require('nunjucks');

  if (console.isDebug) {
    console.debug('WCM Settings : ' + JSON.stringify(wcmSettings));
  }
  var dmsUtils = web.cms.utils;
  var wcmConstants = web.cms.wcm.constants;
  var baseRouteViews = wcmSettings.baseRouteViews;
  var baseRoutePublic = wcmSettings.baseRoutePublic;

  var homeView = wcmSettings.homeView;

  var baseDir = wcmSettings.baseDir;
  var viewsDir = baseDir + pluginConf.viewsDir;

  var publicDir = baseDir + pluginConf.publicDir;

  var regex = new RegExp();

  var server = web.app;

  var wcm = web.cms.wcm;



  web.on('cms.beforeRenderList', function(options, req, res) {
    var folderPath = options.folderPath;
    if (folderPath.indexOf(viewsDir) == 0) {
      options.defaultDocTypeForAddFile = 'HtmlView';
    }
  })  

  var NunjucksMongoLoader = nunjucks.Loader.extend({
    async: true,
    init: function(basePath) {
        this.pathsToNames = {};
        this.basePath = basePath;

    },
   
    getSource: function(name, callback) {

        var fullpath = joinPath(this.basePath, name);
       
        this.pathsToNames[fullpath] = name;

        dmsUtils.retrieveDoc(fullpath, function(err, doc) {
          if (err) {throw err}
          if (!doc) {
            callback(null);
          } else {
            callback(err, {src: doc.content.toString('utf-8'), path: fullpath, noCache: web.conf.isDebug});
          }
        })
      }
  });

  var nunjucksLoader = new NunjucksMongoLoader(viewsDir);
  wcm.settings = wcmSettings;
  wcm.templateEngine = new nunjucks.Environment(nunjucksLoader, {autoescape: true});
  wcm.invalidateCache = function(mongoLoaderCachePath) {
    nunjucksLoader.emit('update', mongoLoaderCachePath);
  }

  web.templateEngine.extendNunjucks(wcm.templateEngine);

  var getRegexFromStr = function(regexStr) {
    var flags = regexStr.replace(/.*\/([gimy]*)$/, '$1');
    var pattern = regexStr.replace(new RegExp('^/(.*?)/'+flags+'$'), '$1');
    return new RegExp(pattern, flags);
  }
  if (!baseRoutePublic) {
    console.error('baseRoutePublic not found in settings');
  }

  baseRouteViews = baseRouteViews || '';

  var routePublic = getRegexFromStr('/^' + (baseRoutePublic) + '(.*)/');
  var routeViews = getRegexFromStr('/^' + (baseRouteViews) + '(.*)/');

  
  web.on('cms.afterDocumentUpdate', async function(doc) {
    var fullPath = joinPath(doc.folderPath, doc.name);

    if (fullPath.indexOf(viewsDir) == 0) {
      let pathMinusViewsDir = fullPath.substr(viewsDir.length);
      if (console.isDebug) {
        console.debug('Nunjucks cache invalidated: ' + pathMinusViewsDir);
      }
      wcm.invalidateCache(pathMinusViewsDir);

      if (web.conf.webServers) {
        for (let webServer of web.conf.webServers) {
          let serverFullPath = url.resolve(webServer, web.cms.wcm.constants.INVALIDATE_CACHE_URL);
          let fullUrl = `${serverFullPath}?p=${encodeURIComponent(pathMinusViewsDir)}`;

          let resp = await fetch(fullUrl, {
            method: 'get',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
          });

          if (resp.status == 200) {
            console.log("Successful Invalidate call:", fullUrl, pathMinusViewsDir, "status code:", resp.status);
          } else {
            console.warn(`Invalidate call failed: ${fullUrl}, resp:`, await resp.text());
          }

        }
      }
    }

  })

  var publicHandler = function() {
    return function(req, res, next) {

      var path = req.params[0];
      if (!path) {
        path = '/index.html';
      } else {
        path = path;
      }
      var dmsPath = joinPath(publicDir, path);
      if (console.isDebug) {
        console.debug('Routing dms path %s', dmsPath);
      }
      dmsUtils.retrieveDoc(dmsPath, function(err, doc) {
        if (err) throw err;

        if (doc) {
          var getMimeType = require('simple-mime')('application/octet-stream');

          var type = getMimeType(doc.name);
          res.writeHead(200, {'Content-Type': type})
          res.end(doc.content);
        } else {
          res.status(404).send('File not found.');
        }
      })
    }
  }

  var renderMongoPath = function(name, req, res, next, options) {
    var fullpath = joinPath(viewsDir, name);
    if (console.isDebug) {
      console.debug('Render mongo path: ' + fullpath);
    }
    dmsUtils.retrieveDoc(fullpath, function(err, doc) {
      if (!doc) {
        next();
        return;
      }

      var controller;

      if (doc.get('controller')) {
        //you have to use .get() for non defined models, need to fix this issue
        controller = web.include(doc.get('controller'));
      } else {
        controller = function(callback) {
          callback(null, options);
        }
      }

      controller(function(err, options) {
        if (err) {
          throw err;
        }
        options = options || {};
        web.callEvent('beforeRender', [name, options, null, req, res])
        web.callEvent('wcm.beforeRender', [name, options, null, req, res])
         wcm.templateEngine.render(name, options, function(err, res2) {
          if (err) {
            if (web.conf.isDebug) {
              res.status(500).send(err.stack);
            } else {
              res.status(500).send('Internal server error');
            }
            throw err;
          }
          res.send(res2);
        });
      }, req, res, next);
     
    });
  
  }

  web.cms.wcm.renderPath = renderMongoPath;

  var viewsHandler = function() {
    return function(req, res, next) {
      if (console.isDebug) {
        console.debug('PASSING WCM VIEWS LOADER');
      }
      var path = req.params[0];
      path = path + '.html';
      renderMongoPath(path, req, res, next);
      
    }
  }
  

  web.on('initServer', function() {
    if (homeView) {
      server.get('/', function(req, res, next) {
          renderMongoPath(homeView, req, res, next);
        })
      if (console.isDebug) {

        console.debug('Setting homeView to %s', homeView);
      }
    } else {
      if (console.isDebug) {
        console.debug('homeView not found. Skipping.');
      }
    }
    server.get(routePublic, publicHandler());
    server.all(routeViews, viewsHandler());
  })
  


}





