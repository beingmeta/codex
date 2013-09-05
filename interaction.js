/* -*- Mode: Javascript; Character-encoding: utf-8; -*- */

/* ###################### codex/interaction.js ###################### */

/* Copyright (C) 2009-2013 beingmeta, inc.

   This file implements most of the interaction handling for the
   e-reader web application.

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

/* There are four basic display modes:
   reading (minimal decoration, with 'minimal' configurable)
   scanning (card at top, buttons on upper edges)
   addgloss (addgloss form at top, text highlighted)
   tool (lots of tools unfaded)

   Tap on content:
   if not hudup and no mode, raise the HUD;
   if not hudup and mode, clear the mode
   if hudup, drop the HUD
   Hold on content:
   if adding gloss to target, raise the hud
   otherwise, start adding gloss to target
*/

/* New content interaction rules, based on assuming taphold for content */
/*
  tap: if previewing, stop and jump to the previewed location
  tap: if over anchor, detail, aside, etc, and fdjtselecting, treat it like a click below,
  tap: if over fdjtselecting, go to addgloss mode with the hud up, and pass event
  on to the fdjtselecting region
  tap: if on anchor, detail, aside, etc, either treat it especially (and set clicked to
  the current time) or ignore it (and let click handle it)
  tap: otherwise, go forward or backward based on the x position

  hold: if previewing, stop and jump to the previewed location
  hold: if over fdjtselecting, switch to addgloss with HUD down and pass it on.
  hold: if not over fdjtselecting:
  if not over a passage, toggle the HUD
  if over a passage, and no current glosstarget,
  start selecting, fake a press, create a gloss;
  if over a passage, and current glosstarget is a reply, retarget the reply;
  if over a passage, and current glosstarget hasn't been modified or save,
  retarget the gloss
*/

