
module.exports = async function(pluginConf, web) {
  
  var self = this;
  web.cms.wcm = self;
  web.cms.wcm.constants = new Object();

  Object.assign(pluginConf, Object.assign(require('./conf/conf.js'), pluginConf));
  
  Object.defineProperty(web.cms.wcm.constants, 'VIEWS_DIR', {configurable: true, get: function() {
    console.warn("web.cms.wcm.constants.VIEWS_DIR is obsolete, please use conf", new Error("Trace"));
    return '/views';
  }})

  Object.defineProperty(web.cms.wcm.constants, 'PUBLIC_DIR', {configurable: true, get: function() {
    console.warn("web.cms.wcm.constants.PUBLIC_DIR is obsolete, please use conf", new Error("Trace"));
    return '/public';
  }})

  web.cms.wcm.constants.INVALIDATE_CACHE_URL = '/admin/wcm/invalidateCache';

  web.cms.registerCmsModel('HtmlView', (pluginConf.pluginPath + '/models/HtmlView.js'));

  web.addRoutes({
    [web.cms.wcm.constants.INVALIDATE_CACHE_URL]: {
      get: function(req, res) {

        let path = req.query.p;

        if (!path) {
          res.status(400).send("NOT OK");
          return;
        }

        web.cms.wcm.invalidateCache(path);
        res.status(200).send("OK");
      }
    }
  });
    
  var dmsUtils = web.cms.utils;
  var DEFAULT_SETTINGS_PATH = '/web/settings.json';

  var defaultSettings = {
    baseDir: '/web',
    baseRouteViews: '', //can be /p for /p/about
    baseRoutePublic: '/pub',
    homeView: '/index.html'
  }

  await dmsUtils.createFileIfNotExist(DEFAULT_SETTINGS_PATH, JSON.stringify(defaultSettings));


  if (!web.syspars) {
    throw new Error("This plugin needs oils-plugin-syspars plugin")
  }

  await web.runOnce('WCM_RUN_ONCE', async function() {
    console.log('First time to run. Running WCM init data.');
    const fs = require('fs');
    const util = require('util');
    const readFileProm = util.promisify(fs.readFile);

    let data = await readFileProm(web.conf.baseDir + pluginConf.pluginPath + '/templates/index.html', 'utf8');
        
    await dmsUtils.createFileIfNotExist('/web/views/index.html', {docType:'HtmlView', content: data});

    data = await readFileProm(web.conf.baseDir + pluginConf.pluginPath + '/templates/main.html', 'utf8');
            
    await dmsUtils.createFileIfNotExist('/web/views/templates/main.html', {docType:'HtmlView', content: data});

    data = await readFileProm(web.conf.baseDir + pluginConf.pluginPath + '/templates/css/main.css', 'utf8');           
    dmsUtils.createFileIfNotExist('/web/public/css/main.css', data);

  });

  await web.call('cms.initWcm');

  let doc = await dmsUtils.retrieveDoc(DEFAULT_SETTINGS_PATH);

  if (doc) {
    let settings = JSON.parse(doc.content);
    
    require('./wcmRoute')(pluginConf, web, settings);
  } else {
    throw new Error('Path not found ' + DEFAULT_SETTINGS_PATH);
  }
  
}