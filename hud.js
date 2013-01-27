/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/hud.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

   This file provides initialization and some interaction for the
   Codex HUD (Heads Up Display), an overlay on the book content
   provided by the Codex e-reader web application.

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

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
var Codex=((typeof Codex !== "undefined")?(Codex):({}));
var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

Codex.setMode=
    (function(){
        var fdjtString=fdjt.String;
        var fdjtState=fdjt.State;
        var fdjtTime=fdjt.Time;
        var fdjtLog=fdjt.Log;
        var fdjtDOM=fdjt.DOM;
        var fdjtUI=fdjt.UI;
        var fdjtKB=fdjt.KB;
        var fdjtID=fdjt.ID;
        
        // Helpful dimensions
        // Whether to call displaySync on mode changes
        var display_sync=false;
        
        var addClass=fdjtDOM.addClass;
        var dropClass=fdjtDOM.dropClass;
        var hasClass=fdjtDOM.hasClass;
        var getParent=fdjtDOM.getParent;
        var getGeometry=fdjtDOM.getGeometry;
        var getChild=fdjtDOM.getChild;
        var hasSuffix=fdjtString.hasSuffix;
        var Ref=fdjtKB.Ref;

        var CodexHUD=false;

        // This will contain the interactive input console (for debugging)
        var hud=false, input_console=false, input_button=false;
        var allglosses=false, sbooksapp=false, console=false;

        function initHUD(){
            if (fdjtID("CODEXHUD")) return;
            var messages=fdjtDOM("div.startupmessages");
            messages.innerHTML=fixStaticRefs(Codex.HTML.messages);
            if (Codex.Trace.startup) fdjtLog("Initializing HUD layout");
            Codex.HUD=CodexHUD=hud=fdjtDOM("div#CODEXHUD");
            hud.codexui=true;
            hud.innerHTML=fixStaticRefs(Codex.HTML.hud);
            fdjtDOM.prepend(document.body,
                            messages,
                            fdjtDOM("div.fdjtprogress#CODEXLAYOUTMESSAGE",
                                    fdjtDOM("div.indicator"),
                                    fdjtDOM("div.message")),
                            hud);
            // Fill in the HUD help
            var hudhelp=fdjtID("CODEXHUDHELP");
            hudhelp.innerHTML=fixStaticRefs(Codex.HTML.hudhelp);
            // Set up the help page
            var help=Codex.DOM.help=fdjtID("CODEXHELP");
            help.innerHTML=fixStaticRefs(Codex.HTML.help);
            // Set up the app splash/status page
            var splash=Codex.DOM.appsplash=fdjtID("CODEXAPPSPLASH");
            splash.innerHTML=fixStaticRefs(Codex.HTML.splash);
            // Setup heart
            var heart=fdjtID("CODEXHEART");
            heart.innerHTML=fixStaticRefs(Codex.HTML.heart);
            Codex.DOM.heart=heart;
            // Setup settings
            var settings=fdjtID("CODEXSETTINGS");
            settings.innerHTML=fixStaticRefs(Codex.HTML.settings);
            Codex.DOM.settings=settings;
            // Other HUD parts
            Codex.DOM.head=fdjtID("CODEXHEAD");
            Codex.DOM.heart=fdjtID("CODEXHEART");
            Codex.DOM.foot=fdjtID("CODEXFOOT");
            Codex.DOM.tabs=fdjtID("CODEXTABS");
            // Initialize search UI
            var search=fdjtID("CODEXSEARCH");
            search.innerHTML=fixStaticRefs(Codex.HTML.searchbox);
            Codex.empty_cloud=
                new fdjtUI.Completions(fdjtID("CODEXSEARCHCLOUD"));
            // Setup addgloss prototype
            var addgloss=fdjtID("CODEXADDGLOSSPROTOTYPE");
            addgloss.innerHTML=fixStaticRefs(Codex.HTML.addgloss);

            if (Codex.Trace.startup) fdjtLog("Done with static HUD init");

            if (!(Codex.svg)) {
                var images=fdjtDOM.getChildren(hud,"img");
                var i=0; var lim=images.length;
                if (Codex.Trace.startup) fdjtLog("Switching images to SVG");
                while (i<lim) {
                    var img=images[i++];
                    if ((img.src)&&
                        ((hasSuffix(img.src,".svg"))||
                         (hasSuffix(img.src,".svgz")))&&
                        (img.getAttribute('bmp')))
                        img.src=img.getAttribute('bmp');}}

            Codex.hudtick=fdjtTime();

            fdjtID("SBOOK_RETURN_TO").value=location.href;

            // Initialize gloss UI
            Codex.DOM.allglosses=allglosses=fdjtID("CODEXALLGLOSSES");
            if (Codex.Trace.startup>1)
                fdjtLog("Setting up gloss UI %o",allglosses);

            Codex.UI.setupSummaryDiv(allglosses);
            Codex.glosses.addEffect("maker",function(f,p,v){
                Codex.sourcekb.ref(v).oninit
                (Codex.UI.addGlossSource,"newsource");});
            Codex.glosses.addEffect("sources",function(f,p,v){
                Codex.sourcekb.ref(v).oninit
                (Codex.UI.addGlossSource,"newsource");});
            Codex.glosses.addInit(addGloss2UI);
            
            Codex.DOM.console=fdjtID("CODEXCONSOLE");
            if (Codex.Trace.startup>1) fdjtLog("Setting up console %o",console);

            Codex.DOM.input_console=input_console=fdjtDOM.getChild(console,"TEXTAREA");
            Codex.DOM.input_button=input_button=fdjtDOM.getChild(console,"span.button");
            input_button.onclick=consolebutton_click;
            input_console.onkeypress=consoleinput_keypress;

            Codex.DOM.sbooksapp=sbooksapp=fdjtID("SBOOKSAPP");
            if (Codex.Trace.startup>1) fdjtLog("Setting up appframe %o",sbooksapp);
            
            var appwindow=((sbooksapp)&&(sbooksapp.contentWindow));
            if (appwindow.postMessage) {
                if (Codex.Trace.messages)
                    fdjtLog("Setting up message listener");
                fdjtDOM.addListener(window,"message",function(evt){
                    var origin=evt.origin;
                    if (Codex.Trace.messages)
                        fdjtLog("Got a message from %s with payload %s",
                                origin,evt.data);
                    if (origin.search(/https:\/\/[^\/]+.sbooks.net/)!==0) {
                        fdjtLog.warn("Rejecting insecure message from %s",
                                     origin);
                        return;}
                    if (evt.data==="sbooksapp") {
                        CodexMode("sbooksapp");}
                    else if (evt.data==="loggedin") {
                        if (!(Codex.user)) Codex.userSetup();}
                    else if (evt.data)
                        fdjtDOM("CODEXINTRO",evt.data);
                    else {}});}


            // Set up the splash form
            var splashform=fdjtID("CODEXSPLASHFORM");
            if (Codex.Trace.startup>1) fdjtLog("Setting up splash %o",splashform);

            var docinput=fdjtDOM.getInput(splashform,"DOCURI");
            if (docinput) docinput.value=Codex.docuri;
            var refinput=fdjtDOM.getInput(splashform,"REFURI");
            if (refinput) refinput.value=Codex.refuri;
            var topinput=fdjtDOM.getInput(splashform,"TOPURI");
            if (topinput) topinput.value=document.location.href;
            if ((Codex.user)&&(Codex.user.email)) {
                var nameinput=fdjtDOM.getInput(splashform,"USERNAME");
                if (nameinput) nameinput.value=Codex.user.email;}
            var query=document.location.search||"?";
            var appuri="https://"+Codex.server+"/flyleaf"+query;
            var refuri=Codex.refuri;
            if (query.search("REFURI=")<0)
                appuri=appuri+"&REFURI="+encodeURIComponent(refuri);
            if (query.search("TOPURI=")<0)
                appuri=appuri+"&TOPURI="+
                encodeURIComponent(document.location.href);
            if (document.title) {
                appuri=appuri+"&DOCTITLE="+encodeURIComponent(document.title);}
            fdjtID("CODEXSPLASH_RETURN_TO").value=appuri;
            
            if (Codex.Trace.startup>1)
                fdjtLog("Setting up taphold for foot %o",Codex.DOM.foot);
            fdjtUI.TapHold(Codex.DOM.foot,Codex.touch);
            
            if (Codex.Trace.startup) fdjtLog("Filling in tabs");
            fillinTabs();
            
            /* Currently a no-op */
            resizeHUD();

            if (Codex.Trace.startup) fdjtLog("Updating scrollers");
            Codex.scrollers={};
            updateScroller("CODEXSEARCHCLOUD");
            updateScroller("CODEXGLOSSCLOUD");
            fdjtDOM.setupCustomInputs(fdjtID("CODEXHUD"));
            fdjtLog("Initialized basic HUD layout");}
        Codex.initHUD=initHUD;
        
        function fixStaticRefs(string){
            if (Codex.root==="http://static.beingmeta.com/g/codex/")
                return string;
            else return string.replace(
                    /http:\/\/static.beingmeta.com\/g\/codex\//g,
                Codex.root);}

        function resizeHUD(){}
        Codex.resizeHUD=resizeHUD;

        /* Various UI methods */
        function addGloss2UI(item){
            if (document.getElementById(item.frag)) {
                var addGlossmark=Codex.UI.addGlossmark;
                Codex.UI.addToSlice(item,allglosses,false);
                var nodes=Codex.getDups(item.frag);
                addClass(nodes,"glossed");
                var i=0, lim=nodes.length; while (i<lim) {
                    addGlossmark(nodes[i++],item);}
                if (item.tstamp>Codex.syncstamp)
                    Codex.syncstamp=item.tstamp;}}

        var tagHTML=Knodule.HTML;

        function addTag2GlossCloud(tag){
            if (!(tag)) return;
            else if (tag instanceof Array) {
                var i=0; var lim=tag.length;
                while (i<lim) addTag2GlossCloud(tag[i++]);
                return;}
            else if (!(Codex.gloss_cloud)) {
                // If the HUD hasn't been initialized, add the tag
                //  to queues for addition.
                var queue=Codex.gloss_cloud_queue;
                if (!(queue)) queue=Codex.gloss_cloud_queue=[];
                queue.push(tag);}
            else if ((tag instanceof Ref)&&(!(tag._init)))
                // If it's uninitialized, delay adding it
                tag.oninit(addTag2GlossCloud,"addTag2GlossCloud");
            // Skip weak tags
            else if ((tag instanceof Ref)&&(tag.weak)) return;
            else {
                var gloss_cloud=Codex.glossCloud();
                var ref=((tag instanceof Ref)?(tag):
                         ((fdjtKB.probe(tag,Codex.knodule))||
                          (fdjtKB.ref(tag,Codex.knodule))));
                var ref_tag=(((ref)&&(ref.tagString))&&
                             (ref.tagString(Codex.knodule)))||
                    ((ref)&&((ref._id)||(ref.uuid)||(ref.oid)))||
                    (tag);
                var gloss_tag=gloss_cloud.getByValue(ref_tag,".completion");
                if (!((gloss_tag)&&(gloss_tag.length))) {
                    gloss_tag=tagHTML(tag,Codex.knodule,false,true);
                    if ((ref)&&(ref.pool===Codex.sourcekb))
                        fdjtDOM(fdjtID("CODEXGLOSSCLOUDSOURCES"),
                                gloss_tag," ");
                    else fdjtDOM(fdjtID("CODEXGLOSSCLOUDTAGS"),
                                 gloss_tag," ");
                    gloss_cloud.addCompletion(gloss_tag);}}}
        Codex.addTag2GlossCloud=addTag2GlossCloud;
        
        function addOutlets2UI(outlets){
            if (typeof outlets === 'string')
                outlets=Codex.sourcekb.ref(outlets);
            if (!(outlets)) return;
            if (!(outlets instanceof Array)) outlets=[outlets];
            if (!(Codex.outlet_cloud)) {
                // If the HUD hasn't been initialized, add the tag
                //  to queues for addition.
                var queue=Codex.outlet_cloud_queue;
                if (!(queue)) queue=Codex.outlet_cloud_queue=[];
                queue=Codex.outlet_cloud_queue=queue.concat(outlets);
                return;}
            else {
                var i=0; var lim=outlets.length;
                var loaded=[];
                while (i<lim) {
                    var outlet=outlets[i++];
                    if (typeof outlet === 'string')
                        outlet=fdjtKB.ref(outlet);
                    if ((outlet instanceof Ref)&&(!(outlet._init)))
                        outlet.oninit(addOutlets2UI,"addOutlets2UI");
                    else loaded.push(outlet);}
                var cloud=Codex.outletCloud();
                i=0; lim=loaded.length; while (i<lim) {
                    var addoutlet=loaded[i++];
                    addOutlet2Cloud(addoutlet,cloud);}
                return;}}
        Codex.addOutlets2UI=addOutlets2UI;
        
        /* Initializing outlets */
        
        function addOutlet2Cloud(outlet,cloud) {
            if (typeof outlet === 'string')
                outlet=fdjtKB.load(outlet);
            var humid=outlet.humid;
            var sourcetag=fdjtID("cxOUTLET"+humid);
            if (!(sourcetag)) { // Add entry to the share cloud
                var completion=fdjtDOM(
                    "span.completion.source",outlet.name);
                completion.id="cxOUTLET"+humid;
                completion.setAttribute("value",outlet._id);
                completion.setAttribute("key",outlet.name);
                if ((outlet.description)&&(outlet.nick))
                    completion.title=outlet.name+": "+
                    outlet.description;
                else if (outlet.description)
                    completion.title=outlet.description;
                else if (outlet.nick) completion.title=outlet.name;
                fdjtDOM(cloud.dom,completion," ");
                if (cloud) cloud.addCompletion(completion);}}
        
        var cloudEntry=Codex.cloudEntry;

        function addTag2SearchCloud(tag){
            if (!(tag)) return;
            else if (tag instanceof Array) {
                var i=0; var lim=tag.length;
                while (i<lim) addTag2SearchCloud(tag[i++]);
                return;}
            else if (!(Codex.search_cloud)) {
                // If the HUD hasn't been initialized, add the tag
                //  to queues for addition.
                var queue=Codex.search_cloud_queue;
                if (!(queue)) queue=Codex.search_cloud_queue=[];
                queue.push(tag);}
            else if ((tag instanceof Ref)&&(!(tag._init)))
                // If it's uninitialized, delay adding it
                tag.oninit(addTag2SearchCloud,"addTag2SearchCloud");
            else {
                var search_cloud=Codex.searchCloud();
                var div=search_cloud.dom;
                var tagstring=((tag.tagString)?(tag.tagString()):(tag));
                var search_tag=
                    search_cloud.getByValue(tagstring,".completion");
                var container=div;
                var ref=((typeof tag === 'string')?
                         (fdjtKB.ref(tag,Codex.knodule)):
                         (tag));
                if (!(ref)) {
                    if (tag[0]==="\u00a7")
                        container=getChild(div,".sections")||container;
                    else container=getChild(div,".words")||div;}
                else if (ref.weak)
                    container=getChild(div,".weak");
                else if (ref.prime)
                    container=getChild(div,".prime");
                else if (ref.pool===Codex.sourcekb)
                    container=getChild(div,".sources");
                else {}
                if (!(container)) container=div;
                if (!((search_tag)&&(search_tag.length))) {
                    search_tag=Codex.cloudEntry(tag,Codex.knodule,false,true);
                    fdjtDOM(container,search_tag," ");
                    search_cloud.addCompletion(search_tag,false,tag);}}}
        Codex.addTag2SearchCloud=addTag2SearchCloud;


        /* This is used for viewport-based browser, where the HUD moves
           to be aligned with the viewport */
        
        function getBounds(elt){
            var style=fdjtDOM.getStyle(elt);
            return { top: fdjtDOM.parsePX(style.marginTop)||0+
                     fdjtDOM.parsePX(style.borderTop)||0+
                     fdjtDOM.parsePX(style.paddingTop)||0,
                     bottom: fdjtDOM.parsePX(style.marginBottom)||0+
                     fdjtDOM.parsePX(style.borderBottom)||0+
                     fdjtDOM.parsePX(style.paddingBottom)||0};}
        fdjtDOM.getBounds=getBounds;
        
        /* Creating the HUD */
        
        function setupTOC(root_info){
            var navhud=createNavHUD("div#CODEXTOC.hudpanel",root_info);
            var toc_button=fdjtID("CODEXTOCBUTTON");
            toc_button.style.visibility='';
            Codex.DOM.toc=navhud;
            fdjtDOM.replace("CODEXTOC",navhud);
            var flytoc=createStaticTOC("div#CODEXFLYTOC.hudpanel",root_info);
            Codex.Flytoc=flytoc;
            fdjtDOM.replace("CODEXFLYTOC",flytoc);}
        Codex.setupTOC=setupTOC;

        function createNavHUD(eltspec,root_info){
            var scan=root_info;
            while (scan) {
                if ((!(scan.sub))||(scan.sub.length===0)) break;
                else if (scan.sub.length>1) {
                    root_info=scan; break;}
                else scan=scan.sub[0];}
            var toc_div=Codex.TOC(root_info,0,false,"CODEXTOC4",true);
            var div=fdjtDOM(eltspec||"div#CODEXTOC.hudpanel",toc_div);
            Codex.UI.addHandlers(div,"toc");
            return div;}

        function createStaticTOC(eltspec,root_info){
            var toc_div=Codex.TOC(root_info,0,false,"CODEXFLYTOC4");
            var div=fdjtDOM(eltspec||"div#CODEXFLYTOC",toc_div);
            Codex.UI.addHandlers(div,"toc");
            return div;}

        /* HUD animation */

        function setHUD(flag,clearmode){
            if (typeof clearmode === 'undefined') clearmode=true;
            // clearmode=((Codex.mode!=='scanning')&&(Codex.mode!=='tocscan'));
            if ((Codex.Trace.gestures)||(Codex.Trace.mode))
                fdjtLog("setHUD %o mode=%o hudup=%o bc=%o hc=%o",
                        flag,Codex.mode,Codex.hudup,
                        document.body.className,
                        CodexHUD.className);
            if (flag) {
                Codex.hudup=true;
                addClass(document.body,"hudup");}
            else {
                Codex.hudup=false;
                Codex.scrolling=false;
                if (Codex.previewing) Codex.stopPreview();
                dropClass(document.body,"cxSHRINK");
                if (clearmode) {
                    dropClass(CodexHUD,"openheart");
                    dropClass(CodexHUD,"openhead");
                    dropClass(CodexHUD,"full");
                    dropClass(CodexHUD,CodexMode_pat);
                    Codex.mode=false;}
                dropClass(document.body,"hudup");
                document.body.focus();}}
        Codex.setHUD=setHUD;

        /* Mode controls */
        
        var CodexMode_pat=/\b((splash)|(device)|(sbooksapp)|(scanning)|(tocscan)|(search)|(searchresults)|(toc)|(glosses)|(allglosses)|(context)|(flytoc)|(about)|(console)|(minimal)|(addgloss)|(editexcerpt)|(gotoloc)|(gotopage))\b/g;
        var codexHeartMode_pat=/\b((device)|(sbooksapp)|(flytoc)|(glosses)|(about)|(console)|(search)|(searchresults)|(allglosses)|(login))\b/g;
        var codexHeadMode_pat=/\b((toc)|(search)|(searchresults)|(allglosses)|(addgloss)|(gotopage)|(gotoloc)|(tocscan))\b/g;
        var CodexSubMode_pat=/\b((glossaddtag)|(glossaddoutlet)|(glossaddlink)|(glosstagging)|(glosseditdetail))\b/g;
        var codex_mode_scrollers=
            {allglosses: "CODEXALLGLOSSES",
             searchresults: "CODEXSEARCHRESULTS",
             search: "CODEXSEARCHCLOUD",
             console: "CODEXCONSOLE",
             // sbooksapp: "SBOOKSAPP",
             device: "CODEXSETTINGS",
             flytoc: "CODEXFLYTOC",
             about: "CODEXABOUTBOOK"};
        var codex_mode_foci=
            {gotopage: "CODEXPAGEINPUT",
             gotoloc: "CODEXLOCINPUT",
             search: "CODEXSEARCHINPUT"};
        
        function CodexMode(mode,nohud){
            var oldmode=Codex.mode;
            if (typeof mode === 'undefined') return oldmode;
            if (mode==='last') mode=Codex.last_mode;
            if (mode==='none') mode=false;
            if (mode==='heart') mode=Codex.heart_mode||"about";
            if (Codex.Trace.mode)
                fdjtLog("CodexMode %o, cur=%o dbc=%o",
                        mode,Codex.mode,document.body.className);
            if ((mode!==Codex.mode)&&(Codex.previewing))
                Codex.stopPreview();
            if ((Codex.mode==="addgloss")&&(mode!=="addgloss")&&
                (hasClass("CODEXLIVEGLOSS","modified")))
                Codex.submitGloss(fdjt.ID("CODEXLIVEGLOSS"));
            if (mode) {
                if (mode==="addgloss") {}
                else dropClass(document.body,"cxSHRINK");
                if (mode===Codex.mode) {}
                else if (mode===true) {
                    /* True just puts up the HUD with no mode info */
                    if (codex_mode_foci[Codex.mode]) {
                        var input=fdjtID(codex_mode_foci[Codex.mode]);
                        input.blur();}
                    dropClass(CodexHUD,CodexMode_pat);
                    dropClass(CodexHUD,CodexSubMode_pat);
                    Codex.mode=false;
                    Codex.last_mode=true;}
                else if (typeof mode !== 'string') 
                    throw new Error('mode arg not a string');
                else {
                    if (codex_mode_foci[Codex.mode]) {
                        var modeinput=fdjtID(codex_mode_foci[Codex.mode]);
                        modeinput.blur();}
                    Codex.mode=mode;}
                // If we're switching to the inner app but the iframe
                //  hasn't been initialized, we do it now.
                if ((mode==="sbooksapp")&&
                    (!(fdjtID("SBOOKSAPP").src))&&
                    (!(Codex.appinit)))
                    initFlyleafApp();
                // Update Codex.scrolling which is the scrolling
                // element in the HUD for this mode
                if (typeof mode !== 'string')
                    Codex.scrolling=false;
                else if (codex_mode_scrollers[mode]) 
                    Codex.scrolling=(codex_mode_scrollers[mode]);
                else Codex.scrolling=false;

                // Scanning is a funny mode in that the HUD is down
                //  for it.  We handle all of this stuff here.
                if ((mode==='scanning')||
                    (mode==='tocscan')||
                    (mode==='status')) {
                    if (mode!==oldmode) {
                        Codex.hudup=false;
                        dropClass(CodexHUD,"openheart");
                        dropClass(CodexHUD,"full");
                        dropClass(document.body,"hudup");}}
                else if (mode==='addgloss') {}
                else if (nohud) {}
                // And if we're not scanning, we just raise the hud
                else setHUD(true);
                // Actually change the class on the HUD object
                if (mode===true) {
                    fdjtDOM.swapClass(CodexHUD,CodexMode_pat,"minimal");
                    dropClass(CodexHUD,"openhead");
                    dropClass(CodexHUD,"openheart");}
                else {
                    if (mode.search(codexHeartMode_pat)<0) {
                        dropClass(CodexHUD,"openheart");}
                    if (mode.search(codexHeadMode_pat)<0)
                        dropClass(CodexHUD,"openhead");
                    if (mode.search(codexHeartMode_pat)>=0) {
                        Codex.heart_mode=mode;
                        addClass(CodexHUD,"openheart");}
                    if (mode.search(codexHeadMode_pat)>=0) {
                        Codex.head_mode=mode;
                        addClass(CodexHUD,"openhead");}}
                
                changeMode(mode);}
            else {
                // Clearing the mode is a lot simpler, in part because
                //  setHUD clears most of the classes when it brings
                //  the HUD down.
                Codex.last_mode=Codex.mode;
                if (Codex.textinput) {
                    Codex.setFocus(false);}
                document.body.focus();
                dropClass(CodexHUD,"openheart");
                dropClass(CodexHUD,"openhead");
                dropClass(CodexHUD,CodexSubMode_pat);
                dropClass(document.body,"dimmed");
                dropClass(document.body,"codexhelp");
                dropClass(document.body,"cxPREVIEW");
                dropClass(document.body,"cxSHRINK");
                Codex.cxthelp=false;
                if (display_sync) Codex.displaySync();
                setHUD(false);}}

        function changeMode(mode){      
            fdjtDOM.dropClass(CodexHUD,CodexMode_pat);
            fdjtDOM.dropClass(CodexHUD,CodexSubMode_pat);
            fdjtDOM.addClass(CodexHUD,mode);
            // This updates scanning state
            if ((Codex.scanning)&&(mode!=="scanning")) {
                // Scroll the scanned content (glosses, search
                // results, etc) to reflect any motion
                var heart=Codex.DOM.heart;
                var height=heart.offsetHeight;
                var scanning=Codex.scanning;
                var content=getParent(scanning,".hudpanel");
                var scrolltop=content.scrollTop;
                var scrollbottom=content.scrollTop+height;
                var inner=getGeometry(scanning,content);
                
                if (inner.height<=0) {} /* Not displayed */
                else if ((inner.top<scrolltop)||(inner.bottom>scrollbottom)) {
                    // Scroll into view
                    if (inner.height>height) content.scrollTop=inner.top;
                    else if (inner.height>height/2)
                        content.scrollTop=Math.floor(inner.top-(height/2));
                    else {
                        var gap=height-inner.height;
                        content.scrollTop=Math.floor(inner.top-(gap/2));}}
                else {} // Already in view
                Codex.scanning=false;}
            
            // This updates scroller dimensions, we delay it
            //  because apparently, on some browsers, the DOM
            //  needs to catch up with CSS
            if ((Codex.scrolling)&&(!(Codex.scrolldivs))) {
                var scroller=fdjtID(Codex.scrolling);
                if (Codex.Trace.iscroll)
                    fdjtLog("Updating scroller for #%s s=%o",
                            Codex.scrolling,scroller);
                setTimeout(function(){updateScroller(scroller);},
                           2000);}
            
            // We autofocus any input element appropriate to the
            // mode
            if (codex_mode_foci[mode]) {
                var input=fdjtID(codex_mode_foci[mode]);
                if (input) Codex.setFocus(input);}
            else if (mode==="addgloss") {}
            // Moving the focus back to the body lets keys work
            else document.body.focus();
            
            if (mode==="allglosses") {
                if (Codex.point)
                    Codex.UI.scrollGlosses(
                        Codex.point,fdjt.ID("CODEXALLGLOSSES"));}
            else if (mode==="searchresults") {
                if (Codex.point)
                    Codex.UI.scrollGlosses(
                        Codex.point,fdjt.ID("CODEXSEARCHRESULTS"));}
            else {}
            if (display_sync) Codex.displaySync();}

        function fadeUpHUD(){
            fdjtLog("Setting properties");
            CodexHUD.style.opacity=0.001;
            setTimeout(function(){
                fdjtLog("Changing opacity");
                CodexHUD.style.opacity=1.00;
                setTimeout(function(){
                    fdjtLog("Clearing setup");
                    CodexHUD.style.opacity='';},
                           1500);},
                       1500);}
        Codex.fadeUpHUD=fadeUpHUD;

        function updateScroller(elt){
            if (Codex.scrolldivs) return;
            if ((elt)&&(Codex.Trace.scrolling))
                fdjtLog("Updating scroller for %o",elt);
            if (Codex.heartscroller) Codex.heartscroller.refresh();
            else {
                var heart=fdjtID("CODEXHEART");
                var contents=fdjtID("CODEXHEARTCONTENTS");
                if (!(contents)) {
                    contents=fdjtDOM("div#CODEXHEARTCONTENTS");
                    fdjtDOM(contents,fdjtDOM.Array(heart.childNodes));
                    fdjtDOM(heart,contents);}
                Codex.heartscroller=new iScroll(heart);
                Codex.heartscroller.refresh();}}
        Codex.UI.updateScroller=updateScroller;

        function CodexHUDToggle(mode,keephud){
            if (!(Codex.mode)) CodexMode(mode);
            else if (mode===Codex.mode)
                if (keephud) CodexMode(true); else CodexMode(false);
            else if ((mode==='heart')&&
                     (Codex.mode.search(codexHeartMode_pat)===0))
                if (keephud) CodexMode(true); else CodexMode(false);
            else CodexMode(mode);}
        CodexMode.toggle=CodexHUDToggle;

        Codex.dropHUD=function(){return CodexMode(false);};
        Codex.toggleHUD=function(evt){
            evt=evt||event;
            if ((evt)&&(fdjtUI.isClickable(fdjtUI.T(evt)))) return;
            fdjtLog("toggle HUD %o hudup=%o",evt,Codex.hudup);
            if (Codex.hudup) setHUD(false,false);
            else setHUD(true);};
        
        /* The App HUD */
        
        function fillinTabs(){
            var hidehelp=fdjtID("SBOOKHIDEHELP");
            var dohidehelp=fdjtState.getCookie("sbookhidehelp");
            var i=0, elts=null, elt=false;
            if (!(hidehelp)) {}
            else if (dohidehelp==='no') hidehelp.checked=false;
            else if (dohidehelp) hidehelp.checked=true;
            else hidehelp.checked=false;
            if (hidehelp)
                hidehelp.onchange=function(){
                    if (hidehelp.checked)
                        fdjtState.setCookie("sbookhidehelp",true,false,"/");
                    else fdjtState.setCookie("sbookhidehelp","no",false,"/");};
            var refuris=document.getElementsByName("REFURI");
            if (refuris) {
                i=0; var len=refuris.length;
                while (i<len)
                    if (refuris[i].value==='fillin')
                        refuris[i++].value=Codex.refuri;
                else i++;}
            fillinAboutInfo();
            /* Get various external APPLINK uris */
            var offlineuri=fdjtDOM.getLink("Codex.offline")||altLink("offline");
            var epuburi=fdjtDOM.getLink("Codex.epub")||altLink("ebub");
            var mobiuri=fdjtDOM.getLink("Codex.mobi")||altLink("mobi");
            var zipuri=fdjtDOM.getLink("Codex.mobi")||altLink("mobi");
            if (offlineuri) {
                elts=document.getElementsByName("SBOOKOFFLINELINK");
                i=0; while (i<elts.length) {
                    elt=elts[i++];
                    if (offlineuri!=='none') elt.href=offlineuri;
                    else {
                        elt.href=false;
                        addClass(elt,"deadlink");
                        elt.title='this sBook is not available offline';}}}
            if (epuburi) {
                elts=document.getElementsByName("SBOOKEPUBLINK");
                i=0; while (i<elts.length) {
                    elt=elts[i++];
                    if (epuburi!=='none') elt.href=epuburi;
                    else {
                        elt.href=false;
                        addClass(elt,"deadlink");
                        elt.title='this sBook is not available as an ePub';}}}
            if (mobiuri) {
                elts=document.getElementsByName("SBOOKMOBILINK");
                i=0; while (i<elts.length) {
                    elt=elts[i++];
                    if (mobiuri!=='none') elt.href=mobiuri;
                    else {
                        elt.href=false;
                        addClass(elt,"deadlink");
                        elt.title=
                            'this sBook is not available as a MOBIpocket format eBook';}}}
            if (zipuri) {
                elts=document.getElementsByName("SBOOKZIPLINK");
                i=0; while (i<elts.length) {
                    elt=elts[i++];
                    if (zipuri!=='none') elt.href=zipuri;
                    else {
                        elt.href=false;
                        addClass(elt,"deadlink");
                        elt.title=
                            'this sBook is not available as a ZIP bundle';}}}
            /* If the book is offline, don't bother showing the link
               to the offline version. */
            if (Codex.persist) addClass(document.body,"sbookoffline");}

        function altLink(type,uri){
            uri=uri||Codex.refuri;
            if (uri.search("http://")===0)
                return "http://offline."+uri.slice(7);
            else if (uri.search("https://")===0)
                return "https://offline."+uri.slice(8);
            else return false;}

        function _sbookFillTemplate(template,spec,content){
            if (!(content)) return;
            var elt=fdjtDOM.$(spec,template);
            if ((elt)&&(elt.length>0)) elt=elt[0];
            else return;
            if (typeof content === 'string')
                elt.innerHTML=fixStaticRefs(content);
            else if (content.cloneNode)
                fdjtDOM.replace(elt,content.cloneNode(true));
            else fdjtDOM(elt,content);}

        function fillinAboutInfo(){
            var about=fdjtID("CODEXABOUTBOOK");
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
                    fdjtDOM.getMeta("Codex.title")||
                    fdjtDOM.getMeta("SBOOK.title")||
                    fdjtDOM.getMeta("DC.title")||
                    fdjtDOM.getMeta("~TITLE")||
                    document.title;
                var byline=
                    fdjtID("SBOOKBYLINE")||fdjtID("SBOOKAUTHOR")||
                    fdjtDOM.getMeta("Codex.byline")||
                    fdjtDOM.getMeta("Codex.author")||
                    fdjtDOM.getMeta("SBOOK.byline")||
                    fdjtDOM.getMeta("SBOOK.author")||
                    fdjtDOM.getMeta("BYLINE")||
                    fdjtDOM.getMeta("AUTHOR");
                var copyright=
                    fdjtID("SBOOKCOPYRIGHT")||
                    fdjtDOM.getMeta("Codex.copyright")||
                    fdjtDOM.getMeta("Codex.rights")||
                    fdjtDOM.getMeta("SBOOK.copyright")||
                    fdjtDOM.getMeta("SBOOK.rights")||
                    fdjtDOM.getMeta("COPYRIGHT")||
                    fdjtDOM.getMeta("RIGHTS");
                var publisher=
                    fdjtID("SBOOKPUBLISHER")||
                    fdjtDOM.getMeta("Codex.publisher")||
                    fdjtDOM.getMeta("SBOOK.publisher")||                    
                    fdjtDOM.getMeta("PUBLISHER");
                var description=
                    fdjtID("SBOOKDESCRIPTION")||
                    fdjtDOM.getMeta("Codex.description")||
                    fdjtDOM.getMeta("SBOOK.description")||
                    fdjtDOM.getMeta("DESCRIPTION");
                var digitized=
                    fdjtID("SBOOKDIGITIZED")||
                    fdjtDOM.getMeta("Codex.digitized")||
                    fdjtDOM.getMeta("SBOOK.digitized")||
                    fdjtDOM.getMeta("DIGITIZED");
                var sbookified=fdjtID("SBOOK.converted")||
                    fdjtDOM.getMeta("SBOOK.converted");
                _sbookFillTemplate(about,".title",title);
                _sbookFillTemplate(about,".byline",byline);
                _sbookFillTemplate(about,".publisher",publisher);
                _sbookFillTemplate(about,".copyright",copyright);
                _sbookFillTemplate(about,".description",description);
                _sbookFillTemplate(about,".digitized",digitized);
                _sbookFillTemplate(about,".sbookified",sbookified);
                _sbookFillTemplate(about,".about",fdjtID("SBOOKABOUT"));
                var cover=fdjtDOM.getLink("cover");
                if (cover) {
                    var cover_elt=fdjtDOM.$(".cover",about)[0];
                    if (cover_elt) fdjtDOM(cover_elt,fdjtDOM.Image(cover));}}
            if (authorabout) fdjtDOM(about,authorabout);
            if (acknowledgements) {
                var clone=acknowledgements.cloneNode(true);
                clone.id=null;
                fdjtDOM(about,clone);}}

        var flyleaf_app_init=false;
        function initFlyleafApp(){
            if (flyleaf_app_init) return;
            if (Codex.appinit) return;
            var query=document.location.search||"?";
            var refuri=Codex.refuri;
            var appuri="https://"+Codex.server+"/flyleaf"+query;
            if (query.search("REFURI=")<0)
                appuri=appuri+"&REFURI="+encodeURIComponent(refuri);
            if (query.search("TOPURI=")<0)
                appuri=appuri+"&TOPURI="+
                encodeURIComponent(document.location.href);
            if (document.title) {
                appuri=appuri+"&DOCTITLE="+encodeURIComponent(document.title);}
            fdjtID("SBOOKSAPP").src=appuri;
            flyleaf_app_init=true;}
        Codex.initFlyleafApp=initFlyleafApp;

        CodexMode.selectApp=function(){
            if (Codex.mode==='sbooksapp') CodexMode(false);
            else CodexMode('sbooksapp');};

        /* Scanning */

        function CodexScan(elt,src,backward,expanded){
            var pelt=Codex.scanning;
            var i=0, lim=0;
            if (Codex.Trace.mode)
                fdjtLog("CodexScan() %o (src=%o) mode=%o scn=%o/%o",
                        elt,src,Codex.mode,Codex.scanning,Codex.target);
            // Copy the description of what we're scanning into the
            // scanner (at the top of the page during scanning and
            // preview)
            if (Codex.scanning!==src) {
                var clone=src.cloneNode(true);
                clone.id="CODEXSCAN";
                fdjtDOM.replace("CODEXSCAN",clone);
                // This all makes sure that the >| and |< buttons
                // appear appropriately
                if (Codex.nextSlice(src))
                    dropClass("CODEXHUD","scanend");
                else addClass("CODEXHUD","scanend");
                if (Codex.prevSlice(src))
                    dropClass("CODEXHUD","scanstart");
                else addClass("CODEXHUD","scanstart");
                // This marks where we are currently scanning
                if (pelt) dropClass(pelt,"codexscanpoint");
                if (src) addClass(src,"codexscanpoint");
                if (expanded) addClass("CODEXSCANNER","expanded");
                else dropClass("CODEXSCANNER","expanded");
                Codex.scanning=src;}
            else {}
            var highlights=[];
            if (Codex.target)
                Codex.clearHighlights(Codex.getDups(Codex.target));
            if ((src)&&(hasClass(src,"gloss"))) {
                var glossinfo=Codex.glosses.ref(src.name);
                if (glossinfo.excerpt) {
                    var searching=Codex.getDups(elt.id);
                    var range=Codex.findExcerpt(
                        searching,glossinfo.excerpt,glossinfo.exoff);
                    if (range) highlights=
                        fdjtUI.Highlight(range,"highlightexcerpt");}
                else addClass(fdjtID(src.about),"highlightpassage");}
            else if ((src)&&(getParent(src,".sbookresults"))) {
                var about=src.about, target=fdjtID(about);
                if (target) {
                    var info=Codex.docinfo[target.id];
                    var terms=Codex.query._query;
                    var spellings=info.knodeterms;
                    i=0; lim=terms.length;
                    if (lim===0) addClass(target,"highlightpassage");
                    else while (i<lim) {
                        var term=terms[i++];
                        var h=Codex.highlightTerm(term,target,info,spellings);
                        highlights=highlights.concat(h);}}}
            Codex.setTarget(elt);
            delete Codex.scanpoints;
            delete Codex.scanoff;
            if ((highlights)&&(highlights.length===1)&&
                (getParent(highlights[0],elt)))
                Codex.GoTo(elt,"Scan");
            else if ((highlights)&&(highlights.length)) {
                var possible=Codex.getDups(elt.id);
                if (possible.length) {
                    var scanpoints=[];
                    i=0; lim=possible.length;
                    while (i<lim) {
                        var poss=possible[i++];
                        var j=0, jlim=highlights.length;
                        while (j<jlim) {
                            if (getParent(highlights[j++],poss)) {
                                scanpoints.push(poss); break;}}}
                    if (scanpoints.length)
                        Codex.scanpoints=scanpoints;
                    else Codex.scanpoints=possible;
                    if (backward) 
                        Codex.scanoff=Codex.scanpoints.length-1;
                    else Codex.scanoff=0;
                    Codex.GoTo(Codex.scanpoints[Codex.scanoff]);}
                else Codex.GoTo(elt,"Scan");}
            else Codex.GoTo(elt,"Scan");
            CodexMode("scanning");}
        Codex.Scan=CodexScan;
        
        Codex.addConfig("uisize",function(name,value){
            fdjtDOM.swapClass(CodexHUD,/codexuifont\w+/,"codexuifont"+value);});
        Codex.addConfig("showconsole",function(name,value){
            if (value) addClass(CodexHUD,"codexshowconsole");
            else dropClass(CodexHUD,"codexshowconsole");});
        Codex.addConfig("animatecontent",function(name,value){
            if (Codex.dontanimate) {}
            else if (value) addClass(document.body,"cxANIMATE");
            else dropClass(Codex.page,"cxANIMATE");});
        Codex.addConfig("animatehud",function(name,value){
            if (Codex.dontanimate) {}
            else if (value) addClass(Codex.HUD,"cxANIMATE");
            else dropClass(Codex.HUD,"cxANIMATE");});

        /* Settings apply/save handlers */

        function getSettings(){
            var result={};
            var settings=fdjtID("CODEXSETTINGS");
            var layout=fdjtDOM.getInputValues(settings,"CODEXLAYOUT");
            result.layout=
                ((layout)&&(layout.length)&&(layout[0]))||false;
            var bodysize=fdjtDOM.getInputValues(settings,"CODEXBODYSIZE");
            if ((bodysize)&&(bodysize.length))
                result.bodysize=bodysize[0];
            var bodyfamily=fdjtDOM.getInputValues(settings,"CODEXBODYFAMILY");
            if ((bodyfamily)&&(bodyfamily.length))
                result.bodyfamily=bodyfamily[0];
            var uisize=fdjtDOM.getInputValues(settings,"CODEXUISIZE");
            if ((uisize)&&(uisize.length))
                result.uisize=uisize[0];
            var hidesplash=fdjtDOM.getInputValues(settings,"CODEXHIDESPLASH");
            result.hidesplash=((hidesplash)&&(hidesplash.length))||false;
            var showconsole=fdjtDOM.getInputValues(settings,"CODEXSHOWCONSOLE");
            result.showconsole=
                ((showconsole)&&(showconsole.length)&&(true))||false;
            var isoffline=fdjtDOM.getInputValues(settings,"CODEXLOCAL");
            result.persist=
                ((isoffline)&&(isoffline.length)&&(isoffline[0]))||false;
            var animatecontent=fdjtDOM.getInputValues(
                settings,"CODEXANIMATECONTENT");
            result.animatecontent=
                ((animatecontent)&&(animatecontent.length)&&
                 (animatecontent[0]))||
                false;
            var animatehud=fdjtDOM.getInputValues(
                settings,"CODEXANIMATEHUD");
            result.animatehud=
                ((animatehud)&&(animatehud.length)&&
                 (animatehud[0]))||
                false;
            
            return result;}

        Codex.UI.settingsUpdate=function(){
            var settings=getSettings();
            Codex.setConfig(settings);};

        Codex.UI.settingsSave=function(evt){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            var settings=getSettings();
            Codex.setConfig(settings);
            Codex.saveConfig(settings);
            fdjtDOM.replace("CODEXSETTINGSMESSAGE",
                            fdjtDOM("span#CODEXSETTINGSMESSAGE",
                                    "Your settings have been saved."));};

        Codex.UI.settingsReset=function(evt){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            Codex.setConfig(saved_config);
            fdjtDOM.replace("CODEXSETTINGSMESSAGE",
                            fdjtDOM("span#CODEXSETTINGSMESSAGE",
                                    "Your settings have been reset."));};

        Codex.UI.settingsOK=function(){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            var settings=getSettings();
            Codex.setConfig(settings);
            Codex.saveConfig(settings);
            fdjtDOM.replace("CODEXSETTINGSMESSAGE",
                            fdjtDOM("span#CODEXSETTINGSMESSAGE",
                                    "Your settings have been saved."));};
        
        Codex.UI.settingsCancel=function(){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            Codex.setConfig(Codex.getConfig());
            fdjtDOM.replace("CODEXSETTINGSMESSAGE",
                            fdjtDOM("span#CODEXSETTINGSMESSAGE",
                                    "Your changes have been discarded."));};

        /* Console methods */
        function console_eval(){
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

        function keyboardHelp(arg,force){
            if (arg===true) {
                if (Codex.keyboardHelp.timer) {
                    clearTimeout(Codex.keyboardHelp.timer);
                    Codex.keyboardHelp.timer=false;}
                dropClass("CODEXKEYBOARDHELPBOX","closing");
                dropClass("CODEXKEYBOARDHELPBOX","closed");
                return;}
            else if (arg===false) {
                if (Codex.keyboardHelp.timer) {
                    clearTimeout(Codex.keyboardHelp.timer);
                    Codex.keyboardHelp.timer=false;}
                addClass("CODEXKEYBOARDHELPBOX","closed");
                dropClass("CODEXKEYBOARDHELPBOX","closing");
                return;}
            if ((!force)&&(!(Codex.keyboardhelp))) return;
            if (typeof arg === 'string') arg=fdjtID(arg);
            if ((!(arg))||(!(arg.nodeType))) return;
            var box=fdjtID("CODEXKEYBOARDHELPBOX");
            var content=arg.cloneNode(true);
            content.id="CODEXKEYBOARDHELP";
            fdjtDOM.replace("CODEXKEYBOARDHELP",content);
            fdjtDOM.dropClass(box,"closed");
            Codex.keyboardHelp.timer=
                setTimeout(function(){
                    fdjtDOM.addClass(box,"closing");
                    Codex.keyboardHelp.timer=
                        setTimeout(function(){
                            Codex.keyboardHelp.timer=false;
                            fdjtDOM.swapClass(box,"closing","closed");},
                                   5000);},
                           5000);}
        Codex.keyboardHelp=keyboardHelp;

        /* Showing a particular gloss */

        Codex.showGloss=function showGloss(uuid){
            if (!(Codex.glosses.ref(uuid))) return false;
            var elts=document.getElementsByName(uuid);
            if (!(elts)) return false;
            else if (!(elts.length)) return false;
            else {
                var hasParent=fdjtDOM.hasParent;
                var i=0, lim=elts.length;
                while (i<lim) {
                    var src=elts[i++];
                    if (hasParent(src,allglosses)) {
                        var elt=fdjtID(src.about);
                        CodexMode("allglosses");
                        Codex.Scan(elt,src);
                        return true;}}
                return false;}};

        /* Setting/clearing help mode */
        Codex.hideHelp=function(){
            fdjtDOM.dropClass(document.body,"codexhelp");};
        Codex.showHelp=function(){
            fdjtDOM.addClass(document.body,"codexhelp");};

        return CodexMode;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
