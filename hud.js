/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/hud.js ###################### */

/* Copyright (C) 2009-2014 beingmeta, inc.

   This file provides initialization and some interaction for the
   metaBook HUD (Heads Up Display), an layer on the book content
   provided by the metaBook e-reader web application.

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
/* global metaBook: false */

/* Initialize these here, even though they should always be
   initialized before hand.  This will cause various code checkers to
   not generate unbound variable warnings when called on individual
   files. */
// var fdjt=((typeof fdjt !== "undefined")?(fdjt):({}));
// var metaBook=((typeof metaBook !== "undefined")?(metaBook):({}));
// var Knodule=((typeof Knodule !== "undefined")?(Knodule):({}));
// var iScroll=((typeof iScroll !== "undefined")?(iScroll):({}));

metaBook.setMode=
    (function(){
        "use strict";

        var fdjtString=fdjt.String;
        var fdjtTime=fdjt.Time;
        var fdjtState=fdjt.State;
        var fdjtLog=fdjt.Log;
        var fdjtDOM=fdjt.DOM;
        var fdjtUI=fdjt.UI;
        var fdjtID=fdjt.ID;
        var TapHold=fdjtUI.TapHold;

        var mB=metaBook;
        var mbID=mB.ID;
        
        // Helpful dimensions
        // Whether to call displaySync on mode changes
        var display_sync=false;
        
        var addClass=fdjtDOM.addClass;
        var dropClass=fdjtDOM.dropClass;
        var hasClass=fdjtDOM.hasClass;
        var getParent=fdjtDOM.getParent;
        var hasSuffix=fdjtString.hasSuffix;

        var fixStaticRefs=mB.fixStaticRefs;

        var metaBookHUD=false;
        var metaBookMedia=false;

        // This will contain the interactive input console (for debugging)
        var frame=false, hud=false, media=false;
        var allglosses=false, sbooksapp=false;

        function initHUD(){
            if (fdjtID("METABOOKHUD")) return;
            var started=fdjtTime();
            var messages=fdjtDOM("div#METABOOKSTARTUPMESSAGES.startupmessages");
            messages.innerHTML=fixStaticRefs(mB.HTML.messages);
            if (mB.Trace.startup>2) fdjtLog("Initializing HUD layout");
            mB.HUD=metaBookHUD=hud=fdjtDOM("div#METABOOKHUD");
            mB.Media=metaBookMedia=media=fdjtDOM("div#METABOOKMEDIA");
            hud.metabookui=true; media.metabookui=true;
            hud.innerHTML=fixStaticRefs(mB.HTML.hud);
            fdjtDOM.append(messages);
            if (fdjtID("METABOOKFRAME")) frame=fdjtID("METABOOKFRAME");
            else {
                frame=fdjtDOM("#METABOOKFRAME");
                fdjtDOM.prepend(document.body,frame);}
            frame.appendChild(messages); frame.appendChild(hud);
            frame.appendChild(media);
            mB.Frame=frame;
            // Fill in the HUD help
            var hudhelp=fdjtID("METABOOKHUDHELP");
            hudhelp.innerHTML=fixStaticRefs(mB.HTML.hudhelp);
            // Fill in the HUD help
            var helptext=fdjtID("METABOOKAPPHELP");
            helptext.innerHTML=fixStaticRefs(mB.HTML.help);
            // Setup heart
            var heart=fdjtID("METABOOKHEART");
            heart.innerHTML=fixStaticRefs(mB.HTML.heart);
            mB.DOM.heart=heart;
            // Other HUD parts
            mB.DOM.top=fdjtID("METABOOKTOP");
            mB.DOM.heart=fdjtID("METABOOKHEART");
            mB.DOM.head=fdjtID("METABOOKHEAD");
            mB.DOM.foot=fdjtID("METABOOKFOOT");
            mB.DOM.tabs=fdjtID("METABOOKTABS");

            mB.DOM.noteshud=fdjtID("METABOOKNOTETEXT");
            mB.DOM.asidehud=fdjtID("METABOOKASIDE");

            // Initialize the pagebar
            mB.DOM.pagebar=fdjtID("METABOOKPAGEBAR");
            
            // Initialize search UI
            var search=fdjtID("METABOOKSEARCH");
            search.innerHTML=fixStaticRefs(mB.HTML.searchbox);
            addClass(mB.HUD,"emptysearch");

            // Setup addgloss prototype
            var addgloss=fdjtID("METABOOKADDGLOSSPROTOTYPE");
            addgloss.innerHTML=fixStaticRefs(mB.HTML.addgloss);

            mB.UI.addHandlers(hud,"hud");

            if (mB.Trace.startup>2) fdjtLog("Done with HUD initialization");

            if (!(mB.svg)) {
                var images=fdjtDOM.getChildren(hud,"img");
                var i=0; var lim=images.length;
                if (mB.Trace.startup) fdjtLog("Switching images to SVG");
                while (i<lim) {
                    var img=images[i++];
                    if ((img.src)&&
                        ((hasSuffix(img.src,".svg"))||
                         (hasSuffix(img.src,".svgz")))&&
                        (img.getAttribute('bmp')))
                        img.src=img.getAttribute('bmp');}}

            mB.hudtick=fdjtTime();

            fdjtDOM.setInputs(".bmrefuri",mB.refuri);
            fdjtDOM.setInputs(".bmdocuri",mB.docuri);
            fdjtDOM.setInputs(".bmtopuri",mB.topuri);
            
            // Initialize gloss UI
            mB.DOM.allglosses=fdjtID("METABOOKALLGLOSSES");
            if ((mB.Trace.startup>2)&&(mB.DOM.allglosses))
                fdjtLog("Setting up gloss UI %o",allglosses);

            mB.glosses=allglosses=new mB.Slice(mB.DOM.allglosses);
            mB.glossdb.onAdd("maker",function(f,p,v){
                mB.sourcedb.ref(v).oninit
                (mB.UI.addGlossSource,"newsource");});
            mB.glossdb.onAdd("sources",function(f,p,v){
                mB.sourcedb.ref(v).oninit
                (mB.UI.addGlossSource,"newsource");});
            mB.glossdb.onLoad(addGloss2UI);
            
            function messageHandler(evt){
                var origin=evt.origin;
                if (mB.Trace.messages)
                    fdjtLog("Got a message from %s with payload %s",
                            origin,evt.data);
                if (origin.search(/https:\/\/[^\/]+.sbooks.net/)!==0) {
                    fdjtLog.warn("Rejecting insecure message from %s",
                                 origin);
                    return;}
                if (evt.data==="sbooksapp") {
                    setMode("sbooksapp");}
                else if (evt.data==="loggedin") {
                    if (!(mB.user)) {
                        mB.userSetup();}}
                else if (evt.data.search("setuser=")===0) {
                    if (!(mB.user)) {
                        mB.userinfo=JSON.parse(evt.data.slice(8));
                        mB.loginUser(mB.userinfo);
                        mB.setMode("welcome");
                        mB.userSetup();}}
                else if (evt.data)
                    fdjtDOM("METABOOKINTRO",evt.data);
                else {}}
            var appframe=sbooksapp;
            var appwindow=((appframe)&&(appframe.contentWindow));
            if (appwindow.postMessage) {
                if (mB.Trace.messages)
                    fdjtLog("Setting up message listener");
                fdjtDOM.addListener(window,"message",messageHandler);}
            
            mB.TapHold.foot=
                new fdjtUI.TapHold(
                    mB.DOM.foot,
                    {override: true,holdfast: true,taptapthresh: 0,
                     holdthresh: 500});
            mB.TapHold.head=
                new fdjtUI.TapHold(mB.DOM.head,
                                   {override: true,taptapthresh: 0});
            mB.DOM.skimmer=fdjtID("METABOOKSKIMMER");
            mB.TapHold.skimmer=new TapHold(mB.DOM.skimmer);
            
            var help=mB.DOM.help=fdjtID("METABOOKHELP");
            help.innerHTML=fixStaticRefs(mB.HTML.help);

            resizeHUD();

            metaBook.scrollers={};

            /* Setup clouds */
            var dom_gloss_cloud=fdjtID("METABOOKGLOSSCLOUD");
            metaBook.gloss_cloud=
                new fdjtUI.Completions(
                    dom_gloss_cloud,fdjtID("METABOOKTAGINPUT"),
                    fdjtUI.FDJT_COMPLETE_OPTIONS|
                        fdjtUI.FDJT_COMPLETE_CLOUD|
                        fdjtUI.FDJT_COMPLETE_ANYWORD);
            updateScroller("METABOOKGLOSSCLOUD");
            mB.TapHold.gloss_cloud=new TapHold(mB.gloss_cloud.dom);

            metaBook.empty_cloud=
                new fdjtUI.Completions(
                    fdjtID("METABOOKALLTAGS"),false,
                    fdjtUI.FDJT_COMPLETE_OPTIONS|
                        fdjtUI.FDJT_COMPLETE_CLOUD|
                        fdjtUI.FDJT_COMPLETE_ANYWORD);
            if (mB.adjustCloudFont)
                mB.empty_cloud.updated=function(){
                    mB.adjustCloudFont(this);};
            mB.DOM.empty_cloud=fdjtID("METABOOKALLTAGS");
            updateScroller("METABOOKALLTAGS");
            mB.TapHold.empty_cloud=new TapHold(mB.empty_cloud.dom);
            
            var dom_share_cloud=fdjtID("METABOOKSHARECLOUD");
            metaBook.share_cloud=
                new fdjtUI.Completions(
                    dom_share_cloud,fdjtID("METABOOKTAGINPUT"),
                    fdjtUI.FDJT_COMPLETE_OPTIONS|
                        fdjtUI.FDJT_COMPLETE_CLOUD|
                        fdjtUI.FDJT_COMPLETE_ANYWORD);
            mB.DOM.share_cloud=dom_share_cloud;
            updateScroller("METABOOKSHARECLOUD");
            mB.TapHold.share_cloud=new TapHold(mB.share_cloud.dom);

            fdjtDOM.setupCustomInputs(fdjtID("METABOOKHUD"));

            if (mB.Trace.startup>1)
                fdjtLog("Initialized basic HUD in %dms",fdjtTime()-started);}
        metaBook.initHUD=initHUD;
        
        function resizeHUD(){
            var view_height=fdjtDOM.viewHeight();
            fdjtID("METABOOKHEART").style.maxHeight=(view_height-100)+'px';
            fdjt.DOM.tweakFonts(mB.HUD);}
        metaBook.resizeHUD=resizeHUD;

        /* Various UI methods */
        function addGloss2UI(item){
            if (!(item.frag)) {
                fdjtLog.warn("Warning: skipping gloss %o with no fragment identifier",
                             item.uuid);}
            else if (mbID(item.frag)) {
                var addGlossmark=mB.UI.addGlossmark;
                allglosses.addCards(item);
                var nodes=mB.getDups(item.frag);
                addClass(nodes,"glossed");
                var i=0, lim=nodes.length; while (i<lim) {
                    addGlossmark(nodes[i++],item);}
                if (item.excerpt) {
                    var range=mB.findExcerpt(nodes,item.excerpt,item.exoff);
                    if (range) {
                        fdjtUI.Highlight(range,"mbuserexcerpt",
                                         item.note,{"data-glossid":item.uuid});}}
                if (item.tags) {
                    var gloss_cloud=mB.gloss_cloud;
                    var tags=item.tags, j=0, n_tags=tags.length;
                    while (j<n_tags) 
                        mB.cloudEntry(tags[j++],gloss_cloud);}
                if (item.tstamp>mB.syncstamp)
                    mB.syncstamp=item.tstamp;}}

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
            var navhud=createNavHUD("div#METABOOKTOC.hudpanel",root_info);
            var toc_button=fdjtID("METABOOKTOCBUTTON");
            toc_button.style.visibility='';
            mB.DOM.toc=navhud;
            fdjtDOM.replace("METABOOKTOC",navhud);
            var statictoc=createStaticTOC("div#METABOOKSTATICTOC.hudpanel",root_info);
            mB.Statictoc=statictoc;
            fdjtDOM.replace("METABOOKSTATICTOC",statictoc);}
        metaBook.setupTOC=setupTOC;

        function createNavHUD(eltspec,root_info){
            var scan=root_info;
            while (scan) {
                if ((!(scan.sub))||(scan.sub.length===0)) break;
                else if (scan.sub.length>1) {
                    root_info=scan; break;}
                else scan=scan.sub[0];}
            var toc_div=mB.TOC(root_info,0,false,"METABOOKTOC4",true);
            var div=fdjtDOM(eltspec||"div#METABOOKTOC.hudpanel",toc_div);
            mB.UI.addHandlers(div,"toc");
            return div;}

        function createStaticTOC(eltspec,root_info){
            var scan=root_info;
            while (scan) {
                if ((!(scan.sub))||(scan.sub.length===0)) break;
                else if (scan.sub.length>1) {
                    root_info=scan; break;}
                else scan=scan.sub[0];}
            var toc_div=mB.TOC(scan,0,false,"METABOOKSTATICTOC4");
            var div=fdjtDOM(eltspec||"div#METABOOKSTATICTOC",toc_div);
            mB.UI.addHandlers(div,"toc");
            div.title=
                "Tap a section to jump there directly; press and hold to see (glimpse) it temporarily; while glimpsing, tap (or press a key) to jump to where you're looking.";
            return div;}

        /* HUD animation */

        function setHUD(flag,clearmode){
            if (typeof clearmode === 'undefined') clearmode=true;
            if ((mB.Trace.gestures)||(mB.Trace.mode))
                fdjtLog("setHUD %o mode=%o hudup=%o bc=%o hc=%o",
                        flag,mB.mode,mB.hudup,
                        document.body.className,
                        metaBookHUD.className);
            if (flag) {
                mB.hudup=true;
                dropClass(document.body,"_SKIMMING");
                addClass(document.body,"hudup");}
            else {
                mB.hudup=false;
                mB.scrolling=false;
                if (mB.previewing)
                    mB.stopPreview("setHUD");
                dropClass(document.body,"_SHRINK");
                if (clearmode) {
                    if (mB.popmode) {
                        var fn=mB.popmode;
                        mB.popmode=false;
                        fn();}
                    dropClass(metaBookHUD,"openheart");
                    dropClass(metaBookHUD,"openhead");
                    dropClass(metaBookHUD,"full");
                    dropClass(metaBookHUD,metaBookModes);
                    dropClass(document.body,"_SKIMMING");
                    dropClass(document.body,"_SKIMSTART");
                    dropClass(document.body,"_SKIMEND");
                    mB.mode=false;}
                dropClass(document.body,"hudup");
                dropClass(document.body,"openhud");
                mB.focusBody();}}
        metaBook.setHUD=setHUD;

        /* Opening and closing the cover */

        function showCover(){
            if (mB._setup)
                fdjtState.dropLocal("metabook.opened("+mB.docuri+")");
            addClass(document.body,"_COVER");}
        metaBook.showCover=showCover;
        function hideCover(){
            if (mB._setup)
                fdjtState.setLocal(
                    "metabook.opened("+mB.docuri+")",fdjtTime());
            dropClass(document.body,"_COVER");}
        metaBook.hideCover=hideCover;
        function toggleCover(){
            if (hasClass(document.body,"_COVER")) hideCover();
            else showCover();}
        metaBook.toggleCover=toggleCover;
        
        /* Mode controls */
        
        var metaBookModes=/\b((search)|(refinesearch)|(expandsearch)|(searchresults)|(overtoc)|(openglossmark)|(allglosses)|(context)|(statictoc)|(minimal)|(addgloss)|(gotoloc)|(gotopage)|(shownote)|(showaside)|(glossdetail))\b/g;
        var metaBookHeartModes=/\b((statictoc)|(search)|(refinesearch)|(expandsearch)|(searchresults)|(allglosses)|(showaside)|(glossaddtag)|(glossaddtag)|(glossaddoutlet)|(glosseditdetail))\b/g;
        var metaBookHeadModes=/\b((overtoc)|(search)|(refinesearch)|(expandsearch)|(searchresults)|(allglosses)|(addgloss)|(shownote))\b/g;
        var metaBookPopModes=/\b((glossdetail))\b/g;
        var metaBookCoverModes=/\b((welcome)|(help)|(layers)|(login)|(settings)|(cover)|(aboutsbooks)|(console)|(aboutbook)|(titlepage))\b/g;
        var metaBookSearchModes=/((refinesearch)|(searchresults)|(expandsearch))/;
        metaBook.searchModes=metaBookSearchModes;
        var metabook_mode_scrollers=
            {allglosses: "METABOOKALLGLOSSES",
             searchresults: "METABOOKSEARCHRESULTS",
             expandsearch: "METABOOKALLTAGS",
             search: "METABOOKSEARCHCLOUD",
             refinesearch: "METABOOKSEARCHCLOUD",
             openglossmark: "METABOOKPOINTGLOSSES",
             statictoc: "METABOOKSTATICTOC"};
        var metabook_mode_foci=
            {gotopage: "METABOOKPAGEINPUT",
             gotoloc: "METABOOKLOCINPUT",
             search: "METABOOKSEARCHINPUT",
             refinesearch: "METABOOKSEARCHINPUT",
             expandsearch: "METABOOKSEARCHINPUT"};
        
        function setMode(mode,nohud){
            var oldmode=mB.mode;
            if (typeof mode === 'undefined') return oldmode;
            if (mode==='last') mode=mB.last_mode;
            if ((!(mode))&&(mB.mode)&&
                (mB.mode.search(metaBookPopModes)>=0))
                mode=mB.last_mode;
            if (mode==='none') mode=false;
            if (mode==='heart') mode=mB.heart_mode||"about";
            if (mB.Trace.mode)
                fdjtLog("setMode %o, cur=%o dbc=%o",
                        mode,mB.mode,document.body.className);
            if ((mode!==mB.mode)&&(mB.previewing))
                mB.stopPreview("setMode");
            if ((mode!==mB.mode)&&(mB.popmode)) {
                var fn=mB.popmode;
                mB.popmode=false;
                fn();}
            if (hasClass(document.body,"_COVER")) {
                if (!(mode)) hideCover();
                else if (mode.search(metaBookCoverModes)>=0)
                    hideCover();
                else {}
                metaBookCoverModes.lastIndex=0;} // Kludge
            if ((mB.mode==="addgloss")&&(mode!=="addgloss")&&
                (hasClass("METABOOKLIVEGLOSS","modified")))
                mB.submitGloss(fdjt.ID("METABOOKLIVEGLOSS"));
            if (mode) {
                if (mode==="search") mode=mB.search_mode||"refinesearch";
                if (mode==="addgloss") {}
                else dropClass(document.body,"_SHRINK");
                if (mode===mB.mode) {}
                else if (mode===true) {
                    /* True just puts up the HUD with no mode info */
                    mB.hideCover();
                    if (metabook_mode_foci[mB.mode]) {
                        var input=fdjtID(metabook_mode_foci[mB.mode]);
                        input.blur();}
                    dropClass(metaBookHUD,metaBookModes);
                    mB.mode=false;
                    mB.last_mode=true;}
                else if (typeof mode !== 'string') 
                    throw new Error('mode arg not a string');
                else if (mode.search(metaBookCoverModes)>=0) {
                    fdjtID("METABOOKCOVER").className=mode;
                    if (mode==="console") fdjtLog.update();
                    showCover();
                    mB.mode=mode;
                    mB.modechange=fdjtTime();
                    return;}
                else {
                    mB.hideCover();
                    mB.modechange=fdjtTime();
                    if (metabook_mode_foci[mB.mode]) {
                        var modeinput=fdjtID(metabook_mode_foci[mB.mode]);
                        modeinput.blur();}
                    if (mode!==mB.mode) mB.last_mode=mB.mode;
                    mB.mode=mode;}
                // If we're switching to the inner app but the iframe
                //  hasn't been initialized, we do it now.
                if ((mode==="sbooksapp")&&
                    (!(fdjtID("SBOOKSAPP").src))&&
                    (!(mB.appinit)))
                    initIFrameApp();
                // Update mB.scrolling which is the scrolling
                // element in the HUD for this mode
                if (typeof mode !== 'string')
                    mB.scrolling=false;
                else if (metabook_mode_scrollers[mode]) 
                    mB.scrolling=(metabook_mode_scrollers[mode]);
                else mB.scrolling=false;

                if ((mode==='refinesearch')||
                    (mode==='searchresults')||
                    (mode==='expandsearch'))
                    mB.search_mode=mode;

                if ((mode==='addgloss')||(mode==="openglossmark")) 
                    addClass(document.body,"openhud");
                else if (nohud) {}
                // And if we're not skimming, we just raise the hud
                else setHUD(true);
                // Actually change the class on the HUD object
                if (mode===true) {
                    dropClass(metaBookHUD,"openhead");
                    dropClass(metaBookHUD,"openheart");
                    fdjtDOM.swapClass(metaBookHUD,metaBookModes,"minimal");}
                else if (mode==="addgloss") {
                    // addgloss has submodes which may specify the
                    //  open heart configuration
                    addClass(metaBookHUD,"openhead");
                    if (metaBookHUD.className.search(metaBookHeartModes)<0)
                        dropClass(metaBookHUD,"openheart");
                    else addClass(metaBookHUD,"openheart");}
                else {
                    if (mode.search(metaBookHeartModes)<0) {
                        dropClass(metaBookHUD,"openheart");}
                    if (mode.search(metaBookHeadModes)<0)
                        dropClass(metaBookHUD,"openhead");
                    if (mode.search(metaBookHeartModes)>=0) {
                        mB.heart_mode=mode;
                        addClass(metaBookHUD,"openheart");}
                    if (mode.search(metaBookHeadModes)>=0) {
                        mB.head_mode=mode;
                        addClass(metaBookHUD,"openhead");}}
                changeMode(mode);}
            else {
                // Clearing the mode is a lot simpler, in part because
                //  setHUD clears most of the classes when it brings
                //  the HUD down.
                mB.last_mode=mB.mode;
                if ((mB.mode==="openglossmark")&&
                    (fdjtID("METABOOKOPENGLOSSMARK")))
                    fdjtID("METABOOKOPENGLOSSMARK").id="";
                if (mB.textinput) {
                    mB.setFocus(false);}
                mB.focusBody();
                if (mB.skimming) {
                    var dups=mB.getDups(mB.target);
                    mB.clearHighlights(dups);
                    dropClass(dups,"MBhighlightpassage");}
                dropClass(metaBookHUD,"openheart");
                dropClass(metaBookHUD,"openhead");
                dropClass(document.body,"dimmed");
                dropClass(document.body,"mbhelp");
                dropClass(document.body,"_PREVIEW");
                dropClass(document.body,"_SHRINK");
                dropClass(metaBookHUD,metaBookModes);
                mB.cxthelp=false;
                if (display_sync) mB.displaySync();
                if (nohud) mB.setHUD(false);
                else setHUD(false);}}
        
        function scrollSlices(mode){
            if (mode==="allglosses") {
                if ((mB.skimming)||(mB.point))
                    mB.UI.scrollSlice(
                        mB.skimming||mB.point,mB.glosses);}
            else if (mode==="searchresults") {
                if ((mB.skimming)||(mB.point))
                    mB.UI.scrollSlice(
                        mB.skimming||mB.point,mB.query.listing);}
            else {}}
        metaBook.scrollSlices=scrollSlices;

        function changeMode(mode){      
            if (mB.Trace.mode)
                fdjtLog("changeMode %o, cur=%o dbc=%o",
                        mode,mB.mode,document.body.className);
            fdjtDOM.dropClass(metaBookHUD,metaBookModes);
            fdjtDOM.addClass(metaBookHUD,mode);
            scrollSlices(mode);
            if (mode==="statictoc") {
                var headinfo=((mB.head)&&(mB.head.id)&&
                              (mB.docinfo[mB.head.id]));
                var hhinfo=headinfo.head, pinfo=headinfo.prev;
                var static_head=fdjt.ID("METABOOKSTATICTOC4"+headinfo.frag);
                var static_hhead=
                    ((hhinfo)&&(fdjt.ID("METABOOKSTATICTOC4"+hhinfo.frag)));
                var static_phead=
                    ((pinfo)&&(fdjt.ID("METABOOKSTATICTOC4"+pinfo.frag)));
                if ((static_head)&&(static_head.scrollIntoView)) {
                    if (static_hhead) static_hhead.scrollIntoView();
                    if ((static_phead)&&(static_phead.scrollIntoViewIfNeeded))
                        static_phead.scrollIntoViewIfNeeded();
                    if (static_head.scrollIntoViewIfNeeded)
                        static_head.scrollIntoViewIfNeeded();
                    else static_head.scrollIntoView();}}
            else if (mode==="allglosses") {
                var curloc=mB.location;
                var allcards=mB.DOM.allglosses.childNodes;
                var i=0, lim=allcards.length;
                var card=false, lastcard=false, lasthead=false;
                if (mB.glosses) mB.glosses.setLive(true);
                while (i<lim) {
                    var each=allcards[i++];
                    if (each.nodeType!==1) continue;
                    lastcard=card; card=each;
                    if (hasClass(card,"newhead")) lasthead=card;
                    var loc=card.getAttribute("data-location");
                    if (loc) loc=parseInt(loc,10);
                    if (loc>=curloc) break;}
                if (i>=lim) card=lastcard=false;
                if ((card)&&(lasthead)&&(mB.iscroll)) {
                    mB.heartscroller.scrollToElement(lasthead,0);
                    mB.heartscroller.scrollToElement(card,0);}
                else if ((card)&&(mB.iscroll)) {
                    mB.heartscroller.scrollToElement(card,0);}
                else if ((card)&&(lasthead)&&(card.scrollIntoViewIfNeeded)) {
                    lasthead.scrollIntoView();
                    card.scrollIntoViewIfNeeded();}
                else if ((card)&&(lastcard.scrollIntoView))
                    card.scrollIntoView();}
            else {}
            
            // This updates scroller dimensions, we delay it
            //  because apparently, on some browsers, the DOM
            //  needs to catch up with CSS
            if ((mB.scrolling)&&(mB.iscroll)) {
                var scroller=fdjtID(mB.scrolling);
                if (mB.Trace.iscroll)
                    fdjtLog("Updating scroller for #%s s=%o",
                            mB.scrolling,scroller);
                setTimeout(function(){updateScroller(scroller);},
                           2000);}
            
            // We autofocus any input element appropriate to the
            // mode
            if (metabook_mode_foci[mode]) {
                var input=fdjtID(metabook_mode_foci[mode]);
                if (input) {
                    setTimeout(function(){
                        mB.setFocus(input);},
                               50);}}
            else if (mode==="addgloss") {}
            // Moving the focus back to the body lets keys work
            else setTimeout(mB.focusBody,50);
            
            if (display_sync) mB.displaySync();}

        function updateScroller(elt){
            /* jshint newcap: false */
            if (!(mB.iscroll)) return;
            if ((elt)&&(mB.Trace.scrolling))
                fdjtLog("Updating scroller for %o",elt);
            if (mB.heartscroller) mB.heartscroller.refresh();
            else {
                var heart=fdjtID("METABOOKHEART");
                var contents=fdjtID("METABOOKHEARTCONTENT");
                if (!(contents)) {
                    contents=fdjtDOM("div#METABOOKHEARTCONTENT");
                    fdjtDOM(contents,fdjtDOM.Array(heart.childNodes));
                    fdjtDOM(heart,contents);}
                mB.heartscroller=new iScroll(heart);
                mB.heartscroller.refresh();}}
        metaBook.UI.updateScroller=updateScroller;

        function metaBookHUDToggle(mode,keephud){
            if (!(mB.mode)) setMode(mode);
            else if (mode===mB.mode)
                if (keephud) setMode(true); else setMode(false);
            else if ((mode==='heart')&&
                     (mB.mode.search(metaBookHeartModes)===0))
                if (keephud) setMode(true); else setMode(false);
            else setMode(mode);}
        metaBook.toggleMode=metaBookHUDToggle;

        metaBook.dropHUD=function(){return setMode(false);};
        metaBook.toggleHUD=function(evt){
            evt=evt||window.event;
            if ((evt)&&(fdjtUI.isClickable(fdjtUI.T(evt)))) return;
            fdjtLog("toggle HUD %o hudup=%o",evt,mB.hudup);
            if (mB.hudup) setHUD(false,false);
            else setHUD(true);};
        
        /* The App HUD */

        var iframe_app_init=false;
        function initIFrameApp(){
            if (iframe_app_init) return;
            if (mB.appinit) return;
            var query="";
            if (document.location.search) {
                if (document.location.search[0]==="?")
                    query=query+document.location.search.slice(1);
                else query=query+document.location.search;}
            if ((query.length)&&(query[query.length-1]!=="&"))
                query=query+"&";
            var refuri=mB.refuri;
            var appuri="https://"+mB.server+"/flyleaf?"+query;
            if (query.search("REFURI=")<0)
                appuri=appuri+"REFURI="+encodeURIComponent(refuri);
            if (query.search("TOPURI=")<0)
                appuri=appuri+"&TOPURI="+
                encodeURIComponent(document.location.href);
            if (document.title) {
                appuri=appuri+"&DOCTITLE="+encodeURIComponent(document.title);}
            if (mB.user) {
                appuri=appuri+"&BOOKUSER="+encodeURIComponent(mB.user._id);}
            if (document.location.hash) {
                appuri=appuri+"&HASH="+document.location.hash.slice(1);}

            fdjtID("SBOOKSAPP").src=appuri;
            iframe_app_init=true;}
        metaBook.initIFrameApp=initIFrameApp;

        metaBook.selectApp=function(){
            if (mB.mode==='sbooksapp') setMode(false);
            else setMode('sbooksapp');};

        /* Skimming */

        function metaBookSkim(elt,src,dir,expanded){
            var nextSlice=mB.nextSlice, prevSlice=mB.prevSlice;
            var pelt=mB.skimming;
            var i=0, lim=0;
            if (typeof dir !== "number") dir=0;
            addClass(document.body,"_SKIMMING"); setHUD(false,false);
            if (true) // (mB.Trace.mode)
                fdjtLog("metaBookSkim() %o (src=%o) mode=%o scn=%o/%o dir=%o",
                        elt,src,mB.mode,mB.skimming,mB.target,
                        dir);
            // Copy the description of what we're skimming into the
            // skimmer (at the top of the page during skimming and
            // preview)
            if (mB.skimming!==src) {
                var skimmer=fdjtID("METABOOKSKIMMER");
                var clone=src.cloneNode(true);
                var next=nextSlice(src), prev=prevSlice(src);
                var before=0, after=0, slice=prev;
                var pct=((dir<0)?("-120%"):(dir>0)?("120%"):(false));
                dropClass(skimmer,"transimate");
                fdjtDOM.replace("METABOOKSKIM",clone);
                var dropTransAnimate=function(){
                    dropClass(skimmer,"transanimate");
                    fdjtDOM.removeListener(
                        skimmer,"transitionend",dropTransAnimate);};
                if ((mB.skimming)&&(pct)) {
                    skimmer.style[fdjtDOM.transform]=
                        "translate("+pct+",0)";
                    setTimeout(function(){
                        addClass(skimmer,"transanimate");
                        fdjtDOM.addListener(
                            skimmer,"transitionend",dropTransAnimate);
                        setTimeout(function(){
                            skimmer.style[fdjtDOM.transform]="";},
                                   0);},
                               0);}
                // This all makes sure that the >| and |< buttons
                // appear appropriately
                if (next) dropClass(document.body,"_SKIMEND");
                else addClass(document.body,"_SKIMEND");
                if (prev) dropClass(document.body,"_SKIMSTART");
                else addClass(document.body,"_SKIMSTART");
                while (slice) {before++; slice=prevSlice(slice);}
                slice=next; while (slice) {
                    after++; slice=nextSlice(slice);}
                var skiminfo=fdjtID("METABOOKSKIMINFO");
                skiminfo.innerHTML=(before+1)+"/"+(before+after+1);
                // This marks where we are currently skimming
                if (pelt) dropClass(pelt,"mbskimpoint");
                if (src) addClass(src,"mbskimpoint");
                if (typeof expanded === "undefined") {}
                else if (expanded) addClass("METABOOKSKIMMER","expanded");
                else dropClass("METABOOKSKIMMER","expanded");
                mB.skimming=src;}
            else {}
            var highlights=[];
            if (mB.target)
                mB.clearHighlights(mB.getDups(mB.target));
            dropClass("METABOOKSKIMMER","cxfoundhighlights");
            mB.setTarget(elt);
            if ((src)&&(hasClass(src,"gloss"))) {
                var glossinfo=mB.glossdb.ref(src.name);
                if (glossinfo.excerpt) {
                    var searching=mB.getDups(elt.id);
                    var range=mB.findExcerpt(
                        searching,glossinfo.excerpt,glossinfo.exoff);
                    if (range) {
                        highlights=
                            fdjtUI.Highlight(range,"MBhighlightexcerpt");
                        addClass("METABOOKSKIMMER","cxhighlights");}}
                else if (src.about[0]==="#")
                    addClass(mB.getDups(src.about.slice(1)),
                             "MBhighlightpassage");
                else addClass(mB.getDups(src.about),"MBhighlightpassage");}
            else if ((src)&&(getParent(src,".sbookresults"))) {
                var about=src.about, target=mbID(about);
                if (target) {
                    var info=mB.docinfo[target.id];
                    var terms=mB.query.tags;
                    var spellings=info.knodeterms;
                    i=0; lim=terms.length;
                    if (lim===0)
                        addClass(mB.getDups(target),"MBhighlightpassage");
                    else while (i<lim) {
                        var term=terms[i++];
                        var h=mB.highlightTerm(term,target,info,spellings);
                        highlights=highlights.concat(h);}}}
            delete mB.skimpoints;
            delete mB.skimoff;
            if ((highlights)&&(highlights.length===1)&&
                (getParent(highlights[0],elt)))
                mB.GoTo(elt,"Skim");
            else if ((highlights)&&(highlights.length)) {
                var possible=mB.getDups(elt.id);
                if (possible.length) {
                    var skimpoints=[];
                    i=0; lim=possible.length;
                    while (i<lim) {
                        var poss=possible[i++];
                        var j=0, jlim=highlights.length;
                        while (j<jlim) {
                            if (getParent(highlights[j++],poss)) {
                                skimpoints.push(poss); break;}}}
                    if (skimpoints.length)
                        mB.skimpoints=skimpoints;
                    else mB.skimpoints=possible;
                    if (dir<0) 
                        mB.skimoff=mB.skimpoints.length-1;
                    else mB.skimoff=0;
                    mB.GoTo(mB.skimpoints[mB.skimoff]);}
                else mB.GoTo(elt,"Skim");}
            else mB.GoTo(elt,"Skim");}
        metaBook.Skim=metaBookSkim;
        function stopSkimming(){
            // Tapping the tochead returns to results/glosses/etc
            var skimming=mB.skimming;
            if (!(skimming)) return;
            dropClass(document.body,"_SKIMMING");
            if (getParent(skimming,fdjtID("METABOOKALLGLOSSES"))) 
                mB.setMode("allglosses");
            else if (getParent(skimming,fdjtID("METABOOKSEARCHRESULTS"))) 
                mB.setMode("searchresults");
            else {}}
        metaBook.stopSkimming=stopSkimming;
        
        mB.addConfig("uisize",function(name,value){
            fdjtDOM.swapClass(
                mB.Frame,/metabookuifont\w+/,"metabookuifont"+value);});
        mB.addConfig("animatecontent",function(name,value){
            if (mB.dontanimate) {}
            else if (value) addClass(document.body,"_ANIMATE");
            else dropClass(mB.page,"_ANIMATE");});
        mB.addConfig("animatehud",function(name,value){
            if (mB.dontanimate) {}
            else if (value) addClass("METABOOKFRAME","_ANIMATE");
            else dropClass("METABOOKFRAME","_ANIMATE");});

        /* Settings apply/save handlers */

        function getSettings(){
            var result={};
            var settings=fdjtID("METABOOKSETTINGS");
            var layout=fdjtDOM.getInputValues(settings,"METABOOKLAYOUT");
            result.layout=
                ((layout)&&(layout.length)&&(layout[0]))||false;
            var bodysize=fdjtDOM.getInputValues(settings,"METABOOKBODYSIZE");
            if ((bodysize)&&(bodysize.length))
                result.bodysize=bodysize[0];
            var bodyfamily=fdjtDOM.getInputValues(settings,"METABOOKBODYFAMILY");
            if ((bodyfamily)&&(bodyfamily.length))
                result.bodyfamily=bodyfamily[0];
            var uisize=fdjtDOM.getInputValues(settings,"METABOOKUISIZE");
            if ((uisize)&&(uisize.length))
                result.uisize=uisize[0];
            var hidesplash=fdjtDOM.getInputValues(settings,"METABOOKHIDESPLASH");
            result.hidesplash=((hidesplash)&&(hidesplash.length))||false;
            var showconsole=fdjtDOM.getInputValues(settings,"METABOOKSHOWCONSOLE");
            result.showconsole=
                ((showconsole)&&(showconsole.length)&&(true))||false;
            var locsync=fdjtDOM.getInputValues(settings,"METABOOKLOCSYNC");
            if ((locsync)&&(locsync.length)) result.locsync=true;
            var justify=fdjtDOM.getInputValues(settings,"METABOOKJUSTIFY");
            if ((justify)&&(justify.length)) result.justify=true;
            else result.justify=false;
            var cacheglosses=fdjtDOM.getInputValues(settings,"METABOOKCACHEGLOSSES");
            if ((cacheglosses)&&(cacheglosses.length)) result.cacheglosses=true;
            else result.cacheglosses=false;
            var animatecontent=fdjtDOM.getInputValues(
                settings,"METABOOKANIMATECONTENT");
            result.animatecontent=
                (((animatecontent)&&(animatecontent.length)&&(animatecontent[0]))?
                 (true):(false));
            var animatehud=fdjtDOM.getInputValues(
                settings,"METABOOKANIMATEHUD");
            result.animatehud=
                (((animatehud)&&(animatehud.length)&&(animatehud[0]))?
                 (true):(false));
            
            return result;}

        metaBook.UI.settingsUpdate=function(){
            var settings=getSettings();
            mB.setConfig(settings);};

        metaBook.UI.settingsSave=function(evt){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            var settings=getSettings();
            mB.setConfig(settings);
            mB.saveConfig(settings);
            fdjtDOM.dropClass("METABOOKSETTINGS","changed");
            fdjtDOM.replace("METABOOKSETTINGSMESSAGE",
                            fdjtDOM("span.message#METABOOKSETTINGSMESSAGE",
                                    "Your settings have been saved."));};

        metaBook.UI.settingsReset=function(evt){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            mB.resetConfig();
            fdjtDOM.dropClass("METABOOKSETTINGS","changed");
            fdjtDOM.replace("METABOOKSETTINGSMESSAGE",
                            fdjtDOM("span.message#METABOOKSETTINGSMESSAGE",
                                    "Your settings have been reset."));};

        metaBook.UI.settingsOK=function(evt){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            var settings=getSettings();
            mB.setConfig(settings);
            mB.saveConfig(settings);
            fdjtDOM.replace("METABOOKSETTINGSMESSAGE",
                            fdjtDOM("span.message#METABOOKSETTINGSMESSAGE",
                                    "Your settings have been saved."));};
        
        metaBook.UI.settingsCancel=function(evt){
            if (typeof evt === "undefined") evt=event;
            if (evt) fdjt.UI.cancel(evt);
            mB.setConfig(mB.getConfig());
            fdjtDOM.replace("METABOOKSETTINGSMESSAGE",
                            fdjtDOM("span.message#METABOOKSETTINGSMESSAGE",
                                    "Your changes have been discarded."));};

        function keyboardHelp(arg,force){
            if (arg===true) {
                if (mB.keyboardHelp.timer) {
                    clearTimeout(mB.keyboardHelp.timer);
                    mB.keyboardHelp.timer=false;}
                dropClass("METABOOKKEYBOARDHELPBOX","closing");
                dropClass("METABOOKKEYBOARDHELPBOX","closed");
                return;}
            else if (arg===false) {
                if (mB.keyboardHelp.timer) {
                    clearTimeout(mB.keyboardHelp.timer);
                    mB.keyboardHelp.timer=false;}
                addClass("METABOOKKEYBOARDHELPBOX","closed");
                dropClass("METABOOKKEYBOARDHELPBOX","closing");
                return;}
            if ((!force)&&(!(mB.keyboardhelp))) return;
            if (typeof arg === 'string') arg=fdjtID(arg);
            if ((!(arg))||(!(arg.nodeType))) return;
            var box=fdjtID("METABOOKKEYBOARDHELPBOX");
            var content=arg.cloneNode(true);
            content.id="METABOOKKEYBOARDHELP";
            fdjtDOM.replace("METABOOKKEYBOARDHELP",content);
            fdjtDOM.dropClass(box,"closed");
            mB.keyboardHelp.timer=
                setTimeout(function(){
                    fdjtDOM.addClass(box,"closing");
                    mB.keyboardHelp.timer=
                        setTimeout(function(){
                            mB.keyboardHelp.timer=false;
                            fdjtDOM.swapClass(box,"closing","closed");},
                                   5000);},
                           5000);}
        metaBook.keyboardHelp=keyboardHelp;

        /* Showing a particular gloss */

        metaBook.showGloss=function showGloss(uuid){
            if (!(mB.glossdb.ref(uuid))) return false;
            var elts=document.getElementsByName(uuid);
            if (!(elts)) return false;
            else if (!(elts.length)) return false;
            else {
                var hasParent=fdjtDOM.hasParent;
                var i=0, lim=elts.length;
                while (i<lim) {
                    var src=elts[i++];
                    if (hasParent(src,allglosses)) {
                        var elt=mbID(src.about);
                        setMode("allglosses");
                        mB.Skim(elt,src);
                        return true;}}
                return false;}};

        /* Setting/clearing help mode */
        metaBook.hideHelp=function(){
            fdjtDOM.dropClass(document.body,"mbhelp");};
        metaBook.showHelp=function(){
            fdjtDOM.addClass(document.body,"mbhelp");};

        return setMode;})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/