(function(){
    "use strict";

    var fdjtString=fdjt.String;
    var fdjtTime=fdjt.Time;
    var fdjtLog=fdjt.Log;
    var fdjtDOM=fdjt.DOM;
    var fdjtUI=fdjt.UI;
    var RefDB=fdjt.RefDB;
    var fdjtID=fdjt.ID;

    // Imports (kind of )
    var addClass=fdjtDOM.addClass;
    var hasClass=fdjtDOM.hasClass;
    var dropClass=fdjtDOM.dropClass;
    var toggleClass=fdjtDOM.toggleClass;
    var getTarget=Codex.getTarget;
    var getParent=fdjtDOM.getParent;
    var hasParent=fdjtDOM.hasParent;
    var isClickable=fdjtUI.isClickable;
    var getChild=fdjtDOM.getChild;

    var submitEvent=fdjtUI.submitEvent;

    var reticle=fdjtUI.Reticle;

    /* For tracking gestures */
    var start_x=-1; var start_y=-1; var last_x=-1; var last_y=-1;
    var double_touch=false;
    
    var addgloss_timer=false;
    var preview_timer=false;

    /* Setup for gesture handling */

    function addHandlers(node,type){
        var mode=Codex.ui;
        fdjtDOM.addListeners(node,Codex.UI.handlers[mode][type]);}
    Codex.UI.addHandlers=addHandlers;

    function setupGestures(domnode){
        var mode=Codex.ui;
        if (!(mode)) Codex.ui=mode="mouse";
        if (!(domnode)) {
            addHandlers(false,'window');
            addHandlers(document,'document');
            addHandlers(document.body,'body');
            if (Codex.bypage) {
                addHandlers(fdjtID("CODEXPAGE"),'content');}
            else {
                addHandlers(fdjtID("CODEXCONTENT"),'content');}
            fdjtUI.TapHold(fdjt.ID("CODEXBODY"),Codex.touch);
            fdjtUI.TapHold(Codex.pagefoot,Codex.touch);
            fdjtUI.TapHold(fdjtID("CODEXEXPANDSCANNER"),Codex.touch);
            addHandlers(Codex.HUD,'hud');}
        if (mode) {
            var handlers=Codex.UI.handlers[mode];
            var keys=[], seen=[];
            for (var key in handlers) {
                if ((handlers.hasOwnProperty(key))&&
                    ((key.indexOf('.')>=0)||(key.indexOf('#')>=0)))
                    keys.push(key);}
            // Appropximate sort for selector priority
            keys=keys.sort(function(kx,ky){return ky.length-kx.length;});
            var i=0, lim=keys.length;
            while (i<lim) {
                key=keys[i++];
                var nodes=fdjtDOM.$(key,domnode);
                var h=handlers[key];
                var j=0, jlim=nodes.length;
                while (j<jlim) {
                    var node=nodes[j++];
                    if (seen.indexOf(node)<0) { 
                        seen.push(node);
                        fdjtDOM.addListeners(node,h);}}}}}
    Codex.setupGestures=setupGestures;

    /* New simpler UI */

    var gloss_focus=false;
    var gloss_blurred=false;
    function glossform_focus(evt){
        evt=evt||event;
        gloss_blurred=false;
        var target=fdjtUI.T(evt);
        var form=getParent(target,"FORM");
        var div=((form)&&(getParent(form,".codexglossform")));
        if (div) {
            addClass(div,"focused");
            Codex.setGlossMode(false);}
        if (!(Codex.hudup)) Codex.setHUD(true,false);
        Codex.dont_resize=true;
        gloss_focus=form;}
    function glossform_blur(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var form=getParent(target,"FORM");
        var div=((form)&&(getParent(form,".codexglossform")));
        if (div) dropClass(div,"focused");
        gloss_blurred=fdjtTime();
        Codex.dont_resize=false;
        // Restore this without removal of the gloss
        // if ((div)&&(hasClass(div,"modified"))) Codex.submitGloss(div);
        gloss_focus=false;}
    Codex.UI.glossform_focus=glossform_focus;
    Codex.UI.glossform_blur=glossform_blur;

    /* Adding a gloss button */
    
    function glossbutton_ontap(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var passage=getTarget(target);
        if ((Codex.mode==="addgloss")&&
            (Codex.glosstarget===passage)) {
            fdjtUI.cancel(evt);
            Codex.setMode(true);}
        else if (passage) {
            fdjtUI.cancel(evt);
            var form=Codex.setGlossTarget(passage);
            if (!(form)) return;
            Codex.setMode("addgloss");
            Codex.setGlossForm(form);}}

    /* Functionality:
       on selection:
       save but keep selection,
       set target (if available)
       if hud is down, raise it
       on tap: (no selection)
       if hud is down, set target and raise it
       if no target, raise hud
       if tapping target, lower HUD
       if tapping other, set target, drop mode, and raise hud
       (simpler) on tap:
       if hudup, drop it
       otherwise, set target and raise HUD
    */

    /*
      Tap on content:
      if not hudup and no mode, raise the HUD;
      if not hudup and mode, clear the mode
      if hudup, drop the HUD
      Hold on content:
      if adding gloss to target, raise the hud
      otherwise, start adding gloss to target
    */

    /* Holding */

    var held=false;

    function clear_hold(caller){
        if (held) {
            clearTimeout(held); held=false;
            if (Codex.Trace.gestures)
                fdjtLog("clear_hold from %s",(caller||"somewhere"));}}

    /* Generic content interaction handler */

    var gesture_start=false;
    var clicked=false;

    function content_tapped(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var sX=evt.screenX, sY=evt.screenY;
        var cX=evt.clientX, cY=evt.clientY;
        var now=fdjtTime(), touch=false;

        // Detect touches with two fingers, which we may treat especially
        if ((evt.touches)||(evt.shiftKey)) {
            if (Codex.Trace.gestures)
                fdjtLog("double_touch dt=%o now=%o",double_touch,now);
            if ((evt.touches.length>1)||(evt.shiftKey)) {
                double_touch=now;
                if (addgloss_timer) {
                    clearTimeout(addgloss_timer);
                    addgloss_timer=false;}
                gesture_start=false;
                return;}
            else if (!(double_touch)) {}
            else if ((now-double_touch)>2000) double_touch=false;
            else {}}
        
        // If we're previewing, stop it and go to the page we're
        //  previewing (which was touched)
        if (Codex.previewing) {
            var goto=Codex.getTarget(target);
            if (!(goto)) goto=getParent(target,".codexpage");
            if (goto) Codex.GoTo(goto,evt);
            else Codex.stopPreview("content_tapped/nocontent");
            return false;}

        if ((Codex.hudup)||(Codex.mode)) {
            Codex.setMode(false); Codex.setHUD(false);
            if (fdjtID("CODEXOPENGLOSSMARK")) 
                fdjtID("CODEXOPENGLOSSMARK").id="";
            fdjtUI.cancel(evt); gesture_start=false;
            clicked=fdjtTime();
            return false;}

        
        // Various click handling
        if (handle_content_click(target)) {
            fdjtUI.cancel(evt);
            return false;}

        // If we're in a glossmark, let its handler apply
        if (hasParent(target,".codexglossmark")) {
            fdjtUI.cancel(evt);
            return false;}

        // If we tap a fdjtselecting region, it's handlers should cancel
        //  this handler, so we don't worry about that.

        // So we're doing a page flip.
        if ((evt.changedTouches)&&(evt.changedTouches.length)) {
            touch=evt.changedTouches[0];
            sX=touch.screenX, sY=touch.screenY;
            cX=touch.clientX, cY=touch.clientY;}
        
        if (fdjtID("CODEXOPENGLOSSMARK")) {
            fdjtID("CODEXOPENGLOSSMARK").id="";
            fdjtUI.cancel(evt); gesture_start=false;
            return;}

        // If there isn't a passage or the hud is down, we take it
        // immediately as a page flip
        if (Codex.Trace.gestures)
            fdjtLog("ctouch/nopassage (%o) %o, m=%o, @%o,%o, vw=%o",
                    evt,target,Codex.mode,cX,cY,fdjtDOM.viewWidth());
        if (cX<(fdjtDOM.viewWidth()/3))
            Codex.Backward(evt);
        else Codex.Forward(evt);
        fdjtUI.cancel(evt); gesture_start=false;
        return;}

    function resolve_anchor(ref){
        var elt=document.getElementById(ref);
        if (elt) return elt;
        var elts=document.getElementsByName(ref);
        if (elts.length===0) return false;
        else if (elts.length===1) return elts[0];
        else {
            var found=0; var i=0, lim=elts.length;
            var codex_page=Codex.page;
            while (i<lim) {
                var r=elts[i++];
                if (hasClass(r,"codexdupstart")) return r;
                else if (found) continue;
                else if (hasParent(r,codex_page)) found=4;
                else {}}
            if (!(found)) return elts[0];
            else return found;}}

    function handle_content_click(target){

        if ((clicked)&&((fdjtTime()-clicked)<3000)) return true;

        // Handle various click-like operations, overriding to sBook
        //  navigation where appropriate.  Set *clicked* to the
        //  current time when you do so, letting the content_click handler
        //  appropriately ignore its invocation.
        var anchor=getParent(target,"A"), href, elt=false;
        // If you tap on a relative anchor, move there using Codex
        // rather than the browser default
        if ((anchor)&&(anchor.href)&&(href=anchor.getAttribute("href"))) {
            if (Codex.Trace.gestures)
                fdjtLog("ctouch: follow link %s",href);
            var rel=anchor.rel;
            if ((href[0]==="#")&&(rel)&&
                (rel.search(/\b((sbooknote)|(footnote)|(endnote))\b/)>=0)) {
                var note_node=fdjt.ID(href.slice(1));
                var label=fdjtDOM("span.sbooknotelabel");
                label.innerHTML=anchor.innerHTML;
                fdjtDOM.removeChildren(Codex.DOM.notehud);
                var shownote=note_node.cloneNode(true); shownote.id=null;
                dropClass(shownote,/\bcodex\S+/g);
                fdjtDOM.prepend(shownote,label);
                fdjtDOM.append(Codex.DOM.notehud,shownote);
                Codex.setMode("shownote");
                gesture_start=false;
                clicked=fdjtTime();
                return true;}
            else if ((href[0]==="#")&&(rel)&&
                     (rel.search(/\b((sidebar)|(breakout)|(tangent))\b/)>=0)) {
                var aside_target=fdjt.ID(href.slice(1));
                fdjtDOM.removeChildren(Codex.DOM.asidehud);
                fdjtDOM.append(Codex.DOM.asidehud,aside_target.cloneNode(true));
                Codex.setMode("showaside");
                gesture_start=false;
                clicked=fdjtTime();
                return true;}
            else if ((href[0]==='#')&&(elt=resolve_anchor(href.slice(1)))) {
                // It's an internal jump, so we follow that
                Codex.JumpTo(elt);
                gesture_start=false;
                clicked=fdjtTime();
                return true;}
            else {
                // We force links to leave the page, hoping people
                //  won't find it obnoxious.  We could also open up
                //  a little iframe in some circumstances
                if (!(anchor.target)) anchor.target="_blank";
                gesture_start=false;
                clicked=fdjtTime();
                return false;}}

        var details=getParent(target,"details,.html5details,.sbookdetails");
        if (details) {
            fdjtDOM.removeChildren(Codex.DOM.notehud);
            Codex.DOM.notehud.innerHTML=details.innerHTML;
            Codex.setMode("showdetails");
            clicked=fdjtTime();
            return true;}
        
        var aside=getParent(target,"aside,.html5aside,.sbookaside");
        if (aside) {
            fdjtDOM.removeChildren(Codex.DOM.asidehud);
            Codex.DOM.asidehud.innerHTML=aside.innerHTML;
            Codex.setMode("showaside");
            clicked=fdjtTime();
            return true;}
        return false;}

    function content_swiped(evt){
        evt=evt||event;
        if (!(evt.deltaX)) {}
        else if ((evt.deltaX>0)&&(Math.abs(evt.deltaY)<100))
            return Codex.pageBackward(evt);
        else if ((evt.deltaX<0)&&(Math.abs(evt.deltaY)<100))
            return Codex.pageForward(evt);
        else {}
        return;}

    var selectors=[];
    var slip_timer=false;
    function content_held(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var passage=Codex.getTarget(target);
        if (Codex.Trace.gestures) 
            fdjtLog("content_held %o p=%o p.p=%o bc=%s hc=%s",
                    evt,passage,((passage)&&(passage.parentNode)),
                    document.body.className,
                    Codex.HUD.className);
        // Already selecting this target, cancel any pending slippage
        if ((hasParent(target,".fdjtselecting"))||(!(passage))||
            (selectors[passage.id])) {
            if (slip_timer) {
                clearTimeout(slip_timer); slip_timer=false;}
            return;}
        var selecting=Codex.UI.selectText(passage);
        selectors.push(selecting);
        selectors[passage.id]=selecting;
        fdjtUI.TapHold.clear();
        // This makes a selection start on the region we just created.
        setTimeout(function(){selecting.startEvent(evt);},0);}

    function abortSelect(except){
        var i=0, lim=selectors.length;
        while (i<lim) {
            var sel=selectors[i++];
            if (sel!==except) sel.clear();}
        selectors=[];}

    function content_slipped(evt){
        evt=evt||event;
        var rel=evt.relatedTarget;
        if ((rel)&&(!(hasParent(rel,".fdjtselecting")))) {
            if (slip_timer) return;
            slip_timer=setTimeout(function(){
                slip_timer=false;
                if (Codex.Trace.gestures)
                    fdjtLog("content_slipped %o, aborting select",evt);
                abortSelect();},2000);}}
    
    function content_released(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if (Codex.Trace.gestures) fdjtLog("content_released %o",evt);
        if (!(hasParent(target,".fdjtselecting"))) {
            abortSelect(); return;}
        var passage=Codex.getTarget(target);
        if (Codex.glosstarget===passage) {
            if (Codex.mode==="addgloss") Codex.setHUD(true);
            else Codex.setMode("addgloss");
            return;}
        var selecting=selectors[passage.id]; abortSelect(selecting);
        var form_div=Codex.setGlossTarget(
            passage,((Codex.mode==="addgloss")&&(Codex.glossform)),selecting);
        var form=fdjtDOM.getChild(form_div,"form");
        if (!(form)) return;
        else fdjtUI.cancel(evt);
        if (Codex.Trace.gestures)
            fdjtLog("c_released/addgloss (%o) %o, p=%o f=%o/%o",
                    evt,target,passage,form_div,form);
        var mode=((evt.shiftKey)&&("addtag"));
        Codex.setGlossForm(form_div);
        if (mode) form.className=mode;
        Codex.setMode("addgloss",true);
        var input=fdjtDOM.getInputs(form,"NOTE")[0];
        if (input) {input.focus(); addClass(form_div,"focused");}}

    function initGlossMode(){
        var form=fdjtDOM.getChild("CODEXLIVEGLOSS","form");
        if (form) {
            var input=fdjtDOM.getInput(form,"NOTE");
            if (input) input.focus();
            Codex.setGlossMode(form.className);}}
    Codex.initGlossMode=initGlossMode;

    // This overrides the default_tap handler
    function content_click(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if ((clicked)&&((fdjtTime()-clicked)<3000)) fdjtUI.cancel(evt);
        else if (handle_content_click(target)) {
            fdjtUI.cancel(evt);
            return;}
        else if (isClickable(target)) return;
        else fdjtUI.cancel(evt);}

    /* TOC handlers */

    function getAbout(elt){
        while (elt) {
            if ((elt.name)&&(elt.name.search("SBR")===0))
                return elt;
            else elt=elt.parentNode;}
        return false;}

    function getTitleSpan(toc,ref){
        var titles=fdjtDOM.getChildren(toc,".codextitle");
        var i=0; var lim=titles.length;
        while (i<lim) {
            var title=titles[i++];
            if (title.name===ref) return title;}
        return false;}

    function toc_tapped(evt){
        evt=evt||event;
        var tap_target=fdjtUI.T(evt);
        var about=getAbout(tap_target);
        if (about) {
            var ref=about.name.slice(3);
            var target=fdjtID(ref);
            var info=Codex.docinfo[ref];
            var show_fulltoc=
                ((info.level===1)&&
                 (info.sub)&&(info.sub.length>2)&&
                 (info.id!==Codex.head.id));
            if (Codex.Trace.gestures)
                fdjtLog("toc_tapped %o about=%o ref=%s",evt,about,ref);
            if (show_fulltoc) Codex.GoTo(target);
            else Codex.JumpTo(target);
            if (show_fulltoc) Codex.setMode("toc");
            else if (Codex.mode==="tocscan")
                Codex.setMode(false);
            else {
                Codex.setMode("tocscan");
                fdjtUI.cancel(evt);}
            return fdjtUI.cancel(evt);}
        else if (Codex.Trace.gestures) fdjtLog("toc_tapped %o noabout", evt);
        else {}}
    function toc_held(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt), about=getAbout(target);
        if (preview_timer) {
            clearTimeout(preview_timer); preview_timer=false;}
        if (slip_timer) {
            clearTimeout(slip_timer); slip_timer=false;}
        if (about) {
            var ref=about.name.slice(3);
            var toc=getParent(about,".codextoc");
            var title=getTitleSpan(toc,about.name);
            if (Codex.Trace.gestures)
                fdjtLog("toc_held %o about=%o ref=%s toc=%o title=%s",
                        evt,about,ref,toc,title);
            addClass(title,"codexpreviewtitle");
            addClass(about.parentNode,"codexheld");
            var spanbar=getParent(about,".spanbar")||getChild(toc,".spanbar");
            addClass(spanbar,"codexvisible");
            addClass(toc,"codexheld");
            Codex.startPreview(fdjtID(ref),"codexheld");
            return fdjtUI.cancel(evt);}
        else if (Codex.Trace.gestures) fdjtLog("toc_held %o noabout", evt);
        else {}}
    function toc_released(evt){
        evt=evt||event;
        var about=getAbout(fdjtUI.T(evt));
        if (preview_timer) {
            clearTimeout(preview_timer); preview_timer=false;}
        if (about) {
            var ref=about.name.slice(3);
            var toc=getParent(about,".codextoc");
            var title=getTitleSpan(toc,about.name);
            if (Codex.Trace.gestures)
                fdjtLog("toc_released %o ref=%o about=%o toc=%o title=%s",
                        evt,ref,about,toc,title);
            dropClass(title,"codexpreviewtitle");
            dropClass(about.parentNode,"codexheld");
            var spanbar=getParent(about,".spanbar")||getChild(toc,".spanbar");
            dropClass(spanbar,"codexvisible");
            dropClass(toc,"codexheld");
            Codex.stopPreview("toc_released");
            Codex.GoTo(ref);
            Codex.setMode(false);}
        else if (Codex.Trace.gestures)
            fdjtLog("toc_released %o noabout",evt);
        else {
            Codex.stopPreview("toc_released");}
        fdjtUI.cancel(evt);}
    function toc_slipped(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var about=getAbout(target);
        if ((!about)&&(Codex.Trace.gestures))
            fdjtLog("toc_slipped %o noabout",evt);
        if (about) {
            var toc=getParent(about,".codextoc");
            var title=getTitleSpan(toc,about.name);
            if (Codex.Trace.gestures)
                fdjtLog("toc_slipped %o about=%o toc=%o title=%s",
                        evt,about,toc,title);
            dropClass(title,"codexpreviewtitle");
            dropClass(getParent(about,".spanbar"),"codexvisible");
            dropClass(about.parentNode,"codexheld");
            dropClass(toc,"codexheld");}
        else if (Codex.Trace.gestures)
            fdjtLog("toc_slipped %o noabout",evt);
        else {}
        var rel=evt.relatedTarget||target;
        if (!(hasParent(rel,".codextoc"))) {
            if (slip_timer) return;
            slip_timer=setTimeout(function(){
                slip_timer=false;
                if (Codex.Trace.gestures) fdjtLog("toc_slipped/timeout %o",evt);
                Codex.stopPreview("toc_slipped");},
                                  500);}}

    /* Slice handlers */

    function getCard(target){
        return ((hasClass(target,"codexcard"))?(target):
                (getParent(target,".codexcard")))||
            getChild(target,".codexcard");}

    function heart_touched(evt){
        var target=fdjtUI.T(evt);
        if (fdjt.UI.isClickable(target)) return;
        if (target===Codex.DOM.heart) {
            cancel(evt);
            Codex.setMode(false);}
        else fdjt.UI.cancel(evt);}

    function slice_tapped(evt){
        var target=fdjtUI.T(evt);
        if (Codex.Trace.gestures)
            fdjtLog("slice_tapped %o: %o",evt,target);
        if (getParent(target,".ellipsis")) {
            fdjtUI.Ellipsis.toggle(target);
            fdjtUI.cancel(evt);
            return;}
        var card=getCard(target);
        var passage=fdjtID(card.getAttribute("data-passage"));
        var glossid=fdjtID(card.getAttribute("data-gloss"));
        var gloss=((glossid)&&(Codex.glossdb.ref(glossid)));
        if (getParent(target,".detail")) {
            var detail=((gloss)&&(gloss.detail));
            if (!(detail)) return;
            else if (detail[0]==='<')
                fdjt.ID("CODEXGLOSSDETAIL").innerHTML=gloss.detail;
            else fdjt.ID("CODEXGLOSSDETAIL").innerHTML=
                "<pre>\n"+gloss.detail+"\n</pre>";
            Codex.setMode("glossdetail");
            return fdjtUI.cancel(evt);}
        else if ((!(gloss))&&(passage)) {
            Codex.Scan(passage,card,false);
            return fdjtUI.cancel(evt);}
        else if ((gloss)&&(getParent(target,".tool"))) {
            var form=Codex.setGlossTarget(gloss);           
            if (!(form)) return;
            Codex.setMode("addgloss");
            return fdjtUI.cancel(evt);}
        else if (gloss) {
            Codex.Scan(gloss,card,false);
            return fdjtUI.cancel(evt);}
        else return;}
    function slice_held(evt){
        evt=evt||event;
        var slice_target=fdjtUI.T(evt), card=getCard(slice_target);
        if (Codex.Trace.gestures)
            fdjtLog("slice_held %o: %o, scanning=%o",
                    evt,card,Codex.scanning);
        if (!(card)) return;
        // This is the case where we're already scanning this card
        // if ((Codex.scanning===card)&&(Codex.mode==="scanning")) return;
        // Put a clone of the card in the scanner
        var clone=card.cloneNode(true);
        clone.id="CODEXSCAN"; fdjtDOM.replace("CODEXSCAN",clone);
        // If we're currently previewing something, clear it
        if (Codex.previewTarget) {
            var drop=Codex.getDups(Codex.previewTarget);
            dropClass(drop,"codexpreviewtarget");
            Codex.clearHighlights(drop);
            Codex.previewTarget=false;}
        // Get the attributes of this card
        var passageid=card.getAttribute("data-passage");
        var glossid=card.getAttribute("data-gloss");
        var gloss=((glossid)&&Codex.glossdb.ref(glossid));
        var passage=fdjtID(passageid), show_target=false;
        var dups=Codex.getDups(passageid);
        // Set up for preview
        Codex.previewTarget=passage; addClass(dups,"codexpreviewtarget");
        if ((gloss)&&(gloss.excerpt)) {
            // Highlight the gloss excerpt
            var range=Codex.findExcerpt(dups,gloss.excerpt,gloss.exoff);
            if (range) {
                var starts=range.startContainer;
                if (!(getParent(starts,passage)))
                    // This is the case where the glosses excerpt
                    //  starts in a 'dup' generated by page layout
                    show_target=getTargetDup(starts,passage);
                fdjtUI.Highlight(range,"codexhighlightexcerpt");}}
        if (getParent(card,".sbookresults")) {
            // It's a search result, so highlight any matching terms
            var terms=Codex.query.tags;
            var info=Codex.docinfo[passageid];
            // knodeterms match tags to their originating strings
            var spellings=info.knodeterms;
            var i=0; var lim=terms.length; while (i<lim) {
                var term=terms[i++];
                var highlights=highlightTerm(term,passage,info,spellings);
                if (!(show_target))
                    if ((highlights)&&(highlights.length)&&
                        (!(getParent(highlights[0],passage))))
                        show_target=getTargetDup(highlights[0],passage);}}
        Codex.startPreview(show_target||passage,"slice_held");
        return fdjtUI.cancel(evt);}
    function slice_released(evt){
        var card=getCard(fdjtUI.T(evt||event));
        if (Codex.Trace.gestures) {
            fdjtLog("slice_released %o: %o, scanning=%o",evt,card);}
        Codex.stopPreview("slice_released");}
    function slice_slipped(evt){
        evt=evt||event;
        var rel=evt.relatedTarget||fdjtUI.T(evt);
        if (!(hasParent(rel,".codexslice"))) {
            if (slip_timer) return;
            slip_timer=setTimeout(function(){
                slip_timer=false;
                if (Codex.Trace.gestures)
                    fdjtLog("slice_slipped/timeout %o",evt);
                Codex.stopPreview("slice_slipped");},
                                  500);}}


    function getTargetDup(scan,target){
        var targetid=target.id;
        while (scan) {
            if (hasClass(scan,"codexpage")) return scan;
            else if ((scan.getAttribute)&&
                     ((scan.id===targetid)||
                      (scan.getAttribute("data-baseid")===targetid))) 
                return scan;
            else scan=scan.parentNode;}
        return target;}

    /* Highlighting terms in passages (for scanning, etc) */

    function highlightTerm(term,target,info,spellings){
        var words=[]; var highlights=[];
        if (typeof term === 'string')
            words=((spellings)&&(spellings[term]))||[term];
        else {
            var knodes=info.knodes;
            if (!(knodes)) knodes=[];
            else if (!(knodes instanceof Array)) knodes=[knodes];
            var i=0; var lim=knodes.length;
            while (i<lim) {
                var knode=knodes[i++];
                if ((knode===term)||(RefDB.contains(knode.allways,term))) {
                    var qid=knode._qid; var dterm=knode.dterm;
                    var spelling=
                        ((spellings)&&
                         ((spellings[qid])||(spellings[dterm])));
                    if (!(spelling)) {
                        var synonyms=knode.EN;
                        if (!(synonyms)) {}
                        else if (typeof synonyms === 'string')
                            words.push(synonyms);
                        else words=words.concat(synonyms);
                        var hooks=knode.hooks;
                        if (!(hooks)) {}
                        else if (typeof hooks === 'string')
                            words.push(hooks);
                        else words=words.concat(hooks);}
                    else if (typeof spelling === 'string')
                        words.push(spelling);
                    else words=words.concat(spelling);}}
            if (words.length===0) words=false;}
        if (!(words)) return [];
        if (typeof words === 'string') words=[words];
        var j=0; var jlim=words.length;
        while (j<jlim) {
            var word=words[j++];
            var pattern=new RegExp(word.replace(/\s+/g,"(\\s+)"),"gim");
            var dups=Codex.getDups(target);
            var ranges=fdjtDOM.findMatches(dups,pattern);
            if (Codex.Trace.highlight)
                fdjtLog("Trying to highlight %s (using %o) in %o, ranges=%o",
                        word,pattern,target,ranges);
            if ((ranges)&&(ranges.length)) {
                var k=0; while (k<ranges.length) {
                    var h=fdjtUI.Highlight(
                        ranges[k++],"codexhighlightsearch");
                    highlights=highlights.concat(h);}}}
        return highlights;}
    Codex.highlightTerm=highlightTerm;

    /* Keyboard handlers */

    // We use keydown to handle navigation functions and keypress
    //  to handle mode changes
    function onkeydown(evt){
        evt=evt||event||null;
        var kc=evt.keyCode;
        var target=fdjtUI.T(evt);
        // fdjtLog("sbook_onkeydown %o",evt);
        if (evt.keyCode===27) { /* Escape works anywhere */
            if (Codex.previewing) {
                Codex.stopPreview("escape_key");
                fdjtUI.TapHold.clear();}
            if (Codex.mode) {
                Codex.last_mode=Codex.mode;
                Codex.setMode(false);
                Codex.setTarget(false);
                fdjtID("CODEXSEARCHINPUT").blur();}
            else {}
            return;}
        else if ((target.tagName==="TEXTAREA")||
                 (target.tagName==="INPUT"))
            return;
        else if (Codex.previewing) {
            // Any key stops a preview (and is ignored)
            var previewing=Codex.previewing;
            var preview_target=Codex.previewTarget;
            Codex.stopPreview("onkeydown");
            fdjtUI.TapHold.clear();
            Codex.setHUD(false);
            fdjt.UI.cancel(evt);
            return false;}
        else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
        else if (kc===34) Codex.pageForward(evt);   /* page down */
        else if (kc===33) Codex.pageBackward(evt);  /* page up */
        else if (kc===40) { /* arrow down */
            Codex.setHUD(false);
            Codex.pageForward(evt);}
        else if (kc===38) {  /* arrow up */
            Codex.setHUD(false);
            Codex.pageBackward(evt);}
        else if (kc===37) Codex.scanBackward(evt); /* arrow left */
        else if (kc===39) Codex.scanForward(evt); /* arrow right */
        // Don't interrupt text input for space, etc
        else if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
        else if (kc===32) // Space
            Codex.Forward(evt);
        // backspace or delete
        else if ((kc===8)||(kc===45))
            Codex.Backward(evt);
        // Home goes to the current head.
        else if (kc===36) Codex.JumpTo(Codex.head);
        else if (Codex.mode==="addgloss") {
            var mode=Codex.getGlossMode();
            if (mode) return;
            var formdiv=fdjtID("CODEXLIVEGLOSS");
            var form=(formdiv)&&(fdjtDOM.getChild(formdiv,"FORM"));
            if (!(form)) return;
            if (kc===13) { // return/newline
                submitEvent(form);}
            else if ((kc===35)||(kc===91)) // # or [
                Codex.setGlossMode("addtag",form);
            else if (kc===32) // Space
                Codex.setGlossMode("editnote",form);
            else if ((kc===47)||(kc===58)) // /or :
                Codex.setGlossMode("addlink",form);
            else if ((kc===64)) // @
                Codex.setGlossMode("addoutlet",form);
            else {}}
        else return;
        fdjtUI.cancel(evt);}

    // At one point, we had the shift key temporarily raise/lower the HUD.
    //  We might do it again, so we keep this definition around
    function onkeyup(evt){
        evt=evt||event||null;
        if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
        else if ((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)) return true;
        else {}}
    Codex.UI.handlers.onkeyup=onkeyup;

    /* Keypress handling */

    // We have a big table of command characters which lead to modes
    var modechars={
        63: "searching",102: "searching",
        65: "openheart", 97: "openheart",
        83: "searching",115: "searching",
        80: "gotopage",112: "gotopage",
        76: "gotoloc",108: "gotoloc",
        70: "searching",
        100: "device",68: "device",
        110: "toc",78: "toc",
        116: "flytoc",84: "flytoc", 72: "help", 
        103: "allglosses",71: "allglosses",
        67: "console", 99: "console"};

    // Handle mode changes
    function onkeypress(evt){
        var modearg=false; 
        evt=evt||event||null;
        var ch=evt.charCode||evt.keyCode;
        // Codex.trace("sbook_onkeypress",evt);
        if (fdjtDOM.isTextInput(fdjtDOM.T(evt))) return true;
        else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
        else if ((ch===72)||(ch===104)) { // 'H' or 'h'
            fdjtDOM.toggleClass(document.body,'codexhelp');
            return false;}
        else modearg=modechars[ch];
        if (modearg==="openheart")
            modearg=Codex.last_heartmode||"about";
        var mode=Codex.setMode();
        if (modearg) {
            if (mode===modearg) {
                Codex.setMode(false); mode=false;}
            else {
                Codex.setMode(modearg); mode=modearg;}}
        else {}
        if (mode==="searching")
            Codex.setFocus(fdjtID("CODEXSEARCHINPUT"));
        else fdjtID("CODEXSEARCHINPUT").blur();
        fdjtDOM.cancel(evt);}
    Codex.UI.handlers.onkeypress=onkeypress;

    function goto_keypress(evt){
        evt=evt||event||null;
        var target=fdjtUI.T(evt);
        var ch=evt.charCode||evt.keyCode;
        var max=false; var min=false;
        var handled=false;
        if (target.name==='GOTOLOC') {
            min=0; max=Math.floor(Codex.ends_at/128);}
        else if (target.name==='GOTOPCT') {
            min=0; max=100;}
        else if (target.name==='GOTOPAGE') {
            min=1; max=Codex.pagecount;}
        else if (ch===13) fdjtUI.cancel(evt);
        if (ch===13) {
            if (target.name==='GOTOPAGE') {
                var num=parseInt(target.value,10);
                if (typeof num === 'number') {
                    handled=true; Codex.GoToPage(num);}
                else {}}
            else if (target.name==='GOTOPCT') {
                var pctstring=target.value;
                var pct=parseFloat(pctstring);
                if ((typeof pct === 'number')&&(pct>=0)&&(pct<=100)) {
                    var goto_loc=Math.floor((pct/100)*Codex.ends_at)+1;
                    Codex.JumpTo(goto_loc); handled=true;}}
            else if (target.name==='GOTOLOC') {
                var locstring=target.value;
                var loc=parseFloat(locstring);
                if ((typeof loc === 'number')&&(loc>=0)&&(loc<=100)) {
                    loc=Math.floor((loc/100)*Codex.ends_at)+1;
                    Codex.JumpTo(loc); handled=true;}
                else {Codex.JumpTo(Math.floor(loc)); handled=true;}}
            else {}
            if (handled) {
                target.value="";
                Codex.setMode(false);}}}
    Codex.UI.goto_keypress=goto_keypress;

    function glossdeleted(response,glossid,frag){
        if (response===glossid) {
            Codex.glossdb.drop(glossid);
            var editform=fdjtID("CODEXEDITGLOSS_"+glossid);
            if (editform) {
                var editor=editform.parentNode;
                if (editor===fdjtID('CODEXLIVEGLOSS')) {
                    Codex.glosstarget=false;
                    Codex.setMode(false);}
                fdjtDOM.remove(editor);}
            var renderings=fdjtDOM.Array(document.getElementsByName(glossid));
            if (renderings) {
                var i=0; var lim=renderings.length;
                while (i<lim) {
                    var rendering=renderings[i++];
                    if (rendering.id==='CODEXSCAN')
                        fdjtDOM.replace(
                            rendering,fdjtDOM("div.codexcard.deletedgloss"));
                    else fdjtDOM.remove(rendering);}}
            var glossmarks=document.getElementsByName("CODEX_GLOSSMARK_"+frag);
            var j=0, jlim=glossmarks.length; while (j<jlim) {
                var glossmark=glossmarks[j++];
                var newglosses=RefDB.remove(glossmark.glosses,glossid);
                if (newglosses.length===0) fdjtDOM.remove(glossmark);
                else glossmark.glosses=newglosses;}}
        else fdjtUI.alert(response);}

    function delete_gloss(uuid){
        var gloss=Codex.glossdb.probe(uuid);
        // If this isn't defined, the gloss hasn't been saved so we
        //  don't try to delete it.
        if ((gloss)&&(gloss.created)&&(gloss.maker)) {
            var frag=gloss.get("frag");
            fdjt.Ajax.jsonCall(
                function(response){glossdeleted(response,uuid,frag);},
                "https://"+Codex.server+"/v1/delete",
                "gloss",uuid);}
        else if ((gloss)&&(gloss.frag)) {
            // This is the case where the gloss hasn't been saved
            //  or is an anonymous gloss by a non-logged in user
            glossdeleted(uuid,uuid,gloss.frag);}}
    
    function addoutlet_keydown(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var content=target.value;
        var glossdiv=fdjtID("CODEXLIVEGLOSS");
        if (!(glossdiv)) return;
        var form=getChild(glossdiv,"FORM");
        var share_cloud=Codex.share_cloud;
        var ch=evt.keyCode||evt.charCode;
        if ((fdjtString.isEmpty(content))&&(ch===13)) {
            if (share_cloud.selection) 
                Codex.addOutlet2Form(
                    form,share_cloud.selection.getAttribute("value"));
            else Codex.setGlossMode("editnote");
            return;}
        else if ((ch===13)&&(share_cloud.selection)) {
            Codex.addOutlet2Form(form,share_cloud.selection);
            share_cloud.complete("");
            target.value="";}
        else if (ch===13) {
            var completions=share_cloud.complete(content);
            if (completions.length)
                Codex.addOutlet2Form(
                    form,completions[0].getAttribute("value"));
            else Codex.addOutlet2Form(form,content);
            fdjtUI.cancel(evt);
            target.value="";
            share_cloud.complete("");}
        else if (ch===9) { /* tab */
            share_cloud.complete(content);
            fdjtUI.cancel(evt);
            if ((share_cloud.prefix)&&
                (share_cloud.prefix!==content)) {
                target.value=share_cloud.prefix;
                fdjtDOM.cancel(evt);
                setTimeout(function(){
                    Codex.UI.updateScroller("CODEXGLOSSOUTLETS");},
                           100);
                return;}
            else if (evt.shiftKey) share_cloud.selectPrevious();
            else share_cloud.selectNext();}
        else setTimeout(function(){
            share_cloud.complete(target.value);},
                        100);}

    function addtag_keydown(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var content=target.value;
        var glossdiv=fdjtID("CODEXLIVEGLOSS");
        if (!(glossdiv)) return;
        var form=getChild(glossdiv,"FORM");
        var gloss_cloud=Codex.gloss_cloud;
        var ch=evt.keyCode||evt.charCode;
        if ((fdjtString.isEmpty(content))&&(ch===13)) {
            if (gloss_cloud.selection) 
                Codex.addTag2Form(form,gloss_cloud.selection);
            else Codex.setGlossMode(false);
            gloss_cloud.clearSelection();
            return;}
        else if ((ch===13)&&(gloss_cloud.selection)) {
            Codex.addTag2Form(form,gloss_cloud.selection);
            gloss_cloud.complete("");
            gloss_cloud.clearSelection();
            target.value="";}
        else if (ch===13) {
            gloss_cloud.complete(content);
            if ((content.indexOf('|')>=0)||
                (content.indexOf('@')>=0))
                Codex.addTag2Form(form,content);
            else Codex.handleTagInput(content,form,true);
            fdjtUI.cancel(evt);
            target.value="";
            gloss_cloud.complete("");}
        else if (ch===9) { /* tab */
            gloss_cloud.complete(content);
            fdjtUI.cancel(evt);
            if ((gloss_cloud.prefix)&&
                (gloss_cloud.prefix!==content)) {
                target.value=gloss_cloud.prefix;
                fdjtDOM.cancel(evt);
                setTimeout(function(){
                    Codex.UI.updateScroller("CODEXGLOSSCLOUD");},
                           100);
                return;}
            else if (evt.shiftKey) gloss_cloud.selectPrevious();
            else gloss_cloud.selectNext();}
        else setTimeout(function(){
            gloss_cloud.complete(target.value);},
                        100);}

    function addlink_action(evt){
        var linkinput=fdjtID("CODEXATTACHURL");
        var titleinput=fdjtID("CODEXATTACHTITLE");
        var livegloss=fdjtID("CODEXLIVEGLOSS");
        if (!(livegloss)) return;
        var form=getChild(livegloss,"FORM");
        Codex.addLink2Form(form,linkinput.value,titleinput.value);
        linkinput.value="";
        titleinput.value="";
        Codex.setGlossMode("editnote");
        fdjtUI.cancel(evt);}
    function addlink_submit(evt){
        fdjtUI.cancel(evt);
        var linkinput=fdjtID("CODEXATTACHURL");
        var titleinput=fdjtID("CODEXATTACHTITLE");
        var livegloss=fdjtID("CODEXLIVEGLOSS");
        if (!(livegloss)) return;
        var form=getChild(livegloss,"FORM");
        Codex.addLink2Form(form,linkinput.value,titleinput.value);
        linkinput.value="";
        titleinput.value="";
        Codex.setGlossMode("editnote");
        fdjtUI.cancel(evt);}
    function addlink_cancel(evt){
        var linkinput=fdjtID("CODEXATTACHURL");
        var titleinput=fdjtID("CODEXATTACHTITLE");
        var livegloss=fdjtID("CODEXLIVEGLOSS");
        if (!(livegloss)) return;
        linkinput.value="";
        titleinput.value="";
        Codex.setGlossMode("editnote");
        fdjtUI.cancel(evt);}
    function addlink_keydown(evt){
        evt=evt||event;
        var ch=evt.keyCode||evt.charCode;
        if (ch!==13) return;
        fdjtUI.cancel(evt);
        var linkinput=fdjtID("CODEXATTACHURL");
        var titleinput=fdjtID("CODEXATTACHTITLE");
        var livegloss=fdjtID("CODEXLIVEGLOSS");
        if (!(livegloss)) return;
        var form=getChild(livegloss,"FORM");
        Codex.addLink2Form(form,linkinput.value,titleinput.value);
        linkinput.value="";
        titleinput.value="";
        Codex.setGlossMode("editnote");}

    /* HUD button handling */

    var mode_hud_map={
        "toc": "CODEXTOC",
        "searching": "CODEXSEARCH",
        "allglosses": "CODEXSOURCES"};
    
    function hudbutton(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var mode=target.getAttribute("hudmode");
        if ((Codex.Trace.gestures)&&
            ((evt.type==='tap')||
             (evt.type==='click')||
             (evt.type==='touchend')||
             (evt.type==='touchstart')||
             (evt.type==='release')||
             (Codex.Trace.gestures>1)))
            fdjtLog("hudbutton() %o mode=%o cl=%o scan=%o sbh=%o mode=%o",
                    evt,mode,(isClickable(target)),
                    Codex.scanning,Codex.hudup,Codex.setMode());
        if (reticle.live) reticle.flash();
        fdjtUI.cancel(evt);
        if (!(mode)) return;
        var hudid=((mode)&&(mode_hud_map[mode]));
        var hud=fdjtID(hudid);
        if ((evt.type==='click')||(evt.type==='tap')||
            (evt.type==='touchstart')||(evt.type==='touchend')||
            (evt.type==='release')) {
            if (hud) dropClass(hud,"hover");
            if ((Codex.scanning)&&(!(Codex.hudup))) {
                if (mode==="refinesearch") {
                    Codex.setMode("searchresults"); return;}
                else if (mode==="allglosses") {
                    Codex.setMode("allglosses"); return;}}
            if (fdjtDOM.hasClass(Codex.HUD,mode)) Codex.setMode(false);
            else if ((mode==="search")&&
                     (fdjtDOM.hasClass(Codex.HUD,/((refinesearch)|(searchresults)|(expandsearch))/)))
                Codex.setMode(false);
            else Codex.setMode(mode);}
        else if ((evt.type==='mouseover')&&(Codex.mode))
            return;
        else {
            if (!(hud)) {}
            else if (evt.type==='mouseover')
                addClass(hud,"hover");
            else if (evt.type==='mouseout')
                dropClass(hud,"hover");
            else {}}}
    Codex.UI.hudbutton=hudbutton;

    Codex.UI.dropHUD=function(evt){
        var target=fdjtUI.T(evt);
        if (isClickable(target)) {
            if (Codex.Trace.gestures)
                fdjtLog("Clickable: don't dropHUD %o",evt);
            return;}
        if (Codex.Trace.gestures) fdjtLog("dropHUD %o",evt);
        fdjtUI.cancel(evt); Codex.setMode(false);};

    /* Gesture state */

    var touch_started=false; var touch_ref=false;
    var page_x=-1; var page_y=-1;
    var touch_moves=0;
    var touch_held=false;
    var touch_moved=false;
    var touch_scrolled=false;
    var n_touches=0;

    /* Tracing touch */
    
    function tracetouch(handler,evt){
        evt=evt||event;
        var touches=evt.touches;
        var touch=(((touches)&&(touches.length))?(touches[0]):(evt));
        var target=fdjtUI.T(evt); var ref=Codex.getRef(target);
        if (touch_started)
            fdjtLog("%s(%o) n=%o %sts=%o %s@%o\n\t+%o %s%s%s%s%s%s%s s=%o,%o l=%o,%o p=%o,%o d=%o,%o ref=%o tm=%o",
                    handler,evt,((touches)&&(touches.length)),
                    ((!(touch))?(""):
                     ("c="+touch.clientX+","+touch.clientY+";s="+touch.screenX+","+touch.screenY+" ")),
                    touch_started,evt.type,target,
                    fdjtTime()-touch_started,
                    ((Codex.mode)?(Codex.mode+" "):""),
                    ((Codex.scanning)?"scanning ":""),
                    ((touch_held)?("held "):("")),
                    ((touch_moved)?("moved "):("")),
                    ((touch_scrolled)?("scrolled "):("")),
                    ((isClickable(target))?("clickable "):("")),
                    ((touch)?"":"notouch "),
                    start_x,start_y,last_x,last_y,page_x,page_y,
                    (((touch)&&(touch.screenX))?(touch.screenX-page_x):0),
                    (((touch)&&(touch.screenY))?(touch.screenY-page_y):0),
                    touch_ref,touch_moves);
        else fdjtLog("%s(%o) n=%o %s%s c=%o,%o p=%o,%o ts=%o %s@%o ref=%o",
                     handler,evt,((touches)&&(touches.length)),
                     ((Codex.mode)?(Codex.mode+" "):""),
                     ((Codex.scanning)?"scanning ":""),
                     touch.clientX,touch.clientY,touch.screenX,touch.screenY,
                     touch_started,evt.type,target,ref);
        if (ref) fdjtLog("%s(%o) ref=%o from %o",handler,evt,ref,target);}


    /* Default click/tap */
    function default_tap(evt){
        var target=fdjtUI.T(evt);
        if (fdjtUI.isClickable(target)) return;
        else if (((Codex.hudup)||(Codex.mode))) {
            Codex.setMode(false);}
        else {
            var cx=evt.clientX, cy=evt.clientY;
            var w=fdjtDOM.viewWidth(), h=fdjtDOM.viewHeight;
            if ((cy<60)||(cy>(h-60))) return;
            if (cx<w/3) Codex.Backward(evt);
            else if (cx>w/2) Codex.Forward(evt);}}

    /* Glossmarks */
    
    function glossmark_tapped(evt){
        evt=evt||event||null;
        if (held) clear_hold("glossmark_tapped");
        if ((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)||(evt.shiftKey))
            return;
        var target=fdjtUI.T(evt);
        var glossmark=getParent(target,".codexglossmark");
        var passage=getTarget(glossmark.parentNode,true);
        if ((passage)&&(passage.getAttribute("data-baseid"))) 
            passage=fdjtID(passage.getAttribute("data-baseid"));
        if (Codex.Trace.gestures)
            fdjtLog("glossmark_tapped (%o) on %o gmark=%o passage=%o mode=%o target=%o",
                    evt,target,glossmark,passage,Codex.mode,Codex.target);
        if (!(glossmark)) return false;
        fdjtUI.cancel(evt);
        if ((Codex.mode==='openglossmark')&&
            (Codex.target===passage)) {
            Codex.setMode(false);
            return;}
        else Codex.showGlossmark(passage,glossmark);}

    var animated_glossmark=false;
    var glossmark_animated=false;
    var glossmark_image=false;
    function animate_glossmark(target,enable){
        if ((target)&&(enable)) {
            var glossmark=((hasClass(target,"codexglossmark"))?(target):
                           (getParent(target,".codexglossmark")));
            if (!(glossmark)) return;
            if (animated_glossmark===glossmark) return;
            if (glossmark_animated) {
                clearInterval(glossmark_animated);
                animated_glossmark=false;
                glossmark_animated=false;
                if (glossmark_image) fdjtUI.ImageSwap.reset(glossmark_image);}
            var wedge=fdjtDOM.getChild(glossmark,"img.wedge");
            if (!(wedge)) return;
            animated_glossmark=glossmark;
            glossmark_image=wedge;
            glossmark_animated=fdjtUI.ImageSwap(wedge,750);}
        else {
            if (Codex.clearGlossmark) Codex.clearGlossmark();
            if (glossmark_animated) {
                clearInterval(glossmark_animated);
                animated_glossmark=false;
                glossmark_animated=false;
                if (glossmark_image) fdjtUI.ImageSwap.reset(glossmark_image);
                glossmark_image=false;}}}

    function glossmark_hoverstart(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var passage=getTarget(target);
        if (!(fdjtDOM.hasClass(passage,"codextarget")))
            animate_glossmark(target,true);}

    function glossmark_hoverdone(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var passage=getTarget(target);
        if (!(fdjtDOM.hasClass(passage,"codextarget")))
            animate_glossmark(target,false);}

    function setTargetUI(target){
        if (target) {
            var glossmark=fdjtDOM.getChild(target,".codexglossmark");
            if (glossmark) animate_glossmark(glossmark,true);
            else animate_glossmark(false,false);}
        else animate_glossmark(false,false);}
    Codex.UI.setTarget=setTargetUI;

    /* Various actions */

    function clearOfflineAction(evt){
        evt=evt||event;
        fdjtUI.cancel(evt);
        Codex.clearOffline();
        // We change this here, so we don't save what's cached in
        //  memory now, but it doesn't change the saved setting (so we
        //  might still be persisting).
        Codex.persist=false;
        fdjtUI.alertFor(5,"Cleared locally stored glosses and other information");
        return false;}
    Codex.UI.clearOfflineAction=clearOfflineAction;

    function forceSyncAction(evt){
        evt=evt||event;
        fdjtUI.cancel(evt);
        Codex.forceSync();
        if (!(navigator.onLine))
            fdjtUI.alertFor(
                15,"You're currently offline; information will be synchronized when you're back online");
        else if (!(Codex.connected))
            fdjtUI.alertFor(
                15,"You're not currently logged into sBooks.  Information will be synchronized when you've logged in.");
        else fdjtUI.alertFor(7,"Sychronizing glosses, etc with the remote server");
        return false;}
    Codex.UI.forceSyncAction=forceSyncAction;


    /* Moving forward and backward */

    var last_motion=false;

    function forward(evt){
        var now=fdjtTime();
        if (!(evt)) evt=event||false;
        if (evt) fdjtUI.cancel(evt);
        if ((last_motion)&&((now-last_motion)<100)) return;
        else last_motion=now;
        if (Codex.Trace.nav)
            fdjtLog("Forward e=%o h=%o t=%o",evt,Codex.head,Codex.target);
        if (((evt)&&(evt.shiftKey))||(n_touches>1))
            scanForward(evt);
        else pageForward(evt);}
    Codex.Forward=forward;
    function right_margin(evt){
        if (Codex.Trace.gestures) tracetouch("right_margin",evt);
        else if ((Codex.mode==="scanning")||
                 (Codex.mode==="tocscan"))
            scanForward(evt);
        else forward(evt);
        cancel(evt);}

    function backward(evt){
        var now=fdjtTime();
        if (!(evt)) evt=event||false;
        if (evt) fdjtUI.cancel(evt);
        if ((last_motion)&&((now-last_motion)<100)) return;
        else last_motion=now;
        if (Codex.Trace.nav)
            fdjtLog("Backward e=%o h=%o t=%o",evt,Codex.head,Codex.target);
        if (((evt)&&(evt.shiftKey))||(n_touches>1))
            scanBackward();
        else pageBackward();}
    Codex.Backward=backward;
    function left_margin(evt){
        if (Codex.Trace.gestures) tracetouch("left_margin",evt);
        if ((Codex.hudup)&&
            (Codex.mode!=="scanning")&&
            (Codex.mode!=="tocscan"))
            Codex.setMode(false);
        else if ((Codex.mode==="scanning")||
                 (Codex.mode==="tocscan"))
            scanBackward(evt);
        else backward(evt);
        cancel(evt);}

    function pageForward(evt){
        evt=evt||event;
        if ((Codex.Trace.gestures)||(Codex.Trace.flips))
            fdjtLog("pageForward (on %o) c=%o n=%o",
                    evt,Codex.curpage,Codex.pagecount);
        if (Codex.clearGlossmark) Codex.clearGlossmark();
        if ((Codex.bypage)&&(Codex.pagecount)) {
            var newpage=false;
            if (Codex.curpage===Codex.pagecount) {}
            else Codex.GoToPage(newpage=Codex.curpage+1,"pageForward",true,true);}
        else {
            var delta=fdjtDOM.viewHeight()-50;
            if (delta<0) delta=fdjtDOM.viewHeight();
            var newy=fdjtDOM.viewTop()+delta;
            window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    Codex.pageForward=pageForward;

    function pageBackward(evt){
        if ((Codex.Trace.gestures)||(Codex.Trace.flips))
            fdjtLog("pageBackward (on %o) c=%o n=%o",
                    evt,Codex.curpage,Codex.pagecount);
        if (Codex.clearGlossmark) Codex.clearGlossmark();
        if ((Codex.bypage)&&(Codex.pagecount)) {
            var newpage=false;
            if (Codex.curpage===0) {}
            else {
                newpage=Codex.curpage-1;
                Codex.GoToPage(newpage,"pageBackward",true,true);}}
        else {
            var delta=fdjtDOM.viewHeight()-50;
            if (delta<0) delta=fdjtDOM.viewHeight();
            var newy=fdjtDOM.viewTop()-delta;
            window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    Codex.pageBackward=pageBackward;

    function scanForward(evt){
        evt=evt||event;
        if (Codex.mode==="scanning") {}
        else if (Codex.mode==="tocscan") {}
        else if (Codex.mode==="openglossmark") {
            var ids=Codex.docinfo._ids;
            var id=((Codex.target)&&(Codex.target.id));
            var glossdb=Codex.glossdb;
            var i, lim=ids.length;
            if ((id)&&((i=RefDB.position(ids,id))>0)) {
                i++; while (i<lim) {
                    var g=glossdb.find('frag',ids[i]);
                    if ((g)&&(g.length)) {
                        var passage=fdjtID(ids[i]);
                        var glossmark=fdjtDOM.getChild(passage,".codexglossmark");
                        Codex.GoTo(passage,"scanForward/glosses",true);
                        Codex.showGlossmark(passage,glossmark);
                        return;}
                    else i++;}}
            Codex.setMode(false);
            return;}
        else if (Codex.scanning) Codex.setMode("scanning");
        else Codex.setMode("tocscan");
        if (Codex.mode==="tocscan") {
            var head=Codex.head;
            var headid=head.codexbaseid||head.id;
            var headinfo=Codex.docinfo[headid];
            if (Codex.Trace.nav) 
                fdjtLog("scanForward/toc() head=%o info=%o n=%o h=%o",
                        head,headinfo,headinfo.next,headinfo.head);
            if (headinfo.next) Codex.GoTo(headinfo.next.frag,"scanForward");
            else if ((headinfo.head)&&(headinfo.head.next)) {
                Codex.GoTo(headinfo.head.next.frag,"scanForward");
                Codex.setMode("toc");}
            else if ((headinfo.head)&&(headinfo.head.head)&&
                     (headinfo.head.head.next)) 
                Codex.GoTo(headinfo.head.head.next.frag,"scanForward");
            else Codex.setMode(false);
            return;}
        if ((Codex.scanpoints)&&
            ((Codex.scanoff+1)<Codex.scanpoints.length)) {
            Codex.scanoff++;
            Codex.GoTo(Codex.scanpoints[Codex.scanoff]);
            return;}
        var start=Codex.scanning;
        var scan=Codex.nextSlice(start);
        var ref=((scan)&&(Codex.getRef(scan)));
        if ((Codex.Trace.gestures)||(Codex.Trace.flips)||(Codex.Trace.nav)) 
            fdjtLog("scanForward (on %o) from %o/%o to %o/%o under %o",
                    evt,start,Codex.getRef(start),scan,ref,Codex.scanning);
        if ((ref)&&(scan)) Codex.Scan(ref,scan);
        return scan;}
    Codex.scanForward=scanForward;

    function scanBackward(evt){
        if (Codex.mode==="scanning") {}
        else if (Codex.mode==="tocscan") {}
        else if (Codex.mode==="openglossmark") {
            var ids=Codex.docinfo._ids;
            var id=((Codex.target)&&(Codex.target.id));
            var glossdb=Codex.glossdb;
            var i=ids.length;
            if ((id)&&((i=RefDB.position(ids,id))>0)) {
                i--; while (i>=0) {
                    var g=glossdb.find('frag',ids[i]);
                    if ((g)&&(g.length)) {
                        var passage=fdjtID(ids[i]);
                        var glossmark=fdjtDOM.getChild(passage,".codexglossmark");
                        Codex.GoTo(passage,"scanBackward/glosses",true);
                        Codex.showGlossmark(passage,glossmark);
                        return;}
                    else i--;}}
            Codex.setMode(false);
            return;}
        else if (Codex.scanning) Codex.setMode("scanning");
        else Codex.setMode("tocscan");
        if (Codex.mode==="tocscan") {
            var head=Codex.head;
            var headid=head.codexbaseid||head.id;
            var headinfo=Codex.docinfo[headid];
            if (Codex.Trace.nav) 
                fdjtLog("scanBackward/toc() head=%o info=%o p=%o h=%o",
                        head,headinfo,headinfo.prev,headinfo.head);
            if (headinfo.prev) Codex.GoTo(headinfo.prev.frag,"scanBackward");
            else if (headinfo.head) 
                Codex.GoTo(headinfo.head.frag,"scanBackward");
            else Codex.setMode(false);
            return;}
        if ((Codex.scanpoints)&&(Codex.scanoff>0)) {
            Codex.scanoff--;
            Codex.GoTo(Codex.scanpoints[Codex.scanoff]);
            return;}
        var start=Codex.scanning;
        var scan=Codex.prevSlice(start);
        var ref=((scan)&&(Codex.getRef(scan)));
        if ((Codex.Trace.gestures)||(Codex.Trace.flips)||(Codex.Trace.nav))
            fdjtLog("scanBackward (on %o) from %o/%o to %o/%o under %o",
                    evt,start,Codex.getRef(start),scan,ref,Codex.scanning);
        if ((ref)&&(scan)) Codex.Scan(ref,scan,true);
        return scan;}
    Codex.scanBackward=scanBackward;

    function scanner_tapped(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if (isClickable(target)) return;
        if (hasParent(target,fdjt.ID("CODEXEXPANDSCANNER"))) return;
        if ((getParent(target,".tool"))) {
            var card=getCard(target);
            if ((card)&&((card.name)||(card.getAttribute("name")))) {
                var name=(card.name)||(card.getAttribute("name"));
                var gloss=RefDB.resolve(name,Codex.glossdb);
                if (!(gloss)) return;
                var form=Codex.setGlossTarget(gloss);
                if (!(form)) return;
                Codex.setMode("addgloss");
                return;}
            else return;}
        if ((hasClass(target,"ellipsis"))||
            (getParent(target,".ellipsis"))) {
            var ellipsis=getParent(target,".ellipsis");
            if (ellipsis) {
                if (hasClass(ellipsis,"expanded")) {
                    dropClass(ellipsis,"expanded");}
                else {
                    addClass(ellipsis,"expanded");
                    fdjtDOM.addClass("CODEXSCANNER","expanded");}
                fdjtUI.cancel(evt);
                return;}}
        // Tapping the tochead returns to results/glosses/etc
        var scanning=Codex.scanning;
        if (!(scanning)) return;
        if (getParent(scanning,fdjtID("CODEXALLGLOSSES"))) {
            Codex.setMode("allglosses");
            fdjtUI.cancel(evt);}
        else if (getParent(scanning,fdjtID("CODEXSEARCHRESULTS"))) {
            Codex.setMode("searchresults");
            fdjtUI.cancel(evt);}
        else {}
        return;}

    /* Entering page numbers and locations */

    function enterPageNum(evt) {
        evt=evt||event;
        if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}
        fdjtUI.cancel(evt);
        if (Codex.hudup) {Codex.setMode(false); return;}
        Codex.toggleMode("gotopage");}
    function enterLocation(evt) {
        evt=evt||event;
        if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}
        fdjtUI.cancel(evt);
        if (Codex.hudup) {Codex.setMode(false); return;}
        Codex.toggleMode("gotoloc");}
    function enterPercentage(evt) {
        evt=evt||event;
        if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}
        fdjtUI.cancel(evt);
        if (Codex.hudup) {Codex.setMode(false); return;}
        Codex.toggleMode("gotopct");}
    
    /* Other handlers */

    function flyleaf_tap(evt){
        if (isClickable(evt)) return;
        else Codex.setMode(false);}

    function head_tap(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if (Codex.Trace.gestures) fdjtLog("head_tap %o t=%o",evt,target);
        if (fdjtUI.isClickable(target)) return;
        if (!((target===Codex.DOM.head)||
              (target===Codex.DOM.tabs)))
            return;
        else if (Codex.mode) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);}
        else if (fdjtDOM.hasClass(document.body,"codexhelp")) {
            fdjtUI.cancel(evt);
            fdjtDOM.dropClass(document.body,"codexhelp");}
        else if (Codex.hudup) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);}
        else {
            fdjtUI.cancel(evt);
            Codex.setMode(true);}}
    function foot_tap(evt){
        if (Codex.Trace.gestures) fdjtLog("foot_tap %o",evt);
        if (isClickable(evt)) return;
        else if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}}

    function getGoPage(target){
        return parseInt(target.innerHTML,10);}

    var previewing_page=false, preview_start_page=false;
    function pageinfo_hold(evt){
        var pageinfo=fdjtID("CODEXPAGEINFO");
        if (preview_timer) {
            clearTimeout(preview_timer);
            preview_timer=false;}
        if ((Codex.hudup)||(Codex.mode)) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}
        var target=fdjtUI.T(evt);
        if (target.nodeType===3) target=target.parentNode;
        if (((hasParent(target,pageinfo))&&(target.tagName==="span")))
            return;
        var gopage=getGoPage(target,evt);
        if ((Codex.Trace.gestures)||(hasClass(pageinfo,"codextrace")))
            fdjtLog("pageinfo_span_hold %o t=%o gopage: %o=>%o/%o",
                    evt,target,previewing_page,gopage,Codex.pagecount);
        if (!(preview_start_page)) preview_start_page=gopage;
        if (previewing_page===gopage) return;
        if (!(gopage)) {
            // fdjtLog.warn("Couldn't get page from CODEXPAGEINFO");
            return;}
        if (previewing_page)
            pageinfo.title=fdjtString(
                "Release to go to this page (%d), move away to return to page %d",
                gopage,Codex.curpage);
        else pageinfo.title=fdjtString(
            ((Codex.touch)?
             ("Release to settle here (page %d), move up or tap the margin to return to page %d"):
             ("Release to settle here (page %d), move up or tap a key to return to page %d")),
            gopage,Codex.curpage);
        previewing_page=gopage;
        Codex.startPreview(gopage,"pageinfo_span_hold");}
    function pageinfo_tap(evt){
        var pageinfo=fdjtID("CODEXPAGEINFO");
        if (preview_timer) {
            clearTimeout(preview_timer);
            preview_timer=false;}
        if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}
        var target=fdjtUI.T(evt);
        if (target.nodeType===3) target=target.parentNode;
        if (((hasParent(target,pageinfo))&&(target.tagName==="span")))
            return;
        var gopage=getGoPage(target,evt);
        if (previewing_page===gopage) return;
        Codex.GoToPage(gopage,"pageinfo_tap",true);
        Codex.setMode(false);}
    function pageinfo_release(evt){
        var pageinfo=fdjtID("CODEXPAGEINFO");
        if (preview_timer) {
            clearTimeout(preview_timer);
            preview_timer=false;}
        if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}
        var target=fdjtUI.T(evt);
        if (target.nodeType===3) target=target.parentNode;
        dropClass(target,"preview");
        if (previewing_page===preview_start_page) {
            Codex.stopPagePreview("pageinfo_release");
            preview_start_page=false;
            previewing_page=false;
            return;}
        preview_start_page=false;
        previewing_page=false;
        if (((hasParent(target,pageinfo))&&(target.tagName==="span"))) {
            return;}
        var gopage=getGoPage(target,evt);
        Codex.GoToPage(gopage,"pageinfo_release",true);
        Codex.setMode(false);}
    function pageinfo_slip(evt){
        evt=evt||event;
        var rel=evt.relatedTarget;
        if ((rel)&&(hasParent(rel,Codex.body)))
            preview_timer=setTimeout(function(){
                var pageinfo=fdjtID("CODEXPAGEINFO");
                pageinfo.title=""; preview_timer=false;
                Codex.GoTo(rel,evt);},
                                     400);
        else preview_timer=setTimeout(function(){
            var pageinfo=fdjtID("CODEXPAGEINFO");
            pageinfo.title=""; preview_timer=false;
            Codex.stopPagePreview("pageinfo_slip");},
                                      400);
        previewing_page=false;}
    
    /* Gloss form handlers */

    /**** Clicking on outlets *****/
    
    function glossform_outlets_tapped(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if (getParent(target,".checkspan"))
            return fdjt.UI.CheckSpan.onclick(evt);
        else if (getParent(target,".sharing"))
            toggleClass(getParent(target,".sharing"),"expanded");
        else {}}
    Codex.UI.outlets_tapped=glossform_outlets_tapped;

    function outlet_tapped(evt){
        var target=fdjtUI.T(evt);
        var outletspan=fdjtDOM.getParent(target,'.outlet');
        if (!(outletspan)) return;
        var live=fdjtID("CODEXLIVEGLOSS");
        var form=((live)&&(fdjtDOM.getChild(live,"form")));
        var outlet=outletspan.value;
        Codex.addOutlet2Form(form,outlet);
        fdjtUI.cancel(evt);}


    /* The addgloss menu */

    var slip_timeout=false;

    function glossmode_tap(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var alt=target.alt;
        
        if (!(alt)) return;

        var menu=fdjtDOM.getParent(target,'.addglossmenu');
        var form=fdjtDOM.getParent(target,'form');
        
        if (alt==="hamburger") {
            Codex.setGlossMode(false,form);
            toggleClass(menu,"expanded");}
        else if (alt==="glossdelete") 
            addgloss_delete(menu,form);
        else if (alt==="glosspush") {
            Codex.submitGloss(form,true);
            dropClass(menu,"expanded");}
        else if (alt==="glossrespond") 
            addgloss_respond(menu,form);
        else if (alt===form.className) {
            Codex.setGlossMode(false,form);
            dropClass(menu,"expanded");}
        else if (Codex.glossmodes.exec(alt)) {
            Codex.setGlossMode(alt,form);
            dropClass(menu,"expanded");}
        else fdjtLog.warn("Bad alt=%s in glossmode_tap",alt);
        fdjtUI.cancel(evt);
        return;}

    function glossmode_hold(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var alt=target.alt;
        
        if (!(alt)) return;

        if (slip_timeout) {
            clearTimeout(slip_timeout);
            slip_timeout=false;}

        var menu=fdjtDOM.getParent(target,'.addglossmenu');
        
        addClass(target,"held");

        addClass(menu,"expanded");}

    function glossmode_release(evt) {
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var menu=fdjtDOM.getParent(target,'.addglossmenu');
        var form=fdjtDOM.getParent(target,'form');
        var alt=target.alt;
        dropClass(target,"held");
        if (alt==="glossdelete") 
            addgloss_delete(menu,form);
        else if (alt==="glosspush")
            Codex.submitGloss(form,true);
        else if (alt==="glossrespond") 
            addgloss_respond(menu,form);
        else if (Codex.glossmodes.exec(alt))
            Codex.setGlossMode(alt,form);
        else fdjtLog.warn("Bad alt=%s in glossmode_release",alt);
        dropClass(menu,"expanded");}

    function glossmode_slip(evt) {
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var menu=fdjtDOM.getParent(target,'.addglossmenu');
        dropClass(target,"held");
        if (!(slip_timeout)) {
            slip_timeout=setTimeout(function(){
                dropClass(menu,"expanded");},
                                    500);}}

    function addgloss_delete(menu,form,div){
        if (!(form)) form=getParent(menu,"FORM");
        if (!(div)) div=getParent(form,".codexglossform");
        var modified=fdjtDOM.hasClass(div,"modified");
        // This keeps it from being saved when it loses the focus
        dropClass(div,"modified");
        dropClass(menu,"expanded");
        var uuid=fdjtDOM.getInputValues(form,"UUID")[0];
        var gloss=Codex.glossdb.probe(uuid);
        if ((!(gloss))||(!(gloss.created))) {
            delete_gloss(uuid);
            Codex.setMode(false);
            fdjtDOM.remove(div);
            Codex.setGlossTarget(false);
            Codex.setTarget(false);
            return;}
        fdjt.UI.choose([{label: "Delete",
                         handler: function(){
                             delete_gloss(uuid);
                             Codex.setMode(false);
                             fdjtDOM.remove(div);
                             Codex.setGlossTarget(false);
                             Codex.setTarget(false);},
                         isdefault: true},
                        {label: ((modified)?("Discard"):("Close")),
                         handler: function(){
                             Codex.setMode(false);
                             fdjtDOM.remove(div);
                             Codex.setGlossTarget(false);
                             Codex.setTarget(false);}},
                        {label: "Cancel"}],
                       ((modified)?
                        ("Delete this gloss?  Discard your changes?"):
                        ("Delete this gloss or just close the box?")),
                       fdjtDOM(
                           "div.smaller",
                           "(Created ",
                           fdjtTime.shortString(gloss.created),
                           ")"));}

    function addgloss_respond(target){
        var block=getParent(target,".codexglossform");
        if (!(block)) return;
        var glosselt=fdjtDOM.getInput(block,'UUID');
        if (!(glosselt)) return;
        var qref=glosselt.value;
        var gloss=Codex.glossdb.probe(qref);
        if (!(gloss)) return;
        var form=Codex.setGlossTarget(gloss,Codex.getGlossForm(gloss,true));
        if (!(form)) return;
        Codex.setMode("addgloss");}
    
    /* Changing gloss networks */
    
    function changeGlossNetwork(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var alternate=fdjtID(
            (fdjtDOM.hasParent(target,".codexglossform"))?
                ("CODEXNETWORKBUTTONS"):(("CODEXLIVEGLOSS")));
        var doppels=fdjtDOM.getInputsFor(alternate,'NETWORK',target.value);
        fdjtUI.CheckSpan.set(doppels,target.checked);}
    Codex.UI.changeGlossNetwork=changeGlossNetwork;

    function changeGlossPosting(evt){
        var target=fdjtUI.T(evt=(evt||event));
        var glossdiv=fdjtDOM.getParent(target,".codexglossform");
        if (target.checked) fdjtDOM.addClass(glossdiv,"posted");
        else fdjtDOM.dropClass(glossdiv,"posted");}
    Codex.UI.changeGlossPosting=changeGlossPosting;

    function changeGlossPrivacy(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt=(evt||event));
        var glossdiv=fdjtDOM.getParent(target,".codexglossform");
        var postgloss=fdjtDOM.getChild(glossdiv,".postgloss");
        var postinput=(postgloss)&&(fdjtDOM.getInput(postgloss,"POSTGLOSS"));
        if (postgloss) {
            if (target.checked) {
                if (postinput) postinput.disabled=true;}
            else {
                if (postinput) postinput.disabled=false;}}
        if (target.checked) fdjtDOM.addClass(glossdiv,"private");
        else fdjtDOM.dropClass(glossdiv,"private");}
    Codex.UI.changeGlossPrivacy=changeGlossPrivacy;

    function exposureClicked(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var form=getParent(target,"FORM");
        if (form.className==="addoutlet")
            fdjt.UI.CheckSpan.onclick(evt);
        else Codex.setGlossMode("addoutlet");}
    Codex.UI.exposureClicked=exposureClicked;

    /* Back to the text */

    function back_to_reading(evt){
        evt=evt||event;
        fdjtUI.cancel(evt);
        Codex.setMode(false);
        fdjtDOM.dropClass(document.body,"codexhelp");}

    function scanner_expand_hold(evt){
        fdjtDOM.addClass("CODEXSCANNER","expanded");
        fdjtUI.cancel(evt);}
    function scanner_expand_tap(evt){
        fdjtDOM.toggleClass("CODEXSCANNER","expanded");
        fdjtUI.cancel(evt);}
    function scanner_expand_release(evt){
        fdjtDOM.dropClass("CODEXSCANNER","expanded");
        fdjtUI.cancel(evt);}

    /* Tracking text input */

    function setFocus(target){
        if (!(target)) {
            var cur=Codex.textinput;
            Codex.textinput=false;
            Codex.dont_resize=false;
            if (cur) cur.blur();
            setTimeout(function(){
                document.body.blur();
                setTimeout(function(){
                    document.body.focus();},0);},
                       0);
            return;}
        else if (Codex.textinput===target) return;
        else {
            Codex.textinput=target;
            Codex.dont_resize=true;
            target.focus();}}
    Codex.setFocus=setFocus;

    function codexfocus(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var input=getParent(target,'textarea');
        if (!(input)) input=getParent(target,'input');
        if ((!(input))||(typeof input.type !== "string")||
            (input.type.search(fdjtDOM.text_types)!==0))
            return;
        setFocus(input);}
    function codexblur(evt){
        evt=evt||event;
        var target=((evt.nodeType)?(evt):(fdjtUI.T(evt)));
        var input=getParent(target,'textarea');
        if (!(input)) input=getParent(target,'input');
        if ((!(input))||(typeof input.type !== "string")||
            (input.type.search(fdjtDOM.text_types)!==0))
            return;
        setFocus(false);}

    /* Rules */

    var cancel=fdjtUI.cancel;
    var taphold_click=fdjtUI.TapHold.click;

    function generic_cancel(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if (fdjtUI.isClickable(target)) return;
        else cancel(evt);}

    function hideSplash(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if (fdjtUI.isClickable(target)) return;
        else Codex.setMode(false);}

    function hideSplashToggle(evt) {
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var newval=(!(Codex.hidesplash));
        var input=getParent(target,"input");
        if (input)
            setTimeout(function(){
                Codex.setConfig("hidesplash",input.checked);
                Codex.saveConfig();},
                       100);
        else {
            Codex.setConfig("hidesplash",newval);
            Codex.saveConfig();}
        if ((newval)&&(Codex._setup)&&
            ((fdjtTime()-(Codex._setup.getTime()))<30000))
            Codex.setMode(false);}

    function toggleHelp(evt){
        evt=evt||event;
        fdjtUI.cancel(evt);
        if (Codex.cxthelp) {
            fdjtDOM.dropClass(document.body,"codexhelp");
            Codex.cxthelp=false;}
        else {
            fdjtDOM.addClass(document.body,"codexhelp");
            Codex.cxthelp=true;}
        return false;}
    Codex.toggleHelp=toggleHelp;

    function editglossnote(evt){
        evt=evt||event;
        Codex.setGlossMode("editnote");
        fdjtUI.cancel(evt);}

    fdjt.DOM.defListeners(
        Codex.UI.handlers.mouse,
        {window: {
            keyup: onkeyup,
            keydown: onkeydown,
            keypress: onkeypress,
            click: default_tap,
            focus: codexfocus,
            blur: codexblur},
         content: {tap: content_tapped,
                   hold: content_held,
                   slip: content_slipped,
                   release: content_released,
                   click: content_click},
         toc: {tap: toc_tapped,hold: toc_held,
               release: toc_released, slip: toc_slipped,
               mouseover: fdjtUI.CoHi.onmouseover,
               mouseout: fdjtUI.CoHi.onmouseout,
               click: cancel},
         glossmark: {mouseup: glossmark_tapped,
                     click: cancel, mousedown: cancel,
                     mouseover: glossmark_hoverstart,
                     mouseout: glossmark_hoverdone},
         glossbutton: {mouseup: glossbutton_ontap,mousedown: cancel},
         summary: {tap: slice_tapped, hold: slice_held,
                   release: slice_released, click: generic_cancel,
                   slip: slice_slipped},
         "#CODEXSTARTPAGE": {click: Codex.UI.dropHUD},
         "#CODEXHUDHELP": {click: Codex.UI.dropHUD},
         ".helphud": {click: Codex.UI.dropHUD},
         ".codexheart": {tap: flyleaf_tap},
         "#CODEXPAGEINFO": {tap: pageinfo_tap,
                            hold: pageinfo_hold,
                            release: pageinfo_release,
                            slip: pageinfo_slip,
                            click: cancel},
         "#CODEXPAGENOTEXT": {tap: enterPageNum},
         "#CODEXLOCPCT": {tap: enterPercentage},
         "#CODEXLOCOFF": {tap: enterLocation},
         // Return to scan
         "#CODEXSCANNER": {click: scanner_tapped},
         // Expanding/contracting the scanner
         "#CODEXEXPANDSCANNER": {
             tap: scanner_expand_tap,
             hold: scanner_expand_hold,
             release: scanner_expand_release,
             click: taphold_click},
         // Raise and lower HUD
         "#CODEXPAGEHEAD": {click: head_tap},
         "#CODEXTABS": {click: head_tap},
         "#CODEXHEAD": {click: head_tap},
         "#CODEXPAGEFOOT": {tap: foot_tap},
         // Forward and backwards
         "#CODEXPAGELEFT": {click: left_margin},
         "#CODEXPAGERIGHT": {click: right_margin},
         "#HIDESPLASHCHECKSPAN" : {click: hideSplashToggle},
         "#CODEXTAGINPUT": {keydown: addtag_keydown},
         "#CODEXOUTLETINPUT": {keydown: addoutlet_keydown},
         "#CODEXATTACHFORM": {submit: addlink_submit},
         "#CODEXATTACHURL": {click: addlink_keydown},
         "#CODEXATTACHTITLE": {click: addlink_keydown},
         "#CODEXATTACHOK": {click: addlink_action},
         "#CODEXATTACHCANCEL": {click: addlink_cancel},
         "#CODEXGLOSSCLOUD": {click: Codex.UI.handlers.glosscloud_ontap},
         "#CODEXSHARECLOUD": {click: outlet_tapped},
         "#CODEXALLTAGS": {click: Codex.UI.handlers.searchcloud_ontap},
         "#CODEXSEARCHCLOUD": {click: Codex.UI.handlers.searchcloud_ontap},
         "#CODEXHELPBUTTON": {
             click: toggleHelp, mousedown: cancel,mouseup: cancel},
         "#CODEXHELP": {
             click: toggleHelp, mousedown: cancel,mouseup: cancel},
         "#CODEXNEXTPAGE": {click: function(evt){
             Codex.pageForward(evt); cancel(evt);}},
         "#CODEXPREVPAGE": {click: function(evt){
             Codex.pageBackward(evt); cancel(evt);}},
         "#CODEXNEXTSCAN": {click: function(evt){
             Codex.scanForward(evt); cancel(evt);}},
         "#CODEXPREVSCAN": {click: function(evt){
             Codex.scanBackward(evt); cancel(evt);}},
         "#CODEXSHOWTEXT": {click: back_to_reading},
         "#CODEXAPPSPLASH": {click: hideSplash},
         "#CODEXGLOSSDETAIL": {click: Codex.UI.dropHUD},
         ".hudmodebutton": {click:hudbutton,mouseup:cancel,mousedown:cancel},
         // GLOSSFORM rules
         "span.codexsharegloss": {tap: fdjt.UI.CheckSpan.onclick},
         // ".glossexposure": {click: fdjt.UI.CheckSpan.onclick},
         ".codexclosehud": {click: back_to_reading},
         ".codexglossform .response": {click: Codex.toggleHUD},
         ".addglossmenu": {
             tap: glossmode_tap,
             hold: glossmode_hold,
             slip: glossmode_slip,
             release: glossmode_release,
             click: cancel},
         "div.glossetc": {click: fdjt.UI.CheckSpan.onclick},
         "div.glossetc div.sharing": {click: glossform_outlets_tapped},
         "div.glossetc div.notetext": {click: editglossnote}});

    fdjt.DOM.defListeners(
        Codex.UI.handlers.touch,
        {window: {
            keyup: onkeyup,
            keydown: onkeydown,
            keypress: onkeypress,
            touchmove: fdjt.UI.noDefault,
            focus: codexfocus,
            blur: codexblur},
         content: {tap: content_tapped,
                   hold: content_held,
                   slip: content_slipped,
                   release: content_released,
                   click: content_click},
         toc: {tap: toc_tapped,hold: toc_held,
               slip: toc_slipped, release: toc_released},
         glossmark: {touchstart: glossmark_tapped,touchend: cancel},
         // glossbutton: {mouseup: glossbutton_ontap,mousedown: cancel},
         summary: {tap: slice_tapped,
                   hold: slice_held,
                   release: slice_released,
                   slip: slice_slipped},
         "#CODEXHEART": {touchstart: heart_touched},
         "#CODEXSTARTPAGE": {click: Codex.UI.dropHUD},
         "#CODEXHUDHELP": {click: Codex.UI.dropHUD},
         ".helphud": {click: Codex.UI.dropHUD},
         "#CODEXPAGEFOOT": {},
         "#CODEXPAGEINFO": {tap: pageinfo_tap,
                            hold: pageinfo_hold,
                            release: pageinfo_release,
                            slip: pageinfo_slip,
                            click: cancel},
         "#CODEXPAGENOTEXT": {tap: enterPageNum},
         "#CODEXLOCPCT": {tap: enterPercentage},
         "#CODEXLOCOFF": {tap: enterLocation},
         // Return to scan
         "#CODEXSCANNER": {touchstart: scanner_tapped},
         // Expanding/contracting the scanner
         "#CODEXEXPANDSCANNER": {
             tap: scanner_expand_tap,
             hold: scanner_expand_hold,
             click: taphold_click,
             release: scanner_expand_release},
         // Raise and lower HUD
         "#CODEXPAGEHEAD": {touchstart: head_tap},
         "#CODEXTABS": {touchstart: head_tap},
         "#CODEXHEAD": {click: head_tap},
         "#CODEXFOOT": {tap: foot_tap},
         // Forward and backwards
         "#CODEXPAGELEFT": {touchstart: left_margin},
         "#CODEXPAGERIGHT": {touchstart: right_margin},
         "#CODEXTAGINPUT": {keydown: addtag_keydown},
         "#CODEXOUTLETINPUT": {keydown: addoutlet_keydown},
         "#CODEXATTACHFORM": {submit: addlink_submit},
         "#CODEXATTACHURL": {click: addlink_keydown},
         "#CODEXATTACHTITLE": {click: addlink_keydown},
         "#CODEXATTACHOK": {click: addlink_action},
         "#CODEXATTACHCANCEL": {click: addlink_cancel},
         "#CODEXGLOSSCLOUD": {click: Codex.UI.handlers.glosscloud_ontap},
         "#CODEXALLTAGS": {click: Codex.UI.handlers.searchcloud_ontap},
         "#CODEXSEARCHCLOUD": {click: Codex.UI.handlers.searchcloud_ontap},
         "#CODEXSHARECLOUD": {click: outlet_tapped},
         "#HIDESPLASHCHECKSPAN" : {click: hideSplashToggle},
         "#CODEXNEXTPAGE": {touchstart: function(evt){
             Codex.pageForward(evt); cancel(evt);}},
         "#CODEXPREVPAGE": {touchstart: function(evt){
             Codex.pageBackward(evt); cancel(evt);}},
         "#CODEXNEXTSCAN": {touchstart: function(evt){
             Codex.scanForward(evt); cancel(evt);}},
         "#CODEXPREVSCAN": {touchstart: function(evt){
             Codex.scanBackward(evt); cancel(evt);}},
         "#CODEXHELPBUTTON": {touchstart: toggleHelp},
         "#CODEXHELP": {touchstart: toggleHelp},
         "#CODEXSHOWTEXT": {
             touchstart: back_to_reading,
             touchmove: cancel,
             touchend: cancel},
         "#CODEXAPPSPLASH": {click: hideSplash},
         "#CODEXGLOSSDETAIL": {click: Codex.UI.dropHUD},
         /* ".hudbutton": {mouseover:hudbutton,mouseout:hudbutton}, */
         ".hudmodebutton": {
             touchstart: hudbutton,
             touchmove: cancel,
             touchend: cancel},
         // GLOSSFORM rules
         "span.codexsharegloss": {click: fdjt.UI.CheckSpan.onclick},
         ".codexclosehud": {
             click: back_to_reading,
             touchmove: cancel,
             touchend: cancel},
         ".glossexposure": {click: fdjt.UI.CheckSpan.onclick},
         ".codexglossform .response": {click: Codex.toggleHUD},
         ".addglossmenu": {
             tap: glossmode_tap,
             hold: glossmode_hold,
             slip: glossmode_slip,
             release: glossmode_release,
             click: cancel},
         "div.glossetc": {
             touchstart: fdjt.UI.CheckSpan.onclick},
         "div.glossetc div.sharing": {click: glossform_outlets_tapped},
         "div.glossetc div.notetext": {click: editglossnote}});
    
})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/

