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
/* jshint browser: true */
/* global Codex: false */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
// var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
// var Codex=((typeof Codex !== "undefined")?(Codex):({}));
// var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
// var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

Codex.setMode=
    (function(){
        "use strict";
        var fdjtString=fdjt.String;
        var fdjtState=fdjt.State;
        var fdjtTime=fdjt.Time;
        var fdjtLog=fdjt.Log;
        var fdjtDOM=fdjt.DOM;
        var fdjtUI=fdjt.UI;
        var fdjtID=fdjt.ID;
        
        // Helpful dimensions
        // Whether to call displaySync on mode changes
        var display_sync=false;
        
        var addClass=fdjtDOM.addClass;
        var dropClass=fdjtDOM.dropClass;
        var hasClass=fdjtDOM.hasClass;
        var getParent=fdjtDOM.getParent;
        var getGeometry=fdjtDOM.getGeometry;
        var hasSuffix=fdjtString.hasSuffix;

        var fixStaticRefs=Codex.fixStaticRefs;

        var CodexHUD=false;

        // This will contain the interactive input console (for debugging)
        var hud=false, input_console=false, input_button=false;
        var allglosses=false, sbooksapp=false, console=false;

        function initHUD(){
            if (fdjtID("CODEXHUD")) return;
            var messages=fdjtDOM("div#CODEXSTARTUPMESSAGES.startupmessages");
            messages.innerHTML=fixStaticRefs(Codex.HTML.messages);
            if (Codex.Trace.startup) fdjtLog("Initializing HUD layout");
            Codex.HUD=CodexHUD=hud=fdjtDOM("div#CODEXHUD");
            hud.codexui=true;
            hud.innerHTML=fixStaticRefs(Codex.HTML.hud);
            fdjtDOM.append(messages,
                           fdjtDOM("div.fdjtprogress#CODEXINDEXMESSAGE",
                                   fdjtDOM("div.indicator"),
                                   fdjtDOM("div.message")),
                           fdjtDOM("div.fdjtprogress#CODEXLAYOUTMESSAGE",
                                   fdjtDOM("div.indicator"),
                                   fdjtDOM("div.message")));
            fdjtDOM.prepend(document.body,messages,hud);
            // Move the page head and foot to reduce layers
            // var hudframe=fdjtID("CODEXHUDFRAME");
            // fdjtDOM.append(hudframe,Codex.pagehead,Codex.pagefoot);
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

            Codex.DOM.noteshud=fdjtID("CODEXNOTETEXT");
            Codex.DOM.asidehud=fdjtID("CODEXASIDE");

            // Initialize the pageinfo
            Codex.DOM.pageinfo=fdjtID("CODEXPAGEINFO");
            
            // Initialize search UI
            var search=fdjtID("CODEXSEARCH");
            search.innerHTML=fixStaticRefs(Codex.HTML.searchbox);
            addClass(Codex.HUD,"emptysearch");

            // Setup addgloss prototype
            var addgloss=fdjtID("CODEXADDGLOSSPROTOTYPE");
            addgloss.innerHTML=fixStaticRefs(Codex.HTML.addgloss);

            Codex.UI.addHandlers(hud,"hud");

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

            var return_to=fdjtID("SBOOK_RETURN_TO");
            if (return_to) return_to.value=location.href;

            // Initialize gloss UI
            Codex.DOM.allglosses=fdjtID("CODEXALLGLOSSES");
            if (Codex.Trace.startup>1)
                fdjtLog("Setting up gloss UI %o",allglosses);

            Codex.glosses=allglosses=new Codex.Slice(Codex.DOM.allglosses);
            Codex.glossdb.onAdd("maker",function(f,p,v){
                Codex.sourcedb.ref(v).oninit
                (Codex.UI.addGlossSource,"newsource");});
            Codex.glossdb.onAdd("sources",function(f,p,v){
                Codex.sourcedb.ref(v).oninit
                (Codex.UI.addGlossSource,"newsource");});
            Codex.glossdb.onLoad(addGloss2UI);
            
            Codex.DOM.console=console=fdjtID("CODEXCONSOLE");
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
                        setMode("sbooksapp");}
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

            Codex.scrollers={};

            /* Setup clouds */
            var dom_gloss_cloud=fdjtID("CODEXGLOSSCLOUD");
            Codex.gloss_cloud=
                new fdjtUI.Completions(
                    dom_gloss_cloud,fdjtID("CODEXTAGINPUT"),
                    fdjtUI.FDJT_COMPLETE_OPTIONS|
                        fdjtUI.FDJT_COMPLETE_CLOUD|
                        fdjtUI.FDJT_COMPLETE_ANYWORD);
            updateScroller("CODEXGLOSSCLOUD");

            Codex.empty_cloud=
                new fdjtUI.Completions(
                    fdjtID("CODEXALLTAGS"),false,
                    fdjtUI.FDJT_COMPLETE_OPTIONS|
                        fdjtUI.FDJT_COMPLETE_CLOUD|
                        fdjtUI.FDJT_COMPLETE_ANYWORD);
            Codex.DOM.empty_cloud=fdjtID("CODEXALLTAGS");
            updateScroller("CODEXALLTAGS");
            
            var dom_share_cloud=fdjtID("CODEXSHARECLOUD");
            Codex.share_cloud=
                new fdjtUI.Completions(
                    dom_share_cloud,fdjtID("CODEXTAGINPUT"),
                    fdjtUI.FDJT_COMPLETE_OPTIONS|
                        fdjtUI.FDJT_COMPLETE_CLOUD|
                        fdjtUI.FDJT_COMPLETE_ANYWORD);
            Codex.DOM.share_cloud=dom_share_cloud;
            updateScroller("CODEXSHARECLOUD");

            if (Codex.Trace.startup) fdjtLog("Updating scrollers");
            fdjtDOM.setupCustomInputs(fdjtID("CODEXHUD"));

            if (Codex.Trace.startup)
                fdjtLog("Initialized basic HUD layout");}
        Codex.initHUD=initHUD;
        
        function resizeHUD(){}
        Codex.resizeHUD=resizeHUD;

        /* Various UI methods */
        function addGloss2UI(item){
            if (document.getElementById(item.frag)) {
                var addGlossmark=Codex.UI.addGlossmark;
                allglosses.addCards(item);
                var nodes=Codex.getDups(item.frag);
                addClass(nodes,"glossed");
                var i=0, lim=nodes.length; while (i<lim) {
                    addGlossmark(nodes[i++],item);}
                if (item.tstamp>Codex.syncstamp)
                    Codex.syncstamp=item.tstamp;}}

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
            var statictoc=createStaticTOC("div#CODEXSTATICTOC.hudpanel",root_info);
            Codex.Statictoc=statictoc;
            fdjtDOM.replace("CODEXSTATICTOC",statictoc);}
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
            var scan=root_info;
            while (scan) {
                if ((!(scan.sub))||(scan.sub.length===0)) break;
                else if (scan.sub.length>1) {
                    root_info=scan; break;}
                else scan=scan.sub[0];}
            var toc_div=Codex.TOC(scan,0,false,"CODEXSTATICTOC4");
            var div=fdjtDOM(eltspec||"div#CODEXSTATICTOC",toc_div);
            Codex.UI.addHandlers(div,"toc");
            div.title=
                "Tap a section to jump there directly; press and hold to see (glimpse) it temporarily; while glimpsing, tap (or press a key) to jump to where you're looking.";
            return div;}

        /* HUD animation */

        function setHUD(flag,clearmode){
            if (typeof clearmode === 'undefined') clearmode=true;
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
                if (Codex.previewing) Codex.stopPreview("setHUD");
                dropClass(document.body,"cxSHRINK");
                if (clearmode) {
                    if (Codex.popmode) {
                        var fn=Codex.popmode;
                        Codex.popmode=false;
                        fn();}
                    dropClass(CodexHUD,"openheart");
                    dropClass(CodexHUD,"openhead");
                    dropClass(CodexHUD,"full");
                    dropClass(CodexHUD,CodexModes);
                    dropClass(document.body,"codexscanning");
                    dropClass(document.body,"codexscanstart");
                    dropClass(document.body,"codexscanend");
                    Codex.mode=false;}
                dropClass(document.body,"hudup");
                document.body.focus();}}
        Codex.setHUD=setHUD;

        /* Mode controls */
        
        var CodexModes=/\b((splash)|(device)|(sbooksapp)|(scanning)|(tocscan)|(search)|(refinesearch)|(expandsearch)|(searchresults)|(overtoc)|(openglossmark)|(allglosses)|(context)|(statictoc)|(about)|(console)|(minimal)|(addgloss)|(gotoloc)|(gotopage)|(shownote)|(showaside)|(glossdetail)|(login))\b/g;
        var codexHeartModes=/\b((device)|(sbooksapp)|(statictoc)|(about)|(console)|(search)|(refinesearch)|(expandsearch)|(searchresults)|(allglosses)|(login)|(showaside)|(glossdetail))\b/g;
        var codexHeadModes=/\b((overtoc)|(search)|(refinesearch)|(expandsearch)|(searchresults)|(allglosses)|(addgloss)|(tocscan)|(shownote))\b/g;
        var CodexSubModes=/\b((glossaddtag)|(glossaddoutlet)|(glossaddlink)|(glosstagging)|(glosseditdetail))\b/g;
        var CodexBodyModes=/\b((addgloss)|(openglossmark)|(shownote)|(showaside))\b/g;
        var CodexPopModes=/\b((glossdetail))\b/g;
        var codex_mode_scrollers=
            {allglosses: "CODEXALLGLOSSES",
             searchresults: "CODEXSEARCHRESULTS",
             expandsearch: "CODEXALLTAGS",
             search: "CODEXSEARCHCLOUD",
             refinesearch: "CODEXSEARCHCLOUD",
             console: "CODEXCONSOLE",
             openglossmark: "CODEXPOINTGLOSSES",
             // sbooksapp: "SBOOKSAPP",
             device: "CODEXSETTINGS",
             statictoc: "CODEXSTATICTOC",
             about: "CODEXABOUTBOOK"};
        var codex_mode_foci=
            {gotopage: "CODEXPAGEINPUT",
             gotoloc: "CODEXLOCINPUT",
             search: "CODEXSEARCHINPUT",
             refinesearch: "CODEXSEARCHINPUT",
             expandsearch: "CODEXSEARCHINPUT"};
        
        function setMode(mode,nohud){
            var oldmode=Codex.mode;
            if (typeof mode === 'undefined') return oldmode;
            if (mode==='last') mode=Codex.last_mode;
            if ((!(mode))&&(Codex.mode)&&(CodexPopModes.test(Codex.mode)))
                mode=Codex.last_mode;
            if (mode==='none') mode=false;
            if (mode==='heart') mode=Codex.heart_mode||"about";
            if (Codex.Trace.mode)
                fdjtLog("setMode %o, cur=%o dbc=%o",
                        mode,Codex.mode,document.body.className);
            if ((mode!==Codex.mode)&&(Codex.previewing))
                Codex.stopPreview("setMode");
            if ((mode!==Codex.mode)&&(Codex.popmode)) {
                var fn=Codex.popmode;
                Codex.popmode=false;
                fn();}
            if ((Codex.mode==="addgloss")&&(mode!=="addgloss")&&
                (hasClass("CODEXLIVEGLOSS","modified")))
                Codex.submitGloss(fdjt.ID("CODEXLIVEGLOSS"));
            if (mode) {
                if (mode==="search") mode=Codex.search_mode||"refinesearch";
                if (mode==="addgloss") {}
                else dropClass(document.body,"cxSHRINK");
                if (mode===Codex.mode) {}
                else if (mode===true) {
                    /* True just puts up the HUD with no mode info */
                    if (codex_mode_foci[Codex.mode]) {
                        var input=fdjtID(codex_mode_foci[Codex.mode]);
                        input.blur();}
                    dropClass(CodexHUD,CodexModes);
                    dropClass(CodexHUD,CodexSubModes);
                    Codex.mode=false;
                    Codex.last_mode=true;}
                else if (typeof mode !== 'string') 
                    throw new Error('mode arg not a string');
                else {
                    if (codex_mode_foci[Codex.mode]) {
                        var modeinput=fdjtID(codex_mode_foci[Codex.mode]);
                        modeinput.blur();}
                    if (mode!==Codex.mode) Codex.last_mode=Codex.mode;
                    Codex.mode=mode;}
                // If we're switching to the inner app but the iframe
                //  hasn't been initialized, we do it now.
                if (((mode==="sbooksapp")||(mode==="login"))&&
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

                if ((mode==='refinesearch')||
                    (mode==='searchresults')||
                    (mode==='expandsearch'))
                    Codex.search_mode=mode;

                if ((mode==='scanning')||(mode==='tocscan'))
                    addClass(document.body,"codexscanning");
                else dropClass(document.body,/\b(codexscan[a-z0-9]*)\b/);

                // These are modes that require the HUD to be down
                if ((mode==='scanning')||(mode==='tocscan')) {
                    if (mode!==oldmode) {
                        Codex.hudup=false;
                        dropClass(CodexHUD,"openheart");
                        dropClass(CodexHUD,"full");
                        dropClass(document.body,"hudup");}}
                else if ((mode==='addgloss')||(mode==="openglossmark")) {}
                else if (nohud) {}
                // And if we're not scanning, we just raise the hud
                else setHUD(true);
                // Actually change the class on the HUD object
                if (mode===true) {
                    dropClass(CodexHUD,"openhead");
                    dropClass(CodexHUD,"openheart");
                    fdjtDOM.swapClass(CodexHUD,CodexModes,"minimal");}
                else {
                    if (mode.search(codexHeartModes)<0) {
                        dropClass(CodexHUD,"openheart");}
                    if (mode.search(codexHeadModes)<0)
                        dropClass(CodexHUD,"openhead");
                    if (mode.search(codexHeartModes)>=0) {
                        Codex.heart_mode=mode;
                        addClass(CodexHUD,"openheart");}
                    if (mode.search(codexHeadModes)>=0) {
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
                dropClass(document.body,"dimmed");
                dropClass(document.body,"codexhelp");
                dropClass(document.body,"cxPREVIEW");
                dropClass(document.body,"cxSHRINK");
                Codex.cxthelp=false;
                if (display_sync) Codex.displaySync();
                if (CodexBodyModes.test(oldmode)) {
                    dropClass(CodexHUD,CodexSubModes);
                    setHUD(false);}
                else setTimeout(function(){
                    if (Codex.mode===oldmode) {
                        dropClass(CodexHUD,CodexSubModes);
                        setHUD(false);}},500);}}
        
        function changeMode(mode){      
            fdjtDOM.dropClass(CodexHUD,CodexModes);
            fdjtDOM.dropClass(CodexHUD,CodexSubModes);
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
                else {}} // Already in view
            else if (mode==="statictoc") {
                var headinfo=((Codex.head)&&(Codex.head.id)&&
                             (Codex.docinfo[Codex.head.id]));
                var hhinfo=headinfo.head, pinfo=headinfo.prev;
                var static_head=fdjt.ID("CODEXSTATICTOC4"+headinfo.frag);
                var static_hhead=((hhinfo)&&(fdjt.ID("CODEXSTATICTOC4"+hhinfo.frag)));
                var static_phead=((pinfo)&&(fdjt.ID("CODEXSTATICTOC4"+pinfo.frag)));
                if ((static_head)&&(static_head.scrollIntoView)) {
                    if (static_hhead) static_hhead.scrollIntoView();
                    if ((static_phead)&&(static_phead.scrollIntoViewIfNeeded))
                        static_phead.scrollIntoViewIfNeeded();
                    if (static_head.scrollIntoViewIfNeeded)
                        static_head.scrollIntoViewIfNeeded();
                    else static_head.scrollIntoView();}}
            else if (mode==="allglosses") {
                var curloc=Codex.location;
                var allcards=Codex.DOM.allglosses.childNodes;
                var i=0, lim=allcards.length;
                var card=false, lastcard=false, lasthead=false;
                while (i<lim) {
                    var each=allcards[i++];
                    if (each.nodeType!==1) continue;
                    lastcard=card; card=each;
                    if (hasClass(card,"newhead")) lasthead=card;
                    var loc=card.getAttribute("data-location");
                    if (loc) loc=parseInt(loc,10);
                    if (loc>curloc) break;}
                if (i>=lim) card=lastcard=false;
                if ((lastcard)&&(lasthead)&&(card.scrollIntoViewIfNeeded)) {
                    lasthead.scrollIntoView();
                    lastcard.scrollIntoViewIfNeeded();}
                else if ((lastcard)&&(lastcard.scrollIntoView))
                    lastcard.scrollIntoView();}
            else {}
            
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
                if ((Codex.scanning)||(Codex.point))
                    Codex.UI.scrollGlosses(Codex.scanning||Codex.point,Codex.glosses);}
            else if (mode==="searchresults") {
                if ((Codex.scanning)||(Codex.point))
                    Codex.UI.scrollGlosses(Codex.scanning||Codex.point,Codex.query.listing);}
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
            /* jshint newcap: false */
            if (Codex.scrolldivs) return;
            if ((elt)&&(Codex.Trace.scrolling))
                fdjtLog("Updating scroller for %o",elt);
            if (Codex.heartscroller) Codex.heartscroller.refresh();
            else {
                var heart=fdjtID("CODEXHEART");
                var contents=fdjtID("CODEXHEARTCONTENT");
                if (!(contents)) {
                    contents=fdjtDOM("div#CODEXHEARTCONTENT");
                    fdjtDOM(contents,fdjtDOM.Array(heart.childNodes));
                    fdjtDOM(heart,contents);}
                Codex.heartscroller=new iScroll(heart);
                Codex.heartscroller.refresh();}}
        Codex.UI.updateScroller=updateScroller;

        function CodexHUDToggle(mode,keephud){
            if (!(Codex.mode)) setMode(mode);
            else if (mode===Codex.mode)
                if (keephud) setMode(true); else setMode(false);
            else if ((mode==='heart')&&
                     (Codex.mode.search(codexHeartModes)===0))
                if (keephud) setMode(true); else setMode(false);
            else setMode(mode);}
        Codex.toggleMode=CodexHUDToggle;

        Codex.dropHUD=function(){return setMode(false);};
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
            if (Codex.user) {
                appuri=appuri+"&BOOKUSER="+encodeURIComponent(Codex.user._id);}
            fdjtID("SBOOKSAPP").src=appuri;
            flyleaf_app_init=true;}
        Codex.initFlyleafApp=initFlyleafApp;

        Codex.selectApp=function(){
            if (Codex.mode==='sbooksapp') setMode(false);
            else setMode('sbooksapp');};

        /* Scanning */


        function CodexScan(elt,src,backward,expanded){
            var nextSlice=Codex.nextSlice, prevSlice=Codex.prevSlice;
            var pelt=Codex.scanning;
            var i=0, lim=0;
            if (Codex.Trace.mode)
                fdjtLog("CodexScan() %o (src=%o) mode=%o scn=%o/%o",
                        elt,src,Codex.mode,Codex.scanning,Codex.target);
            // Copy the description of what we're scanning into the
            // scanner (at the top of the page during scanning and
            // preview)
            if (Codex.scanning!==src) {
                var clone=src.cloneNode(true); clone.id="CODEXSCAN";
                var next=nextSlice(src), prev=prevSlice(src);
                var before=0, after=0, slice=prev;
                fdjtDOM.replace("CODEXSCAN",clone);
                // This all makes sure that the >| and |< buttons
                // appear appropriately
                if (next) dropClass(document.body,"codexscanend");
                else addClass(document.body,"codexscanend");
                if (prev) dropClass(document.body,"codexscanstart");
                else addClass(document.body,"codexscanstart");
                while (slice) {before++; slice=prevSlice(slice);}
                slice=next; while (slice) {
                    after++; slice=nextSlice(slice);}
                var scaninfo=fdjtID("CODEXSCANINFO");
                scaninfo.innerHTML=(before+1)+"/"+(before+after+1);
                // This marks where we are currently scanning
                if (pelt) dropClass(pelt,"codexscanpoint");
                if (src) addClass(src,"codexscanpoint");
                if (typeof expanded === "undefined") {}
                else if (expanded) addClass("CODEXSCANNER","expanded");
                else dropClass("CODEXSCANNER","expanded");
                Codex.scanning=src;}
            else {}
            var highlights=[];
            if (Codex.target)
                Codex.clearHighlights(Codex.getDups(Codex.target));
            Codex.setTarget(elt);
            if ((src)&&(hasClass(src,"gloss"))) {
                var glossinfo=Codex.glossdb.ref(src.name);
                if (glossinfo.excerpt) {
                    var searching=Codex.getDups(elt.id);
                    var range=Codex.findExcerpt(
                        searching,glossinfo.excerpt,glossinfo.exoff);
                    if (range) highlights=
                        fdjtUI.Highlight(range,"codexhighlightexcerpt");}
                else addClass(Codex.getDups(src.about),"codexhighlightpassage");}
            else if ((src)&&(getParent(src,".sbookresults"))) {
                var about=src.about, target=fdjtID(about);
                if (target) {
                    var info=Codex.docinfo[target.id];
                    var terms=Codex.query.tags;
                    var spellings=info.knodeterms;
                    i=0; lim=terms.length;
                    if (lim===0)
                        addClass(Codex.getDups(target),"codexhighlightpassage");
                    else while (i<lim) {
                        var term=terms[i++];
                        var h=Codex.highlightTerm(term,target,info,spellings);
                        highlights=highlights.concat(h);}}}
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
            setMode("scanning");}
        Codex.Scan=CodexScan;
        function stopScanning(){
            // Tapping the tochead returns to results/glosses/etc
            var scanning=Codex.scanning;
            if (!(scanning)) return;
            if (getParent(scanning,fdjtID("CODEXALLGLOSSES"))) 
                Codex.setMode("allglosses");
            else if (getParent(scanning,fdjtID("CODEXSEARCHRESULTS"))) 
                Codex.setMode("searchresults");
            else {}}
        Codex.stopScanning=stopScanning;
        
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
            Codex.resetConfig();
            fdjtDOM.replace("CODEXSETTINGSMESSAGE",
                            fdjtDOM("span#CODEXSETTINGSMESSAGE",
                                    "Your settings have been reset."));};

        Codex.UI.settingsOK=function(evt){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            var settings=getSettings();
            Codex.setConfig(settings);
            Codex.saveConfig(settings);
            fdjtDOM.replace("CODEXSETTINGSMESSAGE",
                            fdjtDOM("span#CODEXSETTINGSMESSAGE",
                                    "Your settings have been saved."));};
        
        Codex.UI.settingsCancel=function(evt){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            Codex.setConfig(Codex.getConfig());
            fdjtDOM.replace("CODEXSETTINGSMESSAGE",
                            fdjtDOM("span#CODEXSETTINGSMESSAGE",
                                    "Your changes have been discarded."));};

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
            if (!(Codex.glossdb.ref(uuid))) return false;
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
                        setMode("allglosses");
                        Codex.Scan(elt,src);
                        return true;}}
                return false;}};

        /* Setting/clearing help mode */
        Codex.hideHelp=function(){
            fdjtDOM.dropClass(document.body,"codexhelp");};
        Codex.showHelp=function(){
            fdjtDOM.addClass(document.body,"codexhelp");};

        return setMode;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
