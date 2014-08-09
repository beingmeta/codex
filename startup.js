/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/startup.js ###################### */

/* Copyright (C) 2009-2014 beingmeta, inc.

   This file specifies the startup of the Codex web application,
   initializing both internal data structures and the DOM.

   This file is part of Codex, a Javascript/DHTML web application for reading
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
/* global Codex: false, Markdown: false */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
//var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
//var Codex=((typeof Codex !== "undefined")?(Codex):({}));
//var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
//var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

Codex.Startup=
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
        var cxID=Codex.ID;
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

        var fixStaticRefs=Codex.fixStaticRefs;

        // This is the window outer dimensions, which is stable across
        // most chrome changes, especially on-screen keyboards.  We
        // track so that we can avoid resizes which shouldn't force
        // layout updates.
        var outer_height=false, outer_width=false;

        /* Initialization */
        
        function startupLog(){
            if (!(Codex.Trace.startup)) return;
            fdjtLog.apply(null,arguments);}

        function startupMessage(){
            if ((Codex.Trace.startup)&&
                (typeof Codex.Trace.startup === "number")&&
                (Codex.Trace.startup>1))
                fdjtLog.apply(null,arguments);}
        Codex.startupMessage=startupMessage;

        /* Save local */

        var readLocal=Codex.readLocal;
        var saveLocal=Codex.saveLocal;
        var clearOffline=Codex.clearOffline;

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
            if (Codex.Trace.config>1)
                fdjtLog("Adding config handler for %s: %s",name,handler);
            config_handlers[name]=handler;
            if (current_config.hasOwnProperty(name)) {
                if (Codex.Trace.config>1)
                    fdjtLog("Applying config handler to current %s=%s",
                            name,current_config[name]);
                handler(name,current_config[name]);}}
        Codex.addConfig=addConfig;

        function getConfig(name){
            if (!(name)) return current_config;
            else return current_config[name];}
        Codex.getConfig=getConfig;

        function setConfig(name,value,save){
            if (arguments.length===1) {
                var config=name;
                Codex.postconfig=[];
                if (Codex.Trace.config) fdjtLog("batch setConfig: %s",config);
                for (var setting in config) {
                    if (config.hasOwnProperty(setting))
                        setConfig(setting,config[setting]);}
                var dopost=Codex.postconfig;
                Codex.postconfig=false;
                if ((Codex.Trace.config>1)&&(!((dopost)||(dopost.length===0))))
                    fdjtLog("batch setConfig, no post processing",config);
                var post_i=0; var post_lim=dopost.length;
                while (post_i<post_lim) {
                    if (Codex.Trace.config>1)
                        fdjtLog("batch setConfig, post processing %s",
                                dopost[post_i]);
                    dopost[post_i++]();}
                return;}
            if (Codex.Trace.config) fdjtLog("setConfig %o=%o",name,value);
            var input_name="CODEX"+(name.toUpperCase());
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
                    if (Codex.Trace.config)
                        fdjtLog("setConfig (handler=%s) %o=%o",
                                config_handlers[name],name,value);
                    config_handlers[name](name,value);}
                else if (Codex.Trace.config)
                    fdjtLog("setConfig (no handler) %o=%o",name,value);
                else {}}
            else if (Codex.Trace.config)
                fdjtLog("Redundant setConfig %o=%o",name,value);
            else {}
            if (current_config[name]!==value) {
                current_config[name]=value;
                if ((!(save))&&(inputs.length))
                    fdjtDOM.addClass("CODEXSETTINGS","changed");}
            if ((save)&&(saved_config[name]!==value)) {
                saved_config[name]=value;
                saveConfig(saved_config);}}
        Codex.setConfig=setConfig;
        Codex.resetConfig=function(){setConfig(saved_config);};

        function saveConfig(config,toserver){
            if (typeof toserver === "undefined") toserver=true;
            if (Codex.Trace.config) {
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
            if (Codex.Trace.config) fdjtLog("Saving config %o",saved);
            saveLocal("codex.config("+Codex.docuri+")",JSON.stringify(saved));
            if ((toserver)&&(navigator.onLine)) {
                var req=new XMLHttpRequest();
                req.onreadystatechange=function(evt){
                    if ((req.readyState===4)&&
                        (req.status>=200)&&(req.status<300)) {
                        Codex.setConnected(true);
                        saved_config=JSON.parse(req.responseText);}
                    else if ((req.readyState===4)&&(navigator.onLine))
                        Codex.setConnected(false);
                    else {}
                    if (Codex.Trace.state)
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
            fdjtDOM.dropClass("CODEXSETTINGS","changed");
            saved_config=saved;}
        Codex.saveConfig=saveConfig;

        function initConfig(){
            var setting, started=fdjtTime(); // changed=false;
            var config=getLocal("codex.config("+Codex.docuri+")",true)||
                fdjtState.getSession("codex.config("+Codex.docuri+")",true);
            Codex.postconfig=[];
            if (config) {
                for (setting in config) {
                    if ((config.hasOwnProperty(setting))&&
                        (!(getQuery(setting)))) {
                        // if ((!(default_config.hasOwnProperty(setting)))||
                        //    (config[setting]!==default_config[setting]))
                        //    changed=true;
                        setConfig(setting,config[setting]);}}}
            else config={};
            if (Codex.Trace.config)
                fdjtLog("initConfig (default) %j",default_config);
            for (setting in default_config) {
                if (!(config.hasOwnProperty(setting)))
                    if (default_config.hasOwnProperty(setting)) {
                        if (getQuery(setting))
                            setConfig(setting,getQuery(setting));
                        else if (getMeta("CODEX."+setting))
                            setConfig(setting,getMeta("CODEX."+setting));
                        else setConfig(setting,default_config[setting]);}}
            var dopost=Codex.postconfig;
            Codex.postconfig=false;
            var i=0; var lim=dopost.length;
            while (i<lim) dopost[i++]();
            
            // if (changed) fdjtDOM.addClass("CODEXSETTINGS","changed");
            
            var devicename=current_config.devicename;
            if ((devicename)&&(!(fdjtString.isEmpty(devicename))))
                Codex.deviceName=devicename;
            if (Codex.Trace.startup>1)
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
            if (Codex.Trace.config) fdjtLog("Update config %s",name);
            if ((elt.type==='radio')||(elt.type==='checkbox'))
                setConfig(name,elt.checked||false,save);
            else setConfig(name,elt.value,save);}
        Codex.updateConfig=updateConfig;

        Codex.addConfig("keyboardhelp",function(name,value){
            Codex.keyboardhelp=value;
            fdjtUI.CheckSpan.set(
                document.getElementsByName("CODEXKEYBOARDHELP"),
                value);});
        Codex.addConfig("devicename",function(name,value){
            if (fdjtString.isEmpty(value)) Codex.deviceName=false;
            else Codex.deviceName=value;});

        Codex.addConfig("holdmsecs",function(name,value){
            Codex.holdmsecs=value;
            fdjtUI.TapHold.default_opts.holdthresh=value;});
        Codex.addConfig("wandermsecs",function(name,value){
            Codex.wandermsecs=value;
            fdjtUI.TapHold.default_opts.wanderthresh=value;});
        Codex.addConfig("taptapmsecs",function(name,value){
            Codex.taptapmsecs=value;
            fdjtUI.TapHold.default_opts.taptapthresh=value;});

        Codex.addConfig("glossupdate",function(name,value){
            Codex.update_interval=value;
            if (ticktock) {
                clearInterval(Codex.ticktock);
                Codex.ticktock=ticktock=false;
                if (value) Codex.ticktock=ticktock=
                    setInterval(updateInfo,value*1000);}});

        Codex.addConfig("syncinterval",function(name,value){
            Codex.sync_interval=value;
            if (Codex.synctock) {
                clearInterval(Codex.synctock);
                Codex.synctock=synctock=false;}
            if ((value)&&(Codex.locsync))
                Codex.synctock=synctock=
                setInterval(Codex.syncState,value*1000);});
        Codex.addConfig("locsync",function(name,value){
            // Start or clear the sync check interval timer
            if ((!(value))&&(Codex.synctock)) {
                clearInterval(Codex.synctock);
                Codex.synctock=synctock=false;}
            else if ((value)&&(!(Codex.synctock))&&
                     (Codex.sync_interval))
                Codex.synctock=synctock=
                setInterval(Codex.syncState,(Codex.sync_interval)*1000);
            else {}
            Codex.locsync=value;});
        
        function syncStartup(){
            // This is the startup code which is run
            //  synchronously, before the time-sliced processing
            fdjtLog.console="CODEXCONSOLELOG";
            fdjtLog.consoletoo=true;
            if (!(Codex._setup_start)) Codex._setup_start=new Date();
            fdjtLog("This is Codex v%s, built %s on %s, launched %s, from %s",
                    Codex.version,Codex.buildtime,Codex.buildhost,
                    Codex._setup_start.toString(),
                    Codex.root||"somewhere");
            if (fdjtID("CODEXBODY")) Codex.body=fdjtID("CODEXBODY");

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
                Codex.authkey=authkey;}

            // Check for any trace settings passed as query arguments
            if (getQuery("cxtrace")) readTraceSettings();
            
            // Get various settings for the sBook from the HTML
            // (META tags, etc), including settings or guidance for
            // skimming, graphics, layout, glosses, etc.
            readBookSettings();
            fdjtLog("Book %s (%s) %s (%s%s)",
                    Codex.docref||"@??",Codex.bookbuild||"",
                    Codex.refuri,Codex.sourceid,
                    ((Codex.sourcetime)?(": "+Codex.sourcetime):("")));
            
            // Initialize the databases
            Codex.initDB();

            // Get config information
            initConfig();

            // This sets various aspects of the environment
            readEnvSettings();

            // Figure out if we have a user and whether we can keep
            // user information
            if (getLocal("codex.user")) {
                Codex.persist=true;
                userSetup();}

            // Initialize the book state (location, targets, etc)
            Codex.initState(); Codex.syncState();

            // If we have no clue who the user is, ask right away (updateInfo())
            if (!((Codex.user)||(window._sbook_loadinfo)||
                  (Codex.userinfo)||(window._userinfo)||
                  (getLocal("codex.user")))) {
                if (Codex.Trace.startup)
                    fdjtLog("No local user info, requesting from sBooks server %s",Codex.server);
                // When Codex.user is not defined, this just requests identity information
                updateInfo();}

            // Execute any FDJT initializations
            fdjt.Init();

            bookSetup();
            deviceSetup();
            coverSetup();
            appSetup();
            Codex._ui_setup=fdjtTime();
            showMessage();
            if (Codex._user_setup) setupUI4User();
            contentSetup();

            // Reapply config settings to update the HUD UI
            Codex.setConfig(Codex.getConfig());

            var adjstart=fdjt.Time();
            fdjtDOM.tweakFonts(fdjtID("CODEXHUD"));
            if (Codex.Trace.startup>2)
                fdjtLog("Adjusted HUD fonts in %fsecs",
                        ((fdjt.Time()-adjstart)/1000));

            if (Codex.Trace.startup>1)
                fdjtLog("Initializing markup converter");
            var markdown_converter=new Markdown.Converter();
            Codex.markdown_converter=markdown_converter;
            Codex.md2HTML=function(mdstring){
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
            Codex.md2DOM=md2DOM;

            Codex.Timeline.sync_startup=new Date();
            if (Codex.onsyncstartup) {
                var delayed=Codex.onsyncstartup;
                delete Codex.onsyncstartup;
                if (Array.isArray(delayed)) {
                    var i=0, lim=delayed.length;
                    while (i<lim) {delayed[i](); i++;}}
                else delayed();}
            if (Codex.Trace.startup)
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
            fdjtDOM.addAppSchema("Codex","http://codex.sbooks.net/");
            fdjtDOM.addAppSchema("DC","http://purl.org/dc/elements/1.1/");
            fdjtDOM.addAppSchema("DCTERMS","http://purl.org/dc/terms/");
            fdjtDOM.addAppSchema("OLIB","http://openlibrary.org/");

            Codex.devinfo=fdjtState.versionInfo();
            
            /* Where to get your images from, especially to keep
               references inside https */
            if ((Codex.root==="http://static.beingmeta.com/")&&
                (window.location.protocol==='https:'))
                Codex.root=https_root;
            // Whether to suppress login, etc
            if ((getLocal("codex.nologin"))||(getQuery("nologin")))
                Codex.nologin=true;
            var sbooksrv=getMeta("SBOOKS.server")||getMeta("SBOOKSERVER");
            if (sbooksrv) Codex.server=sbooksrv;
            else if (fdjtState.getCookie("SBOOKSERVER"))
                Codex.server=fdjtState.getCookie("SBOOKSERVER");
            else Codex.server=lookupServer(document.domain);
            if (!(Codex.server)) Codex.server=Codex.default_server;

            // Get the settings for scanning the document structure
            getScanSettings();}

        function appSetup() {

            var body=document.body;
            var started=fdjtTime();

            if (Codex.Trace.startup>2) fdjtLog("Starting app setup");

            // Create a custom stylesheet for the app
            var style=fdjtDOM("STYLE");
            fdjtDOM(document.head,style);
            Codex.stylesheet=style.sheet;

            // This initializes the book tools (the HUD/Heads Up Display)
            Codex.initHUD();

            var uri=Codex.bookimage||Codex.bookcover||Codex.coverpage;
            if ((uri)&&(typeof uri === "string")) {
                var images=fdjtDOM.$("img.codexbookimage");
                var i=0, lim=images.length;
                while (i<lim) images[i++].src=uri;}

            if (Codex.refuri) {
                var refuris=document.getElementsByName("REFURI");
                if (refuris) {
                    var j=0; var len=refuris.length;
                    while (j<len) {
                        if (refuris[j].value==='fillin')
                            refuris[j++].value=Codex.refuri;
                        else j++;}}}

            addConfig("cacheglosses",
                      function(name,value){Codex.cacheGlosses(value);});

            // Setup the reticle (if desired)
            if ((typeof (body.style["pointer-events"])!== "undefined")&&
                ((Codex.demo)||(fdjtState.getLocal("codex.demo"))||
                 (fdjtState.getCookie("sbooksdemo"))||
                 (getQuery("demo")))) {
                fdjtUI.Reticle.setup();}

            fdjtLog("Body: %s",document.body.className);

            if (Codex.Trace.startup>1)
                fdjtLog("App setup took %dms",fdjtTime()-started);}
        
        function contentSetup(){
            var started=fdjtTime();
            // Modifies the DOM in various ways
            initBody();
            // Size the content
            sizeContent();
            // Setup the UI components for the body and HUD
            Codex.setupGestures();
            if (Codex.Trace.gestures)
                fdjtLog("Content setup in %dms",fdjtTime()-started);}

        Codex.setSync=function setSync(val){
            if (!(val)) return false;
            var cur=Codex.sync;
            if ((cur)&&(cur>val)) return cur;
            Codex.sync=val;
            if (Codex.persist)
                saveLocal("codex.sync("+Codex.docuri+")",val);
            return val;};

        function userSetup(){
            // Get any local sync information
            var sync=Codex.sync=getLocal("codex.sync("+Codex.refuri+")",true)||0;
            var started=fdjtTime();
            var loadinfo=false, userinfo=false;

            // If the configuration is set to not persist, but there's
            //  a sync timestamp, we should erase what's there.
            if ((Codex.sync)&&(!(Codex.persist))) clearOffline();

            if (Codex.nologin) {}
            else if ((Codex.persist)&&(getLocal("codex.user"))) {
                initUserOffline();
                if (Codex.Trace.storage) 
                    fdjtLog("Local info for %o (%s) from %o",
                            Codex.user._id,Codex.user.name,Codex.sync);
                // Clear any loadinfo read on startup from the
                // application cache but already stored locally.
                if ((Codex.user)&&(Codex.sync)&&(Codex.cacheglosses)&&
                    (window._sbook_loadinfo))
                    // Clear the loadinfo "left over" from startup,
                    //  which should now be in the database
                    window._sbook_loadinfo=false;}
            
            if (Codex.nologin) {}
            else if ((window._sbook_loadinfo)&&
                     (window._sbook_loadinfo.userinfo)) {
                // Get the userinfo from the loadinfo that might have already been loaded
                loadinfo=window._sbook_loadinfo;
                userinfo=loadinfo.userinfo;
                window._sbook_loadinfo=false;
                if (Codex.Trace.storage) 
                    fdjtLog("Have window._sbook_loadinfo for %o (%s) dated %o: %j",
                            userinfo._id,userinfo.name||userinfo.email,
                            loadinfo.sync,userinfo);
                setUser(userinfo,
                        loadinfo.outlets,loadinfo.layers,
                        loadinfo.sync);
                if (loadinfo.nodeid) setNodeID(loadinfo.nodeid);}
            else if ((Codex.userinfo)||(window._userinfo)) {
                userinfo=(Codex.userinfo)||(window._userinfo);
                if ((Codex.Trace.storage)||(Codex.Trace.startup))
                    fdjtLog("Have %s for %o (%s) dated %o: %j",
                            ((Codex.userinfo)?("Codex.userinfo"):("window._userinfo")),
                            userinfo._id,userinfo.name||userinfo.email,
                            userinfo.sync||userinfo.modified,userinfo);
                setUser(userinfo,userinfo.outlets,userinfo.layers,
                        userinfo.sync||userinfo.modified);}
            else {}
            if (Codex.Trace.startup>1)
                fdjtLog("userSetup done in %dms",fdjtTime()-started);
            if (Codex.nologin) return;
            else if (!(Codex.refuri)) return;
            else {}
            if (window.navigator.onLine) {
                if ((Codex.user)&&(sync))
                    fdjtLog("Requesting new (> %s (%d)) glosses on %s from %s for %s",
                            fdjtTime.timeString(Codex.sync),Codex.sync,
                            Codex.refuri,Codex.server,Codex.user._id,Codex.user.name);
                else if (Codex.user)
                    fdjtLog("Requesting all glosses on %s from %s for %s (%s)",
                            Codex.refuri,Codex.server,Codex.user._id,Codex.user.name);
                else fdjtLog(
                    "No user, requesting user info and glosses from %s",
                    Codex.server);
                updateInfo();
                return;}
            else return;}
        Codex.userSetup=userSetup;

        function readTraceSettings(){
            var tracing=getQuery("cxtrace",true);
            var i=0; var lim=tracing.length;
            while (i<lim) {
                var trace_spec=tracing[i++];
                var colon=trace_spec.indexOf(":");
                if (colon<0) {
                    if (typeof Codex.Trace[trace_spec] === 'number')
                        Codex.Trace[trace_spec]=1;
                    else Codex.Trace[trace_spec]=true;}
                else {
                    var trace_name=trace_spec.substr(0,colon);
                    var trace_val=trace_spec.substr(colon+1);
                    if (typeof Codex.Trace[trace_name] === 'number')
                        Codex.Trace[trace_name]=parseInt(trace_val,10);
                    else Codex.Trace[trace_name]=trace_val;}}}

        var glosshash_pat=/G[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        
        function CodexStartup(force){
            var metadata=false;
            if (Codex._setup) return;
            if ((!force)&&(getQuery("nocodex"))) return;
            /* Cleanup, save initial hash location */
            if ((location.hash==="null")||(location.hash==="#null"))
                location.hash="";
            if ((location.hash)&&(location.hash!=="#")) {
                var hash=location.hash;
                if (hash[0]==='#') hash=hash.slice(1);
                if (glosshash_pat.exec(location.hash))
                    Codex.glosshash=hash;
                else Codex.inithash=location.hash;}
            Codex._starting=fdjtTime();
            addClass(document.body,"cxSTARTUP");
            // This is all of the startup that we need to do synchronously
            syncStartup();
            // The rest of the stuff we timeslice
            fdjtTime.timeslice
            ([  // Scan the DOM for metadata.  This is surprisingly
                //  fast, so we don't currently try to timeslice it or
                //  cache it, though we could.
                function(){metadata=scanDOM();},
                // Now you're ready to lay out the book, which is
                //  timesliced and runs on its own.  We wait to do
                //  this until we've scanned the DOM because we may
                //  use results of DOM scanning in layout (for example,
                //  heading information).
                function(){
                    if (Codex.bypage) Codex.Paginate("initial");
                    else addClass(document.body,"cxSCROLL");},
                // Build the display TOC, both the dynamic (top of
                // display) and the static (inside the hudheart)
                function(){
                    var tocmsg=fdjtID("CODEXSTARTUPTOC");
                    var tocstart=fdjtTime();
                    if (tocmsg) {
                        tocmsg.innerHTML=fdjtString(
                            "Building table of contents based on %d heads",
                            Codex.docinfo._headcount);
                        addClass(tocmsg,"running");}
                    Codex.setupTOC(metadata[Codex.content.id]);
                    startupLog("Built tables of contents based on %d heads in %fms",
                               Codex.docinfo._headcount,
                               fdjtTime()-tocstart);
                    if (tocmsg) dropClass(tocmsg,"running");},
                // Load all account information
                function(){
                    if (Codex.Trace.startup>1) fdjtLog("Loading sourcedb");
                    Codex.sourcedb.load(true);},
                // Read knowledge bases (knodules) used by the book
                ((Knodule)&&(Knodule.HTML)&&
                 (Knodule.HTML.Setup)&&(Codex.knodule)&&
                 (function(){
                     var knomsg=fdjtID("CODEXSTARTUPKNO");
                     var knodetails=fdjtID("CODEXSTARTUPKNODETAILS");
                     if (knodetails) {
                         knodetails.innerHTML=fdjtString(
                             "Processing knodule %s",Codex.knodule.name);}
                     addClass(knomsg,"running");
                     if ((Codex.Trace.startup>1)||(Codex.Trace.indexing))
                         fdjtLog("Processing knodule %s",Codex.knodule.name);
                     Knodule.HTML.Setup(Codex.knodule);
                     dropClass(knomsg,"running");})),
                // Process locally stored (offline data) glosses
                function(){
                    if (Codex.sync) {
                        if (Codex.cacheglosses) return initGlossesOffline();}
                    else if (window._sbook_loadinfo) {
                        loadInfo(window._sbook_loadinfo);
                        window._sbook_loadinfo=false;}},
                // Process anything we got via JSONP ahead of processing
                //  _sbook_loadinfo
                ((window._sbook_newinfo)&&(function(){
                    loadInfo(window._sbook_newinfo);
                    window._sbook_newinfo=false;})),
                function(){
                    if ((Codex.Trace.startup>1)||(Codex.Trace.indexing>1))
                        fdjtLog("Finding and applying Technorati-style tags");
                    applyAnchorTags();},
                function(){
                    if ((Codex.Trace.startup>1)||(Codex.Trace.indexing>1))
                        fdjtLog("Finding and applying tag elements from body");
                    applyTagSpans();
                    applyMultiTagSpans();
                    applyTagAttributes(metadata);},
                function(){
                    var pubindex=Codex._publisher_index||
                        window._sbook_autoindex;
                    if (pubindex) {
                        handlePublisherIndex(pubindex,indexingDone);
                        Codex._publisher_index=false;
                        window._sbook_autoindex=false;}
                    else if (fdjtID("SBOOKAUTOINDEX")) {
                        var elt=fdjtID("SBOOKAUTOINDEX");
                        fdjtDOM.addListener(elt,"load",function(evt){
                            evt=evt||window.event;
                            handlePublisherIndex(false,indexingDone);
                            Codex._publisher_index=false;
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
                                Codex._publisher_index=false;
                                window._sbook_autoindex=false;});
                            document.body.appendChild(script_elt);}
                        else indexingDone();}},
                startupDone],
             100,25);}
        Codex.Startup=CodexStartup;
        
        function handlePublisherIndex(pubindex,whendone){
            if (!(pubindex))
                pubindex=Codex._publisher_index||window._sbook_autoindex;
            if (!(pubindex)) {
                if (whendone) whendone();
                return;}
            if ((Codex.Trace.startup>1)||(Codex.Trace.indexing)) {
                if (pubindex._nkeys)
                    fdjtLog("Processing provided index of %d keys and %d refs",
                            pubindex._nkeys,pubindex._nrefs);
                else fdjtLog("Processing provided index");}
            Codex.useIndexData(pubindex,Codex.knodule,false,whendone);}

        function scanDOM(){
            var scanmsg=fdjtID("CODEXSTARTUPSCAN");
            addClass(scanmsg,"running");
            var metadata=new Codex.DOMScan(Codex.content,Codex.refuri+"#");
            Codex.docinfo=metadata;
            Codex.ends_at=Codex.docinfo._maxloc;
            dropClass(scanmsg,"running");
            if ((Codex.state)&&(Codex.state.target)&&
                (!((Codex.state.location)))) {
                var info=Codex.docinfo[Codex.state.target];
                if ((info)&&(info.starts_at)) {
                    Codex.state.location=info.starts_at;
                    // Save current state, skip history, force save
                    Codex.saveState(false,true,true);}}
            
            if (Codex.scandone) {
                var donefn=Codex.scandone;
                delete Codex.scandone;
                donefn();}
            return metadata;}
        
        function startupDone(mode){
            if ((Codex.glosshash)&&(Codex.glossdb.ref(Codex.glosshash))) {
                if (Codex.showGloss(Codex.glosshash)) {
                    Codex.glosshash=false;
                    Codex.Timeline.initLocation=fdjtTime();}
                else initLocation();}
            else initLocation();
            window.onpopstate=function onpopstate(evt){
                if (evt.state) Codex.restoreState(evt.state,"popstate");};
            fdjtLog("Startup done");
            Codex.displaySync();
            fdjtDOM.dropClass(document.body,"cxSTARTUP");
            if (fdjtID("CODEXREADYMESSAGE"))
                fdjtID("CODEXREADYMESSAGE").innerHTML="Open";
            if (mode) {}
            else if (getQuery("startmode"))
                mode=getQuery("startmode");
            else {}
            if (mode) Codex.setMode(mode);
            else mode=Codex.mode;
            Codex._setup=new Date();
            Codex._starting=false;
            if (Codex.onsetup) {
                var onsetup=Codex.onsetup;
                Codex.onsetup=false;
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
            if ((!(mode))&&(location.hash)&&(Codex.state)&&
                (location.hash.slice(1)!==Codex.state.target))
                Codex.hideCover();
            else if ((!(mode))&&(Codex.user)) {
                var opened=readLocal(
                    "codex.opened("+Codex.docuri+")",true);
                if ((opened)&&((opened+((3600+1800)*1000))>fdjtTime()))
                    Codex.hideCover();}
            if (fdjtDOM.vischange)
                fdjtDOM.addListener(document,fdjtDOM.vischange,
                                    Codex.visibilityChange);
            fdjtDOM.addListener(window,"resize",resizeHandler);}
        
        /* Application settings */
        
        function readBookSettings(){
            // Basic stuff
            var refuri=_getsbookrefuri();
            var locuri=window.location.href;
            var hashpos=locuri.indexOf('#');
            if (hashpos>0) Codex.locuri=locuri.slice(0,hashpos);
            else Codex.locuri=locuri;
            document.body.refuri=Codex.refuri=refuri;
            Codex.docuri=_getsbookdocuri();
            Codex.topuri=document.location.href;
            
            var refuris=getLocal("codex.refuris",true)||[];

            Codex.sourceid=
                getMeta("SBOOKS.sourceid")||getMeta("SBOOKS.fileid")||
                Codex.docuri;
            Codex.sourcetime=getMeta("SBOOKS.sourcetime");
            var oldid=getLocal("codex.sourceid("+Codex.docuri+")");
            if ((oldid)&&(oldid!==Codex.sourceid)) {
                var layouts=getLocal("codex.layouts("+oldid+")");
                if ((layouts)&&(layouts.length)) {
                    var i=0, lim=layouts.length; while (i<lim) 
                        CodexLayout.dropLayout(layouts[i++]);}}
            else saveLocal("codex.sourceid("+Codex.docuri+")",Codex.sourceid);

            Codex.bookbuild=getMeta("SBOOKS.buildstamp");

            Codex.bypage=(Codex.page_style==='bypage'); 
            Codex.max_excerpt=getMeta("SBOOKS.maxexcerpt")||(Codex.max_excerpt);
            Codex.min_excerpt=getMeta("SBOOKS.minexcerpt")||(Codex.min_excerpt);
            
            var notespecs=getMeta("sbooknote",true).concat(
                getMeta("SBOOKS.note",true));
            var noterefspecs=getMeta("sbooknoteref",true).concat(
                getMeta("SBOOKS.noteref",true));
            Codex.sbooknotes=(((notespecs)&&(notespecs.length))?
                              (fdjtDOM.sel(notespecs)):(false));
            Codex.sbooknoterefs=(((noterefspecs)&&(noterefspecs.length))?
                                 (fdjtDOM.sel(noterefspecs)):(false));

            refuris.push(refuri);

            var docref=getMeta("SBOOKS.docref");
            if (docref) Codex.docref=docref;

            var coverpage=getLink("SBOOKS.coverpage",false,true)||
                getLink("coverpage",false,true);
            if (coverpage) Codex.coverpage=coverpage;
            
            var baseid=getMeta("SBOOKS.id")||
                getMeta("SBOOKS.prefix")||getMeta("SBOOKS.baseid");
            if (baseid) Codex.baseid=baseid;
            var prefix=getMeta("SBOOKS.prefix")||baseid;
            if (prefix) Codex.prefix=prefix;
            var targetprefix=getMeta("SBOOKS.targetprefix");
            if ((targetprefix)&&(targetprefix==="*"))
                Codex.targetids=false;
            else if ((targetprefix)&&(targetprefix[0]==='/'))
                Codex.targetids=new RegExp(targetprefix.slice(1,targetprefix.length-1));
            else if (targetprefix)
                Codex.targetids=new RegExp("^"+targetprefix);
            else if (prefix)
                Codex.targetids=new RegExp("^"+prefix);
            else Codex.targetids=false;
            
            if (getMeta("CODEX.forcelayout"))
                default_config.forcelayout=true;

            var autotoc=getMeta("SBOOKS.autotoc");
            if (autotoc) {
                if ((autotoc[0]==="y")||(autotoc[0]==="Y")||
                    (autotoc==="ON")||(autotoc==="on")||
                    (autotoc==="1")||(autotoc==="enable"))
                    Codex.autotoc=true;
                else Codex.autotoc=false;}

            if (!(Codex.nologin)) {
                Codex.mycopyid=getMeta("SBOOKS.mycopyid")||
                    (getLocal("mycopy("+refuri+")"))||
                    false;}
            if (Codex.persist) saveLocal("codex.refuris",refuris,true);}

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
                Codex.ui="touch";
                Codex.touch=true;
                Codex.keyboard=false;
                viewportSetup();}
            if ((device.android)&&(device.android>=3)) {
                default_config.keyboardhelp=false;
                Codex.updatehash=false;
                Codex.iscroll=false;}
            else if (device.android) {
                default_config.keyboardhelp=false;
                Codex.updatehash=false;
                Codex.iscroll=true;}
            else if ((useragent.search("Safari/")>0)&&
                     (useragent.search("Mobile/")>0)) { 
                hide_mobile_safari_address_bar();
                Codex.iscroll=false;
                Codex.updatehash=false;
                // Animation seems to increase crashes in iOS
                // Codex.dontanimate=true;
                // default_config.layout='fastpage';
                default_config.keyboardhelp=false;
                // Have fdjtLog do it's own format conversion for the log
                fdjtLog.doformat=true;}
            else if (device.touch) {
                fdjtDOM.addClass(body,"cxTOUCH");
                Codex.ui="touch";}
            else if (!(Codex.ui)) {
                // Assume desktop or laptop
                fdjtDOM.addClass(body,"cxMOUSE");
                Codex.ui="mouse";}
            else {}
            if (Codex.iscroll) {
                fdjtDOM.addClass(body,"cxISCROLL");
                device.iscroll=true;}
            device.string=device.string+" "+
                ((Codex.iscroll)?("iScroll"):("nativescroll"));
            fdjtLog("deviceSetup done in %dms: %s/%dx%d %s",
                    fdjtTime()-started,
                    Codex.ui,fdjtDOM.viewWidth(),fdjtDOM.viewHeight(),
                    device.string);}

        function bookSetup(){
            if (Codex.bookinfo) return;
            var bookinfo=Codex.bookinfo={}; var started=fdjtTime();
            bookinfo.title=
                getMeta("Codex.title")||
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
                getMeta("Codex.byline")||
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
            if (Codex.Trace.startup>1)
                fdjtLog("bookSetup done in %dms",fdjtTime()-started);}
        function getBookInfo(){
            if (Codex.bookinfo) return Codex.bookinfo;
            else {bookSetup(); return Codex.bookinfo;}}
        Codex.getBookInfo=getBookInfo;
        
        function initUserOffline(){
            var refuri=Codex.refuri;
            var user=getLocal("codex.user");
            var sync=Codex.sync;
            var nodeid=getLocal("codex.nodeid("+refuri+")",true);
            // We store the information for the current user
            //  in both localStorage and in the "real" sourcedb.
            // We fetch the user from local storage because we
            //  can do that synchronously.
            var userinfo=user&&getLocal(user,true);
            if (Codex.Trace.storage)
                fdjtLog("initOffline user=%s sync=%s nodeid=%s info=%j",
                        user,sync,nodeid,userinfo);
            if (!(sync)) return;
            if (!(user)) return;
            if (Codex.Trace.startup>1)
                fdjtLog("initOffline userinfo=%j",userinfo);
            // Should these really be refs in sourcedb?
            var outlets=Codex.outlets=
                getLocal("codex.outlets("+refuri+")",true)||[];
            var layers=Codex.layers=
                getLocal("codex.layers("+refuri+")",true)||[];
            if (userinfo) setUser(userinfo,outlets,layers,sync);
            if (nodeid) setNodeID(nodeid);}

        var offline_init=false;

        function initGlossesOffline(){
            if (offline_init) return false;
            else offline_init=true;
            var sync=Codex.sync;
            if (!(sync)) return;
            if ((Codex.Trace.glosses)||(Codex.Trace.startup))
                fdjtLog("Starting initializing glosses from local storage");
            Codex.glosses.setLive(false);
            Codex.sourcedb.load(true);
            Codex.glossdb.load(true,function(){
                Codex.glosses.setLive(true);
                if (Codex.heartscroller)
                    Codex.heartscroller.refresh();
                if ((Codex.glossdb.allrefs.length)||
                    (Codex.sourcedb.allrefs.length))
                    fdjtLog("Initialized %d glosses (%d sources) from local storage",
                            Codex.glossdb.allrefs.length,
                            Codex.sourcedb.allrefs.length);});}

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
            var sbook_servers=Codex.servers;
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
        Codex.hasTOCLevel=hasTOCLevel;

        var headlevels=["not","A","B","C","D","E","F","G","H","I","J","K","L"];

        function getScanSettings(){
            if (!(Codex.docroot))
                if (getMeta("SBOOKS.root"))
                    Codex.docroot=cxID(getMeta("SBOOKS.root"));
            else Codex.docroot=fdjtID("SBOOKCONTENT")||document.body;
            if (!(Codex.start))
                if (getMeta("SBOOKS.start"))
                    Codex.start=cxID(getMeta("SBOOKS.start"));
            else if (fdjtID("SBOOKSTART"))
                Codex.start=fdjtID("SBOOKSTART");
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
            if (ignore.length) Codex.ignore=new fdjtDOM.Selector(ignore);
            var notoc=
                ((getMeta("sbooknotoc"))||[]).concat(
                    ((getMeta("SBOOKS.notoc"))||[])).concat(
                        ((getMeta("SBOOKS.nothead"))||[])).concat(
                            ((getMeta("sbooknothead"))||[]));
            if (notoc.length) Codex.notoc=new fdjtDOM.Selector(notoc);
            var terminal=((getMeta("sbookterminal"))||[]).concat(
                ((getMeta("SBOOKS.terminal"))||[]));
            if (terminal.length) Codex.terminals=new fdjtDOM.Selector(terminal.length);
            var focus=
                ((getMeta("sbookfocus"))||[]).concat(
                    ((getMeta("SBOOKS.focus"))||[])).concat(
                        ((getMeta("sbooktarget"))||[])).concat(
                            ((getMeta("SBOOKS.target"))||[])).concat(
                                ((getMeta("SBOOKS.idify"))||[]));
            if (focus.length) Codex.focus=new fdjtDOM.Selector(focus);
            var nofocus=
                ((getMeta("sbooknofocus"))||[]).concat(
                    ((getMeta("SBOOKS.nofocus"))||[])).concat(
                        ((getMeta("sbooknotarget"))||[])).concat(
                            ((getMeta("SBOOKS.notarget"))||[]));
            if (nofocus.length) Codex.nofocus=new fdjtDOM.Selector(nofocus);}

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
            if (Codex.Trace.gesture>1) fdjtLog("consolebutton_click %o",evt);
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
            var frame=fdjtID("CODEXFRAME"), started=fdjtTime();
            var cover, existing_cover=fdjtID("CODEXCOVER");
            if (!(frame)) {
                frame=fdjtDOM("div#CODEXFRAME");
                fdjtDOM.prepend(document.body,frame);}
            Codex.Frame=frame;
            if (existing_cover) {
                frame.appendChild(existing_cover);
                cover=existing_cover;}
            else {
                cover=fdjtDOM("div#CODEXCOVER");
                cover.innerHTML=fixStaticRefs(Codex.HTML.cover);
                frame.appendChild(cover);}
            if (Codex.Trace.startup>2) {
                if (existing_cover)
                    fdjtLog("Setting up existing cover");
                else fdjtLog("Setting up new cover");}

            // Remove any explicit style attributes set for on-load display
            if (existing_cover) existing_cover.removeAttribute("style");
            if (fdjtID("CODEXBOOKCOVERHOLDER"))
                fdjtID("CODEXBOOKCOVERHOLDER").removeAttribute("style");
            if (fdjtID("CODEXBOOKCOVERIMAGE"))
                fdjtID("CODEXBOOKCOVERIMAGE").removeAttribute("style");
            if (fdjtID("CODEXTITLEPAGEHOLDER"))
                fdjtID("CODEXTITLEPAGEHOLDER").removeAttribute("style");
            if (fdjtID("CODEXINFOPAGEHOLDER"))
                fdjtID("CODEXINFOPAGEHOLDER").removeAttribute("style");
            if (fdjtID("CODEXCREDITSPAGEHOLDER"))
                fdjtID("CODEXCREDITSPAGEHOLDER").removeAttribute("style");
            if (fdjtID("CODEXABOUTBOOKHOLDER"))
                fdjtID("CODEXABOUTBOOKHOLDER").removeAttribute("style");
            if (fdjtID("CODEXLAYERS"))
                fdjtID("CODEXLAYERS").removeAttribute("style");
            if (fdjtID("CODEXCONSOLE"))
                fdjtID("CODEXCONSOLE").removeAttribute("style");
            if (fdjtID("CODEXSETTINGS"))
                fdjtID("CODEXSETTINGS").removeAttribute("style");
            if (fdjtID("CODEXAPPHELP"))
                fdjtID("CODEXAPPHELP").removeAttribute("style");
            if (fdjtID("CODEXREADYMESSAGE")) 
                fdjtID("CODEXREADYMESSAGE").removeAttribute("style");
            if (fdjtID("CODEXBUSYMESSAGE"))
                fdjtID("CODEXBUSYMESSAGE").removeAttribute("style");
            if (fdjtID("CODEXCOVERCONTROLS"))
                fdjtID("CODEXCOVERCONTROLS").removeAttribute("style");
            
            var coverpage=fdjtID("CODEXCOVERPAGE");
            if (coverpage) 
                coverpage.id="CODEXBOOKCOVER";
            else if (fdjtID("SBOOKCOVERPAGE")) {
                coverpage=fdjtID("SBOOKCOVERPAGE").cloneNode(true);
                fdjtDOM.stripIDs(coverpage);
                coverpage.id="CODEXBOOKCOVER";}
            else if (Codex.coverpage) {
                var coverimage=fdjtDOM.Image(Codex.coverpage);
                coverpage=fdjtDOM("div#CODEXBOOKCOVER",coverimage);}
            else {}
            if (coverpage) {
                cover.setAttribute("data-defaultclass","bookcover");
                cover.className="bookcover";
                if (fdjtID("CODEXBOOKCOVERHOLDER")) 
                    fdjtDOM.replace(fdjtID("CODEXBOOKCOVERHOLDER"),
                                    coverpage);
                else cover.appendChild(coverpage);}
            else if (cover.className==="bookcover") {
                // Use the provided book cover
                var holder=fdjtID("CODEXBOOKCOVERHOLDER");
                if (holder) holder.id="CODEXBOOKCOVER";}
            else {
                cover.setAttribute("data-defaultclass","titlepage");
                cover.className="titlepage";}
            if (coverpage) {
                coverpage.style.opacity=0.0; coverpage.style.display="block";
                coverpage.style.overflow="visible";
                fdjtDOM.scaleToFit(coverpage,1.0);
                coverpage.style.opacity=""; coverpage.style.display="";
                coverpage.style.overflow="";}
            if (fdjtID("CODEXBOOKCOVERHOLDER"))
                fdjtDOM.remove("CODEXBOOKCOVERHOLDER");
            if ((!(fdjtID("CODEXBOOKCOVER")))&&(fdjtID("CODEXCOVERCONTROLS")))
                fdjtDOM.addClass("CODEXCOVERCONTROLS","nobookcover");

            var titlepage=fdjtID("CODEXTITLEPAGE");
            if (!(titlepage)) {
                titlepage=fdjtID("SBOOKSTITLEPAGE")||fdjtID("TITLEPAGE");
                if (titlepage) {
                    titlepage=titlepage.cloneNode(true);
                    fdjtDOM.stripIDs(titlepage);
                    titlepage.setAttribute("style","");}
                else {
                    var info=getBookInfo();
                    titlepage=fdjtDOM(
                        "div#CODEXTITLEPAGE",
                        fdjtDOM("DIV.title",info.title),
                        fdjtDOM("DIV.credits",
                                ((info.byline)?(fdjtDOM("DIV.byline",info.byline)):
                                 ((info.authors)&&(info.authors.length))?
                                 (fdjtDOM("DIV.author",info.authors[0])):
                                 (false))),
                        fdjtDOM("DIV.pubinfo"));}}
            if (fdjtID("CODEXTITLEPAGEHOLDER")) {
                fdjtDOM.replace(fdjtID("CODEXTITLEPAGEHOLDER"),titlepage);
                titlepage.id="CODEXTITLEPAGE";}
            else if (hasParent(titlepage,cover)) {}
            else cover.appendChild(titlepage);
            if (titlepage) {
                titlepage.setAttribute("style","");
                titlepage.style.opacity=0.0; titlepage.style.display="block";
                titlepage.style.overflow="visible";
                fdjtDOM.tweakFont(titlepage);
                titlepage.style.opacity=""; titlepage.style.display="";
                titlepage.style.overflow="";}
            if ((fdjtID("CODEXTITLEPAGE"))&&(fdjtID("CODEXTITLEPAGEHOLDER")))
                fdjtDOM.remove("CODEXTITLEPAGEHOLDER");
            
            var creditspage=fdjtID("CODEXCREDITSPAGE");
            if (!(creditspage)) {
                creditspage=fdjtID("SBOOKSCREDITSPAGE")||fdjtID("CREDITSPAGE");
                if (creditspage) {
                    creditspage=creditspage.cloneNode(true);
                    fdjtDOM.stripIDs(creditspage);
                    creditspage.setAttribute("style","");}}
            if (creditspage) {
                addClass(cover,"withcreditspage");
                if (fdjtID("CODEXCREDITSPAGEHOLDER")) {
                    fdjtDOM.replace(fdjtID("CODEXCREDITSPAGEHOLDER"),
                                    creditspage);
                    creditspage.id="CODEXCREDITSPAGE";}
                else if (hasParent(creditspage,cover)) {}
                else cover.appendChild(creditspage);
                if ((fdjtID("CODEXCREDITSPAGE"))&&
                    (fdjtID("CODEXCREDITSPAGEHOLDER")))
                    fdjtDOM.remove("CODEXCREDITSPAGEHOLDER");}
            
            var infopage=fdjtID("CODEXINFOPAGE");
            if (infopage)
                fdjtDOM.replace(fdjtID("CODEXINFOPAGEHOLDER"),
                                fdjtID("CODEXINFOPAGE"));
            else if (fdjtID("SBOOKSINFOPAGE")) {
                infopage=fdjtID("SBOOKSINFOPAGE").cloneNode(true);
                fdjtDOM.stripIDs(infopage); infopage.id="CODEXINFOPAGE";
                fdjtDOM.replace(fdjtID("CODEXINFOPAGEHOLDER"),infopage);}
            else fdjtID("CODEXINFOPAGEHOLDER").id="CODEXINFOPAGE";
            if (infopage) {
                infopage.style.opacity=0.0; infopage.style.display="block";
                infopage.style.overflow="visible";
                fdjtDOM.scaleToFit(infopage,0.9);
                infopage.style.opacity=null; infopage.style.display=null;
                infopage.style.overflow=null;}
            if ((fdjtID("CODEXINFOPAGE"))&&(fdjtID("CODEXINFOPAGEHOLDER")))
                fdjtDOM.remove("CODEXINFOPAGEHOLDER");
            
            var settings=fdjtID("CODEXSETTINGS");
            if (!(settings)) {
                settings=fdjtDOM("div#CODEXSETTINGS");
                cover.appendChild(settings);}
            settings.innerHTML=fixStaticRefs(Codex.HTML.settings);
            Codex.DOM.settings=settings;
            var codexbookinfo=fdjt.ID("CODEXBOOKINFO");
            if (!(codexbookinfo)) {
                codexbookinfo=fdjtDOM("div#CODEXBOOKINFO");
                fdjtDOM(settings,"\n",codexbookinfo);}
            codexbookinfo.innerHTML=
                "<p>"+Codex.docref+"#"+Codex.sourceid+"<br/>"+
                ((Codex.sourcetime)?(" ("+Codex.sourcetime+")"):(""))+"</p>\n"+
                "<p>Codex version "+Codex.version+" built on "+
                Codex.buildhost+", "+Codex.buildtime+"</p>\n"+
                "<p>Program &amp; Interface are "+
                "<span style='font-size: 120%;'>©</span>"+
                " beingmeta, inc 2008-2014</p>\n";
            var help=Codex.DOM.help=fdjtID("CODEXAPPHELP");
            if (!(help)) {
                help=fdjtDOM("div#CODEXAPPHELP");
                cover.appendChild(help);}
            var cover_help=fdjtID("CODEXCOVERHELP");
            if (!(cover_help)) {
                cover_help=fdjtDOM("div#CODEXCOVERHELP.codexhelp");
                help.appendChild(cover_help);}
            cover_help.innerHTML=fixStaticRefs(Codex.HTML.help);
            
            var console=Codex.DOM.console=fdjtID("CODEXCONSOLE");
            if (!(console)) {
                console=fdjtDOM("div#CODEXCONSOLE");
                cover.appendChild(console);}
            Codex.DOM.console=console;
            if (Codex.Trace.startup>2) fdjtLog("Setting up console %o",console);
            console.innerHTML=Codex.HTML.console;
            Codex.DOM.input_console=input_console=
                fdjtDOM.getChild(console,"TEXTAREA");
            Codex.DOM.input_button=input_button=
                fdjtDOM.getChild(console,"span.button");
            input_button.onclick=consolebutton_click;
            input_console.onkeypress=consoleinput_keypress;

            var layers=fdjtID("CODEXLAYERS");
            if (!(layers)) {
                layers=fdjtDOM("div#CODEXLAYERS");
                cover.appendChild(layers);}
            var sbooksapp=fdjtID("SBOOKSAPP");
            if (!(sbooksapp)) {
                sbooksapp=fdjtDOM("iframe#SBOOKSAPP");
                sbooksapp.setAttribute("frameborder",0);
                sbooksapp.setAttribute("scrolling","auto");}
            layers.appendChild(sbooksapp);
            Codex.DOM.sbooksapp=sbooksapp;
            
            var about=fdjtID("CODEXABOUTBOOK");
            if (!(about)) {
                about=fdjtDOM("div#CODEXABOUTBOOK");
                fillAboutInfo(about);}
            if (hasParent(about,cover)) {}
            else if (fdjtID("CODEXABOUTBOOKHOLDER")) 
                fdjtDOM.replace(fdjtID("CODEXABOUTBOOKHOLDER"),about);
            else cover.appendChild(about);
            
            if (Codex.touch)
                fdjtDOM.addListener(cover,"touchstart",cover_clicked);
            else fdjtDOM.addListener(cover,"click",cover_clicked);

            if (Codex.iscroll) {
                Codex.scrollers.about=setupScroller(about);
                Codex.scrollers.help=setupScroller(help);
                Codex.scrollers.console=setupScroller(console);
                Codex.scrollers.settings=setupScroller(settings);}

            Codex.showCover();

            // Handle any adjustfont regions
            fdjtUI.adjustFont.setup(cover);
            fdjtDOM.tweakFonts(cover);

            // Make the cover hidden by default
            Codex.CSS.hidecover=fdjtDOM.addCSSRule(
                "#CODEXCOVER","opacity: 0.0; z-index: -10; pointer-events: none; height: 0px; width: 0px;");
            if (Codex.Trace.startup>1)
                fdjtLog("Cover setup done in %dms",fdjtTime()-started);
            return cover;}

        var coverids={"bookcover": "CODEXBOOKCOVER",
                      "titlepage": "CODEXTITLEPAGE",
                      "bookcredits": "CODEXCREDITSPAGE",
                      "aboutbook": "CODEXABOUTBOOK",
                      "help": "CODEXAPPHELP",
                      "settings": "CODEXSETTINGS",
                      "layers": "CODEXLAYERS"};

        function cover_clicked(evt){
            var target=fdjtUI.T(evt);
            var cover=fdjtID("CODEXCOVER");
            if (fdjt.UI.isClickable(target)) return;
            if (!(hasParent(target,fdjtID("CODEXCOVERCONTROLS")))) {
                if (!(hasParent(target,fdjtID("CODEXCOVERMESSAGE")))) {
                    var section=target;
                    while ((section)&&(section.parentNode!==cover))
                        section=section.parentNode;
                    if ((section)&&(section.nodeType===1)&&
                        (section.scrollHeight>section.offsetHeight))
                        return;}
                Codex.clearStateDialog();
                Codex.hideCover();
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
                (!(Codex.appinit)))
                Codex.initIFrameApp();

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
                if (Codex.Trace.mode)
                    fdjtLog("On %o, switching cover mode to %s from %s",
                            evt,mode,curclass);
                if (mode==="console") fdjtLog.update();
                cover.className=mode;
                Codex.mode=mode;},
                       20);
            fdjt.UI.cancel(evt);}

        Codex.addConfig("showconsole",function(name,value){
            if (value) addClass(document.body,"cxSHOWCONSOLE");
            else dropClass(document.body,"cxSHOWCONSOLE");});
        
        Codex.addConfig("uisound",function(name,value){
            Codex.uisound=(value)&&(true);});
        Codex. addConfig("readsound",function(name,value){
            Codex.readsound=(value)&&(true);});


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
                    encodeURIComponent(Codex.refuri),
                "metadata",
                "edit metadata");
            metadata.target="_blank";
            metadata.title=
                "View (and possibly edit) the metadata for this book";
            var reviews=fdjtDOM.Anchor(
                null,
                // "https://www.sbooks.net/publish/reviews?REFURI="+
                //                  encodeURIComponent(Codex.refuri),
                "reviews",
                "see/add reviews");
            reviews.target="_blank";
            reviews.title="Sorry, not yet implemented";
            // fdjtDOM(about,fdjtDOM("div.links",metadata,reviews));

            if (bookabout) fdjtDOM(about,bookabout);
            else {
                var title=
                    fdjtID("SBOOKTITLE")||
                    getMeta("Codex.title")||
                    getMeta("SBOOKS.title")||
                    getMeta("DC.title")||
                    getMeta("~TITLE")||
                    document.title;
                var byline=
                    fdjtID("SBOOKBYLINE")||fdjtID("SBOOKAUTHOR")||
                    getMeta("Codex.byline")||
                    getMeta("Codex.author")||
                    getMeta("SBOOKS.byline")||
                    getMeta("SBOOKS.author")||
                    getMeta("BYLINE")||
                    getMeta("AUTHOR");
                var copyright=
                    fdjtID("SBOOKCOPYRIGHT")||
                    getMeta("Codex.copyright")||
                    getMeta("Codex.rights")||
                    getMeta("SBOOKS.copyright")||
                    getMeta("SBOOKS.rights")||
                    getMeta("COPYRIGHT")||
                    getMeta("RIGHTS");
                var publisher=
                    fdjtID("SBOOKPUBLISHER")||
                    getMeta("Codex.publisher")||
                    getMeta("SBOOKS.publisher")||                    
                    getMeta("PUBLISHER");
                var description=
                    fdjtID("SBOOKDESCRIPTION")||
                    getMeta("Codex.description")||
                    getMeta("SBOOKS.description")||
                    getMeta("DESCRIPTION");
                var digitized=
                    fdjtID("SBOOKDIGITIZED")||
                    getMeta("Codex.digitized")||
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
            var init_content=fdjtID("CODEXCONTENT");
            var content=(init_content)||(fdjtDOM("div#CODEXCONTENT"));
            var i, lim;
            if (Codex.Trace.startup>2) fdjtLog("Starting initBody");

            body.setAttribute("tabindex",1);
            /* -- Sets 1em to equal 10px -- */ 
            body.style.fontSize="62.5%";
            /* -- Remove any original width constraints -- */
            body.style.width="inherit";

            // Save those DOM elements in a handy place
            Codex.content=content;

            // Move all the notes together
            var notesblock=fdjtID("SBOOKNOTES")||
                fdjtDOM("div.sbookbackmatter#SBOOKNOTES");
            applyMetaClass("sbooknote");
            var note_counter=1;
            var allnotes=getChildren(content,".sbooknote");
            i=0; lim=allnotes.length; while (i<lim) {
                var notable=allnotes[i++];
                if (!(notable.id)) notable.id="CODEXNOTE"+(note_counter++);
                var noteref=notable.id+"_REF";
                if (!(cxID(noteref))) {
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
                    else if ((child.id)&&(child.id.search("CODEX")===0)) {}
                    else if (/(META|LINK|SCRIPT)/gi.test(child.tagName)) {}
                    else content.appendChild(child);}}
            // Append the notes block to the content
            if (notesblock.childNodes.length)
                fdjtDOM.append(content,"\n",notesblock,"\n");
            
            // Initialize cover and titlepage (if specified)
            Codex.cover=Codex.getCover();
            Codex.titlepage=fdjtID("SBOOKTITLEPAGE");

            var pages=Codex.pages=fdjtID("CODEXPAGES")||
                fdjtDOM("div#CODEXPAGES");
            var page=Codex.page=fdjtDOM(
                "div#CODEXPAGE",
                fdjtDOM("div#CODEXPAGINATING","Laid out ",
                        fdjtDOM("span#CODEXPAGEPROGRESS",""),
                        " pages"),
                pages);
            
            Codex.body=fdjtID("CODEXBODY");
            if (!(Codex.body)) {
                var cxbody=Codex.body=
                    fdjtDOM("div#CODEXBODY.codexbody",content,page);
                if (Codex.justify) addClass(cxbody,"codexjustify");
                if (Codex.bodysize)
                    addClass(cxbody,"codexbodysize"+Codex.bodysize);
                if (Codex.bodyfamily)
                    addClass(cxbody,"codexbodyfamily"+Codex.bodyfamily);
                if (Codex.bodyspacing)
                    addClass(cxbody,"codexbodyspacing"+Codex.bodyspacing);
                body.appendChild(cxbody);}
            else Codex.body.appendChild(page);
            // Initialize the margins
            initMargins();
            if (Codex.Trace.startup>1)
                fdjtLog("initBody took %dms",fdjtTime()-started);
            Codex.Timeline.initBody=fdjtTime();}

        function sizeContent(){
            var started=Codex.sized=fdjtTime();
            var content=Codex.content, page=Codex.page, body=document.body;
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
                Codex.fullheight=true;
            else Codex.fullheight=false;
            if ((geom.left<10)||((view_width-(geom.width+geom.left))<25))
                Codex.fullwidth=true;
            else Codex.fullwidth=false;
            if (Codex.fullwidth) addClass(document.body,"cxFULLWIDTH");
            else dropClass(document.body,"cxFULLWIDTH");
            if (Codex.fullheight) addClass(document.body,"cxFULLHEIGHT");
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
            if (Codex.CSS.pagerule) {
                Codex.CSS.pagerule.style.width=inner_width+"px";
                Codex.CSS.pagerule.style.height=inner_height+"px";}
            else Codex.CSS.pagerule=fdjtDOM.addCSSRule(
                "div.codexpage",
                "width: "+inner_width+"px; "+"height: "+inner_height+"px;");
            if (Codex.CSS.glossmark_rule) {
                Codex.CSS.glossmark_rule.style.marginRight=
                    (-glossmark_offset)+"px";}
            else Codex.CSS.glossmark_rule=fdjtDOM.addCSSRule(
                "#CODEXPAGE .codexglossmark","margin-right: "+
                    (-glossmark_offset)+"px;");
            
            var shrinkrule=Codex.CSS.shrinkrule;
            if (!(shrinkrule)) {
                shrinkrule=fdjtDOM.addCSSRule(
                    "body.cxSHRINK #CODEXPAGE,body.cxPREVIEW #CODEXPAGE, body.cxSKIMMING #CODEXPAGE", "");
                Codex.CSS.shrinkrule=shrinkrule;}
            var ph=geom.height, sh=ph-25, vs=(sh/ph);
            shrinkrule.style[fdjtDOM.transform]="scale("+vs+","+vs+")";

            document.body.style.overflow='';
            if (Codex.Trace.startup>1)
                fdjtLog("Content sizing took %dms",fdjtTime()-started);}
        Codex.sizeContent=sizeContent;
        
        /* Margin creation */

        function initMargins(){
            var topleading=fdjtDOM("div#SBOOKTOPLEADING.leading.top"," ");
            var bottomleading=
                fdjtDOM("div#SBOOKBOTTOMLEADING.leading.bottom"," ");
            topleading.codexui=true; bottomleading.codexui=true;
            
            var skimleft=document.createDocumentFragment();
            var skimright=document.createDocumentFragment();
            var holder=fdjtDOM("div");
            holder.innerHTML=fixStaticRefs(Codex.HTML.pageleft);
            var nodes=fdjtDOM.toArray(holder.childNodes);
            var i=0, lim=nodes.length;
            while (i<lim) skimleft.appendChild(nodes[i++]);
            holder.innerHTML=fixStaticRefs(Codex.HTML.pageright);
            nodes=fdjtDOM.toArray(holder.childNodes); i=0; lim=nodes.length;
            while (i<lim) skimright.appendChild(nodes[i++]);

            fdjtDOM.prepend(document.body,skimleft,skimright);

            window.scrollTo(0,0);
            
            // The better way to do this might be to change the stylesheet,
            //  but fdjtDOM doesn't currently handle that 
            var bgcolor=getBGColor(document.body)||"white";
            Codex.backgroundColor=bgcolor;
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
            var layout=Codex.layout;
            if (resizing) {
                clearTimeout(resizing); resizing=false;}
            Codex.resizeHUD();
            Codex.scaleLayout(false);
            if (!(layout)) return;
            if ((window.outerWidth===outer_width)&&
                (window.outerHeight===outer_height)) {
                // Not a real change (we think), so just scale the
                // layout, don't make a new one.
                Codex.scaleLayout(true);
                return;}
            // Set these values to the new one
            outer_width=window.outerWidth;
            outer_height=window.outerHeight;
            // Possibly a new layout
            var width=getGeometry(fdjtID("CODEXPAGE"),false,true).width;
            var height=getGeometry(fdjtID("CODEXPAGE"),false,true).inner_height;
            if ((layout)&&(layout.width===width)&&(layout.height===height))
                return;
            if ((layout)&&(layout.onresize)&&(!(Codex.freezelayout))) {
                // This handles prompting for whether or not to update
                // the layout.  We don't prompt if the layout didn't
                // take very long (Codex.long_layout_thresh) or is already
                // cached (Codex.layoutCached()).
                if ((Codex.long_layout_thresh)&&(layout.started)&&
                    ((layout.done-layout.started)<=Codex.long_layout_thresh))
                    resizing=setTimeout(resizeNow,50);
                else if (Codex.layoutCached())
                    resizing=setTimeout(resizeNow,50);
                else if (choosing_resize) {}
                else {
                    // This prompts for updating the layout
                    var msg=fdjtDOM("div.title","Update layout?");
                    // This should be fast, so we do it right away.
                    Codex.scaleLayout();
                    choosing_resize=true;
                    // When a choice is made, it becomes the default
                    // When a choice is made to not resize, the
                    // choice timeout is reduced.
                    var choices=[
                        {label: "Yes",
                         handler: function(){
                             choosing_resize=false;
                             resize_default=true;
                             Codex.layout_choice_timeout=10;
                             resizing=setTimeout(resizeNow,50);},
                         isdefault: resize_default},
                        {label: "No",
                         handler: function(){
                             choosing_resize=false;
                             resize_default=false;
                             Codex.layout_choice_timeout=10;},
                         isdefault: (!(resize_default))}];
                    var spec={choices: choices,
                              timeout: (Codex.layout_choice_timeout||
                                        Codex.choice_timeout||20),
                              spec: "div.fdjtdialog.fdjtconfirm.updatelayout"};
                    choosing_resize=fdjtUI.choose(spec,msg);}}}

        function resizeNow(evt){
            if (resizing) clearTimeout(resizing);
            resizing=false;
            Codex.sizeContent();
            Codex.layout.onresize(evt);}
        
        function getBGColor(arg){
            var color=fdjtDOM.getStyle(arg).backgroundColor;
            if (!(color)) return false;
            else if (color==="transparent") return false;
            else if (color.search(/rgba/)>=0) return false;
            else return color;}

        /* Loading meta info (user, glosses, etc) */

        function loadInfo(info) {
            if (Codex.nouser) {
                Codex.setConnected(false);
                return;}
            if (window._sbook_loadinfo!==info)
                Codex.setConnected(true);
            if (info.sticky) Codex.persist=true;
            if (!(Codex.user)) {
                if (info.userinfo)
                    setUser(info.userinfo,
                            info.outlets,info.layers,
                            info.sync);
                else {
                    if (getLocal("codex.queued("+Codex.refuri+")"))
                        Codex.glossdb.load(
                            getLocal("codex.queued("+Codex.refuri+")",true));
                    fdjtID("CODEXCOVER").className="bookcover";
                    addClass(document.body,"cxNOUSER");}
                if (info.nodeid) setNodeID(info.nodeid);}
            else if (info.wronguser) {
                clearOffline();
                window.location=window.location.href;
                return;}
            if (info.mycopyid) {
                if ((Codex.mycopyid)&&
                    (info.mycopid!==Codex.mycopyid))
                    fdjtLog.warn("Mismatched mycopyids");
                else Codex.mycopyid=info.mycopyid;}
            if (!(Codex.docinfo)) { /* Scan not done */
                Codex.scandone=function(){loadInfo(info);};
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
            var refuri=Codex.refuri;
            if ((Codex.persist)&&(Codex.cacheglosses)&&
                (info)&&(info.userinfo)&&(Codex.user)&&
                (info.userinfo._id!==Codex.user._id)) {
                clearOffline();}
            info.loaded=fdjtTime();
            if ((!(Codex.localglosses))&&
                ((getLocal("codex.sync("+refuri+")"))||
                 (getLocal("codex.queued("+refuri+")"))))
                initGlossesOffline();
            if (Codex.Trace.glosses) {
                fdjtLog("loadInfo for %d %sglosses and %d refs (sync=%d)",
                        ((info.glosses)?(info.glosses.length):(0)),
                        ((Codex.sync)?("updated "):("")),
                        ((info.etc)?(info.etc.length):(0)),
                        info.sync);
                fdjtLog("loadInfo got %d sources, %d outlets, and %d layers",
                        ((info.sources)?(info.sources.length):(0)),
                        ((info.outlets)?(info.outlets.length):(0)),
                        ((info.layers)?(info.layers.length):(0)));}
            if ((info.glosses)||(info.etc))
                initGlosses(info.glosses||[],info.etc||[],
                            function(){infoLoaded(info);});
            if (Codex.glosses) Codex.glosses.update();}
        Codex.loadInfo=loadInfo;

        function infoLoaded(info){
            var keepdata=(Codex.cacheglosses);
            if (info.etc) gotInfo("etc",info.etc,keepdata);
            if (info.sources) gotInfo("sources",info.sources,keepdata);
            if (info.outlets) gotInfo("outlets",info.outlets,keepdata);
            if (info.layers) gotInfo("layers",info.layers,keepdata);
            addOutlets2UI(info.outlets);
            if ((info.sync)&&((!(Codex.sync))||(info.sync>=Codex.sync))) {
                Codex.setSync(info.sync);}
            Codex.loaded=info.loaded=fdjtTime();
            if (Codex.whenloaded) {
                var whenloaded=Codex.whenloaded;
                Codex.whenloaded=false;
                setTimeout(whenloaded,10);}
            if (keepdata) {
                Codex.glossdb.save(true);
                Codex.sourcedb.save(true);}
            if (Codex.glosshash) {
                if (Codex.showGloss(Codex.glosshash))
                    Codex.glosshash=false;}}

        var updating=false;
        var noajax=false;
        function updatedInfo(data,source,start){
            var user=Codex.user;
            if ((Codex.Trace.network)||
                ((Codex.Trace.glosses)&&(data.glosses)&&(data.glosses.length))||
                ((Codex.Trace.startup)&&
                 ((!(user))||
                  ((Codex.update_interval)&&
                   (!(Codex.ticktock))&&
                   (Codex.Trace.startup))))) {
                if (start)
                    fdjtLog("Response (%dms) from %s",fdjtTime()-start,source||Codex.server);
                else fdjtLog("Response from %s",source||Codex.server);}
            updating=false; loadInfo(data);
            if ((!(user))&&(Codex.user)) userSetup();}
        Codex.updatedInfo=updatedInfo;
        function updateInfo(callback,jsonp){
            var user=Codex.user; var start=fdjtTime();
            var uri="https://"+Codex.server+"/v1/loadinfo.js?REFURI="+
                encodeURIComponent(Codex.refuri);
            var ajax_headers=((Codex.sync)?({}):(false));
            if (Codex.sync) ajax_headers["If-Modified-Since"]=((new Date(Codex.sync*1000)).toString());
            function gotInfo(req){
                updating=false;
                Codex.authkey=false; // No longer needed, we should have our own authentication keys
                var response=JSON.parse(req.responseText);
                if ((response.glosses)&&(response.glosses.length))
                    fdjtLog("Received %d glosses from the server",response.glosses.length);
                Codex.updatedInfo(response,uri+((user)?("&SYNCUSER="+user._id):("&JUSTUSER=yes")),start);
                if (user) {
                    // If there was already a user, just startup
                    //  regular updates now
                    if ((!(ticktock))&&(Codex.update_interval)) 
                        Codex.ticktock=ticktock=
                        setInterval(updateInfo,Codex.update_interval*1000);}
                else if (Codex.user)
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
                        clearInterval(Codex.ticktock);
                        Codex.ticktock=ticktock=false;}
                    setTimeout(updateInfo,30*60*1000);}}
            if ((updating)||(!(navigator.onLine))) return; else updating=true;
            // Get any requested glosses and add them to the call
            var i=0, lim, glosses=getQuery("GLOSS",true); {
                i=0; lim=glosses.length; while (i<lim) uri=uri+"&GLOSS="+glosses[i++];}
            glosses=getHash("GLOSS"); {
                i=0; lim=glosses.length; while (i<lim) uri=uri+"&GLOSS="+glosses[i++];}
            if (Codex.mycopyid) uri=uri+"&MCOPYID="+encodeURIComponent(Codex.mycopyid);
            if (Codex.authkey) uri=uri+"&SBOOKS%3aAUTH-="+encodeURIComponent(Codex.authkey);
            if (Codex.sync) uri=uri+"&SYNC="+(Codex.sync+1);
            if (user) uri=uri+"&SYNCUSER="+user._id;
            if (true) // ((!(user))&&(Codex.Trace.startup))
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
        Codex.updateInfo=updateInfo;
        function updatedInfoJSONP(data){
            var elt=fdjtID("CODEXUPDATEINFO");
            Codex.updatedInfo(data,(((elt)&&(elt.src))||"JSON"));}
        Codex.updatedInfoJSONP=updatedInfoJSONP;
        function updateInfoJSONP(uri,callback){
            if (!(navigator.onLine)) return;
            if (!(callback)) callback="Codex.updatedInfoJSONP";
            var elt=fdjtID("CODEXUPDATEINFO");
            if (uri.indexOf('?')>0) {
                if (uri[uri.length-1]!=='&') uri=uri+"&";}
            else uri=uri+"?";
            uri=uri+"CALLBACK="+callback;
            var update_script=fdjtDOM("script#CODEXUPDATEINFO");
            update_script.language="javascript";
            update_script.type="text/javascript";
            update_script.setAttribute("charset","utf-8");
            update_script.setAttribute("async","async");
            if (Codex.mycopyid)
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
            if (Codex.user) {
                if (userinfo._id===Codex.user._id) {}
                else throw { error: "Can't change user"};}
            var cursync=Codex.sync;
            if ((cursync)&&(cursync>sync)) {
                fdjtLog.warn(
                    "Cached user information is newer (%o) than loaded (%o)",
                    cursync,sync);}
            if ((navigator.onLine)&&(getLocal("codex.queued("+Codex.refuri+")")))
                Codex.writeQueuedGlosses();
            Codex.user=Codex.sourcedb.Import(
                userinfo,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
            if (outlets) Codex.outlets=outlets;
            if (layers) Codex.layers=layers;
            // No callback needed
            Codex.user.save();
            saveLocal("codex.user",Codex.user._id);
            // We also save it locally so we can get it synchronously
            saveLocal(Codex.user._id,Codex.user.Export(),true);
            if (Codex.locsync) setConfig("locsync",true);
            
            if (Codex.Trace.startup) {
                var now=fdjtTime();
                fdjtLog("setUser %s (%s) done in %dms",
                        userinfo._id,userinfo.name||userinfo.email,
                        now-started);}
            Codex._user_setup=fdjtTime();
            // This sets up for local storage, now that we have a user 
            if (Codex.cacheglosses) Codex.cacheGlosses(true);
            if (Codex._ui_setup) setupUI4User();
            return Codex.user;}
        Codex.setUser=setUser;
        
        function setNodeID(nodeid){
            var refuri=Codex.refuri;
            if (!(Codex.nodeid)) {
                Codex.nodeid=nodeid;
                if ((nodeid)&&(Codex.persist))
                    setLocal("codex.nodeid("+refuri+")",nodeid,true);}}
        Codex.setNodeID=setNodeID;

        function setupUI4User(){
            var i=0, lim;
            var startui=fdjtTime();
            if (Codex._user_ui_setup) return;
            if (!(Codex.user)) {
                fdjtDOM.addClass(document.body,"cxNOUSER");
                return;}
            fdjtDOM.dropClass(document.body,"cxNOUSER");
            var username=Codex.user.name||Codex.user.handle||Codex.user.email;
            if (username) {
                if (fdjtID("CODEXUSERNAME"))
                    fdjtID("CODEXUSERNAME").innerHTML=username;
                var names=document.getElementsByName("CODEXUSERNAME");
                if ((names)&&(names.length)) {
                    i=0; lim=names.length; while (i<lim)
                        names[i++].innerHTML=username;}
                names=fdjtDOM.$(".codexusername");
                if ((names)&&(names.length)) {
                    i=0; lim=names.length; while (i<lim)
                        names[i++].innerHTML=username;}}
            if (fdjtID("SBOOKMARKUSER"))
                fdjtID("SBOOKMARKUSER").value=Codex.user._id;
            
            /* Initialize add gloss prototype */
            var ss=Codex.stylesheet;
            var form=fdjtID("CODEXADDGLOSSPROTOTYPE");
            if (Codex.user.fbid)  
                ss.insertRule(
                    "#CODEXHUD span.facebook_share { display: inline;}",
                    ss.cssRules.length);
            if (Codex.user.twitterid) 
                ss.insertRule(
                    "#CODEXHUD span.twitter_share { display: inline;}",
                    ss.cssRules.length);
            if (Codex.user.linkedinid) 
                ss.insertRule(
                    "#CODEXHUD span.linkedin_share { display: inline;}",
                    ss.cssRules.length);
            if (Codex.user.googleid) 
                ss.insertRule(
                    "#CODEXHUD span.google_share { display: inline;}",
                    ss.cssRules.length);
            var maker=fdjtDOM.getInput(form,"MAKER");
            if (maker) maker.value=Codex.user._id;
            var pic=
                (Codex.user.pic)||
                ((Codex.user.fbid)&&
                 ("https://graph.facebook.com/"+Codex.user.fbid+
                  "/picture?type=square"));
            if (pic) {
                if (fdjtID("SBOOKMARKIMAGE")) fdjtID("SBOOKMARKIMAGE").src=pic;
                if (fdjtID("CODEXUSERPIC")) fdjtID("CODEXUSERPIC").src=pic;
                var byname=document.getElementsByName("CODEXUSERPIC");
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
            if (Codex.user.friends) {
                var friends=Codex.user.friends; var sourcedb=Codex.sourcedb;
                i=0; lim=friends.length; while (i<lim) {
                    var friend=RefDB.resolve(friends[i++],sourcedb);
                    Codex.addTag2Cloud(friend,Codex.gloss_cloud);
                    Codex.addTag2Cloud(friend,Codex.share_cloud);}}
            if (Codex.Trace.startup) {
                var now=fdjtTime();
                fdjtLog("setUser %s (%s), UI setup took %dms",
                        Codex.user._id,Codex.user.name||Codex.user.email,
                        now-startui);}
            Codex._user_ui_setup=true;}

        function loginUser(info){
            Codex.user=Codex.sourcedb.Import(
                info,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
            setupUI4User();
            Codex._user_setup=false;}
        Codex.loginUser=loginUser;
        
        function gotItem(item,qids){
            if (typeof item === 'string') {
                var load_ref=Codex.sourcedb.ref(item);
                if (Codex.persist) load_ref.load();
                qids.push(load_ref._id);}
            else {
                var import_ref=Codex.sourcedb.Import(
                    item,false,
                    RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
                import_ref.save();
                qids.push(import_ref._id);}}
        function saveItems(qids,name){
            var refuri=Codex.refuri;
            Codex[name]=qids;
            if (Codex.cacheglosses)
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
                    var ref=Codex.sourcedb.Import(
                        info,false,
                        RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
                    if (persist) ref.save();
                    Codex[name]=ref._id;
                    if (persist) saveLocal(
                        "codex."+name+"("+Codex.refuri+")",ref._id,true);}}}

        function initGlosses(glosses,etc,callback){
            if (typeof callback === "undefined") callback=true;
            if ((glosses.length===0)&&(etc.length===0)) return;
            var msg=fdjtID("CODEXNEWGLOSSES");
            var start=fdjtTime();
            if (msg) {
                msg.innerHTML=fdjtString(
                    "Assimilating %d new glosses",glosses.length);
                addClass(msg,"running");}
            if (etc) {
                if (glosses.length)
                    fdjtLog("Assimilating %d new glosses/%d sources...",
                            glosses.length,etc.length);}
            else if ((glosses.length)&&(Codex.Trace.glosses)) 
                fdjtLog("Assimilating %d new glosses...",glosses.length);
            else {}
            Codex.sourcedb.Import(
                etc,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX,true);
            Codex.glossdb.Import(
                glosses,{"tags": Knodule.importTagSlot},
                RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX,
                callback);
            var i=0; var lim=glosses.length;
            var latest=Codex.syncstamp||0;
            while (i<lim) {
                var gloss=glosses[i++];
                var tstamp=gloss.syncstamp||gloss.tstamp;
                if (tstamp>latest) latest=tstamp;}
            Codex.syncstamp=latest;
            if (glosses.length)
                fdjtLog("Assimilated %d new glosses in %dms...",
                        glosses.length,fdjtTime()-start);
            dropClass(msg,"running");}
        Codex.Startup.initGlosses=initGlosses;
        
        function go_online(){return offline_update();}
        function offline_update(){
            Codex.writeQueuedGlosses(); updateInfo();}
        Codex.update=offline_update;
        
        fdjtDOM.addListener(window,"online",go_online);

        function getLoc(x){
            var info=Codex.getLocInfo(x);
            return ((info)&&(info.start));}
        var loc2pct=Codex.location2pct;

        /* This initializes the sbook state to the initial location with the
           document, using the hash value if there is one. */ 
        function initLocation() {
            var state=Codex.state;
            if (state) {}
            else {
                var target=fdjtID("CODEXSTART")||fdjt.$1(".codexstart")||
                    fdjtID("SBOOKSTART")||fdjt.$1(".sbookstart")||
                    fdjtID("SBOOKTITLEPAGE");
                if (target)
                    state={location: getLoc(target),
                           // This is the beginning of the 21st century
                           changed: 978307200};
                else state={location: 1,changed: 978307200};}
            Codex.saveState(state,true,true);}
        Codex.initLocation=initLocation;

        function resolveXState(xstate) {
            var state=Codex.state;
            if (!(Codex.sync_interval)) return;
            if (Codex.statedialog) {
                if (Codex.Trace.state)
                    fdjtLog("resolveXState dialog exists: %o",
                            Codex.statedialog);
                return;}
            if (Codex.Trace.state)
                fdjtLog("resolveXState state=%j, xstate=%j",state,xstate);
            if (!(state)) {
                Codex.restoreState(xstate);
                return;}
            else if (xstate.maxloc>state.maxloc) {
                state.maxloc=xstate.maxloc;
                var statestring=JSON.stringify(state);
                var uri=Codex.docuri;
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
            if (Codex.Trace.state) 
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
                         Codex.GoTo(xstate.maxloc,"sync");
                         state=Codex.state; state.changed=fdjtTime.tick();
                         Codex.saveState(state,true,true);
                         Codex.hideCover();}});
            if ((latest!==state.location)&&(latest!==farthest))
                choices.push(
                    {label: ("latest @"+loc2pct(latest)),
                     title: "the most recent location on any device/app",
                     isdefault: false,
                     handler: function(){
                         Codex.restoreState(xstate); state=Codex.state;
                         state.changed=fdjtTime.tick();
                         Codex.saveState(state,true,true);
                         Codex.hideCover();}});
            if ((choices.length)&&(state.location!==0))
                choices.push(
                    {label: ("current @"+loc2pct(state.location)),
                     title: "the most recent location on this device",
                     isdefault: true,
                     handler: function(){
                         state.changed=fdjtTime.tick();
                         Codex.saveState(state,true,true);
                         Codex.hideCover();}});
            if (choices.length)
                choices.push(
                    {label: "stop syncing",
                     title: "stop syncing this book on this device",
                     handler: function(){
                         setConfig("locsync",false);}});
            if (Codex.Trace.state)
                fdjtLog("resolveXState choices=%j",choices);
            if (choices.length)
                Codex.statedialog=fdjtUI.choose(
                    {choices: choices,cancel: true,timeout: 7,
                     nodefault: true,noauto: true,
                     onclose: function(){Codex.statedialog=false;},
                     spec: "div.fdjtdialog.resolvestate#CODEXRESOLVESTATE"},
                    fdjtDOM("div",msg1));}
        Codex.resolveXState=resolveXState;

        function clearStateDialog(){
            if (Codex.statedialog) {
                fdjt.Dialog.close(Codex.statedialog);
                Codex.statedialog=false;}}
        Codex.clearStateDialog=clearStateDialog;

        /* Indexing tags */
        
        function indexingDone(){
            startupLog("Content indexing is completed");
            if (Codex._setup) setupClouds();
            else Codex.onsetup=setupClouds;}
        
        var cloud_setup_start=false;
        function setupClouds(){
            var tracelevel=Math.max(Codex.Trace.startup,Codex.Trace.clouds);
            var addTag2Cloud=Codex.addTag2Cloud;
            var empty_cloud=Codex.empty_cloud;
            var gloss_cloud=Codex.gloss_cloud;
            cloud_setup_start=fdjtTime();
            Codex.empty_query.results=
                [].concat(Codex.glossdb.allrefs).concat(Codex.docdb.allrefs);
            var searchtags=Codex.searchtags=Codex.empty_query.getCoTags();
            var empty_query=Codex.empty_query;
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
                var elt=addTag2Cloud(tag,empty_cloud,Codex.knodule,
                                     Codex.tagweights,tagfreqs,false);
                var sectag=(tag._id[0]==="\u00a7");
                if (!(sectag)) {
                    if (tag instanceof KNode) addClass(elt,"cue");
                    if ((tag instanceof KNode)||
                        ((tagfreqs[tag]>4)&&(tagfreqs[tag]<(max_freq/2))))
                        addTag2Cloud(tag,gloss_cloud);}},
                             searchtags,addtags_progress,addtags_done,
                             200,20);}
        
        function addtags_done(searchtags){
            var eq=Codex.empty_query;
            var empty_cloud=Codex.empty_cloud;
            var gloss_cloud=Codex.gloss_cloud;
            if (Codex.Trace.startup>1)
                fdjtLog("Done populating clouds with %d tags",
                        searchtags.length);
            dropClass(document.body,"cxINDEXING");
            eq.cloud=empty_cloud;
            if (!(fdjtDOM.getChild(empty_cloud.dom,".showall")))
                fdjtDOM.prepend(empty_cloud.dom,
                                Codex.UI.getShowAll(
                                    true,empty_cloud.values.length));
            Codex.sortCloud(empty_cloud);
            Codex.sortCloud(gloss_cloud);
            Codex.sizeCloud(empty_cloud,Codex.tagweights,[]);
            Codex.sizeCloud(gloss_cloud,Codex.tagweights,[]);}

        function addtags_progress(state,i,lim){
            var tracelevel=Math.max(Codex.Trace.startup,Codex.Trace.clouds);
            var pct=((i*100)/lim);
            if (state!=='after') return;
            if (tracelevel>1)
                startupLog("Added %d (%d%% of %d tags) to clouds",
                           i,Math.floor(pct),lim);
            fdjtUI.ProgressBar.setProgress("CODEXINDEXMESSAGE",pct);
            fdjtUI.ProgressBar.setMessage(
                "CODEXINDEXMESSAGE",fdjtString(
                    "Added %d tags (%d%% of %d) to clouds",
                    i,Math.floor(pct),lim));}
        
        var addTags=Codex.addTags;
        
        /* Using the autoindex generated during book building */
        function useIndexData(autoindex,knodule,baseweight,whendone){
            var ntags=0, nitems=0;
            var allterms=Codex.allterms, prefixes=Codex.prefixes;
            var tagweights=Codex.tagweights;
            var maxweight=Codex.tagmaxweight, minweight=Codex.tagminweight;
            var tracelevel=Math.max(Codex.Trace.startup,Codex.Trace.indexing);
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
                    knode=Codex.knodule.handleSubjectEntry(tag);
                else knode=Codex.knodule.probe(taghead)||
                    Codex.knodule.probe(tagterm);
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
                    var info=Codex.docinfo[frag];
                    // Pointer to non-existent node.  Warn here?
                    if (!(info)) {
                        Codex.missing_nodes.push(frag);
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
                    Codex.tagmaxweight=maxweight;
                    Codex.tagminweight=minweight;
                    if (whendone) return whendone();
                    else return state;},
                200,10);}
        Codex.useIndexData=useIndexData;
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
                var target=Codex.getTarget(elt);
                var info=Codex.docinfo[target.id];
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
                var target=Codex.getTarget(tagelt);
                var info=Codex.docinfo[target.id];
                var tagtext=fdjtDOM.textify(tagelt);
                addTags(info,tagtext);}}
        
        function applyAnchorTags() {
            var docinfo=Codex.docinfo;
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
            var tracelevel=Math.max(Codex.Trace.startup,Codex.Trace.clouds);
            var tohandle=[]; var tagged=0;
            if ((Codex.Trace.startup>1)||(Codex.Trace.indexing>1))
                startupLog("Applying inline tag attributes from content");
            for (var eltid in docinfo) {
                var info=docinfo[eltid];
                if (info.atags) {tagged++; tohandle.push(info);}
                else if (info.sectag) tohandle.push(info);}
            if (((Codex.Trace.indexing)&&(tohandle.length))||
                (Codex.Trace.indexing>1)||(Codex.Trace.startup>1))
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
                         "CODEXINDEXMESSAGE",pct);
                     fdjtUI.ProgressBar.setMessage(
                         "CODEXINDEXMESSAGE",
                         fdjtString("Assimilated %d (%d%% of %d) inline tags",
                                    i,Math.floor(pct),lim));})),
                function(){
                    if (((Codex.Trace.indexing>1)&&(tohandle.length))||
                        (tohandle.length>24))
                        fdjtLog("Finished indexing tag attributes for %d nodes",
                                tohandle.length);
                    if (whendone) whendone();},
                200,5);}
        Codex.applyTagAttributes=applyTagAttributes;
        
        function handle_inline_tags(info){
            if (info.atags) addTags(info,info.atags);
            if (info.sectag)
                addTags(info,info.sectag,"tags",Codex.knodule);
            var knode=Codex.knodule.ref(info.sectag);
            Codex.tagweights.set(
                knode,Codex.docdb.find('head',info).length);}
        
        /* Setting up the clouds */
        
        function addOutlets2UI(outlet){
            if (typeof outlet === 'string')
                outlet=Codex.sourcedb.ref(outlet);
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
                fdjtDOM("#CODEXOUTLETS",completion," ");
                Codex.share_cloud.addCompletion(completion);}
            if (outlet._live) init();
            else outlet.onLoad(init,"addoutlet2cloud");}
        
        /* Other setup */
        
        Codex.StartupHandler=function(){
            Codex.Startup();};

        return CodexStartup;})();
Codex.Setup=Codex.StartupHandler;
/*
sbookStartup=Codex.StartupHandler;
sbook={Start: Codex.Startup,
       setUser: Codex.setUser,
       Startup: Codex.Startup};
*/

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
