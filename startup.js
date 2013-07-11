/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/startup.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

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
/* global Codex: false */

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
        var fdjtState=fdjt.State;
        var fdjtAjax=fdjt.Ajax;
        var fdjtTime=fdjt.Time;
        var fdjtLog=fdjt.Log;
        var fdjtDOM=fdjt.DOM;
        var fdjtUI=fdjt.UI;
        var fdjtID=fdjt.ID;
        var RefDB=fdjt.RefDB, Ref=fdjt.Ref;
        
        var warn=fdjtLog.warn;

        var https_root="https://s3.amazonaws.com/beingmeta/static/";

        // Imported functions
        var getLocal=fdjtState.getLocal;
        var setLocal=fdjtState.setLocal;
        var getQuery=fdjtState.getQuery;
        var getCookie=fdjtState.getCookie;
        var getMeta=fdjtDOM.getMeta;
        var getLink=fdjtDOM.getLink;
        var addClass=fdjtDOM.addClass;
        var dropClass=fdjtDOM.dropClass;
        var getChildren=fdjtDOM.getChildren;

        var fixStaticRefs=Codex.fixStaticRefs;

        var saveprops=Codex.saveprops=
            ["sources","outlets","overlays","sync","nodeid","state"];
        
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

        /* Configuration information */

        var config_handlers={};
        var default_config=
            {layout: 'bypage',
             bodysize: 'normal',bodyfamily: 'serif',
             uisize: 'normal',showconsole: false,
             animatecontent: true,animatehud: true,
             hidesplash: false,keyboardhelp: true,
             holdmsecs: 750,taptapmsecs: 500};
        var current_config={};
        var saved_config={};

        var setCheckSpan=fdjtUI.CheckSpan.set;

        function addConfig(name,handler){
            if (Codex.Trace.config>1)
                fdjtLog("Adding config handler for %s: %s",name,handler);
            config_handlers[name]=handler;}
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
                        fdjtLog("batch setConfig, post processing %s",dopost[post_i]);
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
            if (!((current_config[name])&&
                  (current_config[name]===value))) {
                if (config_handlers[name]) {
                    if (Codex.Trace.config)
                        fdjtLog("setConfig (handler=%s) %o=%o",
                                config_handlers[name],name,value);
                    config_handlers[name](name,value);}}
            current_config[name]=value;
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
                if ((!(default_config.hasOwnProperty(setting)))||
                    (config[setting]!==default_config[setting])) {
                    saved[setting]=config[setting];}}
            if (Codex.Trace.config) fdjtLog("Saving config %o",saved);
            setLocal("codex.config",JSON.stringify(saved));
            if ((toserver)&&(navigator.onLine)) {
                var req=new XMLHttpRequest();
                req.onreadystatechange=function(evt){
                    if ((req.readyState===4)&&(req.status>=200)&&(req.status<300)) {
                        Codex.setConnected(true);
                        saved_config=JSON.parse(req.responseText);}
                    else if ((req.readyState===4)&&(navigator.onLine))
                        Codex.setConnected(false);
                    else {}
                    if ((Codex.Trace.dosync)||(Codex.Trace.state))
                        fdjtLog("configSave(callback) %o ready=%o status=%o %j",
                                evt,req.readyState,((req.readyState===4)&&(req.status)),
                                saved_config);};
                var uri="https://auth.sbooks.net/admin/codexconfig?"+
                    encodeURIComponent(JSON.stringify(saved));
                req.withCredentials=true;
                try { req.open("GET",uri,true); req.send(); }
                catch (ex) {}}
            saved_config=saved;}
        Codex.saveConfig=saveConfig;

        function initConfig(fetch){
            var setting;
            if (typeof fetch === "undefined") fetch=true;
            if ((navigator.onLine)&&(fetch)) fetchConfig();
            var config=(saved_config=(getLocal("codex.config",true)||{}));
            Codex.postconfig=[];
            if (Codex.Trace.config) fdjtLog("initConfig (saved) %o",config);
            if (config) {
                for (setting in config) {
                    if ((config.hasOwnProperty(setting))&&
                        (!(getQuery(setting))))
                        setConfig(setting,config[setting]);}}
            else config={};
            if (Codex.Trace.config)
                fdjtLog("initConfig (default) %o",default_config);
            for (setting in default_config) {
                if (!(config.hasOwnProperty(setting)))
                    if (default_config.hasOwnProperty(setting)) {
                        if (getQuery(setting))
                            setConfig(setting,getQuery(setting));
                        else if (getMeta("Codex."+setting))
                            setConfig(setting,getMeta("Codex."+setting));
                        else setConfig(setting,default_config[setting]);}}
            var dopost=Codex.postconfig;
            Codex.postconfig=false;
            var i=0; var lim=dopost.length;
            while (i<lim) dopost[i++]();
            
            var devicename=current_config.devicename;
            if ((devicename)&&(!(fdjtString.isEmpty(devicename))))
                Codex.deviceName=devicename;}

        var fetching_config=false, config_fetched=false, on_fetched_config=false;
        function fetchConfig(){
            var req=new XMLHttpRequest();
            fetching_config=true; var onfetch=false;
            req.onreadystatechange=function(evt){
                if ((req.readyState===4)&&(req.status>=200)&&(req.status<300)) {
                    try {
                        var config=JSON.parse(req.responseText);
                        fdjtState.setLocal("codex.config",req.responseText);
                        fdjtLog("Got device config: %j",config);
                        fetching_config=false;
                        config_fetched=true;
                        initConfig(false);
                        saveConfig(config,false);
                        if (on_fetched_config) {
                            onfetch=on_fetched_config;
                            on_fetched_config=false;
                            onfetch();}}
                    catch (ex) {}}
                else if (req.readyState===4) {
                    fetching_config=false;
                    config_fetched=false;
                    if (on_fetched_config) {
                        onfetch=on_fetched_config;
                        on_fetched_config=false;
                        onfetch();}}
                else {}
                if ((Codex.Trace.dosync)||(Codex.Trace.state))
                    fdjtLog("configSave(callback) %o ready=%o status=%o %j",
                            evt,req.readyState,
                            ((req.readyState===4)&&(req.status)),
                            saved_config);};
            var uri="https://auth.sbooks.net/admin/codexconfig";
            req.withCredentials=true;
            try { req.open("GET",uri,true); req.send(); }
            catch (ex) {}}
        
        var getParent=fdjtDOM.getParent;
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

        Codex.addConfig("hidesplash",function(name,value){
            var doitnow=false;
            if ((value)&&(!(Codex.hidesplash))&&(Codex._setup)&&
                (Codex.mode==="splash"))
                doitnow=true;
            Codex.hidesplash=value;
            fdjtUI.CheckSpan.set(
                document.getElementsByName("CODEXHIDESPLASH"),
                value);
            if (doitnow) Codex.setMode(false);});
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
            fdjtUI.TapHold.interval=value;});
        Codex.addConfig("taptapmsecs",function(name,value){
            Codex.taptapmsecs=value;});

        function syncStartup(){
            // This is the startup code which is run
            //  synchronously, before the time-sliced processing
            fdjtLog.console="CODEXCONSOLELOG";
            fdjtLog.consoletoo=true;
            if (!(Codex._setup_start)) Codex._setup_start=new Date();
            fdjtLog("This is Codex version %s, built %s on %s, launched %s",
                    Codex.version,Codex.buildtime,Codex.buildhost,
                    Codex._setup_start.toString());
            if (navigator.appVersion)
                fdjtLog("Navigator App version: %s (%s)",
                        navigator.appVersion,navigator.userAgent);
            // This lets trace configurations be passed as query
            // arguments, for handy debugging.
            if (getQuery("cxtrace")) readTraceSettings();

            deviceSetup();
            appSetup();
            userSetup();

            if (Codex.Trace.startup)
                fdjtLog("Done with synchronous startup");

            // Hide the loading splash page, if any
            if (fdjtID("CODEXSPLASH"))
                fdjtID("CODEXSPLASH").style.display='none';

            Codex.setMode("splash");

            fdjtDOM.adjustFonts(fdjtID("CODEXHUD"));

            var md2html=new Markdown.Converter();
            Codex.md2html=md2html;
        }

        function appSetup() {

            if (Codex.Trace.startup) fdjtLog("Starting app setup");

            // Initialize domain and origin for browsers which care
            try {document.domain="sbooks.net";}
            catch (ex) {fdjtLog.warn("Error setting document.domain");}
            try {document.origin="sbooks.net";}
            catch (ex) {fdjtLog.warn("Error setting document.origin");}

            // Execute any FDJT initializations
            fdjt.Init();

            fdjtDOM.addAppSchema("SBOOK","http://sbooks.net/");
            fdjtDOM.addAppSchema("Codex","http://codex.sbooks.net/");
            fdjtDOM.addAppSchema("DC","http://purl.org/dc/elements/1.1/");
            fdjtDOM.addAppSchema("DCTERMS","http://purl.org/dc/terms/");
            fdjtDOM.addAppSchema("OLIB","http://openlibrary.org/");
            
            // Get various settings for the sBook from the HTML (META
            // tags, etc), including settings or guidance for
            // scanning, graphics, layout, glosses, etc.
            readSettings();

            // Initialize the databases
            Codex.initDB();

            // Modifies the DOM in various ways
            initBody();
            
            // This initializes the book tools (the HUD/Heads Up Display)
            Codex.initHUD();

            if (Codex.coverpage) {
                var status_cover=fdjtID("CODEXSTATUSCOVER");
                status_cover.src=Codex.coverpage;
                status_cover.style.display='block';}

            addConfig(
                "persist",
                function(name,value){
                    var refuri=Codex.refuri;
                    if ((value)&&(Codex.persist)) return;
                    else if ((!(value))&&(!(Codex.persist))) return;
                    else if (value) {
                        if (!(Codex.sourcedb.storage))
                            Codex.sourcedb.storage=window.localStorage;
                        if (!Codex.glossdb.storage)
                            Codex.glossdb.storage=window.localStorage;
                        var props=saveprops, i=0, lim=props.length;
                        while (i<lim) {
                            var prop=saveprops[i++];
                            if (Codex[prop]) setLocal(
                                "codex."+prop+"("+refuri+")",Codex[prop],true);}
                        Codex.glossdb.save(true);
                        Codex.sourcedb.save(true);
                        Codex.queued=fdjtState.getLocal(
                            "queued("+Codex.refuri+")",true)||[];}
                    else if (!(value)) {
                        clearOffline();
                        fdjtState.dropLocal("queued("+Codex.refuri+")");
                        Codex.queued=[];}
                    Codex.persist=value;
                    setCheckSpan(fdjtID("CODEXLOCALCHECKBOX"),value);});

            // Get any local saved configuration information
            //  We do this after the HUD is setup so that the settings
            //   panel gets initialized appropriately.
            initConfig();
            Codex.persist=
                ((!(Codex.force_online))&&
                 ((Codex.force_offline)||(workOffline())));

            // Setup the UI components for the body and HUD
            Codex.setupGestures();
            
            // Setup the reticle (if desired)
            if ((typeof (document.body.style["pointer-events"])!== "undefined")&&
                ((Codex.demo)||(fdjtState.getLocal("codex.demo"))||
                 (fdjtState.getCookie("sbooksdemo"))||
                 (getQuery("demo")))) {
                fdjtUI.Reticle.setup();}

            // Initialize page information, etc
            initState();

            // Set up what the user sees during setup
            appSplash();
        }
        
        Codex.setSync=function setSync(val){
            if (!(val)) return false;
            var cur=Codex.sync;
            if ((cur)&&(cur>val)) return cur;
            Codex.sync=val;
            if (Codex.persist)
                setLocal("codex.sync("+Codex.refuri+")",val);
            return val;};

        function userSetup(){
            if (Codex.Trace.startup) fdjtLog("Starting user setup");
            // Start JSONP call to get initial or updated glosses, etc
            var sync=Codex.sync=getLocal("codex.sync("+Codex.refuri+")",true);

            // If the configuration is set to not persist, but there's
            //  a sync timestamp, we should erase what's there.
            if ((Codex.sync)&&(!(Codex.persist))) clearOffline();

            if (Codex.nologin) {}
            else if ((Codex.persist)&&(Codex.sync)&&
                     (getLocal("codex.user"))) {
                initUserOffline();
                if (Codex.Trace.storage) 
                    fdjtLog("Local info for %o (%s) from %o",
                            Codex.user._id,Codex.user.name,Codex.sync);
                if ((Codex.user)&&(Codex.sync)&&(Codex.persist)&&
                    (window._sbook_loadinfo))
                    // Clear the loadinfo "left over" from startup,
                    //  which should now be in the database
                    window._sbook_loadinfo=false;}
                
            if ((Codex.nologin)||(Codex.user)) {}
            else if ((window._sbook_loadinfo)&&
                     (window._sbook_loadinfo.userinfo)) {
                // Get the userinfo from the loadinfo
                var info=window._sbook_loadinfo;
                if (info.userinfo)
                    setUser(info.userinfo,
                            info.outlets,info.overlays,
                            info.sync);
                if (info.nodeid) setNodeID(info.nodeid);
                sync=info.sync;
                if (Codex.Trace.storage>1) 
                    fdjtLog("App cached loadinfo.js for %o (%s) from %o: %j",
                            Codex.user._id,Codex.user.name,Codex.sync,
                            info.userinfo);
                else if (Codex.Trace.storage) 
                    fdjtLog("App cached loadinfo.js for %o (%s) from %o",
                            Codex.user._id,Codex.user.name,Codex.sync);}
            else {}
            if (Codex.nologin) return;
            else if (window.navigator.onLine) {
                if ((Codex.user)&&(sync))
                    fdjtLog("Getting new (> %s (%d)) glosses from %s for %s",
                            fdjtTime.timeString(Codex.sync),Codex.sync,
                            Codex.server,Codex.user._id,Codex.user.name);
                else if (Codex.user)
                    fdjtLog("Getting glosses from %s for %s (%s)",
                            Codex.server,Codex.user._id,Codex.user.name);
                else fdjtLog("Getting glosses from %s",Codex.server);
                updateInfo();
                setInterval(updateInfo,300000);
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

        function Startup(force){
            var metadata=false;
            if (Codex._setup) return;
            if ((!force)&&(getQuery("nocodex"))) return;
            // This is all of the startup that we need to do synchronously
            syncStartup();
            // The rest of the stuff we timeslice
            fdjtTime.timeslice
            ([  // Scan the DOM for metadata.  This is surprisingly
                //  fast, so we don't currently try to timeslice it or
                //  cache it, though we could
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
                    if (tocmsg) {
                        tocmsg.innerHTML=fdjtString(
                            "Building table of contents based on %d heads",
                            Codex.docinfo._headcount);
                        addClass(tocmsg,"running");}
                    startupLog("Building table of contents based on %d heads",
                               Codex.docinfo._headcount);
                    Codex.setupTOC(metadata[Codex.content.id]);
                    dropClass(tocmsg,"running");},
                // Load all account information
                function(){
                    if (Codex.Trace.startup) fdjtLog("Loading sourcedb");
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
                     startupLog("Processing knodule %s",Codex.knodule.name);
                     Knodule.HTML.Setup(Codex.knodule);
                     dropClass(knomsg,"running");})),
                // Process locally stored (offline data) glosses
                function(){
                    if (Codex.sync) {
                        if (Codex.persist) return initGlossesOffline();}
                    else if (window._sbook_loadinfo) {
                        loadInfo(window._sbook_loadinfo);
                        window._sbook_loadinfo=false;}},
                // Process anything we got via JSONP ahead of processing
                //  _sbook_loadinfo
                ((window._sbook_newinfo)&&(function(){
                    loadInfo(window._sbook_newinfo);
                    window._sbook_newinfo=false;})),
                function(){
                    startupLog("Finding and applying Technorati-style tags");
                    applyAnchorTags();},
                function(){
                    startupLog("Finding and applying tag elements");
                    applyTagSpans();
                    applyMultiTagSpans();},
                function(){
                    if (window._sbook_autoindex) {
                        startupLog("Processing precompiled index");
                        Codex.useIndexData(
                            window._sbook_autoindex,
                            Codex.knodule,false,
                            function(){
                                applyTagAttributes(metadata,indexingDone);});
                        window._sbook_autoindex=false;}
                    else {
                        applyTagAttributes(metadata,indexingDone);}},
                // Figure out which mode to start up in, based on
                // query args to the book.
                function(){
                    if (!(Codex.bypage)) startupDone();
                    else if (Codex.layout) startupDone();
                    else Codex.layoutdone=startupDone;}],
             100,25);}
        Codex.Startup=Startup;
        
        function scanDOM(){
            var scanmsg=fdjtID("CODEXSTARTUPSCAN");
            var aboutbook=fdjtID("SBOOKABOUTPAGE"), about_tmp=false;
            var aboutauthor=fdjtID("SBOOKAUTHORPAGE"), author_tmp=false;
            if (aboutbook) {
                about_tmp=document.createTextNode("");
                aboutbook.parentNode.replaceChild(about_tmp,aboutbook);
                Codex.content.appendChild(aboutbook);}
            if (aboutauthor) {
                author_tmp=document.createTextNode("");
                aboutauthor.parentNode.replaceChild(author_tmp,aboutauthor);
                Codex.content.appendChild(aboutauthor);}
            addClass(scanmsg,"running");
            fdjtLog("Starting to scan DOM for structure and metadata");
            var metadata=new Codex.DOMScan(Codex.content,Codex.refuri+"#");
            // fdjtDOM.addClass(metadata._heads,"avoidbreakafter");
            Codex.docinfo=metadata;
            Codex.ends_at=Codex.docinfo[Codex.content.id].ends_at;
            dropClass(scanmsg,"running");
            if (aboutbook) {
                about_tmp.parentNode.replaceChild(aboutbook,about_tmp);}
            if (aboutauthor) {
                author_tmp.parentNode.replaceChild(aboutauthor,author_tmp);}
            fdjtLog("Finished scanning DOM for structure and metadata");
            if (Codex.scandone) {
                var donefn=Codex.scandone;
                delete Codex.scandone;
                donefn();}
            return metadata;}

        function appSplash(){
            var intro=fdjtID("CODEXINTRO");
            // Take any message passed along as a query string
            //  and put it in the top of the help window, then
            //  display the help window
            if (getQuery("congratulations"))
                fdjtDOM(intro,fdjtDOM("strong","Congratulations, "),
                        getQuery("congratulations"));
            else if (getQuery("sorry"))
                fdjtDOM(intro,fdjtDOM("strong","Sorry, "),
                        getQuery("sorry"));
            else if (getQuery("weird")) 
                fdjtDOM(intro,fdjtDOM("strong","Weird, "),
                        getQuery("weird"));
            // This is the case where we're accessing the book but
            //  have arguments to pass to the flyleaf app.  The most
            //  common case here is accepting an invitation to join a
            //  group.  It will probably be common for people to use
            //  the invitation link to get to the book, but we don't
            //  want to always present them with the invitation.  So
            //  this gets a little hairy.
            if ((getQuery("ACTION"))||
                (getQuery("JOIN"))||
                (getQuery("OVERLAY"))) {
                // We have args to pass to the flyleaf app, 
                // so we initialize it:
                Codex.initFlyleafApp();
                var appframe=fdjtID("SBOOKSAPP");
                var appwindow=((appframe)&&(appframe.contentWindow));
                if ((Codex.overlays)&&(getQuery("JOIN"))) {
                    // Check that it's not redundant
                    var ref=Codex.sourcedb.ref(getQuery("JOIN"));
                    if ((RefDB.contains(Codex.overlays,ref._id))) {
                        ref=Codex.sourcedb.ref(getQuery("JOIN"));
                        if (ref.name)
                            fdjtDOM(intro,"You've already added the overlay "+
                                    ref.name);
                        fdjtDOM(intro,"You've already added the overlay.");}}
                // If you have postMessage, it will be used to change
                //  modes when the sbook app actually loads
                else if (appwindow.postMessage) {}
                else {
                    Codex.joining=getQuery("JOIN");
                    Codex.setMode("sbooksapp");}}
            else if (getQuery("GLOSS"))
                Codex.glosshash=getQuery("GLOSS")[0];
            else if ((location.hash)&&(location.hash.length>=36)) {
                var hash=location.hash;
                if (hash[0]==="#") hash=hash.slice(1);
                if (hash.search("X")===0)
                    Codex.glosshash=hash.slice(2);
                else if (hash.search("GL")===0)
                    Codex.glosshash=hash.slice(2);
                else if ((hash.search("FBX")===0)||(hash.search("TWX")===0)||
                         (hash.search("GPX")===0))
                    Codex.glosshash=hash.slice(3);
                else Codex.glosshash=hash;}
                
            // This makes the splash page visible and applies some
            // other styling
            fdjtDOM.addClass(document.body,"codexstartup");
            window.focus();}
        
        function startupDone(mode){
            if ((Codex.glosshash)&&(Codex.glossdb.ref(Codex.glosshash))) {
                if (Codex.showGloss(Codex.glosshash))
                    Codex.glosshash=false;
                else initLocation();}
            else initLocation();
            window.onpopstate=function onpopstate(evt){
                if (evt.state) Codex.restoreState(evt.state);};
            fdjtLog("Startup done");
            if (fdjtID("CODEXREADYSPLASH"))
                fdjtID("CODEXREADYSPLASH").style.display='none';
            Codex.displaySync();
            setInterval(Codex.serverSync,60000);
            fdjtDOM.dropClass(document.body,"codexstartup");
            fdjtDOM.dropClass(document.body,"codexappsplash");
            if (mode) {}
            else if (getQuery("startmode"))
                mode=getQuery("startmode");
            else if (Codex.hidesplash) 
                Codex.setMode(false);
            else {}
            if (mode) Codex.setMode(mode);
            Codex._setup=new Date();
            if (Codex.onsetup) {
                var onsetup=Codex.onsetup;
                Codex.onsetup=false;
                setTimeout(onsetup,10);}
            var msg=false, uuid_end=false, msgid=false;
            if ((msg=getQuery("APPMESSAGE"))) {
                if ((msg.slice(0,2)==="#{")&&
                    ((uuid_end=msg.indexOf('}'))>0)) {
                    msgid="MSG_"+msg.slice(2,uuid_end);
                    if (fdjtState.getLocal(msgid)) {}
                    else {
                        fdjtState.setLocal(msgid,"seen");
                        fdjtUI.alertFor(10,msg.slice(uuid_end+1));}}
                else fdjtUI.alertFor(10,msg);}
            if ((msg=getQuery("SBOOKSMESSAGE"))) {
                if ((msg.slice(0,2)==="#{")&&
                    ((uuid_end=msg.indexOf('}'))>0)) {
                    msgid="MSG_"+msg.slice(2,uuid_end);
                    if (fdjtState.getLocal(msgid)) {}
                    else {
                        fdjtState.setLocal(msgid,"seen");
                        fdjtUI.alertFor(10,msg.slice(uuid_end+1));}}
                else fdjtUI.alertFor(10,msg);}
            if ((msg=getCookie("APPMESSAGE"))) {
                fdjtUI.alertFor(10,msg);
                fdjtState.clearCookie("APPMESSAGE","sbooks.net","/");}
            if ((msg=getCookie("SBOOKSMESSAGE"))) {
                fdjtUI.alertFor(10,msg);
                fdjtState.clearCookie("SBOOKSMESSAGE","sbooks.net","/");}}
        
        /* Application settings */

        function workOffline(){
            if (Codex.force_online) return false;
            else if (Codex.force_offline) return true;
            var config_val=getConfig("persist");
            if (typeof config_val !== 'undefined') return config_val;
            var value=(getMeta("Codex.offline"))||(getMeta("SBOOK.offline"));
            if ((value===0)||(value==="0")||
                (value==="no")||(value==="off")||
                (value==="never"))
                return false;
            else if (config_fetched) return false;
            else if (fetching_config)
                on_fetched_config=offlineDialog;
            return false;}

        function offlineDialog(){
            var config_val=getConfig("persist");
            if (typeof config_val === 'undefined') {
                fdjtUI.choose(
                    [{label: "No, thanks",
                      handler: function(){
                          setConfig("persist",false,true);}},
                     {label: "Yes, keep locally",
                      handler:
                      function(){
                          setConfig("persist",true,true);}},
                     {label: "Ask me later",
                      handler:
                      function(){setConfig("persist",false,false);}}],
                    "Store stuff on this computer?",
                    fdjtDOM("div.smaller",
                            "(to enable faster loading and offline reading)"));}}
            
        
        function readSettings(){
            // Basic stuff
            var refuri=_getsbookrefuri();
            var locuri=window.location.href;
            var hashpos=locuri.indexOf('#');
            if (hashpos>0) Codex.locuri=locuri.slice(0,hashpos);
            else Codex.locuri=locuri;
            document.body.refuri=Codex.refuri=refuri;
            Codex.docuri=_getsbookdocuri();
            
            Codex.devinfo=fdjtState.versionInfo();
            
            if (fdjtState.getQuery("offline")) {
                var qval=fdjtState.getQuery("offline");
                if ((qval===false)||(qval===0)||(qval==="no")||(qval==="off")||
                    (qval==="never")||(qval==="0"))
                    Codex.force_online=true;
                else Codex.force_offline=true;}
            else if (getMeta("SBOOK.offline")) {
                var mval=getMeta("SBOOK.offline");
                if ((mval===false)||(mval===0)||(mval==="no")||(mval==="off")||
                    (mval==="never")||(mval==="0"))
                    Codex.force_online=true;
                else Codex.force_offline=true;}

            var refuris=getLocal("codex.refuris",true)||[];

            Codex.sourceid=getMeta("SBOOK.sourceid");

            // Get the settings for scanning the document structure
            getScanSettings();

            /* Where to get your images from, especially to keep
               references inside https */
            if ((Codex.root==="http://static.beingmeta.com/")&&
                (window.location.protocol==='https:'))
                Codex.root=https_root;
            
            // Whether to suppress login, etc
            if ((getLocal("codex.nologin"))||(getQuery("nologin")))
                Codex.nologin=true;
            Codex.bypage=(Codex.page_style==='bypage'); 
            Codex.max_excerpt=getMeta("SBOOK.maxexcerpt")||(Codex.max_excerpt);
            Codex.min_excerpt=getMeta("SBOOK.minexcerpt")||(Codex.min_excerpt);
            var sbooksrv=getMeta("SBOOK.server")||getMeta("SBOOKSERVER");
            if (sbooksrv) Codex.server=sbooksrv;
            else if (fdjtState.getCookie("SBOOKSERVER"))
                Codex.server=fdjtState.getCookie("SBOOKSERVER");
            else Codex.server=lookupServer(document.domain);
            if (!(Codex.server)) Codex.server=Codex.default_server;
            
            refuris.push(refuri);

            var coverpage=fdjtDOM.getLink("SBOOK.coverpage",false,true)||
                fdjtDOM.getLink("coverpage",false,true);
            if (coverpage) Codex.coverpage=coverpage;
            
            var baseid=getMeta("SBOOK.id")||
                getMeta("SBOOK.prefix")||getMeta("SBOOK.baseid");
            if (baseid) Codex.baseid=baseid;
            var prefix=getMeta("SBOOK.prefix")||baseid;
            if (prefix) Codex.prefix=prefix;
            
            var autotoc=getMeta("SBOOK.autotoc");
            if (autotoc) {
                if ((autotoc[0]==="y")||(autotoc[0]==="Y")||
                    (autotoc==="ON")||(autotoc==="on")||
                    (autotoc==="1")||(autotoc==="enable"))
                    Codex.autotoc=true;
                else Codex.autotoc=false;}

            if (!((Codex.nologin)||(Codex.force_online))) {
                Codex.mycopyid=getMeta("SBOOK.mycopyid")||
                    (getLocal("mycopy("+refuri+")"))||
                    false;}
            if (Codex.persist) setLocal("codex.refuris",refuris,true);}

        function deviceSetup(){
            var useragent=navigator.userAgent;
            var body=document.body;

            var isiPhone = (/iphone/gi).test(navigator.appVersion);
            var isTouchPad = (/Touchpad/gi).test(navigator.appVersion);
            var isiPad = (/ipad/gi).test(navigator.appVersion);
            var isAndroid = (/android/gi).test(navigator.appVersion);
            var isWebKit = navigator.appVersion.search("WebKit")>=0;
            var isTouch = isiPhone || isiPad || isAndroid || isTouchPad || fdjtState.getQuery("touch");

            if (isTouch) {
                fdjtDOM.addClass(body,"cxTOUCH");
                viewportSetup();
                Codex.ui="touch";
                Codex.touch=true;}
            if ((useragent.search("Safari/")>0)&&
                (useragent.search("Mobile/")>0)) { 
                hide_mobile_safari_address_bar();
                Codex.nativescroll=false;
                Codex.scrolldivs=false;
                Codex.updatehash=false;
                // Animation seems to increase crashes in iOS
                Codex.dontanimate=true;
                // default_config.layout='fastpage';
                default_config.keyboardhelp=false;
                // Have fdjtLog do it's own format conversion for the log
                fdjtLog.doformat=true;}
            else if (useragent.search(/Android/gi)>0) {
                default_config.keyboardhelp=false;
                Codex.nativescroll=false;
                Codex.updatehash=false;
                Codex.scrolldivs=false;}
            else {
                fdjtDOM.addClass(body,"cxMOUSE");
                Codex.ui="mouse";}
            if (!(Codex.nativescroll)) fdjtDOM.addClass(body,"cxISCROLL");
            var opt_string=
                fdjtString.stdspace(
                    ((isiPhone)?(" iPhone"):(""))+
                        ((isTouchPad)?(" TouchPad"):(""))+
                        ((isiPad)?(" iPad"):(""))+
                        ((isAndroid)?(" Android"):(""))+
                        ((isWebKit)?(" WebKit"):(""))+
                        ((isTouch)?(" touch"):(""))+
                        ((!(isTouch))?(" mouse"):(""))+
                        ((Codex.nativescroll)?(" nativescroll"):
                         (" iscroll"))+
                        ((Codex.updatehash)?(" updatehash"):
                         (" leavehash"))+
                        ((Codex.scrolldivs)?(" scrolldivs"):
                         (" noscrolldivs")));
            fdjtLog("Device: %s %dx%d ui=%s, body=\"%s\"",
                    opt_string,fdjtDOM.viewWidth(),fdjtDOM.viewHeight(),
                    Codex.ui,body.className);}
        
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
            if (Codex.Trace.startup) fdjtLog("initOffline userinfo=%j",userinfo);
            // Should these really be refs in sourcedb?
            var outlets=Codex.outlets=
                getLocal("codex.outlets("+refuri+")",true)||[];
            var overlays=Codex.overlays=
                getLocal("codex.overlays("+refuri+")",true)||[];
            if (userinfo) setUser(userinfo,outlets,overlays,sync);
            if (nodeid) setNodeID(nodeid);}

        var offline_init=false;

        function initGlossesOffline(){
            if (offline_init) return false;
            else offline_init=true;
            var sync=Codex.sync;
            if (!(sync)) return;
            if ((Codex.Trace.glosses)||(Codex.Trace.startup))
                fdjtLog("Starting initializing glosses from offline storage");
            Codex.glosses.setLive(false);
            Codex.sourcedb.load(true);
            Codex.glossdb.load(true,function(){
                Codex.glosses.setLive(true);
                if ((Codex.glossdb.allrefs.length)||
                    (Codex.sourcedb.allrefs.length))
                    fdjtLog("Initialized %d glosses (%d sources) from offline storage",
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
            var refuri=fdjtDOM.getLink("SBOOK.refuri",false,true)||
                fdjtDOM.getLink("refuri",false,true)||
                getMeta("SBOOK.refuri",false,true)||
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
            return fdjtDOM.getLink("SBOOK.docuri",false)||
                fdjtDOM.getLink("docuri",false)||
                fdjtDOM.getLink("canonical",false)||
                location.href;}

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
                if (getMeta("SBOOK.root"))
                    Codex.docroot=fdjtID(getMeta("SBOOK.root"));
            else Codex.docroot=fdjtID("SBOOKCONTENT")||document.body;
            if (!(Codex.start))
                if (getMeta("SBOOK.start"))
                    Codex.start=fdjtID(getMeta("SBOOK.start"));
            else if (fdjtID("SBOOKSTART"))
                Codex.start=fdjtID("SBOOKSTART");
            else {}
            var i=0; while (i<9) {
                var rules=getMeta("sbookhead"+i,true).
                    concat(getMeta("sbook"+i+"head",true)).
                    concat(getMeta("sbook"+headlevels[i]+"head",true));
                if ((rules)&&(rules.length)) {
                    var j=0; var lim=rules.length; while (j<lim) {
                        var elements=fdjtDOM.getChildren(document.body,rules[j++]);
                        var k=0; var n=elements.length;
                        while (k<n) {
                            var elt=elements[k++];
                            if (!(hasTOCLevel(elt))) elt.toclevel=i;}}}
                i++;}
            // These are all meta class definit6ions, which is why
            //  they don't have regular schema prefixes
            if (getMeta("sbookignore")) 
                Codex.ignore=new fdjtDOM.Selector(getMeta("sbookignore"));
            if (getMeta("sbooknotoc")) 
                Codex.notoc=new fdjtDOM.Selector(getMeta("sbooknotoc"));
            if (getMeta("sbookterminal"))
                Codex.terminals=new fdjtDOM.Selector(getMeta("sbookterminal"));
            if ((getMeta("sbookfocus"))) 
                Codex.focus=new fdjtDOM.Selector(getMeta("sbookfocus"));
            if (getMeta("sbooknofocus"))
                Codex.nofocus=new fdjtDOM.Selector(getMeta("sbooknofocus"));}

        function applyMetaClass(name){
            var meta=getMeta(name,true);
            var i=0; var lim=meta.length;
            while (i<lim) fdjtDOM.addClass(fdjtDOM.$(meta[i++]),name);}

        function initBody(){
            var body=document.body;
            var content=fdjtDOM("div#CODEXCONTENT");
            // Get any author provided splash page
            var splash=fdjtID("CODEXSPLASH");
            var i, lim;

            body.setAttribute("tabindex",1);

            // Save those DOM elements in a handy place
            Codex.content=content;

            // Interpet links
            var notelinks=getChildren(body,"a[rel='sbooknote'],a[rel='footnote'],a[rel='endnote']");
            i=0, lim=notelinks.length; while (i<lim) {
                var ref=notelinks[i++];
                var href=ref.href;
                if (!(fdjtDOM.hasText(ref))) ref.innerHTML="Note";
                if ((href)&&(href[0]==="#")) {
                    addClass(fdjt.ID(href.slice(1)),"sbooknote");}}
            
            // Move the publisher-provided splash page directly into
            //  the body (if neccessary)
            if ((splash)&&(splash.parentNode!==body))
                fdjtDOM.prepend(body,splash);
            var children=body.childNodes, nodes=[];
            i=0, lim=children.length;
            if (splash) {
                // Gather all of the nodes before the splash page.
                //   There should really be any, but we'll check anyway.
                while (i<lim) {
                    //  We're trying to minimize display artifacts during
                    //   startup and this shuffling about might help in
                    //   some browsers.
                    var child=children[i++];
                    if (child===splash) {i++; break;}
                    else nodes.push(child);}}
            // Now copy the rest of the nodes from the body into the array
            while (i<lim) nodes.push(children[i++]);
            
            // Create a custom stylesheet for the app
            var style=fdjtDOM("STYLE");
            fdjtDOM(document.head,style);
            Codex.stylesheet=style.sheet;

            // Initialize cover and titlepage (if specified)
            Codex.cover=Codex.getCover();
            Codex.titlepage=fdjtID("SBOOKTITLEPAGE");

            // Move all the notes together
            var notesblock=fdjtID("SBOOKNOTES");
            if (!(notesblock)) {
                notesblock=fdjtDOM("div.sbookbackmatter#SBOOKNOTES");
                fdjtDOM(content,notesblock);}
            applyMetaClass("sbooknote");
            var note_counter=1;
            var allnotes=getChildren(content,".sbooknote");
            i=0, lim=allnotes.length; while (i<lim) {
                var notable=allnotes[i++];
                if (!(notable.id)) notable.id="CODEXNOTE"+(note_counter++);
                var noteref=notable.id+"_REF";
                if (!(document.getElementById(noteref))) {
                    var label=getChild(notable,"label")||getChild(notable,"summary")||
                        getChild(notable,".sbooklabel")||getChild(notable,".sbooksummary")||
                        getChild(notable,"span")||"Note";
                    var anchor=fdjtDOM.Anchor("#"+notable.id,"A",label); anchor.rel="sbooknote";
                    anchor.id=noteref;
                    fdjtDOM.replace(notable,anchor);
                    fdjtDOM.append(notesblock,notable,"\n");}
                else fdjtDOM.append(notesblock,notable,"\n");}

            // Now, move all of the body nodes into the content element
            i=0, lim=nodes.length; while (i<lim) {
                var node=nodes[i++];
                if (node.nodeType===1) {
                    if ((node.tagName!=='LINK')&&(node.tagName!=='META')&&
                        (node.tagName!=='SCRIPT'))
                        content.appendChild(node);}
                else content.appendChild(node);}

            fdjtDOM.append(content,"\n",notesblock,"\n");

            var pages=Codex.pages=fdjtID("CODEXPAGES")||
                fdjtDOM("div#CODEXPAGES");
            var page=Codex.page=fdjtDOM(
                "div#CODEXPAGE",
                fdjtDOM("div#CODEXPAGINATING","Laid out ",
                        fdjtDOM("span#CODEXPAGEPROGRESS",""),
                        " pages"),
                pages);
            
            Codex.body=fdjtDOM("div#CODEXBODY",content,page);
            fdjtDOM.append(body,Codex.body);
            fdjtDOM.addClass(body,"sbook");
            sizeContent();
            // Initialize the margins
            initMargins();
            if (Codex.Trace.startup>1)
                fdjtLog("Initialized body");}

        var glossmark_rule=false;

        function sizeContent(){
            var page=fdjtID("CODEXPAGE");
            var content=fdjtID("CODEXCONTENT");
            // Clear any explicit left/right settings to get at
            //  whatever the CSS actually specifies
            content.style.left=page.style.left='';
            content.style.right=page.style.right='';
            document.body.style.overflow='hidden';
            var page_width=fdjtDOM.getGeometry(page).width;
            var view_width=fdjtDOM.viewWidth();
            if (page_width) {
                var ss=Codex.stylesheet;
                var page_margin=(view_width-page_width)/2;
                if (glossmark_rule) {
                    ss.deleteRule(glossmark_rule);
                    glossmark_rule=false;}
                // If there are wide margins, set the left and right styles
                if (page_margin>=50) {
                    page.style.left=page_margin+'px';
                    page.style.right=page_margin+'px';}
                else if (page_margin<50) {
                    var insert_at=ss.cssRules.length++;
                    var gm_width=((page_margin<25)?(25):(page_margin));
                    var gm_offset=((gm_width>page_margin)?(gm_width-page_margin):(gm_width))-2;
                    ss.insertRule(
                        fdjtString(
                            "body.cxBYPAGE .codexglossmark { width: %dpx; height: %dpx; margin-right: -%dpx;}",
                            gm_width,gm_width,gm_offset),
                        insert_at);
                    glossmark_rule=ss.cssRules[insert_at];}
                else {}}
            document.body.style.overflow='';}
        Codex.sizeContent=sizeContent;
        
        /* Margin creation */

        var resizing=false;

        function initMargins(){
            var topleading=fdjtDOM("div#SBOOKTOPLEADING.leading.top"," ");
            var bottomleading=fdjtDOM("div#SBOOKBOTTOMLEADING.leading.bottom"," ");
            topleading.codexui=true; bottomleading.codexui=true;
            
            var pagehead=fdjtDOM("div.codexmargin#CODEXPAGEHEAD"," ");
            var pageright=fdjtDOM("div#CODEXPAGERIGHT");
            var pageleft=fdjtDOM("div#CODEXPAGELEFT");
            var pagefoot=fdjtDOM("div.codexmargin#CODEXPAGEFOOT"," ");
            pagehead.codexui=true; pagefoot.codexui=true;
            Codex.pagehead=pagehead; Codex.pagefoot=pagefoot;
            
            var scanleft=document.createDocumentFragment();
            var scanright=document.createDocumentFragment();
            var holder=fdjtDOM("div");
            holder.innerHTML=fixStaticRefs(Codex.HTML.pageleft);
            var nodes=fdjtDOM.toArray(holder.childNodes); var i=0, lim=nodes.length;
            while (i<lim) scanleft.appendChild(nodes[i++]);
            holder.innerHTML=fixStaticRefs(Codex.HTML.pageright);
            nodes=fdjtDOM.toArray(holder.childNodes), i=0, lim=nodes.length;
            while (i<lim) scanright.appendChild(nodes[i++]);

            fdjtDOM.prepend(document.body,pagehead,pagefoot,
                            scanleft,scanright,
                            pageleft,pageright);

            for (var pagelt in [pagehead,pageright,pageleft,pagefoot]) {
                fdjtDOM.addListeners(pagelt,Codex.UI.handlers[Codex.ui]["#"+pagelt.id]);}

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
            else if (bgcolor==="transparent") bgcolor="white";
            pagehead.style.backgroundColor=bgcolor;
            pagefoot.style.backgroundColor=bgcolor;
            fdjtDOM.addListener(window,"resize",function(evt){
                if (Codex.dont_resize) return;
                Codex.sizeContent();
                Codex.resizeHUD();
                if (resizing) clearTimeout(resizing);
                if ((Codex.layout)&&(Codex.layout.onresize))
                    resizing=setTimeout(function(){
                        resizing=false;
                        Codex.layout.onresize(evt||event);},
                                       3000);});}
        
        function getBGColor(arg){
            var color=fdjtDOM.getStyle(arg).backgroundColor;
            if (!(color)) return false;
            else if (color==="transparent") return false;
            else if (color.search(/rgba/)>=0) return false;
            else return color;}

        /* Loading meta info (user, glosses, etc) */

        function loadInfo(info) {
            if ((window._sbook_loadinfo!==info)&&(Codex.user))
                Codex.setConnected(true);
            if (!(Codex.user)) {
                if (info.userinfo)
                    setUser(info.userinfo,
                            info.outlets,info.overlays,
                            info.sync);
                else {
                    if (fdjtState.getLocal("queued("+Codex.refuri+")"))
                        Codex.glossdb.load(
                            fdjtState.getLocal("queued("+Codex.refuri+")",true));
                    addClass(document.body,"cxNOUSER");}
                if (info.nodeid) setNodeID(info.nodeid);}
            else if (info.wronguser) {
                Codex.clearOffline();
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
            if (window._sbook_loadinfo) {
                // This means that we have more information from the gloss
                // server before the local app has gotten around to
                // processing  the app-cached loadinfo.js
                // In this case, we put it in _sbook_new_loadinfo
                window._sbook_newinfo=info;
                return;}
            var refuri=Codex.refuri;
            if ((Codex.persist)&&
                (info)&&(info.userinfo)&&(Codex.user)&&
                (info.userinfo._id!==Codex.user._id)) {
                clearOffline();}
            var persist=((Codex.persist)&&(navigator.onLine));
            info.loaded=fdjtTime();
            if ((!(Codex.localglosses))&&
                ((getLocal("codex.sync("+refuri+")"))||
                 (getLocal("queued("+refuri+")"))))
                initGlossesOffline();
            if (Codex.Trace.glosses) {
                fdjtLog("loadInfo for %d %sglosses and %d refs (sync=%d)",
                        ((info.glosses)?(info.glosses.length):(0)),
                        ((Codex.sync)?("updated "):("")),
                        ((info.etc)?(info.etc.length):(0)),
                        info.sync);
                fdjtLog("loadInfo got %d sources, %d outlets, and %d overlays",
                        ((info.sources)?(info.sources.length):(0)),
                        ((info.outlets)?(info.outlets.length):(0)),
                        ((info.overlays)?(info.overlays.length):(0)));}
            if ((info.glosses)||(info.etc))
                initGlosses(info.glosses,info.etc);
            if (info.etc) gotInfo("etc",info.etc,persist);
            if (info.sources) gotInfo("sources",info.sources,persist);
            if (info.outlets) gotInfo("outlets",info.outlets,persist);
            if (info.overlays) gotInfo("overlays",info.overlays,persist);
            addOutlets2UI(info.outlets);
            if ((info.sync)&&((!(Codex.sync))||(info.sync>=Codex.sync))) {
                Codex.setSync(info.sync);}
            Codex.loaded=info.loaded=fdjtTime();
            if (Codex.whenloaded) {
                var whenloaded=Codex.whenloaded;
                Codex.whenloaded=false;
                setTimeout(whenloaded,10);}
            if (Codex.persist) {
                Codex.glossdb.save(true);
                Codex.sourcedb.save(true);}
            if (Codex.glosshash) {
                if (Codex.showGloss(Codex.glosshash))
                    Codex.glosshash=false;}
            if (Codex.glosses) Codex.glosses.update();}
        Codex.loadInfo=loadInfo;

        var updating=false;
        Codex.updatedInfo=function(data){
            loadInfo(data);
            updating=false;};
        function updateInfo(callback){
            if (updating) return;
            updating=true;
            if (!(navigator.onLine)) return;
            if (!(callback)) callback="Codex.updatedInfo";
            var uri="https://"+Codex.server+"/v1/loadinfo.js?REFURI="+
                encodeURIComponent(Codex.refuri);
            var glosses=fdjtState.getQuery("GLOSS");
            if ((glosses)&&(glosses.length)) {
                var i=0, lim=glosses.length; while (i<lim)
                    uri=uri+"&GLOSS="+glosses[i++];}
            if (Codex.mycopyid)
                uri=uri+"&MCOPYID="+encodeURIComponent(Codex.mycopyid);
            if (Codex.sync) uri=uri+"&SYNC="+(Codex.sync+1);
            if (Codex.user) uri=uri+"&SYNCUSER="+Codex.user._id;
            var ajax_uri=uri+"&CALLBACK=return";
            try { fdjtAjax(function(req){
                Codex.updatedInfo(JSON.parse(req.responseText));},
                           ajax_uri,[],
                           function (req){
                               if (req.readyState===4) {
                                   if (req.status>=400) {
                                       fdjtLog.warn("Ajax call to %s failed on callback, falling back to JSONP",
                                                    uri);
                                       updateInfoJSONP(uri);}}},
                           ((Codex.sync)?
                            ({"If-Modified-Since": (new Date(Codex.sync*1000)).toString()}):
                            (false)));}
            catch (ex) {
                fdjtLog.warn("Ajax call to %s failed on transmission, falling back to JSONP",uri);
                updateInfoJSONP(uri);}}
        function updateInfoJSONP(uri,callback){
            if (!(navigator.onLine)) return;
            if (!(callback)) callback="Codex.updatedInfo";
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

        function setUser(userinfo,outlets,overlays,sync){
            var persist=((Codex.persist)&&(navigator.onLine));
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
            if ((navigator.onLine)&&
                (fdjtState.getLocal("queued("+Codex.refuri+")")))
                Codex.writeQueuedGlosses();
            Codex.user=Codex.sourcedb.Import(
                userinfo,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
            if (persist) setConfig("persist",true,true);
            if (outlets) Codex.outlets=outlets;
            if (overlays) Codex.overlays=overlays;
            if (persist) {
                // No callback needed
                Codex.user.save();
                setLocal("codex.user",Codex.user._id);
                // We also save it locally so we can get it synchronously
                setLocal(Codex.user._id,Codex.user.Export(),true);}
            setupUI4User();
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
            if (Codex._user_setup) return;
            if (!(Codex.user)) {
                fdjtDOM.addClass(document.body,"cxNOUSER");
                return;}
            fdjtDOM.dropClass(document.body,"cxNOUSER");
            var username=Codex.user.name;
            if (fdjtID("CODEXUSERNAME"))
                fdjtID("CODEXUSERNAME").innerHTML=username;
            var names=document.getElementsByName("CODEXUSERNAME");
            if (names) {
                i=0, lim=names.length; while (i<lim)
                    names[i++].innerHTML=username;}
            if (fdjtID("SBOOKMARKUSER"))
                fdjtID("SBOOKMARKUSER").value=Codex.user._id;

            // Initialize the splashform, which provides easy login
            // and social features
            var splashform=fdjtID("CODEXSPLASHFORM");
            var docinput=fdjtDOM.getInput(splashform,"DOCURI");
            if (docinput) docinput.value=Codex.docuri;
            var refinput=fdjtDOM.getInput(splashform,"REFURI");
            if (refinput) refinput.value=Codex.refuri;
            var topinput=fdjtDOM.getInput(splashform,"TOPURI");
            if (topinput) topinput.value=document.location.href;
            var xquery=fdjtDOM.getInput(splashform,"XQUERY");
            var query=document.location.query;
            if (xquery) xquery.value=(((query)&&(query!=="?"))?(query):"");

            /* Initialize add gloss prototype */
            var ss=Codex.stylesheet;
            var form=fdjtID("CODEXADDGLOSSPROTOTYPE");
            if (Codex.user.fbid)  
                ss.insertRule(
                    "div#CODEXHUD span.facebook_share { display: inline;}",
                    ss.cssRules.length);
            if (Codex.user.twitterid) 
                ss.insertRule(
                    "div#CODEXHUD span.twitter_share { display: inline;}",
                    ss.cssRules.length);
            if (Codex.user.linkedinid) 
                ss.insertRule(
                    "div#CODEXHUD span.linkedin_share { display: inline;}",
                    ss.cssRules.length);
            if (Codex.user.googleid) 
                ss.insertRule(
                    "div#CODEXHUD span.google_share { display: inline;}",
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
                    i=0, lim=byname.length; while (i<lim)
                        byname[i++].src=pic;}}
            var idlinks=document.getElementsByName("IDLINK");
            if (idlinks) {
                i=0, lim=idlinks.length; while (i<lim) {
                    var idlink=idlinks[i++];
                    idlink.target='_blank';
                    idlink.title='click to edit your personal information';
                    idlink.href='https://auth.sbooks.net/my/profile';}}
            if (Codex.user.friends) {
                var friends=Codex.user.friends; var sourcedb=Codex.sourcedb;
                i=0, lim=friends.length; while (i<lim) {
                    var friend=RefDB.resolve(friends[i++],sourcedb);
                    Codex.addTag2Cloud(friend,Codex.gloss_cloud);
                    Codex.addTag2Cloud(friend,Codex.share_cloud);}}
            Codex._user_setup=true;}
        
        // Processes info loaded remotely
        function gotInfo(name,info,persist) {
            var refuri=Codex.refuri;
            if (info) {
                if (info instanceof Array) {
                    var i=0; var lim=info.length; var qids=[];
                    while (i<lim) {
                        if (typeof info[i] === 'string') {
                            var load_qid=info[i++];
                            var load_ref=Codex.sourcedb.ref(load_qid);
                            if (Codex.persist) load_ref.load();
                            qids.push(load_ref._id);}
                        else {
                            var import_ref=Codex.sourcedb.Import(
                                info[i++],false,
                                RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
                            import_ref.save();
                            qids.push(import_ref._id);}}
                    Codex[name]=qids;
                    if (Codex.persist)
                        setLocal("codex."+name+"("+refuri+")",qids,true);}
                else {
                    var ref=Codex.sourcedb.Import(
                        info,false,
                        RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
                    if (persist) ref.save();
                    Codex[name]=ref._id;
                    if (persist) setLocal(
                        "codex."+name+"("+refuri+")",ref._id,true);}}}

        function initGlosses(glosses,etc){
            if ((glosses.length===0)&&(etc.length===0)) return;
            var msg=fdjtID("CODEXNEWGLOSSES");
            if (msg) {
                msg.innerHTML=fdjtString(
                    "Assimilating %d new glosses",glosses.length);
                addClass(msg,"running");}
            if (etc) {
                startupLog("Assimilating %d new glosses/%d sources...",
                           glosses.length,etc.length);}
            else {
                startupLog("Assimilating %d new glosses...",glosses.length);}
            Codex.sourcedb.Import(
                etc,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
            Codex.glossdb.Import(
                glosses,{"tags": Knodule.importTagSlot},
                RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
            var i=0; var lim=glosses.length;
            var latest=Codex.syncstamp||0;
            while (i<lim) {
                var gloss=glosses[i++];
                var tstamp=gloss.syncstamp||gloss.tstamp;
                if (tstamp>latest) latest=tstamp;}
            Codex.syncstamp=latest;
            startupLog("Done assimilating %d new glosses...",glosses.length);
            dropClass(msg,"running");}
        Codex.Startup.initGlosses=initGlosses;
        
        function go_online(){return offline_update();}
        function offline_update(){
            Codex.writeQueuedGlosses(); updateInfo();}
        Codex.update=offline_update;
        
        fdjtDOM.addListener(window,"online",go_online);

        function initState() {
            var uri=Codex.docuri||Codex.refuri;
            var statestring=getLocal("codex.state("+uri+")");
            if (statestring)
                Codex.state=JSON.parse(statestring);}
        
        /* This initializes the sbook state to the initial location with the
           document, using the hash value if there is one. */ 
        function initLocation() {
            var state=Codex.state;
            if (!(state)) {
                var uri=Codex.docuri||Codex.refuri;
                var statestring=getLocal("codex.state("+uri+")");
                if (statestring) {
                    Codex.state=state=JSON.parse(statestring);
                    if (Codex.Trace.state)
                        fdjtLog("Got state from local storage: %j",
                                state);}
                else state={};}
            var hash=window.location.hash; var target=false;
            if ((typeof hash === "string") && (hash.length>0)) {
                if ((hash[0]==='#') && (hash.length>1))
                    target=document.getElementById(hash.slice(1));
                else target=document.getElementById(hash);
                if (Codex.Trace.startup>1)
                    fdjtLog("sbookInitLocation hash=%s=%o",hash,target);}
            if (target) Codex.GoTo(target,"initLocation/hash",true,true,true);
            else if ((state)&&(state.location)) {
                Codex.GoTo(state.location,"initLocation/state.location",
                           false,false,true);
                if (state.target) Codex.setTarget(state.target);}
            else if ((state)&&(state.target)&&(fdjtID(state.target)))
                Codex.GoTo(state.target,"initLocation/state.target",true,true,true);
            else if (Codex.start||Codex.cover||Codex.titlepage)
                Codex.GoTo((Codex.start||Codex.cover||Codex.titlepage),
                           "initLocation/start/cover/titlepage",
                           false,false,true);
            if ((Codex.user)&&(Codex.dosync)&&(navigator.onLine))
                syncLocation();}
        
        function syncLocation() {
            if (!(Codex.user)) return;
            var uri="https://"+Codex.server+"/v1/sync"+
                "?DOCURI="+encodeURIComponent(Codex.docuri)+
                "&REFURI="+encodeURIComponent(Codex.refuri);
            if (Codex.Trace.dosync)
                fdjtLog("syncLocation(call) %s",uri);
            try {
                fdjt.Ajax(function(req){
                    var d=JSON.parse(req.responseText);
                    Codex.setConnected(true);
                    Codex.syncstart=true;
                    if (Codex.Trace.dosync)
                        fdjtLog("syncLocation(callback) %s: %j",uri,d);
                    if ((!(d))||(!(d.location))) {
                        if (!(Codex.state))
                            Codex.GoTo(Codex.start||Codex.docroot||Codex.body,
                                       "syncLocation",false,false);
                        return;}
                    else if ((!(Codex.state))||(Codex.state.tstamp<d.tstamp)) {
                        if ((d.location)&&(d.location<=Codex.location)) return;
                        if (d.page===Codex.curpage) return;
                        var msg1="Sync to L"+Codex.location2pct(d.location);
                        var msg2=((d.page)&&("(page "+d.page+")"));
                        fdjtUI.choose([
                            {label: "No"},
                            {label: "Yes, sync",selected: true,
                             handler: function() {
                                 if ((d.location)||(d.target)) {
                                     if (d.location)
                                         Codex.GoTo(d.location,"sync",
                                                    d.target,true);
                                     else Codex.GoTo(d.target,"sync",
                                                     d.target,true);
                                     Codex.saveState(d);}}}],
                                      fdjtDOM("div",msg1),
                                      fdjtDOM("div.smaller",msg2));}},
                          uri,false,
                          function(req){
                              if ((req.readyState===4)&&(navigator.onLine))
                                  Codex.setConnected(false);});}
            catch (ex) {Codex.dosync=false;}}
        Codex.syncLocation=syncLocation;

        /* Indexing tags */
        
        function indexingDone(){
            startupLog("Content indexing is completed");
            if (Codex._setup) setupClouds();
            else Codex.onsetup=setupClouds;}
        
        function setupClouds(){
            var tracelevel=Math.max(Codex.Trace.startup,Codex.Trace.clouds);
            var addTag2Cloud=Codex.addTag2Cloud;
            var empty_cloud=Codex.empty_cloud;
            var gloss_cloud=Codex.gloss_cloud;
            Codex.empty_query.results=
                [].concat(Codex.glossdb.allrefs).concat(Codex.docdb.allrefs);
            var searchtags=Codex.searchtags=Codex.empty_query.getCoTags();
            var empty_query=Codex.empty_query;
            var tagscores=empty_query.tagscores;
            var tagfreqs=empty_query.tagfreqs;
            var max_freq=empty_query.max_freq;
            if (tracelevel)
                fdjtLog("Setting up initial tag clouds for %d tags",
                        searchtags.length);
            addClass(document.body,"cxINDEXING");
            fdjtTime.slowmap(function(tag){
                addTag2Cloud(tag,empty_cloud,Codex.knodule,tagscores,tagfreqs,false);
                if ((tag instanceof KNode)||
                    ((tagfreqs[tag]>4)&&(tagfreqs[tag]<(max_freq/2))))
                    addTag2Cloud(tag,gloss_cloud);},
                             searchtags,
                             function(state,i,lim){
                                 if (state!=='suspend') return;
                                 var pct=(i*100)/lim;
                                 if (tracelevel>1)
                                     startupLog("Added %d (%d%% of %d tags) to clouds",
                                                i,Math.floor(pct),lim);
                                 fdjtUI.ProgressBar.setProgress("CODEXINDEXMESSAGE",pct);
                                 fdjtUI.ProgressBar.setMessage(
                                     "CODEXINDEXMESSAGE",
                                     fdjtString("Added %d tags (%d%% of %d) to clouds",
                                                i,Math.floor(pct),lim));},
                             function(){
                                 var eq=Codex.empty_query;
                                 fdjtLog("Done populating clouds");
                                 fdjtUI.ProgressBar.setProgress("CODEXINDEXMESSAGE",100);
                                 fdjtUI.ProgressBar.setMessage(
                                     "CODEXINDEXMESSAGE",
                                     fdjtString("Added all %d tags to search/gloss clouds",
                                                searchtags.length));
                                 dropClass(document.body,"cxINDEXING");
                                 eq.cloud=empty_cloud;
                                 if (!(fdjtDOM.getChild(empty_cloud.dom,".showall")))
                                     fdjtDOM.prepend(
                                         empty_cloud.dom,
                                         Codex.UI.getShowAll(
                                             true,empty_cloud.values.length));
                                 Codex.sortCloud(empty_cloud,eq.tagfreqs);
                                 Codex.sizeCloud
                                 (empty_cloud,eq.tagscores,eq.tagfreqs,
                                  eq.results.length,false);
                                 Codex.sortCloud(gloss_cloud,eq.tagfreqs);
                                 Codex.sizeCloud(
                                     gloss_cloud,eq.tagscores,eq.tagfreqs,
                                     eq.results.length,false);},
                            200,5);}
        
        var addTags=Codex.addTags;
        
        /* Using the autoindex generated during book building */
        function useIndexData(autoindex,knodule,baseweight,whendone){
            var ntags=0, nitems=0;
            var tagweights=Codex.tagweights;
            var maxweight=Codex.tagmaxweight, minweight=Codex.tagminweight;
            var tracelevel=Math.max(Codex.Trace.startup,Codex.Trace.indexing);
            var alltags=[];
            if (!(autoindex)) return;
            for (var tag in autoindex) {
                if (!(autoindex.hasOwnProperty(tag))) continue;
                else alltags.push(tag);}
            function handleIndexEntry(tag){
                var ids=autoindex[tag]; ntags++;
                var occurrences=[];
                var bar=tag.indexOf('|');
                var taghead=tag, tagbase=tag, tagstart;
                if (bar>0) tagbase=taghead=tag.slice(0,bar);
                tagstart=taghead.search(/[^*~]/);
                if (tagstart>0) tagbase=taghead.slice(tagstart);
                if (bar>0) {
                    var defbody=tag.slice(bar);
                    var field_at=defbody.search("|:weight=");
                    if (field_at>=0) {
                        var weight=parseFloat(defbody.slice(field_at+9));
                        tagweights.set(tagbase,weight);
                        if (weight>maxweight) maxweight=weight;
                        if (weight<minweight) minweight=weight;
                        tag=taghead;}
                    if (field_at===0) tag=taghead;}
                var i=0; var lim=ids.length; nitems=nitems+lim;
                while (i<lim) {
                    var idinfo=ids[i++];
                    var frag=((typeof idinfo === 'string')?(idinfo):(idinfo[0]));
                    var info=Codex.docinfo[frag];
                    // Pointer to non-existent node.  Warn here?
                    if (!(info)) {
                        warn("Couldn't find node for %o",frag);
                        continue;}
                    if (typeof idinfo !== 'string') {
                        // When the idinfo is an array, the first
                        // element is the id itself and the remaining
                        // elements are the text strings which are the
                        // basis for the tag (we use this for
                        // highlighting).
                        var knodeterms=info.knodeterms, terms;
                        // If it's the regular case, we just assume that
                        if (!(info.knodeterms)) {
                            knodeterms=info.knodeterms={};
                            knodeterms[tagbase]=terms=[];}
                        else if ((terms=knodeterms[tagbase])) {}
                        else knodeterms[tagbase]=terms=[];
                        var j=1; var jlim=idinfo.length;
                        while (j<jlim) {terms.push(idinfo[j++]);}}
                    occurrences.push(info);}
                addTags(occurrences,tag);}
            addClass(document.body,"cxINDEXING");
            fdjtTime.slowmap(handleIndexEntry,alltags,
                             ((alltags.length>100)&&
                              (function(state,i,lim){
                                  if (state!=='suspend') return;
                                  // For chunks:
                                  var pct=(i*100)/lim;
                                  if (tracelevel>1)
                                      fdjtLog("Processed %d/%d (%d%%) of automatic tags",
                                              i,lim,Math.floor(pct));
                                  fdjtUI.ProgressBar.setProgress(
                                      "CODEXINDEXMESSAGE",pct);
                                  fdjtUI.ProgressBar.setMessage(
                                      "CODEXINDEXMESSAGE",
                                      fdjtString(
                                          "Assimilated %d tags (%d%% of %d) from the robo-index",
                                          i,Math.floor(pct),lim));})),
                             function(state){
                                 // At end:
                                 Codex.tagmaxweight=maxweight;
                                 Codex.tagminweight=minweight;
                                 fdjtLog("Processed automatic index of %d keys over %d items",
                                         ntags,nitems);
                                 dropClass(document.body,"cxINDEXING");
                                 if (whendone) whendone();},
                            200,5);}
        Codex.useIndexData=useIndexData;
        
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
            for (var eltid in docinfo) {
                var info=docinfo[eltid];
                if (info.atags) {tagged++; tohandle.push(info);}}
            if (((Codex.Trace.indexing)&&
                 ((Codex.Trace.indexing>1)||(tohandle.length>7)))||
                (tohandle.length>50))
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
            if (info.tags) addTags(info,info.tags);
            if (info.atags) addTags(info,info.atags);}
        
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
                completion.setAttribute("value",outlet._id);
                completion.setAttribute("key",outlet.name);
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
        
        /* Clearing offline data */

        function clearOffline(){
            var dropLocal=fdjtState.dropLocal;
            Codex.sync=false;
            dropLocal("codex.user");
            dropLocal("codex.sync("+Codex.refuri+")");
            dropLocal("codex.outlets("+Codex.refuri+")");
            dropLocal("codex.overlays("+Codex.refuri+")");
            Codex.sourcedb.clearOffline(function(){
                Codex.glossdb.clearOffline(function(){
                    fdjtState.dropLocal("codex.sync("+Codex.refuri+")");});});}
        Codex.clearOffline=clearOffline;

        /* Other setup */
        
        Codex.StartupHandler=function(){
            Codex.Startup();};

        return Startup;})();
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
