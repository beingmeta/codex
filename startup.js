/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/startup.js ###################### */

/* Copyright (C) 2009-2014 beingmeta, inc.

   This file specifies the startup of the metaBook web application,
   initializing both internal data structures and the DOM.

   This file is part of metaBook, a Javascript/DHTML web application for reading
   large structured documents (sBooks).

   For more information on sbooks, visit www.sbooks.net
   For more information on knodules, visit www.knodules.net
   For more information about beingmeta, visit www.beingmeta.com

   This library uses the FDJT (www.fdjt.org) toolkit.

   This program comes with absolutely NO WARRANTY, including implied
   warranties of merchantability or fitness for any particular
   purpose.

   Use and redistribution (especially embedding in other
   CC licensed content) is permitted under the terms of the
   Creative Commons "Attribution-NonCommercial" license:

   http://creativecommons.org/licenses/by-nc/3.0/ 

   Other uses may be allowed based on prior agreement with
   beingmeta, inc.  Inquiries can be addressed to:

   licensing@beingmeta.com

   Enjoy!

*/
/* jshint browser: true */
/* global metaBook: false, Markdown: false */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
//var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
//var metaBook=((typeof metaBook !== "undefined")?(metaBook):({}));
//var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
//var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

metaBook.Startup=
    (function(){
        "use strict";

        var fdjtString=fdjt.String;
        var fdjtDevice=fdjt.device;
        var fdjtState=fdjt.State;
        var fdjtAjax=fdjt.Ajax;
        var fdjtTime=fdjt.Time;
        var fdjtLog=fdjt.Log;
        var fdjtDOM=fdjt.DOM;
        var fdjtUI=fdjt.UI;
        var fdjtID=fdjt.ID;
        var RefDB=fdjt.RefDB, Ref=fdjt.Ref;
        
        var CodexLayout=fdjt.CodexLayout;

        var https_root="https://s3.amazonaws.com/beingmeta/static/";

        // Imported functions
        var getLocal=fdjtState.getLocal;
        var setLocal=fdjtState.setLocal;
        var getQuery=fdjtState.getQuery;
        var getHash=fdjtState.getHash;
        var getCookie=fdjtState.getCookie;
        var getMeta=fdjtDOM.getMeta;
        var getLink=fdjtDOM.getLink;
        var addClass=fdjtDOM.addClass;
        var dropClass=fdjtDOM.dropClass;
        var getChildren=fdjtDOM.getChildren;
        var getGeometry=fdjtDOM.getGeometry;

        var mB=metaBook;
        var mbID=mB.ID;
        var fixStaticRefs=mB.fixStaticRefs;

        // This is the window outer dimensions, which is stable across
        // most chrome changes, especially on-screen keyboards.  We
        // track so that we can avoid resizes which shouldn't force
        // layout updates.
        var outer_height=false, outer_width=false;

        /* Initialization */
        
        function startupLog(){
            if (!(mB.Trace.startup)) return;
            fdjtLog.apply(null,arguments);}

        function startupMessage(){
            if ((mB.Trace.startup)&&
                (typeof mB.Trace.startup === "number")&&
                (mB.Trace.startup>1))
                fdjtLog.apply(null,arguments);}
        mB.startupMessage=startupMessage;

        /* Save local */

        var readLocal=mB.readLocal;
        var saveLocal=mB.saveLocal;
        var clearOffline=mB.clearOffline;

        /* Whether to resize by default */
        var resize_default=false;

        /* Interval timers */
        var ticktock=false, synctock=false;
        
        /* Configuration information */

        var config_handlers={};
        var default_config=
            {layout: 'bypage',forcelayout: false,
             bodysize: 'normal',bodyfamily: 'serif',
             justify: false,linespacing: 'normal',
             uisize: 'normal',showconsole: false,
             animatecontent: true,animatehud: true,
             hidesplash: false,keyboardhelp: true,
             holdmsecs: 150,wandermsecs: 1500,
             syncinterval: 60,glossupdate: 5*60,
             locsync: 15, cacheglosses: true,
             soundeffects: false, buzzeffects: false,
             controlc: false};
        var current_config={};
        var saved_config={};

        var setCheckSpan=fdjtUI.CheckSpan.set;

        function addConfig(name,handler){
            if (mB.Trace.config>1)
                fdjtLog("Adding config handler for %s: %s",name,handler);
            config_handlers[name]=handler;
            if (current_config.hasOwnProperty(name)) {
                if (mB.Trace.config>1)
                    fdjtLog("Applying config handler to current %s=%s",
                            name,current_config[name]);
                handler(name,current_config[name]);}}
        mB.addConfig=addConfig;

        function getConfig(name){
            if (!(name)) return current_config;
            else return current_config[name];}
        mB.getConfig=getConfig;

        function setConfig(name,value,save){
            if (arguments.length===1) {
                var config=name;
                mB.postconfig=[];
                if (mB.Trace.config) fdjtLog("batch setConfig: %s",config);
                for (var setting in config) {
                    if (config.hasOwnProperty(setting))
                        setConfig(setting,config[setting]);}
                var dopost=mB.postconfig;
                mB.postconfig=false;
                if ((mB.Trace.config>1)&&(!((dopost)||(dopost.length===0))))
                    fdjtLog("batch setConfig, no post processing",config);
                var post_i=0; var post_lim=dopost.length;
                while (post_i<post_lim) {
                    if (mB.Trace.config>1)
                        fdjtLog("batch setConfig, post processing %s",
                                dopost[post_i]);
                    dopost[post_i++]();}
                return;}
            if (mB.Trace.config) fdjtLog("setConfig %o=%o",name,value);
            var input_name="METABOOK"+(name.toUpperCase());
            var inputs=document.getElementsByName(input_name);
            var input_i=0, input_lim=inputs.length;
            while (input_i<input_lim) {
                var input=inputs[input_i++];
                if (input.tagName!=='INPUT') continue;
                if (input.type==='checkbox') {
                    if (value) setCheckSpan(input,true);
                    else setCheckSpan(input,false);}
                else if (input.type==='radio') {
                    if (value===input.value) setCheckSpan(input,true);
                    else setCheckSpan(input,false);}
                else input.value=value;}
            if (!((current_config.hasOwnProperty(name))&&
                  (current_config[name]===value))) {
                if (config_handlers[name]) {
                    if (mB.Trace.config)
                        fdjtLog("setConfig (handler=%s) %o=%o",
                                config_handlers[name],name,value);
                    config_handlers[name](name,value);}
                else if (mB.Trace.config)
                    fdjtLog("setConfig (no handler) %o=%o",name,value);
                else {}}
            else if (mB.Trace.config)
                fdjtLog("Redundant setConfig %o=%o",name,value);
            else {}
            if (current_config[name]!==value) {
                current_config[name]=value;
                if ((!(save))&&(inputs.length))
                    fdjtDOM.addClass("METABOOKSETTINGS","changed");}
            if ((save)&&(saved_config[name]!==value)) {
                saved_config[name]=value;
                saveConfig(saved_config);}}
        mB.setConfig=setConfig;
        mB.resetConfig=function(){setConfig(saved_config);};

        function saveConfig(config,toserver){
            if (typeof toserver === "undefined") toserver=true;
            if (mB.Trace.config) {
                fdjtLog("saveConfig %o",config);
                fdjtLog("saved_config=%o",saved_config);}
            if (!(config)) config=saved_config;
            // Save automatically applies (seems only fair)
            else setConfig(config);
            var saved={};
            for (var setting in config) {
                if ((default_config.hasOwnProperty(setting))&&
                    (config[setting]!==default_config[setting])&&
                    (!(getQuery(setting)))) {
                    saved[setting]=config[setting];}}
            if (mB.Trace.config) fdjtLog("Saving config %o",saved);
            saveLocal("codex.config("+mB.docuri+")",JSON.stringify(saved));
            if ((toserver)&&(navigator.onLine)) {
                var req=new XMLHttpRequest();
                req.onreadystatechange=function(evt){
                    if ((req.readyState===4)&&
                        (req.status>=200)&&(req.status<300)) {
                        mB.setConnected(true);
                        saved_config=JSON.parse(req.responseText);}
                    else if ((req.readyState===4)&&(navigator.onLine))
                        mB.setConnected(false);
                    else {}
                    if (mB.Trace.state)
                        fdjtLog("configSave(callback) %o ready=%o status=%o %j",
                                evt,req.readyState,
                                ((req.readyState===4)&&(req.status)),
                                saved_config);};
                var uri="https://config.sbooks.net/config?"+
                    encodeURIComponent(JSON.stringify(saved));
                try {
                    req.open("GET",uri,true);
                    req.withCredentials=true;
                    req.send(); }
                catch (ex) {}}
            fdjtDOM.dropClass("METABOOKSETTINGS","changed");
            saved_config=saved;}
        mB.saveConfig=saveConfig;

        function initConfig(){
            var setting, started=fdjtTime(); // changed=false;
            var config=getLocal("codex.config("+mB.docuri+")",true)||
                fdjtState.getSession("codex.config("+mB.docuri+")",true);
            mB.postconfig=[];
            if (config) {
                for (setting in config) {
                    if ((config.hasOwnProperty(setting))&&
                        (!(getQuery(setting)))) {
                        // if ((!(default_config.hasOwnProperty(setting)))||
                        //    (config[setting]!==default_config[setting]))
                        //    changed=true;
                        setConfig(setting,config[setting]);}}}
            else config={};
            if (mB.Trace.config)
                fdjtLog("initConfig (default) %j",default_config);
            for (setting in default_config) {
                if (!(config.hasOwnProperty(setting)))
                    if (default_config.hasOwnProperty(setting)) {
                        if (getQuery(setting))
                            setConfig(setting,getQuery(setting));
                        else if (getMeta("METABOOK."+setting))
                            setConfig(setting,getMeta("CODEX."+setting));
                        else setConfig(setting,default_config[setting]);}}
            var dopost=mB.postconfig;
            mB.postconfig=false;
            var i=0; var lim=dopost.length;
            while (i<lim) dopost[i++]();
            
            // if (changed) fdjtDOM.addClass("METABOOKSETTINGS","changed");
            
            var devicename=current_config.devicename;
            if ((devicename)&&(!(fdjtString.isEmpty(devicename))))
                mB.deviceName=devicename;
            if (mB.Trace.startup>1)
                fdjtLog("initConfig took %dms",fdjtTime()-started);}
        
        var getParent=fdjtDOM.getParent;
        var hasParent=fdjtDOM.hasParent;
        var getChild=fdjtDOM.getChild;

        function updateConfig(name,id,save){
            if (typeof save === 'undefined') save=false;
            var elt=((typeof id === 'string')&&(document.getElementById(id)))||
                ((id.nodeType)&&(getParent(id,'input')))||
                ((id.nodeType)&&(getChild(id,'input')))||
                ((id.nodeType)&&(getChild(id,'textarea')))||
                ((id.nodeType)&&(getChild(id,'select')))||
                (id);
            if (mB.Trace.config) fdjtLog("Update config %s",name);
            if ((elt.type==='radio')||(elt.type==='checkbox'))
                setConfig(name,elt.checked||false,save);
            else setConfig(name,elt.value,save);}
        mB.updateConfig=updateConfig;

        mB.addConfig("keyboardhelp",function(name,value){
            mB.keyboardhelp=value;
            fdjtUI.CheckSpan.set(
                document.getElementsByName("METABOOKKEYBOARDHELP"),
                value);});
        mB.addConfig("devicename",function(name,value){
            if (fdjtString.isEmpty(value)) mB.deviceName=false;
            else mB.deviceName=value;});

        mB.addConfig("holdmsecs",function(name,value){
            mB.holdmsecs=value;
            fdjtUI.TapHold.default_opts.holdthresh=value;});
        mB.addConfig("wandermsecs",function(name,value){
            mB.wandermsecs=value;
            fdjtUI.TapHold.default_opts.wanderthresh=value;});
        mB.addConfig("taptapmsecs",function(name,value){
            mB.taptapmsecs=value;
            fdjtUI.TapHold.default_opts.taptapthresh=value;});

        mB.addConfig("glossupdate",function(name,value){
            mB.update_interval=value;
            if (ticktock) {
                clearInterval(mB.ticktock);
                mB.ticktock=ticktock=false;
                if (value) mB.ticktock=ticktock=
                    setInterval(updateInfo,value*1000);}});

        mB.addConfig("syncinterval",function(name,value){
            mB.sync_interval=value;
            if (mB.synctock) {
                clearInterval(mB.synctock);
                mB.synctock=synctock=false;}
            if ((value)&&(mB.locsync))
                mB.synctock=synctock=
                setInterval(mB.syncState,value*1000);});
        mB.addConfig("locsync",function(name,value){
            // Start or clear the sync check interval timer
            if ((!(value))&&(mB.synctock)) {
                clearInterval(mB.synctock);
                mB.synctock=synctock=false;}
            else if ((value)&&(!(mB.synctock))&&
                     (mB.sync_interval))
                mB.synctock=synctock=
                setInterval(mB.syncState,(mB.sync_interval)*1000);
            else {}
            mB.locsync=value;});
        
        function syncStartup(){
            // This is the startup code which is run
            //  synchronously, before the time-sliced processing
            fdjtLog.console="METABOOKCONSOLELOG";
            fdjtLog.consoletoo=true;
            if (!(mB._setup_start)) mB._setup_start=new Date();
            fdjtLog("This is metaBook v%s, built %s on %s, launched %s, from %s",
                    mB.version,mB.buildtime,mB.buildhost,
                    mB._setup_start.toString(),
                    mB.root||"somewhere");
            if (fdjtID("METABOOKBODY")) mB.body=fdjtID("METABOOKBODY");

            // Get window outer dimensions (this doesn't count Chrome,
            // onscreen keyboards, etc)
            outer_height=window.outerHeight;
            outer_width=window.outerWidth;

            if ((fdjtDevice.standalone)&&
                (fdjtDevice.ios)&&(fdjtDevice.mobile)&&
                (!(getLocal("codex.user")))&&
                (fdjtState.getQuery("SBOOKS:AUTH-"))) {
                var authkey=fdjt.State.getQuery("SBOOKS:AUTH-");
                fdjtLog("Got auth key %s",authkey);
                mB.authkey=authkey;}

            // Check for any trace settings passed as query arguments
            if (getQuery("cxtrace")) readTraceSettings();
            
            // Get various settings for the sBook from the HTML
            // (META tags, etc), including settings or guidance for
            // skimming, graphics, layout, glosses, etc.
            readBookSettings();
            fdjtLog("Book %s (%s) %s (%s%s)",
                    mB.docref||"@??",mB.bookbuild||"",
                    mB.refuri,mB.sourceid,
                    ((mB.sourcetime)?(": "+mB.sourcetime):("")));
            
            // Initialize the databases
            mB.initDB();

            // Get config information
            initConfig();

            // This sets various aspects of the environment
            readEnvSettings();

            // Figure out if we have a user and whether we can keep
            // user information
            if (getLocal("codex.user")) {
                mB.persist=true;
                userSetup();}

            // Initialize the book state (location, targets, etc)
            mB.initState(); mB.syncState();

            // If we have no clue who the user is, ask right away (updateInfo())
            if (!((mB.user)||(window._sbook_loadinfo)||
                  (mB.userinfo)||(window._userinfo)||
                  (getLocal("codex.user")))) {
                if (mB.Trace.startup)
                    fdjtLog("No local user info, requesting from sBooks server %s",mB.server);
                // When mB.user is not defined, this just requests identity information
                updateInfo();}

            // Execute any FDJT initializations
            fdjt.Init();

            bookSetup();
            deviceSetup();
            coverSetup();
            appSetup();
            mB._ui_setup=fdjtTime();
            showMessage();
            if (mB._user_setup) setupUI4User();
            contentSetup();

            // Reapply config settings to update the HUD UI
            mB.setConfig(mB.getConfig());

            var adjstart=fdjt.Time();
            fdjtDOM.tweakFonts(fdjtID("METABOOKHUD"));
            if (mB.Trace.startup>2)
                fdjtLog("Adjusted HUD fonts in %fsecs",
                        ((fdjt.Time()-adjstart)/1000));

            if (mB.Trace.startup>1)
                fdjtLog("Initializing markup converter");
            var markdown_converter=new Markdown.Converter();
            mB.markdown_converter=markdown_converter;
            mB.md2HTML=function(mdstring){
                return markdown_converter.makeHtml(mdstring);};
            function md2DOM(mdstring,inline){
                var div=fdjtDOM("div"), root=div;
                var frag=document.createDocumentFragment();
                div.innerHTML=markdown_converter.makeHtml(mdstring);
                var children=root.childNodes, nodes=[];
                if ((inline)&&(children.length===1)&&
                    (children[0].nodeType===1)&&
                    (children[0].tagName==="P")) {
                    root=children[0]; children=root.childNodes;}
                var i=0, lim=children.length; while (i<lim) {
                    nodes.push(children[i++]);}
                i=0; while (i<lim) frag.appendChild(nodes[i++]);
                return frag;}
            mB.md2DOM=md2DOM;

            mB.Timeline.sync_startup=new Date();
            if (mB.onsyncstartup) {
                var delayed=mB.onsyncstartup;
                delete mB.onsyncstartup;
                if (Array.isArray(delayed)) {
                    var i=0, lim=delayed.length;
                    while (i<lim) {delayed[i](); i++;}}
                else delayed();}
            if (mB.Trace.startup)
                fdjtLog("Done with sync startup");}

        function showMessage(){
            var message=fdjt.State.getCookie("SBOOKSPOPUP");
            if (message) fdjt.UI.alertFor(10,message);
            fdjt.State.clearCookie("SBOOKSPOPUP","/","sbooks.net");
            fdjt.State.clearCookie("SBOOKSMESSAGE","/","sbooks.net");}

        function readEnvSettings() {

            // Initialize domain and origin for browsers which care
            try {document.domain="sbooks.net";}
            catch (ex) {fdjtLog.warn("Error setting document.domain");}
            try {document.origin="sbooks.net";}
            catch (ex) {fdjtLog.warn("Error setting document.origin");}

            // First, define common schemas
            fdjtDOM.addAppSchema("SBOOK","http://sbooks.net/");
            fdjtDOM.addAppSchema("SBOOKS","http://sbooks.net/");
            fdjtDOM.addAppSchema("metaBook","http://codex.sbooks.net/");
            fdjtDOM.addAppSchema("DC","http://purl.org/dc/elements/1.1/");
            fdjtDOM.addAppSchema("DCTERMS","http://purl.org/dc/terms/");
            fdjtDOM.addAppSchema("OLIB","http://openlibrary.org/");

            mB.devinfo=fdjtState.versionInfo();
            
            /* Where to get your images from, especially to keep
               references inside https */
            if ((mB.root==="http://static.beingmeta.com/")&&
                (window.location.protocol==='https:'))
                mB.root=https_root;
            // Whether to suppress login, etc
            if ((getLocal("codex.nologin"))||(getQuery("nologin")))
                mB.nologin=true;
            var sbooksrv=getMeta("SBOOKS.server")||getMeta("SBOOKSERVER");
            if (sbooksrv) mB.server=sbooksrv;
            else if (fdjtState.getCookie("SBOOKSERVER"))
                mB.server=fdjtState.getCookie("SBOOKSERVER");
            else mB.server=lookupServer(document.domain);
            if (!(mB.server)) mB.server=mB.default_server;

            // Get the settings for scanning the document structure
            getScanSettings();}

        function appSetup() {

            var body=document.body;
            var started=fdjtTime();

            if (mB.Trace.startup>2) fdjtLog("Starting app setup");

            // Create a custom stylesheet for the app
            var style=fdjtDOM("STYLE");
            fdjtDOM(document.head,style);
            mB.stylesheet=style.sheet;

            // This initializes the book tools (the HUD/Heads Up Display)
            mB.initHUD();

            var i, lim;
            var uri=
                ((typeof mB.coverimage === "string")&&(mB.coverimage))||
                ((typeof mB.bookimage === "string")&&(mB.bookimage))||
                ((typeof mB.bookcover === "string")&&(mB.bookcover))||
                ((typeof mB.coverpage === "string")&&(mB.coverpage));
            if (uri) {
                var bookimages=fdjtDOM.$("img.codexbookimage");
                i=0; lim=bookimages.length;
                while (i<lim) {
                    if (bookimages[i].src) i++;
                    else bookimages[i++].src=uri;}}
            var thumb_uri=
                ((typeof mB.thumbnail === "string")&&(mB.thumbnail));
            if (thumb_uri) {
                var thumbimages=fdjtDOM.$("img.codexbookthumb");
                i=0; lim=thumbimages.length;
                while (i<lim) {
                    if (thumbimages[i].src) i++;
                    else thumbimages[i++].src=thumb_uri;}}
            var icon_uri=
                ((typeof mB.icon === "string")&&(mB.icon));
            if (icon_uri) {
                var iconimages=fdjtDOM.$("img.codexbookicon");
                i=0; lim=iconimages.length;
                while (i<lim) {
                    if (iconimages[i].src) i++;
                    else iconimages[i++].src=icon_uri;}}
            if (mB.refuri) {
                var refuris=document.getElementsByName("REFURI");
                if (refuris) {
                    var j=0; var len=refuris.length;
                    while (j<len) {
                        if (refuris[j].value==='fillin')
                            refuris[j++].value=mB.refuri;
                        else j++;}}}

            addConfig("cacheglosses",
                      function(name,value){mB.cacheGlosses(value);});

            // Setup the reticle (if desired)
            if ((typeof (body.style["pointer-events"])!== "undefined")&&
                ((mB.demo)||(fdjtState.getLocal("codex.demo"))||
                 (fdjtState.getCookie("sbooksdemo"))||
                 (getQuery("demo")))) {
                fdjtUI.Reticle.setup();}

            fdjtLog("Body: %s",document.body.className);

            if (mB.Trace.startup>1)
                fdjtLog("App setup took %dms",fdjtTime()-started);}
        
        function contentSetup(){
            var started=fdjtTime();
            // Modifies the DOM in various ways
            initBody();
            // Size the content
            sizeContent();
            // Setup the UI components for the body and HUD
            mB.setupGestures();
            if (mB.Trace.gestures)
                fdjtLog("Content setup in %dms",fdjtTime()-started);}

        mB.setSync=function setSync(val){
            if (!(val)) return false;
            var cur=mB.sync;
            if ((cur)&&(cur>val)) return cur;
            mB.sync=val;
            if (mB.persist)
                saveLocal("codex.sync("+mB.docuri+")",val);
            return val;};

        function userSetup(){
            // Get any local sync information
            var sync=mB.sync=getLocal("codex.sync("+mB.refuri+")",true)||0;
            var started=fdjtTime();
            var loadinfo=false, userinfo=false;

            // If the configuration is set to not persist, but there's
            //  a sync timestamp, we should erase what's there.
            if ((mB.sync)&&(!(mB.persist))) clearOffline();

            if (mB.nologin) {}
            else if ((mB.persist)&&(getLocal("codex.user"))) {
                initUserOffline();
                if (mB.Trace.storage) 
                    fdjtLog("Local info for %o (%s) from %o",
                            mB.user._id,mB.user.name,mB.sync);
                // Clear any loadinfo read on startup from the
                // application cache but already stored locally.
                if ((mB.user)&&(mB.sync)&&(mB.cacheglosses)&&
                    (window._sbook_loadinfo))
                    // Clear the loadinfo "left over" from startup,
                    //  which should now be in the database
                    window._sbook_loadinfo=false;}
            
            if (mB.nologin) {}
            else if ((window._sbook_loadinfo)&&
                     (window._sbook_loadinfo.userinfo)) {
                // Get the userinfo from the loadinfo that might have already been loaded
                loadinfo=window._sbook_loadinfo;
                userinfo=loadinfo.userinfo;
                window._sbook_loadinfo=false;
                if (mB.Trace.storage) 
                    fdjtLog("Have window._sbook_loadinfo for %o (%s) dated %o: %j",
                            userinfo._id,userinfo.name||userinfo.email,
                            loadinfo.sync,userinfo);
                setUser(userinfo,
                        loadinfo.outlets,loadinfo.layers,
                        loadinfo.sync);
                if (loadinfo.nodeid) setNodeID(loadinfo.nodeid);}
            else if ((mB.userinfo)||(window._userinfo)) {
                userinfo=(mB.userinfo)||(window._userinfo);
                if ((mB.Trace.storage)||(mB.Trace.startup))
                    fdjtLog("Have %s for %o (%s) dated %o: %j",
                            ((mB.userinfo)?("mB.userinfo"):("window._userinfo")),
                            userinfo._id,userinfo.name||userinfo.email,
                            userinfo.sync||userinfo.modified,userinfo);
                setUser(userinfo,userinfo.outlets,userinfo.layers,
                        userinfo.sync||userinfo.modified);}
            else {}
            if (mB.Trace.startup>1)
                fdjtLog("userSetup done in %dms",fdjtTime()-started);
            if (mB.nologin) return;
            else if (!(mB.refuri)) return;
            else {}
            if (window.navigator.onLine) {
                if ((mB.user)&&(sync))
                    fdjtLog("Requesting new (> %s (%d)) glosses on %s from %s for %s",
                            fdjtTime.timeString(mB.sync),mB.sync,
                            mB.refuri,mB.server,mB.user._id,mB.user.name);
                else if (mB.user)
                    fdjtLog("Requesting all glosses on %s from %s for %s (%s)",
                            mB.refuri,mB.server,mB.user._id,mB.user.name);
                else fdjtLog(
                    "No user, requesting user info and glosses from %s",
                    mB.server);
                updateInfo();
                return;}
            else return;}
        mB.userSetup=userSetup;

        function readTraceSettings(){
            var tracing=getQuery("cxtrace",true);
            var i=0; var lim=tracing.length;
            while (i<lim) {
                var trace_spec=tracing[i++];
                var colon=trace_spec.indexOf(":");
                if (colon<0) {
                    if (typeof mB.Trace[trace_spec] === 'number')
                        mB.Trace[trace_spec]=1;
                    else mB.Trace[trace_spec]=true;}
                else {
                    var trace_name=trace_spec.substr(0,colon);
                    var trace_val=trace_spec.substr(colon+1);
                    if (typeof mB.Trace[trace_name] === 'number')
                        mB.Trace[trace_name]=parseInt(trace_val,10);
                    else mB.Trace[trace_name]=trace_val;}}}

        var glosshash_pat=/G[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        
        function CodexStartup(force){
            var metadata=false;
            if (mB._setup) return;
            if ((!force)&&(getQuery("nocodex"))) return;
            /* Cleanup, save initial hash location */
            if ((location.hash==="null")||(location.hash==="#null"))
                location.hash="";
            if ((location.hash)&&(location.hash!=="#")) {
                var hash=location.hash;
                if (hash[0]==='#') hash=hash.slice(1);
                if (glosshash_pat.exec(location.hash))
                    mB.glosshash=hash;
                else mB.inithash=location.hash;}
            mB._starting=fdjtTime();
            addClass(document.body,"cxSTARTUP");
            // This is all of the startup that we need to do synchronously
            syncStartup();
            // The rest of the stuff we timeslice
            fdjtTime.timeslice
            ([  // Scan the DOM for metadata.  This is surprisingly
                //  fast, so we don't currently try to timeslice it or
                //  cache it, though we could.
                function(){
                    applyTOCRules();
                    metadata=scanDOM();},
                // Now you're ready to lay out the book, which is
                //  timesliced and runs on its own.  We wait to do
                //  this until we've scanned the DOM because we may
                //  use results of DOM scanning in layout (for example,
                //  heading information).
                function(){
                    if (mB.bypage) mB.Paginate("initial");
                    else addClass(document.body,"cxSCROLL");},
                // Build the display TOC, both the dynamic (top of
                // display) and the static (inside the hudheart)
                function(){
                    var tocmsg=fdjtID("METABOOKSTARTUPTOC");
                    var tocstart=fdjtTime();
                    if (tocmsg) {
                        tocmsg.innerHTML=fdjtString(
                            "Building table of contents based on %d heads",
                            mB.docinfo._headcount);
                        addClass(tocmsg,"running");}
                    mB.setupTOC(metadata[mB.content.id]);
                    startupLog("Built tables of contents based on %d heads in %fms",
                               mB.docinfo._headcount,
                               fdjtTime()-tocstart);
                    if (tocmsg) dropClass(tocmsg,"running");},
                // Load all account information
                function(){
                    if (mB.Trace.startup>1) fdjtLog("Loading sourcedb");
                    mB.sourcedb.load(true);},
                // Read knowledge bases (knodules) used by the book
                ((Knodule)&&(Knodule.HTML)&&
                 (Knodule.HTML.Setup)&&(mB.knodule)&&
                 (function(){
                     var knomsg=fdjtID("METABOOKSTARTUPKNO");
                     var knodetails=fdjtID("METABOOKSTARTUPKNODETAILS");
                     if (knodetails) {
                         knodetails.innerHTML=fdjtString(
                             "Processing knodule %s",mB.knodule.name);}
                     addClass(knomsg,"running");
                     if ((mB.Trace.startup>1)||(mB.Trace.indexing))
                         fdjtLog("Processing knodule %s",mB.knodule.name);
                     Knodule.HTML.Setup(mB.knodule);
                     dropClass(knomsg,"running");})),
                // Process locally stored (offline data) glosses
                function(){
                    if (mB.sync) {
                        if (mB.cacheglosses) return initGlossesOffline();}
                    else if (window._sbook_loadinfo) {
                        loadInfo(window._sbook_loadinfo);
                        window._sbook_loadinfo=false;}},
                // Process anything we got via JSONP ahead of processing
                //  _sbook_loadinfo
                ((window._sbook_newinfo)&&(function(){
                    loadInfo(window._sbook_newinfo);
                    window._sbook_newinfo=false;})),
                function(){
                    if ((mB.Trace.startup>1)||(mB.Trace.indexing>1))
                        fdjtLog("Finding and applying Technorati-style tags");
                    applyAnchorTags();},
                function(){
                    if ((mB.Trace.startup>1)||(mB.Trace.indexing>1))
                        fdjtLog("Finding and applying tag elements from body");
                    applyTagSpans();
                    applyMultiTagSpans();
                    applyTagAttributes(metadata);},
                function(){
                    var pubindex=mB._publisher_index||
                        window._sbook_autoindex;
                    if (pubindex) {
                        handlePublisherIndex(pubindex,indexingDone);
                        mB._publisher_index=false;
                        window._sbook_autoindex=false;}
                    else if (fdjtID("SBOOKAUTOINDEX")) {
                        var elt=fdjtID("SBOOKAUTOINDEX");
                        fdjtDOM.addListener(elt,"load",function(evt){
                            evt=evt||window.event;
                            handlePublisherIndex(false,indexingDone);
                            mB._publisher_index=false;
                            window._sbook_autoindex=false;});}
                    else {
                        var indexref=getLink("SBOOKS.bookindex");
                        if (indexref) {
                            var script_elt=document.createElement("SCRIPT");
                            script_elt.setAttribute("src",indexref);
                            script_elt.setAttribute("language","javascript");
                            script_elt.setAttribute("async","async");
                            fdjtDOM.addListener(script_elt,"load",function(){
                                handlePublisherIndex(false,indexingDone);
                                mB._publisher_index=false;
                                window._sbook_autoindex=false;});
                            document.body.appendChild(script_elt);}
                        else indexingDone();}},
                startupDone],
             100,25);}
        mB.Startup=CodexStartup;
        
        function addTOCLevel(specs,level){
            var j=0, nspecs=specs.length; while (j<nspecs) {
                var nodes=fdjtDOM.$(specs[j++]);
                var i=0, lim=nodes.length; while (i<lim) {
                nodes[i++].setAttribute("data-toclevel",level);}}}
        function applyTOCRules(){
            var h1=getMeta("SBOOKS.h1",true,true)
                .concat(getMeta("SBOOKS.head1",true,true))
                .concat(getMeta("sbook1head",true));
            if (h1.length) addTOCLevel(h1,"1");
            var h2=getMeta("SBOOKS.h2",true,true)
                .concat(getMeta("SBOOKS.head2",true,true))
                .concat(getMeta("sbook2head",true));
            if (h2.length) addTOCLevel(h2,"2");
            var h3=getMeta("SBOOKS.h3",true,true)
                .concat(getMeta("SBOOKS.head3",true,true))
                .concat(getMeta("sbook3head",true));
            if (h3.length) addTOCLevel(h3,"3");
            var h4=getMeta("SBOOKS.h4",true,true)
                .concat(getMeta("SBOOKS.head4",true,true))
                .concat(getMeta("sbook4head",true));
            if (h4.length) addTOCLevel(h4,"4");
            var h5=getMeta("SBOOKS.h5",true,true)
                .concat(getMeta("SBOOKS.head5",true,true))
                .concat(getMeta("sbook5head",true));
            if (h5.length) addTOCLevel(h5,"5");
            var h6=getMeta("SBOOKS.h6",true,true)
                .concat(getMeta("SBOOKS.head6",true,true))
                .concat(getMeta("sbook6head",true));
            if (h6.length) addTOCLevel(h6,"6");
            var h7=getMeta("SBOOKS.h7",true,true)
                .concat(getMeta("SBOOKS.head7",true,true))
                .concat(getMeta("sbook7head",true));
            if (h7.length) addTOCLevel(h7,"7");}

        function handlePublisherIndex(pubindex,whendone){
            if (!(pubindex))
                pubindex=mB._publisher_index||window._sbook_autoindex;
            if (!(pubindex)) {
                if (whendone) whendone();
                return;}
            if ((mB.Trace.startup>1)||(mB.Trace.indexing)) {
                if (pubindex._nkeys)
                    fdjtLog("Processing provided index of %d keys and %d refs",
                            pubindex._nkeys,pubindex._nrefs);
                else fdjtLog("Processing provided index");}
            mB.useIndexData(pubindex,mB.knodule,false,whendone);}

        function scanDOM(){
            var scanmsg=fdjtID("METABOOKSTARTUPSCAN");
            addClass(scanmsg,"running");
            var metadata=new mB.DOMScan(mB.content,mB.refuri+"#");
            mB.docinfo=metadata;
            mB.ends_at=mB.docinfo._maxloc;
            dropClass(scanmsg,"running");
            if ((mB.state)&&(mB.state.target)&&
                (!((mB.state.location)))) {
                var info=mB.docinfo[mB.state.target];
                if ((info)&&(info.starts_at)) {
                    mB.state.location=info.starts_at;
                    // Save current state, skip history, force save
                    mB.saveState(false,true,true);}}
            
            if (mB.scandone) {
                var donefn=mB.scandone;
                delete mB.scandone;
                donefn();}
            return metadata;}
        
        function startupDone(mode){
            if ((mB.glosshash)&&(mB.glossdb.ref(mB.glosshash))) {
                if (mB.showGloss(mB.glosshash)) {
                    mB.glosshash=false;
                    mB.Timeline.initLocation=fdjtTime();}
                else initLocation();}
            else initLocation();
            window.onpopstate=function onpopstate(evt){
                if (evt.state) mB.restoreState(evt.state,"popstate");};
            fdjtLog("Startup done");
            mB.displaySync();
            fdjtDOM.dropClass(document.body,"cxSTARTUP");
            if (fdjtID("METABOOKREADYMESSAGE"))
                fdjtID("METABOOKREADYMESSAGE").innerHTML="Open";
            if (mode) {}
            else if (getQuery("startmode"))
                mode=getQuery("startmode");
            else {}
            if (mode) mB.setMode(mode);
            else mode=mB.mode;
            mB._setup=new Date();
            mB._starting=false;
            if (mB.onsetup) {
                var onsetup=mB.onsetup;
                mB.onsetup=false;
                setTimeout(onsetup,10);}
            var msg=false, uuid_end=false, msgid=false;
            if ((msg=getQuery("APPMESSAGE"))) {
                if ((msg.slice(0,2)==="#{")&&
                    ((uuid_end=msg.indexOf('}'))>0)) {
                    msgid="MSG_"+msg.slice(2,uuid_end);
                    if (getLocal(msgid)) {}
                    else {
                        saveLocal(msgid,"seen");
                        fdjtUI.alertFor(10,msg.slice(uuid_end+1));}}
                else fdjtUI.alertFor(10,msg);}
            if ((msg=getQuery("SBOOKSMESSAGE"))) {
                if ((msg.slice(0,2)==="#{")&&
                    ((uuid_end=msg.indexOf('}'))>0)) {
                    msgid="MSG_"+msg.slice(2,uuid_end);
                    if (getLocal(msgid)) {}
                    else {
                        saveLocal(msgid,"seen");
                        fdjtUI.alertFor(10,msg.slice(uuid_end+1));}}
                else fdjtUI.alertFor(10,msg);}
            if ((msg=getCookie("APPMESSAGE"))) {
                fdjtUI.alertFor(10,msg);
                fdjtState.clearCookie("APPMESSAGE","sbooks.net","/");}
            if ((msg=getCookie("SBOOKSMESSAGE"))) {
                fdjtUI.alertFor(10,msg);
                fdjtState.clearCookie("SBOOKSMESSAGE","sbooks.net","/");}
            if ((!(mode))&&(location.hash)&&(mB.state)&&
                (location.hash.slice(1)!==mB.state.target))
                mB.hideCover();
            else if ((!(mode))&&(mB.user)) {
                var opened=readLocal(
                    "codex.opened("+mB.docuri+")",true);
                if ((opened)&&((opened+((3600+1800)*1000))>fdjtTime()))
                    mB.hideCover();}
            if (fdjtDOM.vischange)
                fdjtDOM.addListener(document,fdjtDOM.vischange,
                                    mB.visibilityChange);
            fdjtDOM.addListener(window,"resize",resizeHandler);}
        
        /* Application settings */
        
        function readBookSettings(){
            // Basic stuff
            var refuri=_getsbookrefuri();
            var locuri=window.location.href;
            var hashpos=locuri.indexOf('#');
            if (hashpos>0) mB.locuri=locuri.slice(0,hashpos);
            else mB.locuri=locuri;
            document.body.refuri=mB.refuri=refuri;
            mB.docuri=_getsbookdocuri();
            mB.topuri=document.location.href;
            
            var refuris=getLocal("codex.refuris",true)||[];

            mB.sourceid=
                getMeta("SBOOKS.sourceid")||getMeta("SBOOKS.fileid")||
                mB.docuri;
            mB.sourcetime=getMeta("SBOOKS.sourcetime");
            var oldid=getLocal("codex.sourceid("+mB.docuri+")");
            if ((oldid)&&(oldid!==mB.sourceid)) {
                var layouts=getLocal("codex.layouts("+oldid+")");
                if ((layouts)&&(layouts.length)) {
                    var i=0, lim=layouts.length; while (i<lim) 
                        CodexLayout.dropLayout(layouts[i++]);}}
            else saveLocal("codex.sourceid("+mB.docuri+")",mB.sourceid);

            mB.bookbuild=getMeta("SBOOKS.buildstamp");

            mB.bypage=(mB.page_style==='bypage'); 
            mB.max_excerpt=getMeta("SBOOKS.maxexcerpt")||(mB.max_excerpt);
            mB.min_excerpt=getMeta("SBOOKS.minexcerpt")||(mB.min_excerpt);
            
            var notespecs=getMeta("sbooknote",true).concat(
                getMeta("SBOOKS.note",true));
            var noterefspecs=getMeta("sbooknoteref",true).concat(
                getMeta("SBOOKS.noteref",true));
            mB.sbooknotes=(((notespecs)&&(notespecs.length))?
                              (fdjtDOM.sel(notespecs)):(false));
            mB.sbooknoterefs=(((noterefspecs)&&(noterefspecs.length))?
                                 (fdjtDOM.sel(noterefspecs)):(false));

            refuris.push(refuri);

            var docref=getMeta("SBOOKS.docref");
            if (docref) mB.docref=docref;

            var coverpage=getLink("SBOOKS.coverpage",false,true)||
                getLink("coverpage",false,true);
            if (coverpage) mB.coverpage=coverpage;
            var coverimage=getLink("SBOOKS.coverimage",false,true)||
                getLink("coverimage",false,true);
            if (coverimage) mB.coverimage=coverimage;
            var thumbnail=getLink("SBOOKS.thumbnail",false,true)||
                getLink("thumbnail",false,true);
            if (thumbnail) mB.thumbnail=thumbnail;
            var icon=getLink("SBOOKS.icon",false,true)||
                getLink("icon",false,true);
            if (icon) mB.icon=icon;
            
            var baseid=getMeta("SBOOKS.id")||
                getMeta("SBOOKS.prefix")||getMeta("SBOOKS.baseid");
            if (baseid) mB.baseid=baseid;
            var prefix=getMeta("SBOOKS.prefix")||baseid;
            if (prefix) mB.prefix=prefix;
            var targetprefix=getMeta("SBOOKS.targetprefix");
            if ((targetprefix)&&(targetprefix==="*"))
                mB.targetids=false;
            else if ((targetprefix)&&(targetprefix[0]==='/'))
                mB.targetids=new RegExp(targetprefix.slice(1,targetprefix.length-1));
            else if (targetprefix)
                mB.targetids=new RegExp("^"+targetprefix);
            else if (prefix)
                mB.targetids=new RegExp("^"+prefix);
            else mB.targetids=false;
            
            var autofonts=fdjtDOM.getMeta("SBOOKS.adjustfont",true);
            if (autofonts.length)
                fdjt.DOM.autofont=fdjt.DOM.autofont+","+autofonts.join(",");

            if (getMeta("CODEX.forcelayout"))
                default_config.forcelayout=true;

            var autotoc=getMeta("SBOOKS.autotoc");
            if (autotoc) {
                if ((autotoc[0]==="y")||(autotoc[0]==="Y")||
                    (autotoc==="ON")||(autotoc==="on")||
                    (autotoc==="1")||(autotoc==="enable"))
                    mB.autotoc=true;
                else mB.autotoc=false;}

            if (!(mB.nologin)) {
                mB.mycopyid=getMeta("SBOOKS.mycopyid")||
                    (getLocal("mycopy("+refuri+")"))||
                    false;}
            if (mB.persist) saveLocal("codex.refuris",refuris,true);}

        function deviceSetup(){
            var useragent=navigator.userAgent;
            var device=fdjtDevice;
            var body=document.body;
            var started=fdjtTime();

            if ((!(device.touch))&&(getQuery("touch")))
                device.touch=getQuery("touch");
            
            // Don't bubble from TapHold regions (by default)
            fdjt.TapHold.default_opts.bubble=false;
            
            if (device.touch) {
                fdjtDOM.addClass(body,"cxTOUCH");
                fdjt.TapHold.default_opts.fortouch=true;
                mB.ui="touch";
                mB.touch=true;
                mB.keyboard=false;
                viewportSetup();}
            if ((device.android)&&(device.android>=3)) {
                default_config.keyboardhelp=false;
                mB.updatehash=false;
                mB.iscroll=false;}
            else if (device.android) {
                default_config.keyboardhelp=false;
                mB.updatehash=false;
                mB.iscroll=true;}
            else if ((useragent.search("Safari/")>0)&&
                     (useragent.search("Mobile/")>0)) { 
                hide_mobile_safari_address_bar();
                mB.iscroll=false;
                mB.updatehash=false;
                // Animation seems to increase crashes in iOS
                // mB.dontanimate=true;
                // default_config.layout='fastpage';
                default_config.keyboardhelp=false;
                // Have fdjtLog do it's own format conversion for the log
                fdjtLog.doformat=true;}
            else if (device.touch) {
                fdjtDOM.addClass(body,"cxTOUCH");
                mB.ui="touch";}
            else if (!(mB.ui)) {
                // Assume desktop or laptop
                fdjtDOM.addClass(body,"cxMOUSE");
                mB.ui="mouse";}
            else {}
            if (mB.iscroll) {
                fdjtDOM.addClass(body,"cxISCROLL");
                device.iscroll=true;}
            device.string=device.string+" "+
                ((mB.iscroll)?("iScroll"):("nativescroll"));
            fdjtLog("deviceSetup done in %dms: %s/%dx%d %s",
                    fdjtTime()-started,
                    mB.ui,fdjtDOM.viewWidth(),fdjtDOM.viewHeight(),
                    device.string);}

        function bookSetup(){
            if (mB.bookinfo) return;
            var bookinfo=mB.bookinfo={}; var started=fdjtTime();
            bookinfo.title=
                getMeta("mB.title")||
                getMeta("SBOOKS.title")||
                getMeta("DC.title")||
                getMeta("~TITLE")||
                document.title||"untitled";
            var authors=
                getMeta("SBOOKS.author",true).concat(
                    getMeta("DC.creator",true)).concat(
                        getMeta("AUTHOR")).concat(
                            getMeta("~AUTHOR"));
            if ((authors)&&(authors.length)) bookinfo.authors=authors;
            bookinfo.byline=
                getMeta("mB.byline")||
                getMeta("SBOOKS.byline")||
                getMeta("BYLINE")||
                ((authors)&&(authors.length)&&(authors[0]));
            bookinfo.copyright=
                getMeta("SBOOKS.copyright")||
                getMeta("SBOOKS.rights")||
                getMeta("DC.rights")||
                getMeta("COPYRIGHT")||
                getMeta("RIGHTS");
            bookinfo.publisher=
                getMeta("SBOOKS.pubname")||
                getMeta("DC.publisher")||
                getMeta("PUBLISHER");
            bookinfo.pubyear=
                getMeta("SBOOKS.pubyear")||
                getMeta("DC.date");
            bookinfo.description=
                getMeta("SBOOKS.description")||
                getMeta("DC.description")||
                getMeta("DESCRIPTION");
            bookinfo.digitized=
                getMeta("SBOOKS.digitized")||
                getMeta("DIGITIZED");
            bookinfo.converted=fdjtID("SBOOKS.converted")||
                getMeta("SBOOKS.converted");
            if (mB.Trace.startup>1)
                fdjtLog("bookSetup done in %dms",fdjtTime()-started);}
        function getBookInfo(){
            if (mB.bookinfo) return mB.bookinfo;
            else {bookSetup(); return mB.bookinfo;}}
        mB.getBookInfo=getBookInfo;
        
        function initUserOffline(){
            var refuri=mB.refuri;
            var user=getLocal("codex.user");
            var sync=mB.sync;
            var nodeid=getLocal("codex.nodeid("+refuri+")",true);
            // We store the information for the current user
            //  in both localStorage and in the "real" sourcedb.
            // We fetch the user from local storage because we
            //  can do that synchronously.
            var userinfo=user&&getLocal(user,true);
            if (mB.Trace.storage)
                fdjtLog("initOffline user=%s sync=%s nodeid=%s info=%j",
                        user,sync,nodeid,userinfo);
            if (!(sync)) return;
            if (!(user)) return;
            if (mB.Trace.startup>1)
                fdjtLog("initOffline userinfo=%j",userinfo);
            // Should these really be refs in sourcedb?
            var outlets=mB.outlets=
                getLocal("codex.outlets("+refuri+")",true)||[];
            var layers=mB.layers=
                getLocal("codex.layers("+refuri+")",true)||[];
            if (userinfo) setUser(userinfo,outlets,layers,sync);
            if (nodeid) setNodeID(nodeid);}

        var offline_init=false;

        function initGlossesOffline(){
            if (offline_init) return false;
            else offline_init=true;
            var sync=mB.sync;
            if (!(sync)) return;
            if ((mB.Trace.glosses)||(mB.Trace.startup))
                fdjtLog("Starting initializing glosses from local storage");
            mB.glosses.setLive(false);
            mB.sourcedb.load(true);
            mB.glossdb.load(true,function(){
                mB.glosses.setLive(true);
                if (mB.heartscroller)
                    mB.heartscroller.refresh();
                if ((mB.glossdb.allrefs.length)||
                    (mB.sourcedb.allrefs.length))
                    fdjtLog("Initialized %d glosses (%d sources) from local storage",
                            mB.glossdb.allrefs.length,
                            mB.sourcedb.allrefs.length);});}

        /* Viewport setup */

        var viewport_spec=
            "width=device-width,initial-scale=1.0,user-scalable=no";
        function viewportSetup(){
            var head=fdjtDOM.getHEAD();
            var viewport=getMeta("viewport",false,false,true);
            if (!(viewport)) {
                viewport=document.createElement("META");
                viewport.setAttribute("name","viewport");
                viewport.setAttribute("content",viewport_spec);
                head.appendChild(viewport);}
            var isapp=getMeta("apple-mobile-web-app-capable",false,false,true);
            if (!(isapp)) {
                isapp=document.createElement("META");
                isapp.setAttribute("name","apple-mobile-web-app-capable");
                isapp.setAttribute("content","yes");
                head.appendChild(isapp);}}

        function hide_mobile_safari_address_bar(){
            window.scrollTo(0,1);
            setTimeout(function(){window.scrollTo(0,0);},0);}

        /* Getting settings */

        function _getsbookrefuri(){
            var refuri=getLink("SBOOKS.refuri",false,true)||
                getLink("refuri",false,true)||
                getMeta("SBOOKS.refuri",false,true)||
                getMeta("refuri",false,true)||
                getLink("canonical",false,true);
            if (refuri) return decodeURI(refuri);
            else {
                var locref=document.location.href;
                var qstart=locref.indexOf('?');
                if (qstart>=0) locref=locref.slice(0,qstart);
                var hstart=locref.indexOf('#');
                if (hstart>=0) locref=locref.slice(0,hstart);
                return decodeURI(locref);}}
        function _getsbookdocuri(){
            return getLink("SBOOKS.docuri",false)||
                getLink("docuri",false)||
                getLink("canonical",false)||
                _getsbookrefuri();}

        function lookupServer(string){
            var sbook_servers=mB.servers;
            var i=0;
            while (i<sbook_servers.length) 
                if (sbook_servers[i][0]===string)
                    return sbook_servers[i][1];
            else if (string.search(sbook_servers[i][0])>=0)
                return sbook_servers[i][1];
            else if ((sbook_servers[i][0].call) &&
                     (sbook_servers[i][0].call(string)))
                return sbook_servers[i][1];
            else i++;
            return false;}

        function hasTOCLevel(elt){
            if ((elt.toclevel)||
                ((elt.getAttributeNS)&&
                 (elt.getAttributeNS('toclevel','http://sbooks.net/')))||
                (elt.getAttribute('toclevel'))||
                (elt.getAttribute('data-toclevel'))||
                ((elt.className)&&
                 ((elt.className.search(/\bsbook\dhead\b/)>=0)||
                  (elt.className.search(/\bsbooknotoc\b/)>=0)||
                  (elt.className.search(/\bsbookignore\b/)>=0))))
                return true;
            else return false;}
        mB.hasTOCLevel=hasTOCLevel;

        var headlevels=["not","A","B","C","D","E","F","G","H","I","J","K","L"];

        function getScanSettings(){
            if (!(mB.docroot))
                if (getMeta("SBOOKS.root"))
                    mB.docroot=mbID(getMeta("SBOOKS.root"));
            else mB.docroot=fdjtID("SBOOKCONTENT")||document.body;
            if (!(mB.start))
                if (getMeta("SBOOKS.start"))
                    mB.start=mbID(getMeta("SBOOKS.start"));
            else if (fdjtID("SBOOKSTART"))
                mB.start=fdjtID("SBOOKSTART");
            else {}
            var i=0; while (i<9) {
                var body=document.body;
                var rules=getMeta("sbookhead"+i,true).
                    concat(getMeta("sbook"+i+"head",true)).
                    concat(getMeta("sbook"+headlevels[i]+"head",true)).
                    concat(getMeta("SBOOKS.head"+i,true));
                if ((rules)&&(rules.length)) {
                    var j=0; var lim=rules.length; while (j<lim) {
                        var elements=fdjtDOM.getChildren(body,rules[j++]);
                        var k=0; var n=elements.length;
                        while (k<n) {
                            var elt=elements[k++];
                            if (!(hasTOCLevel(elt))) elt.toclevel=i;}}}
                i++;}
            // These are all meta class definitions, which is why
            //  they don't have regular schema prefixes
            var ignore=((getMeta("sbookignore"))||[]).concat(
                ((getMeta("SBOOKS.ignore"))||[]));
            if (ignore.length) mB.ignore=new fdjtDOM.Selector(ignore);
            var notoc=
                ((getMeta("sbooknotoc"))||[]).concat(
                    ((getMeta("SBOOKS.notoc"))||[])).concat(
                        ((getMeta("SBOOKS.nothead"))||[])).concat(
                            ((getMeta("sbooknothead"))||[]));
            if (notoc.length) mB.notoc=new fdjtDOM.Selector(notoc);
            var terminal=((getMeta("sbookterminal"))||[]).concat(
                ((getMeta("SBOOKS.terminal"))||[]));
            if (terminal.length) mB.terminals=new fdjtDOM.Selector(terminal.length);
            var focus=
                ((getMeta("sbookfocus"))||[]).concat(
                    ((getMeta("SBOOKS.focus"))||[])).concat(
                        ((getMeta("sbooktarget"))||[])).concat(
                            ((getMeta("SBOOKS.target"))||[])).concat(
                                ((getMeta("SBOOKS.idify"))||[]));
            if (focus.length) mB.focus=new fdjtDOM.Selector(focus);
            var nofocus=
                ((getMeta("sbooknofocus"))||[]).concat(
                    ((getMeta("SBOOKS.nofocus"))||[])).concat(
                        ((getMeta("sbooknotarget"))||[])).concat(
                            ((getMeta("SBOOKS.notarget"))||[]));
            if (nofocus.length) mB.nofocus=new fdjtDOM.Selector(nofocus);}

        function applyMetaClass(name){
            var meta=getMeta(name,true);
            var i=0; var lim=meta.length;
            while (i<lim) fdjtDOM.addClass(fdjtDOM.$(meta[i++]),name);}

        // Console input and evaluation
        // These are used by the input handlers of the console log
        var input_console=false, input_button=false;
        
        /* Console methods */
        function console_eval(){
            /* jshint evil: true */
            fdjtLog("Executing %s",input_console.value);
            var result=eval(input_console.value);
            var string_result=
                ((result.nodeType)?
                 (fdjtString("%o",result)):
                 (fdjtString("%j",result)));
            fdjtLog("Result is %s",string_result);}
        function consolebutton_click(evt){
            if (mB.Trace.gesture>1) fdjtLog("consolebutton_click %o",evt);
            console_eval();}
        function consoleinput_keypress(evt){
            evt=evt||window.event;
            if (evt.keyCode===13) {
                if (!(evt.ctrlKey)) {
                    fdjtUI.cancel(evt);
                    console_eval();
                    if (evt.shiftKey) input_console.value="";}}}

        function setupScroller(div){
            var c=fdjtDOM("div");
            var children=div.childNodes; var cnodes=[];
            var i=0, lim=children.length; while (i<lim)
                cnodes.push(children[i++]);
            i=0; while (i<lim) c.appendChild(cnodes[i++]);
            div.appendChild(c);
            return new iScroll(div);}

        // Cover setup
        function coverSetup(){
            var frame=fdjtID("METABOOKFRAME"), started=fdjtTime();
            var cover, existing_cover=fdjtID("METABOOKCOVER");
            if (!(frame)) {
                frame=fdjtDOM("div#METABOOKFRAME");
                fdjtDOM.prepend(document.body,frame);}
            mB.Frame=frame;
            if (existing_cover) {
                frame.appendChild(existing_cover);
                cover=existing_cover;}
            else {
                cover=fdjtDOM("div#METABOOKCOVER");
                cover.innerHTML=fixStaticRefs(mB.HTML.cover);
                frame.appendChild(cover);}
            if (mB.Trace.startup>2) {
                if (existing_cover)
                    fdjtLog("Setting up existing cover");
                else fdjtLog("Setting up new cover");}

            // Remove any explicit style attributes set for on-load display
            if (existing_cover) existing_cover.removeAttribute("style");
            if (fdjtID("METABOOKBOOKCOVERHOLDER"))
                fdjtID("METABOOKBOOKCOVERHOLDER").removeAttribute("style");
            if (fdjtID("METABOOKBOOKCOVERIMAGE"))
                fdjtID("METABOOKBOOKCOVERIMAGE").removeAttribute("style");
            if (fdjtID("METABOOKTITLEPAGEHOLDER"))
                fdjtID("METABOOKTITLEPAGEHOLDER").removeAttribute("style");
            if (fdjtID("METABOOKINFOPAGEHOLDER"))
                fdjtID("METABOOKINFOPAGEHOLDER").removeAttribute("style");
            if (fdjtID("METABOOKCREDITSPAGEHOLDER"))
                fdjtID("METABOOKCREDITSPAGEHOLDER").removeAttribute("style");
            if (fdjtID("METABOOKABOUTBOOKHOLDER"))
                fdjtID("METABOOKABOUTBOOKHOLDER").removeAttribute("style");
            if (fdjtID("METABOOKLAYERS"))
                fdjtID("METABOOKLAYERS").removeAttribute("style");
            if (fdjtID("METABOOKCONSOLE"))
                fdjtID("METABOOKCONSOLE").removeAttribute("style");
            if (fdjtID("METABOOKSETTINGS"))
                fdjtID("METABOOKSETTINGS").removeAttribute("style");
            if (fdjtID("METABOOKAPPHELP"))
                fdjtID("METABOOKAPPHELP").removeAttribute("style");
            if (fdjtID("METABOOKREADYMESSAGE")) 
                fdjtID("METABOOKREADYMESSAGE").removeAttribute("style");
            if (fdjtID("METABOOKBUSYMESSAGE"))
                fdjtID("METABOOKBUSYMESSAGE").removeAttribute("style");
            if (fdjtID("METABOOKCOVERCONTROLS"))
                fdjtID("METABOOKCOVERCONTROLS").removeAttribute("style");
            
            var coverpage=fdjtID("METABOOKCOVERPAGE");
            if (coverpage) 
                coverpage.id="METABOOKBOOKCOVER";
            else if (fdjtID("SBOOKCOVERPAGE")) {
                coverpage=fdjtID("SBOOKCOVERPAGE").cloneNode(true);
                fdjtDOM.stripIDs(coverpage);
                coverpage.id="METABOOKBOOKCOVER";}
            else if (mB.coverpage) {
                var coverimage=fdjtDOM.Image(mB.coverpage);
                coverpage=fdjtDOM("div#METABOOKBOOKCOVER",coverimage);}
            else {}
            if (coverpage) {
                cover.setAttribute("data-defaultclass","bookcover");
                cover.className="bookcover";
                if (fdjtID("METABOOKBOOKCOVERHOLDER")) 
                    fdjtDOM.replace(fdjtID("METABOOKBOOKCOVERHOLDER"),
                                    coverpage);
                else cover.appendChild(coverpage);}
            else if (cover.className==="bookcover") {
                // Use the provided book cover
                var holder=fdjtID("METABOOKBOOKCOVERHOLDER");
                if (holder) holder.id="METABOOKBOOKCOVER";}
            else {
                cover.setAttribute("data-defaultclass","titlepage");
                cover.className="titlepage";}
            if (coverpage) {
                coverpage.style.opacity=0.0; coverpage.style.display="block";
                coverpage.style.overflow="visible";
                fdjtDOM.scaleToFit(coverpage,1.0);
                coverpage.style.opacity=""; coverpage.style.display="";
                coverpage.style.overflow="";}
            if (fdjtID("METABOOKBOOKCOVERHOLDER"))
                fdjtDOM.remove("METABOOKBOOKCOVERHOLDER");
            if ((!(fdjtID("METABOOKBOOKCOVER")))&&(fdjtID("METABOOKCOVERCONTROLS")))
                fdjtDOM.addClass("METABOOKCOVERCONTROLS","nobookcover");

            var titlepage=fdjtID("METABOOKTITLEPAGE");
            if (!(titlepage)) {
                titlepage=fdjtID("SBOOKSTITLEPAGE")||fdjtID("TITLEPAGE");
                if (titlepage) {
                    titlepage=titlepage.cloneNode(true);
                    fdjtDOM.stripIDs(titlepage);
                    titlepage.setAttribute("style","");}
                else {
                    var info=getBookInfo();
                    titlepage=fdjtDOM(
                        "div#METABOOKTITLEPAGE",
                        fdjtDOM("DIV.title",info.title),
                        fdjtDOM("DIV.credits",
                                ((info.byline)?(fdjtDOM("DIV.byline",info.byline)):
                                 ((info.authors)&&(info.authors.length))?
                                 (fdjtDOM("DIV.author",info.authors[0])):
                                 (false))),
                        fdjtDOM("DIV.pubinfo"));}}
            if (fdjtID("METABOOKTITLEPAGEHOLDER")) {
                fdjtDOM.replace(fdjtID("METABOOKTITLEPAGEHOLDER"),titlepage);
                titlepage.id="METABOOKTITLEPAGE";}
            else if (hasParent(titlepage,cover)) {}
            else cover.appendChild(titlepage);
            if (titlepage) {
                titlepage.setAttribute("style","");
                titlepage.style.opacity=0.0; titlepage.style.display="block";
                titlepage.style.overflow="visible";
                fdjtDOM.tweakFont(titlepage);
                titlepage.style.opacity=""; titlepage.style.display="";
                titlepage.style.overflow="";}
            if ((fdjtID("METABOOKTITLEPAGE"))&&(fdjtID("METABOOKTITLEPAGEHOLDER")))
                fdjtDOM.remove("METABOOKTITLEPAGEHOLDER");
            
            var creditspage=fdjtID("METABOOKCREDITSPAGE");
            if (!(creditspage)) {
                creditspage=fdjtID("SBOOKSCREDITSPAGE")||fdjtID("CREDITSPAGE");
                if (creditspage) {
                    creditspage=creditspage.cloneNode(true);
                    fdjtDOM.stripIDs(creditspage);
                    creditspage.setAttribute("style","");}}
            if (creditspage) {
                addClass(cover,"withcreditspage");
                if (fdjtID("METABOOKCREDITSPAGEHOLDER")) {
                    fdjtDOM.replace(fdjtID("METABOOKCREDITSPAGEHOLDER"),
                                    creditspage);
                    creditspage.id="METABOOKCREDITSPAGE";}
                else if (hasParent(creditspage,cover)) {}
                else cover.appendChild(creditspage);
                if ((fdjtID("METABOOKCREDITSPAGE"))&&
                    (fdjtID("METABOOKCREDITSPAGEHOLDER")))
                    fdjtDOM.remove("METABOOKCREDITSPAGEHOLDER");}
            
            var infopage=fdjtID("METABOOKINFOPAGE");
            if (infopage)
                fdjtDOM.replace(fdjtID("METABOOKINFOPAGEHOLDER"),
                                fdjtID("METABOOKINFOPAGE"));
            else if (fdjtID("SBOOKSINFOPAGE")) {
                infopage=fdjtID("SBOOKSINFOPAGE").cloneNode(true);
                fdjtDOM.stripIDs(infopage); infopage.id="METABOOKINFOPAGE";
                fdjtDOM.replace(fdjtID("METABOOKINFOPAGEHOLDER"),infopage);}
            else fdjtID("METABOOKINFOPAGEHOLDER").id="METABOOKINFOPAGE";
            if (infopage) {
                infopage.style.opacity=0.0; infopage.style.display="block";
                infopage.style.overflow="visible";
                fdjtDOM.scaleToFit(infopage,0.9);
                infopage.style.opacity=null; infopage.style.display=null;
                infopage.style.overflow=null;}
            if ((fdjtID("METABOOKINFOPAGE"))&&(fdjtID("METABOOKINFOPAGEHOLDER")))
                fdjtDOM.remove("METABOOKINFOPAGEHOLDER");
            
            var settings=fdjtID("METABOOKSETTINGS");
            if (!(settings)) {
                settings=fdjtDOM("div#METABOOKSETTINGS");
                cover.appendChild(settings);}
            settings.innerHTML=fixStaticRefs(mB.HTML.settings);
            mB.DOM.settings=settings;
            var codexbookinfo=fdjt.ID("METABOOKBOOKINFO");
            if (!(codexbookinfo)) {
                codexbookinfo=fdjtDOM("div#METABOOKBOOKINFO");
                fdjtDOM(settings,"\n",codexbookinfo);}
            codexbookinfo.innerHTML=
                "<p>"+mB.docref+"#"+mB.sourceid+"<br/>"+
                ((mB.sourcetime)?(" ("+mB.sourcetime+")"):(""))+"</p>\n"+
                "<p>metaBook version "+mB.version+" built on "+
                mB.buildhost+", "+mB.buildtime+"</p>\n"+
                "<p>Program &amp; Interface are "+
                "<span style='font-size: 120%;'>©</span>"+
                " beingmeta, inc 2008-2014</p>\n";
            var help=mB.DOM.help=fdjtID("METABOOKAPPHELP");
            if (!(help)) {
                help=fdjtDOM("div#METABOOKAPPHELP");
                cover.appendChild(help);}
            var cover_help=fdjtID("METABOOKCOVERHELP");
            if (!(cover_help)) {
                cover_help=fdjtDOM("div#METABOOKCOVERHELP.codexhelp");
                help.appendChild(cover_help);}
            cover_help.innerHTML=fixStaticRefs(mB.HTML.help);
            
            var console=mB.DOM.console=fdjtID("METABOOKCONSOLE");
            if (!(console)) {
                console=fdjtDOM("div#METABOOKCONSOLE");
                cover.appendChild(console);}
            mB.DOM.console=console;
            if (mB.Trace.startup>2) fdjtLog("Setting up console %o",console);
            console.innerHTML=mB.HTML.console;
            mB.DOM.input_console=input_console=
                fdjtDOM.getChild(console,"TEXTAREA");
            mB.DOM.input_button=input_button=
                fdjtDOM.getChild(console,"span.button");
            input_button.onclick=consolebutton_click;
            input_console.onkeypress=consoleinput_keypress;

            var layers=fdjtID("METABOOKLAYERS");
            if (!(layers)) {
                layers=fdjtDOM("div#METABOOKLAYERS");
                cover.appendChild(layers);}
            var sbooksapp=fdjtID("SBOOKSAPP");
            if (!(sbooksapp)) {
                sbooksapp=fdjtDOM("iframe#SBOOKSAPP");
                sbooksapp.setAttribute("frameborder",0);
                sbooksapp.setAttribute("scrolling","auto");}
            layers.appendChild(sbooksapp);
            mB.DOM.sbooksapp=sbooksapp;
            
            var about=fdjtID("METABOOKABOUTBOOK");
            if (!(about)) {
                about=fdjtDOM("div#METABOOKABOUTBOOK");
                fillAboutInfo(about);}
            if (hasParent(about,cover)) {}
            else if (fdjtID("METABOOKABOUTBOOKHOLDER")) 
                fdjtDOM.replace(fdjtID("METABOOKABOUTBOOKHOLDER"),about);
            else cover.appendChild(about);
            
            if (mB.touch)
                fdjtDOM.addListener(cover,"touchstart",cover_clicked);
            else fdjtDOM.addListener(cover,"click",cover_clicked);

            if (mB.iscroll) {
                mB.scrollers.about=setupScroller(about);
                mB.scrollers.help=setupScroller(help);
                mB.scrollers.console=setupScroller(console);
                mB.scrollers.settings=setupScroller(settings);}

            mB.showCover();

            fdjtDOM.tweakFonts(cover);

            // Make the cover hidden by default
            mB.CSS.hidecover=fdjtDOM.addCSSRule(
                "#METABOOKCOVER","opacity: 0.0; z-index: -10; pointer-events: none; height: 0px; width: 0px;");
            if (mB.Trace.startup>1)
                fdjtLog("Cover setup done in %dms",fdjtTime()-started);
            return cover;}

        var coverids={"bookcover": "METABOOKBOOKCOVER",
                      "titlepage": "METABOOKTITLEPAGE",
                      "bookcredits": "METABOOKCREDITSPAGE",
                      "aboutbook": "METABOOKABOUTBOOK",
                      "help": "METABOOKAPPHELP",
                      "settings": "METABOOKSETTINGS",
                      "layers": "METABOOKLAYERS"};

        function cover_clicked(evt){
            var target=fdjtUI.T(evt);
            var cover=fdjtID("METABOOKCOVER");
            if (fdjt.UI.isClickable(target)) return;
            if (!(hasParent(target,fdjtID("METABOOKCOVERCONTROLS")))) {
                if (!(hasParent(target,fdjtID("METABOOKCOVERMESSAGE")))) {
                    var section=target;
                    while ((section)&&(section.parentNode!==cover))
                        section=section.parentNode;
                    if ((section)&&(section.nodeType===1)&&
                        (section.scrollHeight>section.offsetHeight))
                        return;}
                mB.clearStateDialog();
                mB.hideCover();
                fdjtUI.cancel(evt);
                return;}
            var scan=target;
            while (scan) {
                if (scan===document.body) break;
                else if (scan.getAttribute("data-mode")) break;
                else scan=scan.parentNode;}
            var mode=scan.getAttribute("data-mode");
            // No longer have cover buttons be toggles
            /* 
               if ((mode)&&(cover.className===mode)) {
               if (cover.getAttribute("data-defaultclass"))
               cover.className=cover.getAttribute("data-defaultclass");
               else cover.className="bookcover";
               fdjt.UI.cancel(evt);
               return;}
            */
            if ((mode==="layers")&&
                (!(fdjtID("SBOOKSAPP").src))&&
                (!(mB.appinit)))
                mB.initIFrameApp();

            var curclass=cover.className;
            var cur=((curclass)&&(coverids[curclass])&&(fdjtID(coverids[curclass])));
            var nxt=((mode)&&(coverids[mode])&&(fdjtID(coverids[mode])));
            if ((cur)&&(nxt)) {
                cur.style.display='block';
                nxt.style.display='block';
                setTimeout(function(){
                    cur.style.display="";
                    nxt.style.display="";},
                           3000);}
            setTimeout(function(){
                if (mB.Trace.mode)
                    fdjtLog("On %o, switching cover mode to %s from %s",
                            evt,mode,curclass);
                if (mode==="console") fdjtLog.update();
                cover.className=mode;
                mB.mode=mode;},
                       20);
            fdjt.UI.cancel(evt);}

        mB.addConfig("showconsole",function(name,value){
            if (value) addClass(document.body,"cxSHOWCONSOLE");
            else dropClass(document.body,"cxSHOWCONSOLE");});
        
        mB.addConfig("uisound",function(name,value){
            mB.uisound=(value)&&(true);});
        mB. addConfig("readsound",function(name,value){
            mB.readsound=(value)&&(true);});


        /* Filling in information */

        function fillAboutInfo(about){
            var bookabout=fdjtID("SBOOKABOUTBOOK")||
                fdjtID("SBOOKABOUTPAGE")||fdjtID("SBOOKABOUT");
            var authorabout=fdjtID("SBOOKABOUTORIGIN")||
                fdjtID("SBOOKAUTHORPAGE")||
                fdjtID("SBOOKABOUTAUTHOR");
            var acknowledgements=
                fdjtID("SBOOKACKNOWLEDGEMENTSPAGE")||
                fdjtID("SBOOKACKNOWLEDGEMENTS");
            var metadata=fdjtDOM.Anchor(
                "https://www.sbooks.net/publish/metadata?REFURI="+
                    encodeURIComponent(mB.refuri),
                "metadata",
                "edit metadata");
            metadata.target="_blank";
            metadata.title=
                "View (and possibly edit) the metadata for this book";
            var reviews=fdjtDOM.Anchor(
                null,
                // "https://www.sbooks.net/publish/reviews?REFURI="+
                //                  encodeURIComponent(mB.refuri),
                "reviews",
                "see/add reviews");
            reviews.target="_blank";
            reviews.title="Sorry, not yet implemented";
            // fdjtDOM(about,fdjtDOM("div.links",metadata,reviews));

            if (bookabout) fdjtDOM(about,bookabout);
            else {
                var title=
                    fdjtID("SBOOKTITLE")||
                    getMeta("mB.title")||
                    getMeta("SBOOKS.title")||
                    getMeta("DC.title")||
                    getMeta("~TITLE")||
                    document.title;
                var byline=
                    fdjtID("SBOOKBYLINE")||fdjtID("SBOOKAUTHOR")||
                    getMeta("mB.byline")||
                    getMeta("mB.author")||
                    getMeta("SBOOKS.byline")||
                    getMeta("SBOOKS.author")||
                    getMeta("BYLINE")||
                    getMeta("AUTHOR");
                var copyright=
                    fdjtID("SBOOKCOPYRIGHT")||
                    getMeta("mB.copyright")||
                    getMeta("mB.rights")||
                    getMeta("SBOOKS.copyright")||
                    getMeta("SBOOKS.rights")||
                    getMeta("COPYRIGHT")||
                    getMeta("RIGHTS");
                var publisher=
                    fdjtID("SBOOKPUBLISHER")||
                    getMeta("mB.publisher")||
                    getMeta("SBOOKS.publisher")||                    
                    getMeta("PUBLISHER");
                var description=
                    fdjtID("SBOOKDESCRIPTION")||
                    getMeta("mB.description")||
                    getMeta("SBOOKS.description")||
                    getMeta("DESCRIPTION");
                var digitized=
                    fdjtID("SBOOKDIGITIZED")||
                    getMeta("mB.digitized")||
                    getMeta("SBOOKS.digitized")||
                    getMeta("DIGITIZED");
                var sbookified=fdjtID("SBOOKS.converted")||
                    getMeta("SBOOKS.converted");
                fillTemplate(about,".title",title);
                fillTemplate(about,".byline",byline);
                fillTemplate(about,".publisher",publisher);
                fillTemplate(about,".copyright",copyright);
                fillTemplate(about,".description",description);
                fillTemplate(about,".digitized",digitized);
                fillTemplate(about,".sbookified",sbookified);
                fillTemplate(about,".about",fdjtID("SBOOKABOUT"));
                var cover=getLink("cover");
                if (cover) {
                    var cover_elt=fdjtDOM.$(".cover",about)[0];
                    if (cover_elt) fdjtDOM(cover_elt,fdjtDOM.Image(cover));}}
            if (authorabout) fdjtDOM(about,authorabout);
            if (acknowledgements) {
                var clone=acknowledgements.cloneNode(true);
                clone.id="";
                fdjtDOM(about,clone);}}

        function fillTemplate(template,spec,content){
            if (!(content)) return;
            var elt=fdjtDOM.$(spec,template);
            if ((elt)&&(elt.length>0)) elt=elt[0];
            else return;
            if (typeof content === 'string')
                elt.innerHTML=fixStaticRefs(content);
            else if (content.cloneNode)
                fdjtDOM.replace(elt,content.cloneNode(true));
            else fdjtDOM(elt,content);}

        /* Initializing the body and content */

        function initBody(){
            var body=document.body, started=fdjtTime();
            var init_content=fdjtID("METABOOKCONTENT");
            var content=(init_content)||(fdjtDOM("div#METABOOKCONTENT"));
            var i, lim;
            if (mB.Trace.startup>2) fdjtLog("Starting initBody");

            body.setAttribute("tabindex",1);
            /* -- Sets 1em to equal 10px -- */ 
            body.style.fontSize="62.5%";
            /* -- Remove any original width constraints -- */
            body.style.width="inherit";

            // Save those DOM elements in a handy place
            mB.content=content;

            // Move all the notes together
            var notesblock=fdjtID("SBOOKNOTES")||
                fdjtDOM("div.sbookbackmatter#SBOOKNOTES");
            applyMetaClass("sbooknote");
            var note_counter=1;
            var allnotes=getChildren(content,".sbooknote");
            i=0; lim=allnotes.length; while (i<lim) {
                var notable=allnotes[i++];
                if (!(notable.id)) notable.id="METABOOKNOTE"+(note_counter++);
                var noteref=notable.id+"_REF";
                if (!(mbID(noteref))) {
                    var label=getChild(notable,"label")||
                        getChild(notable,"summary")||
                        getChild(notable,".sbooklabel")||
                        getChild(notable,".sbooksummary")||
                        getChild(notable,"span")||"Note";
                    var anchor=fdjtDOM.Anchor("#"+notable.id,"A",label);
                    anchor.rel="sbooknote";
                    anchor.id=noteref;
                    fdjtDOM.replace(notable,anchor);
                    fdjtDOM.append(notesblock,notable,"\n");}
                else fdjtDOM.append(notesblock,notable,"\n");}
            
            // Interpet links
            var notelinks=getChildren(
                body,"a[rel='sbooknote'],a[rel='footnote'],a[rel='endnote']");
            i=0; lim=notelinks.length; while (i<lim) {
                var ref=notelinks[i++];
                var href=ref.href;
                if (!(fdjtDOM.hasText(ref))) ref.innerHTML="Note";
                if ((href)&&(href[0]==="#")) {
                    addClass(fdjt.ID(href.slice(1)),"sbooknote");}}
            
            if (!(init_content)) {
                var children=[], childnodes=body.childNodes;
                i=0; lim=childnodes.length;
                while (i<lim) children.push(childnodes[i++]);
                i=0; while (i<lim) {
                    // Copy all of the content nodes
                    var child=children[i++];
                    if (child.nodeType!==1) content.appendChild(child);
                    else if ((child.id)&&(child.id.search("METABOOK")===0)) {}
                    else if (/(META|LINK|SCRIPT)/gi.test(child.tagName)) {}
                    else content.appendChild(child);}}
            // Append the notes block to the content
            if (notesblock.childNodes.length)
                fdjtDOM.append(content,"\n",notesblock,"\n");
            
            // Initialize cover and titlepage (if specified)
            mB.cover=mB.getCover();
            mB.titlepage=fdjtID("SBOOKTITLEPAGE");

            var pages=mB.pages=fdjtID("METABOOKPAGES")||
                fdjtDOM("div#METABOOKPAGES");
            var page=mB.page=fdjtDOM(
                "div#METABOOKPAGE",
                fdjtDOM("div#METABOOKPAGINATING","Laid out ",
                        fdjtDOM("span#METABOOKPAGEPROGRESS",""),
                        " pages"),
                pages);
            
            mB.body=fdjtID("METABOOKBODY");
            if (!(mB.body)) {
                var cxbody=mB.body=
                    fdjtDOM("div#METABOOKBODY.codexbody",content,page);
                if (mB.justify) addClass(cxbody,"codexjustify");
                if (mB.bodysize)
                    addClass(cxbody,"codexbodysize"+mB.bodysize);
                if (mB.bodyfamily)
                    addClass(cxbody,"codexbodyfamily"+mB.bodyfamily);
                if (mB.bodyspacing)
                    addClass(cxbody,"codexbodyspacing"+mB.bodyspacing);
                body.appendChild(cxbody);}
            else mB.body.appendChild(page);
            // Initialize the margins
            initMargins();
            if (mB.Trace.startup>1)
                fdjtLog("initBody took %dms",fdjtTime()-started);
            mB.Timeline.initBody=fdjtTime();}

        function sizeContent(){
            var started=mB.sized=fdjtTime();
            var content=mB.content, page=mB.page, body=document.body;
            // Clear any explicit left/right settings to get at
            //  whatever the CSS actually specifies
            content.style.left=page.style.left='';
            content.style.right=page.style.right='';
            body.style.overflow='hidden';
            // Get geometry
            var geom=getGeometry(page);
            var view_height=fdjtDOM.viewHeight();
            var page_width=geom.width, view_width=fdjtDOM.viewWidth();
            var page_margin=(view_width-page_width)/2;
            if (page_margin!==50) {
                page.style.left=page_margin+'px';
                page.style.right=page_margin+'px';}
            else page.style.left=page.style.right='';
            if ((geom.top<10)||((view_height-(geom.height+geom.top))<25))
                mB.fullheight=true;
            else mB.fullheight=false;
            if ((geom.left<10)||((view_width-(geom.width+geom.left))<25))
                mB.fullwidth=true;
            else mB.fullwidth=false;
            if (mB.fullwidth) addClass(document.body,"cxFULLWIDTH");
            else dropClass(document.body,"cxFULLWIDTH");
            if (mB.fullheight) addClass(document.body,"cxFULLHEIGHT");
            else dropClass(document.body,"cxFULLHEIGHT");
            geom=getGeometry(page,page.offsetParent,true);
            var fakepage=fdjtDOM("DIV.codexpage");
            page.appendChild(fakepage);
            // There might be a better way to get the .codexpage settings,
            //  but this seems to work.
            var fakepage_geom=getGeometry(fakepage,page,true);
            var inner_width=geom.inner_width, inner_height=geom.inner_height;
            // The (-2) is for the two pixel wide border on the right side of
            //  the glossmark
            var glossmark_offset=page_margin+(-2)+
                geom.right_border+geom.right_padding+
                fakepage_geom.right_border+fakepage_geom.right_padding;
            fdjtDOM.remove(fakepage);
            // var glossmark_offset=page_margin;
            // The 2 here is for the right border of the glossmark,
            // which appears as a vertical mark on the margin.
            if (mB.CSS.pagerule) {
                mB.CSS.pagerule.style.width=inner_width+"px";
                mB.CSS.pagerule.style.height=inner_height+"px";}
            else mB.CSS.pagerule=fdjtDOM.addCSSRule(
                "div.codexpage",
                "width: "+inner_width+"px; "+"height: "+inner_height+"px;");
            if (mB.CSS.glossmark_rule) {
                mB.CSS.glossmark_rule.style.marginRight=
                    (-glossmark_offset)+"px";}
            else mB.CSS.glossmark_rule=fdjtDOM.addCSSRule(
                "#METABOOKPAGE .codexglossmark","margin-right: "+
                    (-glossmark_offset)+"px;");
            
            var shrinkrule=mB.CSS.shrinkrule;
            if (!(shrinkrule)) {
                shrinkrule=fdjtDOM.addCSSRule(
                    "body.cxSHRINK #METABOOKPAGE,body.cxPREVIEW #METABOOKPAGE, body.cxSKIMMING #METABOOKPAGE", "");
                mB.CSS.shrinkrule=shrinkrule;}
            var ph=geom.height, sh=ph-25, vs=(sh/ph);
            shrinkrule.style[fdjtDOM.transform]="scale("+vs+","+vs+")";

            document.body.style.overflow='';
            if (mB.Trace.startup>1)
                fdjtLog("Content sizing took %dms",fdjtTime()-started);}
        mB.sizeContent=sizeContent;
        
        /* Margin creation */

        function initMargins(){
            var topleading=fdjtDOM("div#SBOOKTOPLEADING.leading.top"," ");
            var bottomleading=
                fdjtDOM("div#SBOOKBOTTOMLEADING.leading.bottom"," ");
            topleading.codexui=true; bottomleading.codexui=true;
            
            var skimleft=document.createDocumentFragment();
            var skimright=document.createDocumentFragment();
            var holder=fdjtDOM("div");
            holder.innerHTML=fixStaticRefs(mB.HTML.pageleft);
            var nodes=fdjtDOM.toArray(holder.childNodes);
            var i=0, lim=nodes.length;
            while (i<lim) skimleft.appendChild(nodes[i++]);
            holder.innerHTML=fixStaticRefs(mB.HTML.pageright);
            nodes=fdjtDOM.toArray(holder.childNodes); i=0; lim=nodes.length;
            while (i<lim) skimright.appendChild(nodes[i++]);

            fdjtDOM.prepend(document.body,skimleft,skimright);

            window.scrollTo(0,0);
            
            // The better way to do this might be to change the stylesheet,
            //  but fdjtDOM doesn't currently handle that 
            var bgcolor=getBGColor(document.body)||"white";
            mB.backgroundColor=bgcolor;
            if (bgcolor==='transparent')
                bgcolor=fdjtDOM.getStyle(document.body).backgroundColor;
            if ((bgcolor)&&(bgcolor.search("rgba")>=0)) {
                if (bgcolor.search(/,\s*0\s*\)/)>0) bgcolor='white';
                else {
                    bgcolor=bgcolor.replace("rgba","rgb");
                    bgcolor=bgcolor.replace(/,\s*((\d+)|(\d+.\d+))\s*\)/,")");}}
            else if (bgcolor==="transparent") bgcolor="white";}

        var resizing=false;
        var resize_wait=false;
        var choosing_resize=false;
        
        function resizeHandler(evt){
            evt=evt||window.event;
            if (resize_wait) clearTimeout(resize_wait);
            if (choosing_resize) {
                fdjt.Dialog.close(choosing_resize);
                choosing_resize=false;}
            resize_wait=setTimeout(codexResize,1000);}

        function codexResize(){
            var layout=mB.layout;
            if (resizing) {
                clearTimeout(resizing); resizing=false;}
            mB.resizeHUD();
            mB.scaleLayout(false);
            if (!(layout)) return;
            if ((window.outerWidth===outer_width)&&
                (window.outerHeight===outer_height)) {
                // Not a real change (we think), so just scale the
                // layout, don't make a new one.
                mB.scaleLayout(true);
                return;}
            // Set these values to the new one
            outer_width=window.outerWidth;
            outer_height=window.outerHeight;
            // Possibly a new layout
            var width=getGeometry(fdjtID("METABOOKPAGE"),false,true).width;
            var height=getGeometry(fdjtID("METABOOKPAGE"),false,true).inner_height;
            if ((layout)&&(layout.width===width)&&(layout.height===height))
                return;
            if ((layout)&&(layout.onresize)&&(!(mB.freezelayout))) {
                // This handles prompting for whether or not to update
                // the layout.  We don't prompt if the layout didn't
                // take very long (mB.long_layout_thresh) or is already
                // cached (mB.layoutCached()).
                if ((mB.long_layout_thresh)&&(layout.started)&&
                    ((layout.done-layout.started)<=mB.long_layout_thresh))
                    resizing=setTimeout(resizeNow,50);
                else if (mB.layoutCached())
                    resizing=setTimeout(resizeNow,50);
                else if (choosing_resize) {}
                else {
                    // This prompts for updating the layout
                    var msg=fdjtDOM("div.title","Update layout?");
                    // This should be fast, so we do it right away.
                    mB.scaleLayout();
                    choosing_resize=true;
                    // When a choice is made, it becomes the default
                    // When a choice is made to not resize, the
                    // choice timeout is reduced.
                    var choices=[
                        {label: "Yes",
                         handler: function(){
                             choosing_resize=false;
                             resize_default=true;
                             mB.layout_choice_timeout=10;
                             resizing=setTimeout(resizeNow,50);},
                         isdefault: resize_default},
                        {label: "No",
                         handler: function(){
                             choosing_resize=false;
                             resize_default=false;
                             mB.layout_choice_timeout=10;},
                         isdefault: (!(resize_default))}];
                    var spec={choices: choices,
                              timeout: (mB.layout_choice_timeout||
                                        mB.choice_timeout||20),
                              spec: "div.fdjtdialog.fdjtconfirm.updatelayout"};
                    choosing_resize=fdjtUI.choose(spec,msg);}}}

        function resizeNow(evt){
            if (resizing) clearTimeout(resizing);
            resizing=false;
            mB.sizeContent();
            mB.layout.onresize(evt);}
        
        function getBGColor(arg){
            var color=fdjtDOM.getStyle(arg).backgroundColor;
            if (!(color)) return false;
            else if (color==="transparent") return false;
            else if (color.search(/rgba/)>=0) return false;
            else return color;}

        /* Loading meta info (user, glosses, etc) */

        function loadInfo(info) {
            if (mB.nouser) {
                mB.setConnected(false);
                return;}
            if (window._sbook_loadinfo!==info)
                mB.setConnected(true);
            if (info.sticky) mB.persist=true;
            if (!(mB.user)) {
                if (info.userinfo)
                    setUser(info.userinfo,
                            info.outlets,info.layers,
                            info.sync);
                else {
                    if (getLocal("codex.queued("+mB.refuri+")"))
                        mB.glossdb.load(
                            getLocal("codex.queued("+mB.refuri+")",true));
                    fdjtID("METABOOKCOVER").className="bookcover";
                    addClass(document.body,"cxNOUSER");}
                if (info.nodeid) setNodeID(info.nodeid);}
            else if (info.wronguser) {
                clearOffline();
                window.location=window.location.href;
                return;}
            if (info.mycopyid) {
                if ((mB.mycopyid)&&
                    (info.mycopid!==mB.mycopyid))
                    fdjtLog.warn("Mismatched mycopyids");
                else mB.mycopyid=info.mycopyid;}
            if (!(mB.docinfo)) { /* Scan not done */
                mB.scandone=function(){loadInfo(info);};
                return;}
            else if (info.loaded) return;
            if ((window._sbook_loadinfo)&&
                (window._sbook_loadinfo!==info)) {
                // This means that we have more information from the gloss
                // server before the local app has gotten around to
                // processing  the app-cached loadinfo.js
                // In this case, we put it in _sbook_new_loadinfo
                window._sbook_newinfo=info;
                return;}
            var refuri=mB.refuri;
            if ((mB.persist)&&(mB.cacheglosses)&&
                (info)&&(info.userinfo)&&(mB.user)&&
                (info.userinfo._id!==mB.user._id)) {
                clearOffline();}
            info.loaded=fdjtTime();
            if ((!(mB.localglosses))&&
                ((getLocal("codex.sync("+refuri+")"))||
                 (getLocal("codex.queued("+refuri+")"))))
                initGlossesOffline();
            if (mB.Trace.glosses) {
                fdjtLog("loadInfo for %d %sglosses and %d refs (sync=%d)",
                        ((info.glosses)?(info.glosses.length):(0)),
                        ((mB.sync)?("updated "):("")),
                        ((info.etc)?(info.etc.length):(0)),
                        info.sync);
                fdjtLog("loadInfo got %d sources, %d outlets, and %d layers",
                        ((info.sources)?(info.sources.length):(0)),
                        ((info.outlets)?(info.outlets.length):(0)),
                        ((info.layers)?(info.layers.length):(0)));}
            if ((info.glosses)||(info.etc))
                initGlosses(info.glosses||[],info.etc||[],
                            function(){infoLoaded(info);});
            if (mB.glosses) mB.glosses.update();}
        mB.loadInfo=loadInfo;

        function infoLoaded(info){
            var keepdata=(mB.cacheglosses);
            if (info.etc) gotInfo("etc",info.etc,keepdata);
            if (info.sources) gotInfo("sources",info.sources,keepdata);
            if (info.outlets) gotInfo("outlets",info.outlets,keepdata);
            if (info.layers) gotInfo("layers",info.layers,keepdata);
            addOutlets2UI(info.outlets);
            if ((info.sync)&&((!(mB.sync))||(info.sync>=mB.sync))) {
                mB.setSync(info.sync);}
            mB.loaded=info.loaded=fdjtTime();
            if (mB.whenloaded) {
                var whenloaded=mB.whenloaded;
                mB.whenloaded=false;
                setTimeout(whenloaded,10);}
            if (keepdata) {
                mB.glossdb.save(true);
                mB.sourcedb.save(true);}
            if (mB.glosshash) {
                if (mB.showGloss(mB.glosshash))
                    mB.glosshash=false;}}

        var updating=false;
        var noajax=false;
        function updatedInfo(data,source,start){
            var user=mB.user;
            if ((mB.Trace.network)||
                ((mB.Trace.glosses)&&(data.glosses)&&(data.glosses.length))||
                ((mB.Trace.startup)&&
                 ((!(user))||
                  ((mB.update_interval)&&
                   (!(mB.ticktock))&&
                   (mB.Trace.startup))))) {
                if (start)
                    fdjtLog("Response (%dms) from %s",fdjtTime()-start,source||mB.server);
                else fdjtLog("Response from %s",source||mB.server);}
            updating=false; loadInfo(data);
            if ((!(user))&&(mB.user)) userSetup();}
        mB.updatedInfo=updatedInfo;
        function updateInfo(callback,jsonp){
            var user=mB.user; var start=fdjtTime();
            var uri="https://"+mB.server+"/v1/loadinfo.js?REFURI="+
                encodeURIComponent(mB.refuri);
            var ajax_headers=((mB.sync)?({}):(false));
            if (mB.sync) ajax_headers["If-Modified-Since"]=((new Date(mB.sync*1000)).toString());
            function gotInfo(req){
                updating=false;
                mB.authkey=false; // No longer needed, we should have our own authentication keys
                var response=JSON.parse(req.responseText);
                if ((response.glosses)&&(response.glosses.length))
                    fdjtLog("Received %d glosses from the server",response.glosses.length);
                mB.updatedInfo(response,uri+((user)?("&SYNCUSER="+user._id):("&JUSTUSER=yes")),start);
                if (user) {
                    // If there was already a user, just startup
                    //  regular updates now
                    if ((!(ticktock))&&(mB.update_interval)) 
                        mB.ticktock=ticktock=
                        setInterval(updateInfo,mB.update_interval*1000);}
                else if (mB.user)
                    // This response gave us a user, so we start
                    //  another request, which will get glosses.  The
                    //  response to this request will start the
                    //  interval timer.
                    setTimeout(updateInfo,50);
                else {
                    // The response back didn't give us any user information
                    fdjtLog.warn("Couldn't determine user!");}}
            function ajaxFailed(req){
                if ((req.readyState===4)&&(req.status<500)) {
                    fdjtLog.warn(
                        "Ajax call to %s failed on callback, falling back to JSONP",
                        uri);
                    updateInfoJSONP(uri+((user)?(""):("&JUSTUSER=yes")),jsonp);
                    noajax=true;}
                else if (req.readyState===4) {
                    try {
                        fdjtLog.warn(
                            "Ajax call to %s returned status %d %j, taking a break",
                            uri,req.status,JSON.parse(req.responseText));}
                    catch (ex) {
                        fdjtLog.warn(
                            "Ajax call to %s returned status %d, taking a break",
                            uri,req.status);}
                    if (ticktock) {
                        clearInterval(mB.ticktock);
                        mB.ticktock=ticktock=false;}
                    setTimeout(updateInfo,30*60*1000);}}
            if ((updating)||(!(navigator.onLine))) return; else updating=true;
            // Get any requested glosses and add them to the call
            var i=0, lim, glosses=getQuery("GLOSS",true); {
                i=0; lim=glosses.length; while (i<lim) uri=uri+"&GLOSS="+glosses[i++];}
            glosses=getHash("GLOSS"); {
                i=0; lim=glosses.length; while (i<lim) uri=uri+"&GLOSS="+glosses[i++];}
            if (mB.mycopyid) uri=uri+"&MCOPYID="+encodeURIComponent(mB.mycopyid);
            if (mB.authkey) uri=uri+"&SBOOKS%3aAUTH-="+encodeURIComponent(mB.authkey);
            if (mB.sync) uri=uri+"&SYNC="+(mB.sync+1);
            if (user) uri=uri+"&SYNCUSER="+user._id;
            if (true) // ((!(user))&&(mB.Trace.startup))
                fdjtLog("Requesting initial user information with %s using %s",
                        ((noajax)?("JSONP"):("Ajax")),uri);
            if (noajax) {
                updateInfoJSONP(uri+((user)?(""):("&JUSTUSER=yes")),jsonp);
                return;}
            try { fdjtAjax(gotInfo,uri+"&CALLBACK=return"+((user)?(""):("&JUSTUSER=yes")),[],
                           ajaxFailed,
                           ajax_headers);}
            catch (ex) {
                fdjtLog.warn(
                    "Ajax call to %s failed on transmission, falling back to JSONP",uri);
                updateInfoJSONP(uri);}}
        mB.updateInfo=updateInfo;
        function updatedInfoJSONP(data){
            var elt=fdjtID("METABOOKUPDATEINFO");
            mB.updatedInfo(data,(((elt)&&(elt.src))||"JSON"));}
        mB.updatedInfoJSONP=updatedInfoJSONP;
        function updateInfoJSONP(uri,callback){
            if (!(navigator.onLine)) return;
            if (!(callback)) callback="mB.updatedInfoJSONP";
            var elt=fdjtID("METABOOKUPDATEINFO");
            if (uri.indexOf('?')>0) {
                if (uri[uri.length-1]!=='&') uri=uri+"&";}
            else uri=uri+"?";
            uri=uri+"CALLBACK="+callback;
            var update_script=fdjtDOM("script#METABOOKUPDATEINFO");
            update_script.language="javascript";
            update_script.type="text/javascript";
            update_script.setAttribute("charset","utf-8");
            update_script.setAttribute("async","async");
            if (mB.mycopyid)
                update_script.setAttribute("crossorigin","anonymous");
            else update_script.setAttribute("crossorigin","use-credentials");
            update_script.src=uri;
            if (elt) fdjtDOM.replace(elt,update_script);
            else document.body.appendChild(update_script);}

        function setUser(userinfo,outlets,layers,sync){
            var started=fdjtTime();
            fdjtLog("Setting up user %s (%s)",userinfo._id,
                    userinfo.name||userinfo.email);
            if (userinfo) {
                fdjtDOM.dropClass(document.body,"cxNOUSER");
                fdjtDOM.addClass(document.body,"cxUSER");}
            if (mB.user) {
                if (userinfo._id===mB.user._id) {}
                else throw { error: "Can't change user"};}
            var cursync=mB.sync;
            if ((cursync)&&(cursync>sync)) {
                fdjtLog.warn(
                    "Cached user information is newer (%o) than loaded (%o)",
                    cursync,sync);}
            if ((navigator.onLine)&&(getLocal("codex.queued("+mB.refuri+")")))
                mB.writeQueuedGlosses();
            mB.user=mB.sourcedb.Import(
                userinfo,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
            if (outlets) mB.outlets=outlets;
            if (layers) mB.layers=layers;
            // No callback needed
            mB.user.save();
            saveLocal("codex.user",mB.user._id);
            // We also save it locally so we can get it synchronously
            saveLocal(mB.user._id,mB.user.Export(),true);
            if (mB.locsync) setConfig("locsync",true);
            
            if (mB.Trace.startup) {
                var now=fdjtTime();
                fdjtLog("setUser %s (%s) done in %dms",
                        userinfo._id,userinfo.name||userinfo.email,
                        now-started);}
            mB._user_setup=fdjtTime();
            // This sets up for local storage, now that we have a user 
            if (mB.cacheglosses) mB.cacheGlosses(true);
            if (mB._ui_setup) setupUI4User();
            return mB.user;}
        mB.setUser=setUser;
        
        function setNodeID(nodeid){
            var refuri=mB.refuri;
            if (!(mB.nodeid)) {
                mB.nodeid=nodeid;
                if ((nodeid)&&(mB.persist))
                    setLocal("codex.nodeid("+refuri+")",nodeid,true);}}
        mB.setNodeID=setNodeID;

        function setupUI4User(){
            var i=0, lim;
            var startui=fdjtTime();
            if (mB._user_ui_setup) return;
            if (!(mB.user)) {
                fdjtDOM.addClass(document.body,"cxNOUSER");
                return;}
            fdjtDOM.dropClass(document.body,"cxNOUSER");
            var username=mB.user.name||mB.user.handle||mB.user.email;
            if (username) {
                if (fdjtID("METABOOKUSERNAME"))
                    fdjtID("METABOOKUSERNAME").innerHTML=username;
                var names=document.getElementsByName("METABOOKUSERNAME");
                if ((names)&&(names.length)) {
                    i=0; lim=names.length; while (i<lim)
                        names[i++].innerHTML=username;}
                names=fdjtDOM.$(".codexusername");
                if ((names)&&(names.length)) {
                    i=0; lim=names.length; while (i<lim)
                        names[i++].innerHTML=username;}}
            if (fdjtID("SBOOKMARKUSER"))
                fdjtID("SBOOKMARKUSER").value=mB.user._id;
            
            /* Initialize add gloss prototype */
            var ss=mB.stylesheet;
            var form=fdjtID("METABOOKADDGLOSSPROTOTYPE");
            if (mB.user.fbid)  
                ss.insertRule(
                    "#METABOOKHUD span.facebook_share { display: inline;}",
                    ss.cssRules.length);
            if (mB.user.twitterid) 
                ss.insertRule(
                    "#METABOOKHUD span.twitter_share { display: inline;}",
                    ss.cssRules.length);
            if (mB.user.linkedinid) 
                ss.insertRule(
                    "#METABOOKHUD span.linkedin_share { display: inline;}",
                    ss.cssRules.length);
            if (mB.user.googleid) 
                ss.insertRule(
                    "#METABOOKHUD span.google_share { display: inline;}",
                    ss.cssRules.length);
            var maker=fdjtDOM.getInput(form,"MAKER");
            if (maker) maker.value=mB.user._id;
            var pic=
                (mB.user.pic)||
                ((mB.user.fbid)&&
                 ("https://graph.facebook.com/"+mB.user.fbid+
                  "/picture?type=square"));
            if (pic) {
                if (fdjtID("SBOOKMARKIMAGE")) fdjtID("SBOOKMARKIMAGE").src=pic;
                if (fdjtID("METABOOKUSERPIC")) fdjtID("METABOOKUSERPIC").src=pic;
                var byname=document.getElementsByName("METABOOKUSERPIC");
                if (byname) {
                    i=0; lim=byname.length; while (i<lim)
                        byname[i++].src=pic;}}
            var idlinks=document.getElementsByName("IDLINK");
            if (idlinks) {
                i=0; lim=idlinks.length; while (i<lim) {
                    var idlink=idlinks[i++];
                    idlink.target='_blank';
                    idlink.title='click to edit your personal information';
                    idlink.href='https://auth.sbooks.net/my/profile';}}
            if (mB.user.friends) {
                var friends=mB.user.friends; var sourcedb=mB.sourcedb;
                i=0; lim=friends.length; while (i<lim) {
                    var friend=RefDB.resolve(friends[i++],sourcedb);
                    mB.addTag2Cloud(friend,mB.gloss_cloud);
                    mB.addTag2Cloud(friend,mB.share_cloud);}}
            if (mB.Trace.startup) {
                var now=fdjtTime();
                fdjtLog("setUser %s (%s), UI setup took %dms",
                        mB.user._id,mB.user.name||mB.user.email,
                        now-startui);}
            mB._user_ui_setup=true;}

        function loginUser(info){
            mB.user=mB.sourcedb.Import(
                info,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
            setupUI4User();
            mB._user_setup=false;}
        mB.loginUser=loginUser;
        
        function gotItem(item,qids){
            if (typeof item === 'string') {
                var load_ref=mB.sourcedb.ref(item);
                if (mB.persist) load_ref.load();
                qids.push(load_ref._id);}
            else {
                var import_ref=mB.sourcedb.Import(
                    item,false,
                    RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
                import_ref.save();
                qids.push(import_ref._id);}}
        function saveItems(qids,name){
            var refuri=mB.refuri;
            metaBook[name]=qids;
            if (mB.cacheglosses)
                saveLocal("codex."+name+"("+refuri+")",qids,true);}
        
        // Processes info loaded remotely
        function gotInfo(name,info,persist) {
            if (info) {
                if (info instanceof Array) {
                    var qids=[];
                    if (info.length<7) {
                        var i=0; var lim=info.length; 
                        while (i<lim) gotItem(info[i++],qids);
                        saveItems(qids,name);}
                    else fdjtTime.slowmap(function(item){gotItem(item,qids);},
                                          info,false,
                                          function(){saveItems(qids,name);});}
                else {
                    var ref=mB.sourcedb.Import(
                        info,false,
                        RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
                    if (persist) ref.save();
                    metaBook[name]=ref._id;
                    if (persist) saveLocal(
                        "codex."+name+"("+mB.refuri+")",ref._id,true);}}}

        function initGlosses(glosses,etc,callback){
            if (typeof callback === "undefined") callback=true;
            if ((glosses.length===0)&&(etc.length===0)) return;
            var msg=fdjtID("METABOOKNEWGLOSSES");
            var start=fdjtTime();
            if (msg) {
                msg.innerHTML=fdjtString(
                    "Assimilating %d new glosses",glosses.length);
                addClass(msg,"running");}
            if (etc) {
                if (glosses.length)
                    fdjtLog("Assimilating %d new glosses/%d sources...",
                            glosses.length,etc.length);}
            else if ((glosses.length)&&(mB.Trace.glosses)) 
                fdjtLog("Assimilating %d new glosses...",glosses.length);
            else {}
            mB.sourcedb.Import(
                etc,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX,true);
            mB.glossdb.Import(
                glosses,{"tags": Knodule.importTagSlot},
                RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX,
                callback);
            var i=0; var lim=glosses.length;
            var latest=mB.syncstamp||0;
            while (i<lim) {
                var gloss=glosses[i++];
                var tstamp=gloss.syncstamp||gloss.tstamp;
                if (tstamp>latest) latest=tstamp;}
            mB.syncstamp=latest;
            if (glosses.length)
                fdjtLog("Assimilated %d new glosses in %dms...",
                        glosses.length,fdjtTime()-start);
            dropClass(msg,"running");}
        mB.Startup.initGlosses=initGlosses;
        
        function go_online(){return offline_update();}
        function offline_update(){
            mB.writeQueuedGlosses(); updateInfo();}
        mB.update=offline_update;
        
        fdjtDOM.addListener(window,"online",go_online);

        function getLoc(x){
            var info=mB.getLocInfo(x);
            return ((info)&&(info.start));}
        var loc2pct=mB.location2pct;

        /* This initializes the sbook state to the initial location with the
           document, using the hash value if there is one. */ 
        function initLocation() {
            var state=mB.state;
            if (state) {}
            else {
                var target=fdjtID("METABOOKSTART")||fdjt.$1(".codexstart")||
                    fdjtID("SBOOKSTART")||fdjt.$1(".sbookstart")||
                    fdjtID("SBOOKTITLEPAGE");
                if (target)
                    state={location: getLoc(target),
                           // This is the beginning of the 21st century
                           changed: 978307200};
                else state={location: 1,changed: 978307200};}
            mB.saveState(state,true,true);}
        mB.initLocation=initLocation;

        function resolveXState(xstate) {
            var state=mB.state;
            if (!(mB.sync_interval)) return;
            if (mB.statedialog) {
                if (mB.Trace.state)
                    fdjtLog("resolveXState dialog exists: %o",
                            mB.statedialog);
                return;}
            if (mB.Trace.state)
                fdjtLog("resolveXState state=%j, xstate=%j",state,xstate);
            if (!(state)) {
                mB.restoreState(xstate);
                return;}
            else if (xstate.maxloc>state.maxloc) {
                state.maxloc=xstate.maxloc;
                var statestring=JSON.stringify(state);
                var uri=mB.docuri;
                saveLocal("codex.state("+uri+")",statestring);}
            else {}
            if (state.changed>=xstate.changed) {
                // The locally saved state is newer than the server,
                //  so we ignore the xstate (it might get synced
                //  separately)
                return;}
            var now=fdjtTime.tick();
            if ((now-state.changed)<(30)) {
                // If our state changed in the past 30 seconds, don't
                // bother changing the current state.
                return;}
            if (mB.Trace.state) 
                fdjtLog("Resolving local state %j with remote state %j",
                        state,xstate);
            var msg1="Start at";
            var choices=[];
            var latest=xstate.location, farthest=xstate.maxloc;
            if (farthest>state.location)
                choices.push(
                    {label: "farthest @"+loc2pct(farthest),
                     title: "your farthest location on any device/app",
                     isdefault: false,
                     handler: function(){
                         mB.GoTo(xstate.maxloc,"sync");
                         state=mB.state; state.changed=fdjtTime.tick();
                         mB.saveState(state,true,true);
                         mB.hideCover();}});
            if ((latest!==state.location)&&(latest!==farthest))
                choices.push(
                    {label: ("latest @"+loc2pct(latest)),
                     title: "the most recent location on any device/app",
                     isdefault: false,
                     handler: function(){
                         mB.restoreState(xstate); state=mB.state;
                         state.changed=fdjtTime.tick();
                         mB.saveState(state,true,true);
                         mB.hideCover();}});
            if ((choices.length)&&(state.location!==0))
                choices.push(
                    {label: ("current @"+loc2pct(state.location)),
                     title: "the most recent location on this device",
                     isdefault: true,
                     handler: function(){
                         state.changed=fdjtTime.tick();
                         mB.saveState(state,true,true);
                         mB.hideCover();}});
            if (choices.length)
                choices.push(
                    {label: "stop syncing",
                     title: "stop syncing this book on this device",
                     handler: function(){
                         setConfig("locsync",false);}});
            if (mB.Trace.state)
                fdjtLog("resolveXState choices=%j",choices);
            if (choices.length)
                mB.statedialog=fdjtUI.choose(
                    {choices: choices,cancel: true,timeout: 7,
                     nodefault: true,noauto: true,
                     onclose: function(){mB.statedialog=false;},
                     spec: "div.fdjtdialog.resolvestate#METABOOKRESOLVESTATE"},
                    fdjtDOM("div",msg1));}
        mB.resolveXState=resolveXState;

        function clearStateDialog(){
            if (mB.statedialog) {
                fdjt.Dialog.close(mB.statedialog);
                mB.statedialog=false;}}
        mB.clearStateDialog=clearStateDialog;

        /* Indexing tags */
        
        function indexingDone(){
            startupLog("Content indexing is completed");
            if (mB._setup) setupClouds();
            else mB.onsetup=setupClouds;}
        
        var cloud_setup_start=false;
        function setupClouds(){
            var tracelevel=Math.max(mB.Trace.startup,mB.Trace.clouds);
            var addTag2Cloud=mB.addTag2Cloud;
            var empty_cloud=mB.empty_cloud;
            var gloss_cloud=mB.gloss_cloud;
            cloud_setup_start=fdjtTime();
            mB.empty_query.results=
                [].concat(mB.glossdb.allrefs).concat(mB.docdb.allrefs);
            var searchtags=mB.searchtags=mB.empty_query.getCoTags();
            var empty_query=mB.empty_query;
            var tagfreqs=empty_query.tagfreqs;
            var max_freq=empty_query.max_freq;
            if (tracelevel)
                fdjtLog("Setting up initial tag clouds for %d tags",
                        searchtags.length);
            addClass(document.body,"cxINDEXING");
            fdjtDOM(empty_cloud.dom,
                    fdjtDOM("div.cloudprogress","Cloud Shaping in Progress"));
            addClass(empty_cloud.dom,"working");
            fdjtDOM(gloss_cloud.dom,
                    fdjtDOM("div.cloudprogress","Cloud Shaping in Progress"));
            addClass(gloss_cloud.dom,"working");
            fdjtTime.slowmap(function(tag){
                if (!(tag instanceof KNode)) return;
                var elt=addTag2Cloud(tag,empty_cloud,mB.knodule,
                                     mB.tagweights,tagfreqs,false);
                var sectag=(tag._id[0]==="\u00a7");
                if (!(sectag)) {
                    if (tag instanceof KNode) addClass(elt,"cue");
                    if ((tag instanceof KNode)||
                        ((tagfreqs[tag]>4)&&(tagfreqs[tag]<(max_freq/2))))
                        addTag2Cloud(tag,gloss_cloud);}},
                             searchtags,addtags_progress,addtags_done,
                             200,20);}
        
        function addtags_done(searchtags){
            var eq=mB.empty_query;
            var empty_cloud=mB.empty_cloud;
            var gloss_cloud=mB.gloss_cloud;
            if (mB.Trace.startup>1)
                fdjtLog("Done populating clouds with %d tags",
                        searchtags.length);
            dropClass(document.body,"cxINDEXING");
            eq.cloud=empty_cloud;
            if (!(fdjtDOM.getChild(empty_cloud.dom,".showall")))
                fdjtDOM.prepend(empty_cloud.dom,
                                mB.UI.getShowAll(
                                    true,empty_cloud.values.length));
            mB.sortCloud(empty_cloud);
            mB.sortCloud(gloss_cloud);
            mB.sizeCloud(empty_cloud,mB.tagweights,[]);
            mB.sizeCloud(gloss_cloud,mB.tagweights,[]);}

        function addtags_progress(state,i,lim){
            var tracelevel=Math.max(mB.Trace.startup,mB.Trace.clouds);
            var pct=((i*100)/lim);
            if (state!=='after') return;
            if (tracelevel>1)
                startupLog("Added %d (%d%% of %d tags) to clouds",
                           i,Math.floor(pct),lim);
            fdjtUI.ProgressBar.setProgress("METABOOKINDEXMESSAGE",pct);
            fdjtUI.ProgressBar.setMessage(
                "METABOOKINDEXMESSAGE",fdjtString(
                    "Added %d tags (%d%% of %d) to clouds",
                    i,Math.floor(pct),lim));}
        
        var addTags=mB.addTags;
        
        /* Using the autoindex generated during book building */
        function useIndexData(autoindex,knodule,baseweight,whendone){
            var ntags=0, nitems=0;
            var allterms=mB.allterms, prefixes=mB.prefixes;
            var tagweights=mB.tagweights;
            var maxweight=mB.tagmaxweight, minweight=mB.tagminweight;
            var tracelevel=Math.max(mB.Trace.startup,mB.Trace.indexing);
            var alltags=[];
            if (!(autoindex)) {
                if (whendone) whendone();
                return;}
            for (var tag in autoindex) {
                if (tag[0]==="_") continue;
                else if (!(autoindex.hasOwnProperty(tag))) continue;
                else alltags.push(tag);}
            function handleIndexEntry(tag){
                var ids=autoindex[tag]; ntags++;
                var occurrences=[];
                var bar=tag.indexOf('|'), tagstart=tag.search(/[^*~]/);
                var taghead=tag, tagterm=tag, knode=false, weight=false;
                if (bar>0) {
                    taghead=tag.slice(0,bar);
                    tagterm=tag.slice(tagstart,bar);}
                else tagterm=taghead=tag.slice(tagstart);
                if (tag[0]!=='~')
                    knode=mB.knodule.handleSubjectEntry(tag);
                else knode=mB.knodule.probe(taghead)||
                    mB.knodule.probe(tagterm);
                /* Track weights */
                if (knode) {
                    weight=knode.weight;
                    tagweights.set(knode,weight);}
                else if (bar>0) {
                    var body=tag.slice(bar);
                    var field_at=body.search("|:weight=");
                    if (field_at>=0) {
                        var end=body.indexOf('|',field_at+1);
                        weight=((end>=0)?
                                (parseFloat(body.slice(field_at+9,end))):
                                (parseFloat(body.slice(field_at+9))));
                        tagweights.set(tagterm,weight);}}
                else {}
                if (weight>maxweight) maxweight=weight;
                if (weight<minweight) minweight=weight;
                if (!(knode)) {
                    var prefix=((tagterm.length<3)?(tagterm):
                                (tagterm.slice(0,3)));
                    allterms.push(tagterm);
                    if (prefixes.hasOwnProperty(prefix))
                        prefixes[prefix].push(tagterm);
                    else prefixes[prefix]=[tagterm];}
                var i=0; var lim=ids.length; nitems=nitems+lim;
                while (i<lim) {
                    var idinfo=ids[i++];
                    var frag=((typeof idinfo === 'string')?
                              (idinfo):
                              (idinfo[0]));
                    var info=mB.docinfo[frag];
                    // Pointer to non-existent node.  Warn here?
                    if (!(info)) {
                        mB.missing_nodes.push(frag);
                        continue;}
                    if (typeof idinfo !== 'string') {
                        // When the idinfo is an array, the first
                        // element is the id itself and the remaining
                        // elements are the text strings which are the
                        // basis for the tag (we use this for
                        // highlighting).
                        var knodeterms=info.knodeterms, terms;
                        var tagid=((knode)?(knode._qid):(tagterm));
                        // If it's the regular case, we just assume that
                        if (!(info.knodeterms)) {
                            knodeterms=info.knodeterms={};
                            knodeterms[tagid]=terms=[];}
                        else if ((terms=knodeterms[tagid])) {}
                        else knodeterms[tagid]=terms=[];
                        var j=1; var jlim=idinfo.length;
                        while (j<jlim) {terms.push(idinfo[j++]);}}
                    occurrences.push(info);}
                addTags(occurrences,knode||taghead);}
            addClass(document.body,"cxINDEXING");
            fdjtTime.slowmap(
                handleIndexEntry,alltags,
                ((alltags.length>100)&&(tracelevel>1)&&(indexProgress)),
                function(state){
                    fdjtLog("Book index links %d keys to %d refs",ntags,nitems);
                    dropClass(document.body,"cxINDEXING");
                    mB.tagmaxweight=maxweight;
                    mB.tagminweight=minweight;
                    if (whendone) return whendone();
                    else return state;},
                200,10);}
        mB.useIndexData=useIndexData;
        function indexProgress(state,i,lim){
            if (state!=='suspend') return;
            // For chunks:
            var pct=(i*100)/lim;
            fdjtLog("Processed %d/%d (%d%%) of provided tags",
                    i,lim,Math.floor(pct));}
        
        /* Applying various tagging schemes */

        function applyMultiTagSpans() {
            var tags=fdjtDOM.$(".sbooktags");
            var i=0, lim=tags.length;
            while (i<lim) {
                var elt=tags[i++];
                var target=mB.getTarget(elt);
                var info=mB.docinfo[target.id];
                var tagtext=fdjtDOM.textify(elt);
                var tagsep=elt.getAttribute("tagsep")||";";
                var tagstrings=tagtext.split(tagsep);
                if (tagstrings.length) {
                    var j=0, jlim=tagstrings.length;
                    while (j<jlim) addTags(info,tagstrings[j++]);}}}
        function applyTagSpans() {
            var tags=fdjtDOM.$(".sbooktag");
            var i=0; var lim=tags.length;
            while (i<lim) {
                var tagelt=tags[i++];
                var target=mB.getTarget(tagelt);
                var info=mB.docinfo[target.id];
                var tagtext=fdjtDOM.textify(tagelt);
                addTags(info,tagtext);}}
        
        function applyAnchorTags() {
            var docinfo=mB.docinfo;
            var anchors=document.getElementsByTagName("A");
            if (!(anchors)) return;
            var i=0; var len=anchors.length;
            while (i<len) {
                if (anchors[i].rel==='tag') {
                    var elt=anchors[i++];
                    var cxt=elt;
                    while (cxt) if (cxt.id) break; else cxt=cxt.parentNode;
                    // Nowhere to store it?
                    if (!(cxt)) return;
                    var href=elt.href; var name=elt.name; var tag=false;
                    if (name) { // DTerm style
                        var def=elt.getAttribute('data-def')||
                            elt.getAttribute('data-def');
                        var title=elt.title;
                        if (def) {
                            if (def[0]==='|') tag=tag+def;
                            else tag=tag+"|"+def;}
                        else if (title) {
                            if (title[0]==='|') tag=name+title;
                            else if (title.indexOf('|')>0) {
                                tag=name+"|"+title;}
                            else tag=name+"|~"+title;}
                        else tag=name;}
                    else if (href) {
                        // Technorati style
                        var tagstart=(href.search(/[^\/]+$/));
                        tag=((tagstart<0)?(href):(href.slice(tagstart)));}
                    else {}
                    if (tag) {
                        var info=docinfo[cxt.id];
                        addTags(info,tag);}}
                else i++;}}
        
        /* Handling tag attributes */
        /* These are collected during the domscan; this is where the logic
           is implemented which applies header tags to section elements. */
        
        function applyTagAttributes(docinfo,whendone){
            var tracelevel=Math.max(mB.Trace.startup,mB.Trace.clouds);
            var tohandle=[]; var tagged=0;
            if ((mB.Trace.startup>1)||(mB.Trace.indexing>1))
                startupLog("Applying inline tag attributes from content");
            for (var eltid in docinfo) {
                var info=docinfo[eltid];
                if (info.atags) {tagged++; tohandle.push(info);}
                else if (info.sectag) tohandle.push(info);}
            if (((mB.Trace.indexing)&&(tohandle.length))||
                (mB.Trace.indexing>1)||(mB.Trace.startup>1))
                fdjtLog("Indexing tag attributes for %d nodes",tohandle.length);
            fdjtTime.slowmap(
                handle_inline_tags,
                tohandle,
                ((tohandle.length>100)&&
                 (function(state,i,lim){
                     // For chunks:
                     if (!((state==='suspend')||(state==='finishing')))
                         return;
                     var pct=(i*100)/lim;
                     if (tracelevel>1)
                         fdjtLog("Processed %d/%d (%d%%) inline tags",
                                 i,lim,Math.floor(pct));
                     fdjtUI.ProgressBar.setProgress(
                         "METABOOKINDEXMESSAGE",pct);
                     fdjtUI.ProgressBar.setMessage(
                         "METABOOKINDEXMESSAGE",
                         fdjtString("Assimilated %d (%d%% of %d) inline tags",
                                    i,Math.floor(pct),lim));})),
                function(){
                    if (((mB.Trace.indexing>1)&&(tohandle.length))||
                        (tohandle.length>24))
                        fdjtLog("Finished indexing tag attributes for %d nodes",
                                tohandle.length);
                    if (whendone) whendone();},
                200,5);}
        mB.applyTagAttributes=applyTagAttributes;
        
        function handle_inline_tags(info){
            if (info.atags) addTags(info,info.atags);
            if (info.sectag)
                addTags(info,info.sectag,"tags",mB.knodule);
            var knode=mB.knodule.ref(info.sectag);
            mB.tagweights.set(
                knode,mB.docdb.find('head',info).length);}
        
        /* Setting up the clouds */
        
        function addOutlets2UI(outlet){
            if (typeof outlet === 'string')
                outlet=mB.sourcedb.ref(outlet);
            if (!(outlet)) return;
            if (outlet instanceof Array) {
                var outlets=outlet;
                var i=0; var lim=outlets.length; while (i<lim)
                    addOutlets2UI(outlets[i++]);
                return;}
            if (!(outlet instanceof Ref)) return;
            var completion=fdjtDOM("span.completion.cue.source",outlet._id);
            function init(){
                completion.id="cxOUTLET"+outlet.humid;
                completion.setAttribute("data-value",outlet._id);
                completion.setAttribute("data-key",outlet.name);
                completion.innerHTML=outlet.name;
                if ((outlet.description)&&(outlet.nick))
                    completion.title=outlet.name+": "+
                    outlet.description;
                else if (outlet.description)
                    completion.title=outlet.description;
                else if (outlet.nick) completion.title=outlet.name;
                fdjtDOM("#METABOOKOUTLETS",completion," ");
                mB.share_cloud.addCompletion(completion);}
            if (outlet._live) init();
            else outlet.onLoad(init,"addoutlet2cloud");}
        
        /* Other setup */
        
        mB.StartupHandler=function(){
            mB.Startup();};

        return CodexStartup;})();
mB.Setup=mB.StartupHandler;
/*
sbookStartup=mB.StartupHandler;
sbook={Start: mB.Startup,
       setUser: mB.setUser,
       Startup: mB.Startup};
*/

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
