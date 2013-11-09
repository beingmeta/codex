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
        var getHash=fdjtState.getHash;
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

        /* Save local */

        var saveLocal=Codex.saveLocal;

        /* Configuration information */

        var config_handlers={};
        var default_config=
            {layout: 'bypage',forcelayout: false,
             bodysize: 'normal',bodyfamily: 'serif',
             uisize: 'normal',showconsole: false,
             animatecontent: true,animatehud: true,
             hidesplash: false,keyboardhelp: true,
             holdmsecs: 400,wandermsecs: 1500,
             glossupdate: 5*60*1000};
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
            if (!((current_config[name])&&
                  (current_config[name]===value))) {
                if (config_handlers[name]) {
                    if (Codex.Trace.config)
                        fdjtLog("setConfig (handler=%s) %o=%o",
                                config_handlers[name],name,value);
                    config_handlers[name](name,value);}}
            current_config[name]=value;
            if ((!(save))&&(inputs.length))
                fdjtDOM.addClass("CODEXSETTINGS","changed");
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
                if (((!(default_config.hasOwnProperty(setting)))||
                     (config[setting]!==default_config[setting]))&&
                    (!(getQuery(setting)))) {
                    saved[setting]=config[setting];}}
            if (Codex.Trace.config) fdjtLog("Saving config %o",saved);
            setLocal("codex.config",JSON.stringify(saved));
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
                    if ((Codex.Trace.dosync)||(Codex.Trace.state))
                        fdjtLog("configSave(callback) %o ready=%o status=%o %j",
                                evt,req.readyState,
                                ((req.readyState===4)&&(req.status)),
                                saved_config);};
                var uri="https://auth.sbooks.net/admin/codexconfig?"+
                    encodeURIComponent(JSON.stringify(saved));
                try {
                    req.open("GET",uri,true);
                    req.withCredentials=true;
                    req.send(); }
                catch (ex) {}}
            fdjtDOM.dropClass("CODEXSETTINGS","changed");
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
            
            fdjtDOM.addClass("CODEXSETTINGS","changed");
            
            var devicename=current_config.devicename;
            if ((devicename)&&(!(fdjtString.isEmpty(devicename))))
                Codex.deviceName=devicename;}

        var fetching_config=false, config_fetched=false;
        var on_fetched_config=false;
        function fetchConfig(){
            var req=new XMLHttpRequest();
            fetching_config=true; var onfetch=false;
            req.onreadystatechange=function(evt){
                if ((req.readyState===4)&&
                    (req.status>=200)&&(req.status<300)) {
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
            try {
                req.open("GET",uri,true);
                req.withCredentials=true;
                req.send(); }
            catch (ex) {}}
        
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
                    setInterval(updateInfo,value);}});
        
        function syncStartup(){
            // This is the startup code which is run
            //  synchronously, before the time-sliced processing
            fdjtLog.console="CODEXCONSOLELOG";
            fdjtLog.consoletoo=true;
            if (!(Codex._setup_start)) Codex._setup_start=new Date();
            fdjtLog("This is Codex version %s, built %s on %s, launched %s, from %s",
                    Codex.version,Codex.buildtime,Codex.buildhost,
                    Codex._setup_start.toString(),
                    Codex.root||"somewhere");
            if (navigator.appVersion)
                fdjtLog("Navigator App version: %s (%s)",
                        navigator.appVersion,navigator.userAgent);
            // This lets trace configurations be passed as query
            // arguments, for handy debugging.
            if (getQuery("cxtrace")) readTraceSettings();

            // This reads settings
            envSetup();

            // If we don't know who the user is, get started
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
            showMessage();
            if (!(updating)) userSetup();

            // Hide the loading splash page, if any
            if (fdjtID("CODEXSPLASH"))
                fdjtID("CODEXSPLASH").style.display='none';

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

        function envSetup() {

            // Initialize domain and origin for browsers which care
            try {document.domain="sbooks.net";}
            catch (ex) {fdjtLog.warn("Error setting document.domain");}
            try {document.origin="sbooks.net";}
            catch (ex) {fdjtLog.warn("Error setting document.origin");}

            // Get various settings for the sBook from the HTML (META
            // tags, etc), including settings or guidance for
            // scanning, graphics, layout, glosses, etc.
            readSettings();}

        function appSetup() {

            var body=document.body;

            if (Codex.Trace.startup>2) fdjtLog("Starting app setup");

            // Create a custom stylesheet for the app
            var style=fdjtDOM("STYLE");
            fdjtDOM(document.head,style);
            Codex.stylesheet=style.sheet;

            // Initialize the databases
            Codex.initDB();

            // Modifies the DOM in various ways
            initBody();
            
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

            addConfig(
                "keepdata",
                function(name,value){
                    var refuri=Codex.refuri;
                    if (value) {
                        fdjtDOM.remove(fdjtDOM.toArray(fdjtDOM.$(".codexkeepdata")));}
                    if ((value)&&(Codex.keepdata)) return;
                    else if ((!(value))&&(!(Codex.keepdata))) return;
                    else if ((value)&&(!(Codex.force_online))) {
                        if (!(Codex.sourcedb.storage))
                            Codex.sourcedb.storage=window.localStorage;
                        if (!Codex.glossdb.storage)
                            Codex.glossdb.storage=window.localStorage;
                        var props=saveprops, i=0, lim=props.length;
                        while (i<lim) {
                            var prop=saveprops[i++];
                            if (Codex[prop]) saveLocal(
                                "codex."+prop+"("+refuri+")",Codex[prop],true);}
                        Codex.glossdb.save(true);
                        Codex.sourcedb.save(true);
                        Codex.queued=getLocal("queued("+Codex.refuri+")",true)||[];}
                    else if (!(value)) {
                        clearOffline();
                        fdjtState.dropLocal("queued("+Codex.refuri+")");
                        Codex.queued=[];}
                    Codex.keepdata=value;
                    setCheckSpan(fdjtID("CODEXLOCALCHECKBOX"),value);});

            // Get any local saved configuration information
            //  We do this after the HUD is setup so that the settings
            //   panel gets initialized appropriately.
            initConfig();
            Codex.keepdata=
                ((!(Codex.force_online))&&
                 ((Codex.force_offline)||(workOffline())));

            // Setup the UI components for the body and HUD
            Codex.setupGestures();
            
            // Setup the reticle (if desired)
            if ((typeof (body.style["pointer-events"])!== "undefined")&&
                ((Codex.demo)||(fdjtState.getLocal("codex.demo"))||
                 (fdjtState.getCookie("sbooksdemo"))||
                 (getQuery("demo")))) {
                fdjtUI.Reticle.setup();}

            // Initialize page information, etc
            initState();

            fdjtLog("Body: %s",document.body.className);

            if (Codex.Trace.startup>2) fdjtLog("Done with app setup");}
        
        Codex.setSync=function setSync(val){
            if (!(val)) return false;
            var cur=Codex.sync;
            if ((cur)&&(cur>val)) return cur;
            Codex.sync=val;
            if (Codex.keepdata)
                saveLocal("codex.sync("+Codex.refuri+")",val);
            return val;};

        function userSetup(){
            // Get any local sync information
            var sync=Codex.sync=getLocal("codex.sync("+Codex.refuri+")",true)||0;
            var loadinfo=false, userinfo=false;

            // If the configuration is set to not persist, but there's
            //  a sync timestamp, we should erase what's there.
            if ((Codex.sync)&&(!(Codex.keepdata))) clearOffline();

            if (Codex.nologin) {}
            else if ((Codex.keepdata)&&(sync)&&(getLocal("codex.user"))) {
                initUserOffline();
                if (Codex.Trace.storage) 
                    fdjtLog("Local info for %o (%s) from %o",
                            Codex.user._id,Codex.user.name,Codex.sync);
                if ((Codex.user)&&(Codex.sync)&&(Codex.keepdata)&&
                    (window._sbook_loadinfo))
                    // Clear the loadinfo "left over" from startup,
                    //  which should now be in the database
                    window._sbook_loadinfo=false;}
                
            if ((Codex.nologin)||(Codex.user)) {}
            else if ((window._sbook_loadinfo)&&
                     (window._sbook_loadinfo.userinfo)) {
                // Get the userinfo from the loadinfo that might have already been loaded
                loadinfo=window._sbook_loadinfo;
                userinfo=loadinfo.userinfo;
                if (Codex.Trace.storage) 
                    fdjtLog("Have window._sbook_loadinfo for %o (%s) dated %o: %j",
                            userinfo._id,userinfo.name||userinfo.email,
                            loadinfo.sync,userinfo);
                setUser(userinfo,
                        loadinfo.outlets,loadinfo.overlays,
                        loadinfo.sync);
                if (loadinfo.nodeid) setNodeID(loadinfo.nodeid);
                if (loadinfo.sync>sync) Codex.sync=sync=loadinfo.sync;}
            else if ((Codex.userinfo)||(window._userinfo)) {
                userinfo=(Codex.userinfo)||(window._userinfo);
                if ((Codex.Trace.storage)||(Codex.Trace.startup))
                    fdjtLog("Have %s for %o (%s) dated %o: %j",
                            ((Codex.userinfo)?("Codex.userinfo"):("window._userinfo")),
                            userinfo._id,userinfo.name||userinfo.email,
                            userinfo.sync||userinfo.modified,userinfo);
                setUser(userinfo,userinfo.outlets,userinfo.overlays,
                        userinfo.sync||userinfo.modified);}
            else {}
            if (Codex.nologin) return;
            else if (!(Codex.refuri)) return;
            else if (window.navigator.onLine) {
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

        function CodexStartup(force){
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
                        if (Codex.keepdata) return initGlossesOffline();}
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
                    applyMultiTagSpans();},
                function(){
                    if (window._sbook_autoindex) {
                        if ((Codex.Trace.startup>1)||(Codex.Trace.indexing)) {
                            if (window._sbook_autoindex._nkeys)
                                fdjtLog("Processing provided index of %d keys and %d refs",
                                        window._sbook_autoindex._nkeys,
                                        window._sbook_autoindex._nrefs);
                            else fdjtLog("Processing provided index");}
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
                    else if ((Codex.layout)&&(Codex.layout.done))
                        startupDone();
                    else Codex.layoutdone=startupDone;}],
             100,25);}
        Codex.Startup=CodexStartup;
        
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
            var metadata=new Codex.DOMScan(Codex.content,Codex.refuri+"#");
            // fdjtDOM.addClass(metadata._heads,"avoidbreakafter");
            Codex.docinfo=metadata;
            Codex.ends_at=Codex.docinfo[Codex.content.id].ends_at;
            dropClass(scanmsg,"running");
            if (aboutbook) {
                about_tmp.parentNode.replaceChild(aboutbook,about_tmp);}
            if (aboutauthor) {
                author_tmp.parentNode.replaceChild(aboutauthor,author_tmp);}
            if (Codex.scandone) {
                var donefn=Codex.scandone;
                delete Codex.scandone;
                donefn();}
            return metadata;}
        
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
            if (mode) {}
            else if (getQuery("startmode"))
                mode=getQuery("startmode");
            else {}
            if (mode) Codex.setMode(mode);
            else mode=Codex.mode;
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
                    if (getLocal(msgid)) {}
                    else {
                        fdjtState.setLocal(msgid,"seen");
                        fdjtUI.alertFor(10,msg.slice(uuid_end+1));}}
                else fdjtUI.alertFor(10,msg);}
            if ((msg=getQuery("SBOOKSMESSAGE"))) {
                if ((msg.slice(0,2)==="#{")&&
                    ((uuid_end=msg.indexOf('}'))>0)) {
                    msgid="MSG_"+msg.slice(2,uuid_end);
                    if (getLocal(msgid)) {}
                    else {
                        fdjtState.setLocal(msgid,"seen");
                        fdjtUI.alertFor(10,msg.slice(uuid_end+1));}}
                else fdjtUI.alertFor(10,msg);}
            if ((msg=getCookie("APPMESSAGE"))) {
                fdjtUI.alertFor(10,msg);
                fdjtState.clearCookie("APPMESSAGE","sbooks.net","/");}
            if ((msg=getCookie("SBOOKSMESSAGE"))) {
                fdjtUI.alertFor(10,msg);
                fdjtState.clearCookie("SBOOKSMESSAGE","sbooks.net","/");}
            if ((!(mode))&&(location.hash)) Codex.hideCover();
            else if ((!(mode))&&(Codex.user)) {
                var opened=getLocal("Codex.opened("+Codex.refuri+")",true);
                if ((opened)&&((opened+((3600+1800)*1000))>fdjtTime()))
                    Codex.hideCover();}}
        
        /* Application settings */

        function workOffline(){
            if (Codex.force_online) return false;
            else if (Codex.force_offline) return true;
            var config_val=getConfig("keepdata");
            if (typeof config_val !== 'undefined') return config_val;
            var value=(getMeta("Codex.offline"))||(getMeta("SBOOKS.offline"));
            if ((value===0)||(value==="0")||
                (value==="no")||(value==="off")||
                (value==="never")) {
                Codex.force_online=true;
                return false;}
            else return false;}
        
        function readSettings(){

            // First, define common schemas
            fdjtDOM.addAppSchema("SBOOK","http://sbooks.net/");
            fdjtDOM.addAppSchema("SBOOKS","http://sbooks.net/");
            fdjtDOM.addAppSchema("Codex","http://codex.sbooks.net/");
            fdjtDOM.addAppSchema("DC","http://purl.org/dc/elements/1.1/");
            fdjtDOM.addAppSchema("DCTERMS","http://purl.org/dc/terms/");
            fdjtDOM.addAppSchema("OLIB","http://openlibrary.org/");
            
            // Basic stuff
            var refuri=_getsbookrefuri();
            var locuri=window.location.href;
            var hashpos=locuri.indexOf('#');
            if (hashpos>0) Codex.locuri=locuri.slice(0,hashpos);
            else Codex.locuri=locuri;
            document.body.refuri=Codex.refuri=refuri;
            Codex.docuri=_getsbookdocuri();
            Codex.topuri=document.location.href;
            
            Codex.devinfo=fdjtState.versionInfo();
            
            if (getQuery("offline")) {
                var qval=getQuery("offline");
                if ((qval===false)||(qval===0)||(qval==="no")||(qval==="off")||
                    (qval==="never")||(qval==="0"))
                    Codex.force_online=true;
                else Codex.force_offline=true;}
            else if (getMeta("SBOOKS.offline")) {
                var mval=getMeta("SBOOKS.offline");
                if ((mval===false)||(mval===0)||(mval==="no")||(mval==="off")||
                    (mval==="never")||(mval==="0"))
                    Codex.force_online=true;
                else Codex.force_offline=true;}

            var refuris=getLocal("codex.refuris",true)||[];

            Codex.sourceid=getMeta("SBOOKS.sourceid");

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
            Codex.max_excerpt=getMeta("SBOOKS.maxexcerpt")||(Codex.max_excerpt);
            Codex.min_excerpt=getMeta("SBOOKS.minexcerpt")||(Codex.min_excerpt);
            var sbooksrv=getMeta("SBOOKS.server")||getMeta("SBOOKSERVER");
            if (sbooksrv) Codex.server=sbooksrv;
            else if (fdjtState.getCookie("SBOOKSERVER"))
                Codex.server=fdjtState.getCookie("SBOOKSERVER");
            else Codex.server=lookupServer(document.domain);
            if (!(Codex.server)) Codex.server=Codex.default_server;
            
            var notespecs=getMeta("sbooknote",true).concat(
                getMeta("SBOOKS.note",true));
            var noterefspecs=getMeta("sbooknoteref",true).concat(
                getMeta("SBOOKS.noteref",true));
            Codex.sbooknotes=(((notespecs)&&(notespecs.length))?
                              (fdjtDOM.sel(notespecs)):(false));
            Codex.sbooknoterefs=(((noterefspecs)&&(noterefspecs.length))?
                                 (fdjtDOM.sel(noterefspecs)):(false));

            refuris.push(refuri);

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
            
            var autotoc=getMeta("SBOOKS.autotoc");
            if (autotoc) {
                if ((autotoc[0]==="y")||(autotoc[0]==="Y")||
                    (autotoc==="ON")||(autotoc==="on")||
                    (autotoc==="1")||(autotoc==="enable"))
                    Codex.autotoc=true;
                else Codex.autotoc=false;}

            if (!((Codex.nologin)||(Codex.force_online))) {
                Codex.mycopyid=getMeta("SBOOKS.mycopyid")||
                    (getLocal("mycopy("+refuri+")"))||
                    false;}
            if (Codex.keepdata) saveLocal("codex.refuris",refuris,true);}

        function deviceSetup(){
            var useragent=navigator.userAgent;
            var device=fdjt.device;
            var body=document.body;

            if ((!(device.touch))&&(getQuery("touch")))
                device.touch=getQuery("touch");
            
            // Don't bubble from TapHold regions (by default)
            fdjt.TapHold.default_opts.bubble=false;
            
            if (device.touch) {
                fdjtDOM.addClass(body,"cxTOUCH");
                fdjt.TapHold.default_opts.touch=true;
                Codex.ui="touch";
                Codex.touch=true;
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
            else {
                // Assume desktop or laptop
                fdjtDOM.addClass(body,"cxMOUSE");
                Codex.ui="mouse";}
            if (Codex.iscroll) {
                fdjtDOM.addClass(body,"cxISCROLL");
                device.iscroll=true;}
            device.string=device.string+" "+
                ((Codex.iscroll)?("iScroll"):("nativescroll"));
            fdjtLog("Device: %s/%dx%d %s",
                    Codex.ui,fdjtDOM.viewWidth(),fdjtDOM.viewHeight(),device.string);}

        function bookSetup(){
            if (Codex.bookinfo) return;
            var bookinfo=Codex.bookinfo={};
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
                getMeta("SBOOKS.converted");}
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
            if (Codex.Trace.startup)
                fdjtLog("initOffline userinfo=%j",userinfo);
            // Should these really be refs in sourcedb?
            var outlets=Codex.outlets=getLocal("codex.outlets("+refuri+")",true)||[];
            var overlays=Codex.overlays=getLocal("codex.overlays("+refuri+")",true)||[];
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
                if (Codex.heartscroller)
                    Codex.heartscroller.refresh();
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
                if (getMeta("SBOOKS.root"))
                    Codex.docroot=fdjtID(getMeta("SBOOKS.root"));
            else Codex.docroot=fdjtID("SBOOKCONTENT")||document.body;
            if (!(Codex.start))
                if (getMeta("SBOOKS.start"))
                    Codex.start=fdjtID(getMeta("SBOOKS.start"));
            else if (fdjtID("SBOOKSTART"))
                Codex.start=fdjtID("SBOOKSTART");
            else {}
            var i=0; while (i<9) {
                var body=document.body;
                var rules=getMeta("sbookhead"+i,true).
                    concat(getMeta("sbook"+i+"head",true)).
                    concat(getMeta("sbook"+headlevels[i]+"head",true));
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
            evt=evt||event;
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
            var frame=fdjtID("CODEXFRAME");
            var cover, existing_cover=fdjtID("CODEXCOVER");
            if (!(frame)) {
                frame=fdjtDOM("div#CODEXFRAME");
                fdjtDOM.prepend(document.body,frame);}
            if (existing_cover) {
                frame.appendChild(existing_cover);
                cover=existing_cover;}
            else {
                cover=fdjtDOM("div#CODEXCOVER");
                cover.innerHTML=fixStaticRefs(Codex.HTML.cover);
                frame.appendChild(cover);}
            if (Codex.Trace.startup) {
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
            if (fdjtID("CODEXCREDITSPAGEHOLDER"))
                fdjtID("CODEXCREDITSPAGEHOLDER").removeAttribute("style");

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
                fdjtDOM.scaleToFit(coverpage,0.9);
                coverpage.style.opacity=null; coverpage.style.display=null;
                coverpage.style.overflow=null;}
            if (fdjtID("CODEXBOOKCOVERHOLDER")) fdjtDOM.remove("CODEXBOOKCOVERHOLDER");
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
                    titlepage=fdjtDOM("div#CODEXTITLEPAGE",
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
                titlepage.style.opacity=0.0; titlepage.style.display="block";
                titlepage.style.overflow="visible";
                fdjtDOM.scaleToFit(titlepage,0.9);
                titlepage.style.opacity=null; titlepage.style.display=null;
                titlepage.style.overflow=null;}
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
                    fdjtDOM.replace(fdjtID("CODEXCREDITSPAGEHOLDER"),creditspage);
                    creditspage.id="CODEXCREDITSPAGE";}
                else if (hasParent(creditspage,cover)) {}
                else cover.appendChild(creditspage);
                if ((fdjtID("CODEXCREDITSPAGE"))&&(fdjtID("CODEXCREDITSPAGEHOLDER")))
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
            if (Codex.Trace.startup>1) fdjtLog("Setting up console %o",console);
            console.innerHTML=Codex.HTML.console;
            Codex.DOM.input_console=input_console=
                fdjtDOM.getChild(console,"TEXTAREA");
            Codex.DOM.input_button=input_button=
                fdjtDOM.getChild(console,"span.button");
            input_button.onclick=consolebutton_click;
            input_console.onkeypress=consoleinput_keypress;

            var overlays=fdjtID("CODEXOVERLAYS");
            if (!(overlays)) {
                overlays=fdjtDOM("div#CODEXOVERLAYS");
                cover.appendChild(overlays);}
            var sbooksapp=fdjtID("SBOOKSAPP");
            if (!(sbooksapp)) {
                sbooksapp=fdjtDOM("iframe#SBOOKSAPP");
                sbooksapp.setAttribute("frameborder",0);
                sbooksapp.setAttribute("scrolling","auto");}
            overlays.appendChild(sbooksapp);
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

            // Make the cover hidden by default
            Codex.CSS.hidecover=fdjtDOM.addCSSRule(
                "div#CODEXCOVER","opacity: 0.0; z-index: -10; pointer-events: none;");
            fdjtDOM.tweakFonts(cover);
            return cover;}

        var coverids={"bookcover": "CODEXBOOKCOVER",
                      "titlepage": "CODEXTITLEPAGE",
                      "bookcredits": "CODEXCREDITSPAGE",
                      "aboutbook": "CODEXABOUTBOOK",
                      "help": "CODEXAPPHELP",
                      "settings": "CODEXSETTINGS",
                      "overlays": "CODEXOVERLAYS"};

        function cover_clicked(evt){
            var target=fdjtUI.T(evt);
            var cover=fdjtID("CODEXCOVER");
            if (fdjt.UI.isClickable(target)) return;
            if (!(hasParent(target,fdjtID("CODEXCOVERCONTROLS")))) {
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
            if ((mode==="overlays")&&
                (!(fdjtID("SBOOKSAPP").src))&&
                (!(Codex.appinit)))
                Codex.initIFrameApp();

            var curclass=cover.className;
            var cur=((curclass)&&(coverids[curclass])&&(fdjtID(coverids[curclass])));
            var nxt=((mode)&&(coverids[mode])&&(fdjtID(coverids[mode])));
            fdjtLog("cur=%o, nxt=%o",cur,nxt);
            if ((cur)&&(nxt)) {
                cur.style.display='block';
                nxt.style.display='block';
                setTimeout(function(){
                    cur.style.display="";
                    nxt.style.display="";},
                           3000);}
            setTimeout(function(){
                cover.className=mode;
                Codex.mode=mode;},
                       20);
            fdjt.UI.cancel(evt);}

        Codex.addConfig("showconsole",function(name,value){
            if (value) addClass(document.body,"cxSHOWCONSOLE");
            else dropClass(document.body,"cxSHOWCONSOLE");});
        
        /* Filling in information */

        function fillAboutInfo(about){
            var bookabout=fdjtID("SBOOKABOUTPAGE")||fdjtID("SBOOKABOUT");
            var authorabout=fdjtID("SBOOKAUTHORPAGE")||
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
                clone.id=null;
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
            var body=document.body;
            var init_content=fdjtID("CODEXCONTENT");
            var content=(init_content)||(fdjtDOM("div#CODEXCONTENT"));
            var i, lim;
            if (Codex.Trace.startup>2) fdjtLog("Organizing content");

            body.setAttribute("tabindex",1);
            /* -- Sets 1em to equal 10px -- */ 
            body.style.fontSize="62.5%";
            /* -- Remove any original width constraints -- */
            body.style.width="inherit";

            // Save those DOM elements in a handy place
            Codex.content=content;

            // Move all the notes together
            var notesblock=fdjtID("SBOOKNOTES")||fdjtDOM("div.sbookbackmatter#SBOOKNOTES");
            applyMetaClass("sbooknote");
            var note_counter=1;
            var allnotes=getChildren(content,".sbooknote");
            i=0, lim=allnotes.length; while (i<lim) {
                var notable=allnotes[i++];
                if (!(notable.id)) notable.id="CODEXNOTE"+(note_counter++);
                var noteref=notable.id+"_REF";
                if (!(document.getElementById(noteref))) {
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
            i=0, lim=notelinks.length; while (i<lim) {
                var ref=notelinks[i++];
                var href=ref.href;
                if (!(fdjtDOM.hasText(ref))) ref.innerHTML="Note";
                if ((href)&&(href[0]==="#")) {
                    addClass(fdjt.ID(href.slice(1)),"sbooknote");}}
            
            if (!(init_content)) {
                var children=[], childnodes=body.childNodes;
                i=0, lim=childnodes.length; while (i<lim) children.push(childnodes[i++]);
                i=0; while (i<lim) {
                    // Copy all of the content nodes
                    var child=children[i++];
                    if (child.nodeType!==1) content.appendChild(child);
                    else if ((child.id)&&(child.id.search("CODEX")===0)) {}
                    else if (/(META|LINK|SCRIPT)/gi.test(child.tagName)) {}
                    else content.appendChild(child);}}
            // Append the notes block to the content
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
            
            Codex.body=fdjtDOM("div#CODEXBODY.codexbody",content,page);
            fdjtDOM.append(body,Codex.body);
            // Initialize the margins
            initMargins();
            // Size the content
            sizeContent();
            if (Codex.Trace.startup>2) fdjtLog("Organized content");}

        function sizeContent(){
            var content=Codex.content, page=Codex.page, body=document.body;
            // Clear any explicit left/right settings to get at
            //  whatever the CSS actually specifies
            content.style.left=page.style.left='';
            content.style.right=page.style.right='';
            body.style.overflow='hidden';
            // Get geometry
            var geom=fdjtDOM.getGeometry(page);
            var view_height=fdjtDOM.viewHeight();
            var page_width=geom.width, view_width=fdjtDOM.viewWidth();
            var page_margin=(view_width-page_width)/2;
            if (page_margin!==50) {
                page.style.left=page_margin+'px';
                page.style.right=page_margin+'px';}
            else page.style.left=page.style.right='';
            if ((geom.top<35)||((view_height-(geom.height+geom.top))<35))
                Codex.fullheight=true;
            else Codex.fullheight=false;
            if ((geom.left<35)||((view_width-(geom.width+geom.left))<35))
                Codex.fullwidth=true;
            else Codex.fullwidth=false;
            if (Codex.fullwidth) addClass(document.body,"cxFULLWIDTH");
            else dropClass(document.body,"cxFULLWIDTH");
            if (Codex.fullheight) addClass(document.body,"cxFULLHEIGHT");
            else dropClass(document.body,"cxFULLHEIGHT");
            geom=fdjtDOM.getGeometry(page,page.offsetParent,true);
            var fakepage=fdjtDOM("DIV.codexpage");
            page.appendChild(fakepage);
            // There might be a better way to get the .codexpage settings,
            //  but this seems to work.
            var fakepage_geom=fdjtDOM.getGeometry(fakepage,page,true);
            fdjtID("CODEXPAGELEFT").style.width=page_margin+"px";
            fdjtID("CODEXPAGERIGHT").style.width=page_margin+"px";
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
            document.body.style.overflow='';}
        Codex.sizeContent=sizeContent;
        
        /* Margin creation */

        var resizing=false;

        function initMargins(){
            var topleading=fdjtDOM("div#SBOOKTOPLEADING.leading.top"," ");
            var bottomleading=
                fdjtDOM("div#SBOOKBOTTOMLEADING.leading.bottom"," ");
            topleading.codexui=true; bottomleading.codexui=true;
            
            var pageright=fdjtDOM("div#CODEXPAGERIGHT");
            var pageleft=fdjtDOM("div#CODEXPAGELEFT");
            
            var scanleft=document.createDocumentFragment();
            var scanright=document.createDocumentFragment();
            var holder=fdjtDOM("div");
            holder.innerHTML=fixStaticRefs(Codex.HTML.pageleft);
            var nodes=fdjtDOM.toArray(holder.childNodes);
            var i=0, lim=nodes.length;
            while (i<lim) scanleft.appendChild(nodes[i++]);
            holder.innerHTML=fixStaticRefs(Codex.HTML.pageright);
            nodes=fdjtDOM.toArray(holder.childNodes), i=0, lim=nodes.length;
            while (i<lim) scanright.appendChild(nodes[i++]);

            fdjtDOM.prepend(document.body,/* pagehead,pagefoot, */
                            scanleft,scanright,
                            pageleft,pageright);

            Codex.TapHold.pageleft=new fdjt.TapHold(pageleft,{override:true});
            Codex.TapHold.pageright=new fdjt.TapHold(pageright,{override:true});
            for (var pagelt in [pageright,pageleft]) { /* pagehead,pagefoot  */
                fdjtDOM.addListeners(
                    pagelt,Codex.UI.handlers[Codex.ui]["#"+pagelt.id]);}

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
            /*
            pagehead.style.backgroundColor=bgcolor;
            pagefoot.style.backgroundColor=bgcolor;
            */
            fdjtDOM.addListener(window,"resize",function(evt){
                if (resizing) clearTimeout(resizing);
                Codex.resizeHUD();
                if ((Codex.layout)&&(Codex.layout.onresize)&&
                    (!(Codex.freezelayout))&&(!(Codex.glossform)))
                    resizing=setTimeout(function(){
                        resizing=false;
                        Codex.sizeContent();
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
            if (Codex.nouser) {
                Codex.setConnected(false);
                return;}
            if (window._sbook_loadinfo!==info)
                Codex.setConnected(true);
            if (!((Codex.user)&&(Codex._user_setup))) {
                if (info.userinfo)
                    setUser(info.userinfo,
                            info.outlets,info.overlays,
                            info.sync);
                else {
                    if (getLocal("queued("+Codex.refuri+")"))
                        Codex.glossdb.load(getLocal("queued("+Codex.refuri+")",true));
                    fdjtID("CODEXCOVER").className="bookcover";
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
            if ((window._sbook_loadinfo)&&
                (window._sbook_loadinfo!==info)) {
                // This means that we have more information from the gloss
                // server before the local app has gotten around to
                // processing  the app-cached loadinfo.js
                // In this case, we put it in _sbook_new_loadinfo
                window._sbook_newinfo=info;
                return;}
            var refuri=Codex.refuri;
            if ((Codex.keepdata)&&
                (info)&&(info.userinfo)&&(Codex.user)&&
                (info.userinfo._id!==Codex.user._id)) {
                clearOffline();}
            var keepdata=((Codex.keepdata)&&(navigator.onLine));
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
                initGlosses(info.glosses||[],info.etc||[]);
            if (info.etc) gotInfo("etc",info.etc,keepdata);
            if (info.sources) gotInfo("sources",info.sources,keepdata);
            if (info.outlets) gotInfo("outlets",info.outlets,keepdata);
            if (info.overlays) gotInfo("overlays",info.overlays,keepdata);
            addOutlets2UI(info.outlets);
            if ((info.sync)&&((!(Codex.sync))||(info.sync>=Codex.sync))) {
                Codex.setSync(info.sync);}
            Codex.loaded=info.loaded=fdjtTime();
            if (Codex.whenloaded) {
                var whenloaded=Codex.whenloaded;
                Codex.whenloaded=false;
                setTimeout(whenloaded,10);}
            if (Codex.keepdata) {
                Codex.glossdb.save(true);
                Codex.sourcedb.save(true);}
            if (Codex.glosshash) {
                if (Codex.showGloss(Codex.glosshash))
                    Codex.glosshash=false;}
            if (Codex.glosses) Codex.glosses.update();}
        Codex.loadInfo=loadInfo;

        var updating=false;
        var ticktock=false;
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
            var ajax_headers=
                ((Codex.sync)?
                 ({"If-Modified-Since": (new Date(Codex.sync*1000)).toString()}):
                 (false));
            function gotInfo(req){
                updating=false;
                Codex.updatedInfo(
                    JSON.parse(req.responseText),
                    uri+((user)?("&SYNCUSER="+user._id):("&JUSTUSER=yes")),
                    start);
                if (user) {
                    // If there was already a user, just startup regular
                    //  updates now
                    if ((!(ticktock))&&(Codex.update_interval)) 
                        Codex.ticktock=ticktock=setInterval(updateInfo,Codex.update_interval);}
                else if (Codex.user)
                    // This response gave us a user, so we start another request, which
                    //  will get glosses.  The response to this request will start the
                    //  interval timer.
                    setTimeout(updateInfo,50);
                else {
                    // The response back didn't give us any user information
                    fdjtLog.warn("Couldn't determine user!");}}
            function ajaxFailed(req){
                if (req.readyState===4) {
                    if (req.status<500) {
                        fdjtLog.warn("Ajax call to %s failed on callback, falling back to JSONP",
                                     uri);
                        updateInfoJSONP(uri+((user)?(""):("&JUSTUSER=yes")),jsonp);
                        noajax=true;}
                    else {
                        try {
                            fdjtLog.warn(
                                "Ajax call to %s returnd status %d %j, taking a break",
                                uri,req.status,JSON.parse(req.responseText));}
                        catch (ex) {
                            fdjtLog.warn(
                                "Ajax call to %s returned status %d, taking a break",
                                req.status,uri);}
                        if (ticktock) {
                            clearInterval(Codex.ticktock);
                            Codex.ticktock=ticktock=false;}
                        setTimeout(updateInfo,30*60*1000);}}}
            if ((updating)||(!(navigator.onLine))) return; else updating=true;
            // Get any requested glosses and add them to the call
            var i=0, lim, glosses=getQuery("GLOSS",true); {
                i=0, lim=glosses.length; while (i<lim) uri=uri+"&GLOSS="+glosses[i++];}
            glosses=getHash("GLOSS"); {
                i=0; lim=glosses.length; while (i<lim) uri=uri+"&GLOSS="+glosses[i++];}
            if (Codex.mycopyid) uri=uri+"&MCOPYID="+encodeURIComponent(Codex.mycopyid);
            if (Codex.sync) uri=uri+"&SYNC="+(Codex.sync+1);
            if (user) uri=uri+"&SYNCUSER="+user._id;
            if ((!(user))&&(Codex.Trace.startup))
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

        function setUser(userinfo,outlets,overlays,sync){
            var keepdata=((Codex.keepdata)&&(navigator.onLine));
            if (Codex.Trace.startup)
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
            if ((navigator.onLine)&&(getLocal("queued("+Codex.refuri+")")))
                Codex.writeQueuedGlosses();
            Codex.user=Codex.sourcedb.Import(
                userinfo,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
            if (keepdata) setConfig("keepdata",true,true);
            if (outlets) Codex.outlets=outlets;
            if (overlays) Codex.overlays=overlays;
            if (keepdata) {
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
                if ((nodeid)&&(Codex.keepdata))
                    setLocal("codex.nodeid("+refuri+")",nodeid,true);}}
        Codex.setNodeID=setNodeID;

        function setupUI4User(){
            var i=0, lim;
            if (Codex._user_setup) return;
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
                    i=0, lim=names.length; while (i<lim)
                        names[i++].innerHTML=username;}
                names=fdjtDOM.$(".codexusername");
                if ((names)&&(names.length)) {
                    i=0, lim=names.length; while (i<lim)
                        names[i++].innerHTML=username;}}
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

        function loginUser(info){
            Codex.user=Codex.sourcedb.Import(
                info,false,RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
            setupUI4User();
            Codex._user_setup=false;}
        Codex.loginUser=loginUser;
        
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
                            if (Codex.keepdata) load_ref.load();
                            qids.push(load_ref._id);}
                        else {
                            var import_ref=Codex.sourcedb.Import(
                                info[i++],false,
                                RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
                            import_ref.save();
                            qids.push(import_ref._id);}}
                    Codex[name]=qids;
                    if (Codex.keepdata)
                        setLocal("codex."+name+"("+refuri+")",qids,true);}
                else {
                    var ref=Codex.sourcedb.Import(
                        info,false,
                        RefDB.REFLOAD|RefDB.REFSTRINGS|RefDB.REFINDEX);
                    if (persist) ref.save();
                    Codex[name]=ref._id;
                    if (persist) saveLocal(
                        "codex."+name+"("+refuri+")",ref._id,true);}}}

        function initGlosses(glosses,etc){
            if ((glosses.length===0)&&(etc.length===0)) return;
            var msg=fdjtID("CODEXNEWGLOSSES");
            if (msg) {
                msg.innerHTML=fdjtString(
                    "Assimilating %d new glosses",glosses.length);
                addClass(msg,"running");}
            if (etc) {
                if (glosses.length)
                    fdjtLog("Assimilating %d new glosses/%d sources...",
                            glosses.length,etc.length);}
            else if (glosses.length) 
                fdjtLog("Assimilating %d new glosses...",glosses.length);
            else {}
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
            if (glosses.length)
                fdjtLog("Done assimilating %d new glosses...",glosses.length);
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
                Codex.GoTo(state.target,"initLocation/state.target",
                           true,true,true);
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
                    if (req.readyState!==4) return;
                    else if (req.status>=300) {
                        Codex.setConnected(false);
                        return;}
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
            var tagfreqs=empty_query.tagfreqs;
            var max_freq=empty_query.max_freq;
            if (tracelevel)
                fdjtLog("Setting up initial tag clouds for %d tags",
                        searchtags.length);
            addClass(document.body,"cxINDEXING");
            fdjtTime.slowmap(function(tag){
                addTag2Cloud(tag,empty_cloud,Codex.knodule,
                             Codex.tagweights,tagfreqs,false);
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
                                 fdjtUI.ProgressBar.setProgress(
                                     "CODEXINDEXMESSAGE",pct);
                                 fdjtUI.ProgressBar.setMessage(
                                     "CODEXINDEXMESSAGE",
                                     fdjtString("Added %d tags (%d%% of %d) to clouds",
                                                i,Math.floor(pct),lim));},
                             function(){
                                 var eq=Codex.empty_query;
                                 fdjtLog("Done populating clouds");
                                 fdjtUI.ProgressBar.setProgress(
                                     "CODEXINDEXMESSAGE",100);
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
                                 Codex.sortCloud(empty_cloud);
                                 Codex.sizeCloud(
                                     empty_cloud,Codex.tagweights,true);
                                 Codex.sortCloud(gloss_cloud);
                                 Codex.sizeCloud(
                                     gloss_cloud,Codex.tagweights,true);},
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
                if (tag[0]==="_") continue;
                else if (!(autoindex.hasOwnProperty(tag))) continue;
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
                    var frag=((typeof idinfo === 'string')?
                              (idinfo):
                              (idinfo[0]));
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
                                      fdjtLog("Processed %d/%d (%d%%) of provided tags",
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
                                 fdjtLog("Processed provided index of %d keys over %d items",
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
            if ((Codex.Trace.startup>1)||(Codex.Trace.indexing>1))
                startupLog("Applying inline tag attributes from content");
            for (var eltid in docinfo) {
                var info=docinfo[eltid];
                if (info.atags) {tagged++; tohandle.push(info);}}
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

        function clearOffline(refuri){
            var dropLocal=fdjtState.dropLocal;
            if (!(refuri)) {
                dropLocal("codex.user");
                if (Codex.user) {
                    // For now, we clear layouts, because they might
                    //  contain personalized information
                    fdjt.CodexLayout.clearLayouts();}
                fdjtState.clearLocal();}
            else {
                if (typeof refuri !== "string") refuri=Codex.refuri;
                Codex.sync=false;
                dropLocal("codex.sync("+refuri+")");
                dropLocal("codex.sourceid("+refuri+")");
                dropLocal("codex.sources("+refuri+")");
                dropLocal("codex.outlets("+refuri+")");
                dropLocal("codex.overlays("+refuri+")");
                dropLocal("codex.state("+refuri+")");
                dropLocal("codex.etc("+refuri+")");
                Codex.sourcedb.clearOffline(function(){
                    Codex.glossdb.clearOffline(function(){
                        fdjtState.dropLocal("codex.sync("+refuri+")");});});}}
        Codex.clearOffline=clearOffline;
        
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
