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
   skimming (card at top, buttons on upper edges)
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
    var cxID=Codex.ID;

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
    var getChildren=fdjtDOM.getChildren;
    var getInput=fdjtDOM.getInput;
    var getInputs=fdjtDOM.getInputs;
    var getInputsFor=fdjtDOM.getInputsFor;
    var getInputValues=fdjtDOM.getInputValues;
    var hasText=fdjtDOM.hasText;
    var Selector=fdjtDOM.Selector;

    var submitEvent=fdjtUI.submitEvent;

    var reticle=fdjtUI.Reticle;

    /* For tracking gestures */
    var start_x=-1; var start_y=-1; var last_x=-1; var last_y=-1;
    var double_touch=false;
    
    var addgloss_timer=false;
    var preview_timer=false;

    Codex.uiclasses=/\b(codexui|codexglossmark)\b/gi;

    /* Setup for gesture handling */

    function addHandlers(node,type){
        var mode=Codex.ui;
        fdjtDOM.addListeners(node,Codex.UI.handlers[mode][type]);}
    Codex.UI.addHandlers=addHandlers;

    function externClickable(evt){
        var target=fdjtUI.T(evt);
        var anchor=getParent(target,"A");
        if ((anchor)&&(anchor.href)) {
            if (anchor.href[0]==="#") return false;
            else if (anchor.getAttribute("href")[0]==="#")
                return false;
            else return true;}
        else return isClickable(evt);}

    function setupGestures(domnode){
        var mode=Codex.ui;
        if (!(mode)) Codex.ui=mode="mouse";
        if ((!(domnode))&&((Codex.Trace.startup>1)||(Codex.Trace.gestures)))
            fdjtLog("Setting up basic handlers for %s UI",mode);
        if ((domnode)&&(Codex.Trace.gestures))
            fdjtLog("Setting up %s UI handlers for %o",mode,domnode);
        if (!(domnode)) {
            addHandlers(false,'window');
            addHandlers(document,'document');
            addHandlers(document.body,'body');
            if (Codex.bypage) {
                addHandlers(fdjtID("CODEXPAGE"),'content');}
            else {
                addHandlers(fdjtID("CODEXCONTENT"),'content');}
            Codex.TapHold.body=fdjtUI.TapHold(
                fdjt.ID("CODEXBODY"),
                {override: true,
                 untouchable: externClickable,
                 movethresh: 20});
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
                var h=handlers[key], sel=new Selector(key);
                if ((domnode)&&(sel.match(domnode)))
                    fdjtDOM.addListeners(domnode,h);
                var j=0, jlim=nodes.length;
                while (j<jlim) {
                    var node=nodes[j++];
                    if (seen.indexOf(node)<0) { 
                        seen.push(node);
                        fdjtDOM.addListeners(node,h);}}}}
        if (Codex.Trace.startup>2) fdjtLog("Done with handler setup");}
    Codex.setupGestures=setupGestures;

    /* New simpler UI */

    var gloss_focus=false;
    var gloss_blurred=false;
    var gloss_blur_timeout=false;

    function glossform_focusin(evt){
        if (gloss_blur_timeout) clearTimeout(gloss_blur_timeout);
        glossform_focus(evt);}
    function glossform_focusout(evt){
        gloss_blur_timeout=setTimeout(function(){
            glossform_blur(evt);},500);}

    function glossform_focus(evt){
        evt=evt||event;
        gloss_blurred=false;
        var target=fdjtUI.T(evt);
        var form=getParent(target,"FORM");
        var div=((form)&&(getParent(form,".codexglossform")));
        var input=((div)&&(getChild(div,"TEXTAREA")));
        if (div) {
            Codex.setGlossMode(false);}
        if (input) Codex.setFocus(input);
        Codex.freezelayout=true;
        gloss_focus=form;}
    function glossform_blur(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var form=getParent(target,"FORM");
        var div=((form)&&(getParent(form,".codexglossform")));
        var input=((div)&&(getChild(div,"TEXTAREA")));
        if (div) dropClass(div,"focused");
        if (input) Codex.clearFocus(input);
        gloss_blurred=fdjtTime();
        Codex.freezelayout=false;
        // Restore this without removal of the gloss
        // if ((div)&&(hasClass(div,"modified"))) Codex.submitGloss(div);
        gloss_focus=false;}
    function glossform_touch(evt){
        evt=evt||event;
        if (gloss_blur_timeout) clearTimeout(gloss_blur_timeout);
        var target=fdjtUI.T(evt);
        var closing=getParent(target,".submitclose");
        if (closing) dropClass(closing,"submitclose");
        var form=getParent(target,"FORM");
        var div=((form)&&(getParent(form,".codexglossform")));
        var input=((div)&&(getChild(div,"TEXTAREA")));
        if (hasClass(div,"focused")) {
            setTimeout(function(){
                if (input) {Codex.setFocus(input); input.focus();}},
                       150);
            return;}
        if ((hasParent(target,".addglossmenu"))||(hasParent(target,".glossexposure")))
            return;
        if (!(hasParent(target,".textbox"))) fdjtUI.cancel(evt);
        addClass(div,"focused");
        glossform_focus(evt);}
    Codex.UI.glossform_touch=glossform_touch;
    Codex.UI.glossform_focus=glossform_focus;
    Codex.UI.glossform_blur=glossform_blur;
    Codex.UI.glossform_focusin=glossform_focusin;
    Codex.UI.glossform_focusout=glossform_focusout;

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
                fdjtLog("content_tapped(double/shift) dt=%o now=%o",
                        double_touch,now);
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
        if (Codex.Trace.gestures)
            fdjtLog("content_tapped %o c=%d,%d now=%o p=%o",
                    evt,cX,cY,now,Codex.previewing);
        
        // If we're previewing, stop it and go to the page we're
        //  previewing (which was touched)
        if (Codex.previewing) {
            var jumpto=getTarget(target);
            Codex.stopPreview("content_tapped/stop_preview",jumpto||true);
            fdjtUI.TapHold.clear();
            fdjt.UI.cancel(evt);
            return false;}

        if (hasParent(target,".codexglossmark")) {
             cancel(evt);
            return false;}

        if ((Codex.touch)&&(Codex.textinput)) {
            Codex.clearFocus(Codex.textinput);
            cancel(evt);
            return;}

        if (hasClass(document.body,"codexhelp")) {
            dropClass(document.body,"codexhelp");
            cancel(evt);
            return;}

        if ((Codex.hudup)||(Codex.mode)) {
            Codex.setMode(false); Codex.setHUD(false);
            if (fdjtID("CODEXOPENGLOSSMARK")) {
                if (Codex.target)
                    Codex.clearHighlights(Codex.target);
                fdjtID("CODEXOPENGLOSSMARK").id="";}
            fdjtUI.cancel(evt); gesture_start=false;
            clicked=fdjtTime();
            // if (getTarget(target)) Codex.setTarget(false);
            return false;}

        // If we're in a glossmark, let its handler apply
        if (hasParent(target,".codexglossmark")) {
            fdjtUI.cancel(evt);
            return false;}

        // Various kinds of content click handling (anchors, details,
        // asides, etc)
        if (handle_content_click(target)) {
            fdjtUI.cancel(evt);
            return false;}

        if (fdjtID("CODEXOPENGLOSSMARK")) {
            fdjtID("CODEXOPENGLOSSMARK").id="";
            if (Codex.target) Codex.clearHighlights(Codex.target);
            fdjtUI.cancel(evt); gesture_start=false;
            return;}

        // If we get here, we're doing a page flip
        if ((evt.changedTouches)&&(evt.changedTouches.length)) {
            touch=evt.changedTouches[0];
            sX=touch.screenX; sY=touch.screenY;
            cX=touch.clientX; cY=touch.clientY;}
        if (Codex.Trace.gestures)
            fdjtLog("ctouch/nopassage (%o) %o, m=%o, @%o,%o, vw=%o",
                    evt,target,Codex.mode,cX,cY,fdjtDOM.viewWidth());
        if ((Codex.fullheight)&&(!(Codex.hudup))&&
            ((cY<50)||(cY>(fdjtDOM.viewHeight()-50)))) 
            Codex.setHUD(true);
        else if (cX<(fdjtDOM.viewWidth()/3))
            Codex.Backward(evt);
        else Codex.Forward(evt);
        fdjtUI.cancel(evt); gesture_start=false;
        return;}

    function resolve_anchor(ref){
        var elt=cxID(ref);
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

    var CodexSlice=Codex.Slice;

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
            var rel=anchor.rel, classname=anchor.className;
            if ((href[0]==="#")&&
                (((rel)&&(rel.search(/\b((sbooknote)|(footnote)|(endnote)|(note))\b/)>=0))||
                 ((classname)&&(classname.search(/\b((sbooknote)|(sbooknoteref))\b/)>=0))||
                 ((Codex.sbooknoterefs)&&(Codex.sbooknoterefs.match(anchor))))) {
                var note_node=getNoteNode(href.slice(1));
                var noteid=note_node.id;
                Codex.DOM.noteshud.innerHTML="";
                var shownote=note_node.cloneNode(true);
                fdjtDOM.stripIDs(shownote);
                dropClass(shownote,/\bcodex\S+/g);
                Codex.DOM.noteshud.setAttribute("data-note",noteid||(href.slice(1)));
                fdjtDOM.append(Codex.DOM.noteshud,shownote);
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
            else if ((href[0]==='#')&&(fn=Codex.xtargets[href.slice(1)])) {
                var fn=Codex.xtargets[href.slice(1)];
                gesture_start=false;
                clicked=fdjtTime();
                fn();
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

        var glossref=getParent(target,"[data-glossid]");
        if (glossref) {
            var glossid=glossref.getAttribute("data-glossid");
            var gloss=Codex.glossdb.ref(glossid);
            if (!(gloss)) return false;
            var slicediv=fdjtDOM("div.codexglosses.codexslice");
            var slice=new CodexSlice(slicediv,[gloss]);
            var hudwrapper=fdjtDOM("div.hudpanel#CODEXPOINTGLOSSES",slicediv);
            fdjtDOM.replace("CODEXPOINTGLOSSES",hudwrapper);
            Codex.setTarget(target);
            slice.update();
            Codex.setMode("openglossmark");
            return true;}

        return false;}

    function getNoteNode(ref){
        var elt=cxID(ref);
        var body=fdjt.ID("CODEXBODY"), db=document.body;
        if (!(elt)) {
            var elts=document.getElementsByName(ref);
            if (!(body)) return false;
            if (elts.length) {
                var i=0, lim=elts.length; while (i<lim) {
                    if (hasParent(elt[i],body)) {elt=elt[i]; break;}
                    else i++;}}}
        if (!(elt)) return;
        var scan=elt, style=fdjtDOM.getStyle(elt), block=false;
        var notespec=Codex.sbooknotes;
        while (scan) {
            if (scan===body) break;
            else if (scan===db) break;
            else if ((notespec)&&(notespec.match(scan))) return scan;
            else if (block) {}
            else if (style.display==='block') {block=scan; style=false;}
            else {}
            scan=scan.parentNode;
            style=fdjtDOM.getStyle(scan);}
        if (block) return block; else return elt;
        return elt;}

    function jumpToNote(evt){
        evt=evt||event;
        var noteshud=Codex.DOM.noteshud;
        var jumpto=noteshud.getAttribute("data-note");
        if (jumpto) {
            noteshud.removeAttribute("data-note");
            noteshud.innerHTML="";
            Codex.setMode(false);
            Codex.GoTo(jumpto,"jumpToNote",true,true);}
        else Codex.setMode(false);}
    
    var selectors=[];
    var slip_timer=false;
    function content_held(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var passage=getTarget(target);
        if (Codex.Trace.gestures) 
            fdjtLog("content_held %o p=%o p.p=%o bc=%s hc=%s",
                    evt,passage,((passage)&&(passage.parentNode)),
                    document.body.className,
                    Codex.HUD.className);
        if (Codex.previewing) return;
        else if (hasParent(target,"A")) {
            var anchor=getParent(target,"A");
            var href=((anchor)&&(anchor.getAttribute("href")));
            fdjtUI.cancel(evt);
            if ((href)&&(href[0]==="#")&&(cxID(href.slice(1)))) {
                Codex.startPreview(href.slice(1),"content/anchor_held");
                return;}}
        // Already selecting this target, cancel any pending slippage
        if ((!(passage))||
            // Target already selecting
            (hasParent(target,".fdjtselecting"))||
            // Selector already exists
            (selectors[passage.id])||
            // Target is a container (no text of its own) with
            // children that are already selecting, so defer to the
            // other children to start selections
            ((!(hasText(passage)))&&
             (getChildren(passage,".fdjtselecting").length))) {
            // Cancel any pending slip events, since this doesn't
            // count as a slip.
            if (slip_timer) {
                clearTimeout(slip_timer); slip_timer=false;}
            return;}
        if ((Codex.TapHold.body)&&(Codex.TapHold.body.abort))
            Codex.TapHold.body.abort();
        var selecting=Codex.UI.selectText(passage);
        Codex.select_target=passage;
        selectors.push(selecting);
        selectors[passage.id]=selecting;
        fdjtUI.TapHold.clear();
        // This makes a selection start on the region we just created.
        setTimeout(function(){selecting.startEvent(evt);},0);}
    Codex.getTextSelectors=function getTextSelectors(){return selectors;};

    function abortSelect(except){
        var i=0, lim=selectors.length;
        while (i<lim) {
            var sel=selectors[i++];
            if (sel!==except) sel.clear();}
        selectors=[];
        Codex.select_target=false;}

    /*
    function content_slipped(evt){
        evt=evt||event;
        var rel=evt.relatedTarget;
        if ((rel)&&(!(hasParent(rel,".fdjtselecting")))) {
            if (slip_timer) return;
            if (Codex.Trace.gestures)
                fdjtLog("content_slipped %o, starting slip timer",evt);
            slip_timer=setTimeout(function(){
                slip_timer=false;
                if (Codex.Trace.gestures)
                    fdjtLog("content_slipped %o, aborting select",evt);
                abortSelect();},2000);}}
    */
    function content_slipped(evt){evt=evt||event;}
    
    function content_released(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt), children=false;
        if (Codex.Trace.gestures) fdjtLog("content_released %o",evt);
        if (Codex.previewing) {
            Codex.stopPreview("content_released");
            fdjtUI.cancel(evt);
            return;}
        else if (hasParent(target,"A")) {
            fdjtUI.cancel(evt);
            return;}
        var passage=((hasParent(target,".fdjtselecting"))&&(getTarget(target)));
        if (!(passage)) {
            children=getChildren(target,".fdjtselected");
            if (children.length===0) {abortSelect(); return;}
            target=children[0]; passage=getTarget(target);}
        if (Codex.Trace.gestures)
            fdjtLog("content_released %o p=%o gt=%o gf=%o",
                    evt,passage,Codex.glosstarget,Codex.glossform);
        if (Codex.glosstarget===passage) {
            if (Codex.glossform)
                Codex.glossform.id="CODEXLIVEGLOSS";
            if (Codex.mode==="addgloss") Codex.setHUD(true);
            else Codex.setMode("addgloss");
            return;}
        startAddGloss(passage,((evt.shiftKey)&&("addtag")),evt);}

    function startAddGloss(passage,mode,evt){
        var selecting=selectors[passage.id]; abortSelect(selecting);
        var form_div=Codex.setGlossTarget(
            passage,((Codex.mode==="addgloss")&&(Codex.glossform)),selecting);
        var form=getChild(form_div,"form");
        if (!(form)) return;
        else if (evt) fdjtUI.cancel(evt);
        if (Codex.Trace.gestures)
            fdjtLog("startAddGloss (%o) %o f=%o/%o",
                    evt,passage,form_div,form);
        Codex.setGlossForm(form_div);
        if (mode) form.className=mode;
        Codex.setMode("addgloss",true);
        var input=getInputs(form,"NOTE")[0];
        if ((input)&&(Codex.keyboard))
            Codex.setFocus(input);
    }

    function content_swiped(evt){
        var dx=evt.deltaX, dy=evt.deltaY; var vw=fdjtDOM.viewWidth();
        var adx=((dx<0)?(-dx):(dx)), ady=((dy<0)?(-dy):(dy));
        if (Codex.Trace.gestures)
            fdjtLog("swiped d=%o,%o, ad=%o,%o, s=%o,%o vw=%o",
                    dx,dy,adx,ady,evt.startX,evt.startY,vw);
        if (adx>(ady*2)) {
            // Horizontal swipe
            if (dx<-10) {
                if (hasClass(document.body,"cxSKIMMING"))
                    Codex.scanForward(evt);
                else Codex.Forward(evt);}
            else if (dx>10) {
                if (hasClass(document.body,"cxSKIMMING"))
                    Codex.scanBackward(evt);
                else Codex.Backward(evt);}}
        else if (ady>(adx*2)) {
            // Vertical swipe
            if (!(Codex.hudup)) {
                if (ady<=10) return; // Ignore really short swipes 
                else if ((evt.startX<(vw/5))&&(dy<0))
                    Codex.setMode("help");
                else if ((evt.startX<(vw/5))&&(dy>0))
                    Codex.setMode("statictoc");
                else if ((evt.startX>(vw*0.8))&&(dy>0))
                    Codex.setMode("search");
                else if ((evt.startX>(vw*0.8))&&(dy<0))
                    Codex.setMode("allglosses");
                else Codex.setHUD(true);}
            else if (dy<-10) Codex.setMode("allglosses");
            else if (dy>10) Codex.setMode("search");}
        else {}}

    function initGlossMode(){
        var form=getChild("CODEXLIVEGLOSS","form");
        if (form) {
            var input=getInput(form,"NOTE");
            if (input) Codex.setFocus(input);
            Codex.setGlossMode(form.className);}}
    Codex.initGlossMode=initGlossMode;

    // This overrides the default_tap handler
    function content_click(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        // This avoids double-handling of clicks
        if ((clicked)&&((fdjtTime()-clicked)<3000))
            fdjtUI.cancel(evt);
        else if (handle_content_click(target)) {
            fdjtUI.cancel(evt);
            return;}
        else if (isClickable(target)) return;
        else fdjtUI.cancel(evt);}

    /* TOC handlers */

    function getAbout(elt){
        var body=document.body;
        while (elt) {
            if (elt===body) return false;
            else if (elt.nodeType!==1) return false;
            else if ((elt.name)&&(elt.name.search("SBR")===0))
                return elt;
            else if ((elt.getAttribute("name"))&&
                     (elt.getAttribute("name").search("SBR")===0))
                return elt;                     
            else elt=elt.parentNode;}
        return false;}

    function getTitleSpan(toc,ref){
        var titles=getChildren(toc,".codextitle");
        var i=0; var lim=titles.length;
        while (i<lim) {
            var title=titles[i++];
            if (title.name===ref) return title;}
        return false;}

   function toc_tapped(evt){
       evt=evt||event;
        var tap_target=fdjtUI.T(evt);
        if (Codex.previewing) {
            // Because we're previewing, this slice is invisible, so
            //  the user really meant to tap on the body underneath,
            //  so we stop previewing and jump there We might try to
            //  figure out exactly which element was tapped somehow
            Codex.stopPreview("toc_tapped");
            fdjtUI.cancel(evt);
            return;}
       var about=getAbout(tap_target);
        if (about) {
            var name=about.name||about.getAttribute("name");
            var ref=name.slice(3);
            var info=Codex.docinfo[ref];
            var target=info.elt||cxID(ref);
            if (target.id!==ref) target=cxID(ref);
            if (Codex.Trace.gestures)
                fdjtLog("toc_tapped %o about=%o ref=%s target=%o",
                        evt,about,ref,target);
            Codex.JumpTo(target);
            fdjtUI.cancel(evt);}
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
            var name=about.name||about.getAttribute("name");
            var ref=name.slice(3);
            var toc=getParent(about,".codextoc");
            var title=getTitleSpan(toc,name);
            if (Codex.Trace.gestures)
                fdjtLog("toc_held %o about=%o ref=%s toc=%o title=%s",
                        evt,about,ref,toc,title);
            addClass(title,"codexpreviewtitle");
            addClass(about.parentNode,"codexheld");
            var spanbar=getParent(about,".spanbar")||getChild(toc,".spanbar");
            addClass(spanbar,"codexvisible");
            addClass(toc,"codexheld");
            Codex.startPreview(cxID(ref),"toc_held");
            return fdjtUI.cancel(evt);}
        else if (Codex.Trace.gestures) fdjtLog("toc_held %o noabout", evt);
        else {}}
    function toc_released(evt){
        evt=evt||event;
        var about=getAbout(fdjtUI.T(evt));
        if (preview_timer) {
            clearTimeout(preview_timer); preview_timer=false;}
        if (about) {
            var name=about.name||about.getAttribute("name");
            var ref=name.slice(3);
            var toc=getParent(about,".codextoc");
            var title=getTitleSpan(toc,name);
            if (Codex.Trace.gestures)
                fdjtLog("toc_released %o ref=%o about=%o toc=%o title=%s",
                        evt,ref,about,toc,title);
            dropClass(title,"codexpreviewtitle");
            dropClass(about.parentNode,"codexheld");
            var spanbar=getParent(about,".spanbar")||getChild(toc,".spanbar");
            dropClass(spanbar,"codexvisible");
            dropClass(toc,"codexheld");
            if (Codex.previewing)
                Codex.stopPreview("toc_released");}
        else if (Codex.Trace.gestures) {
            fdjtLog("toc_released %o noabout",evt);
            Codex.stopPreview("toc_released");}
        else {
            Codex.stopPreview("toc_released");}
        fdjtUI.cancel(evt);}
    function toc_touchtoo(evt){
        evt=evt||event;
        if (preview_timer) {
            clearTimeout(preview_timer); preview_timer=false;}
        if (!(Codex.previewing)) return;
        else if (Codex.Trace.gestures) {
            fdjtLog("toc_touchtoo %o noabout",evt);
            Codex.stopPreview("toc_touchtoo",true);}
        else {
            Codex.stopPreview("toc_touchtoo",true);}
        fdjtUI.cancel(evt);}
    function toc_slipped(evt){
        evt=evt||event;
        var rel=evt.relatedTarget||fdjtUI.T(evt);
        if (slip_timer) return;
        slip_timer=setTimeout(function(){
            slip_timer=false;
            if (Codex.Trace.gestures)
                fdjtLog("toc_slipped/timeout %o",evt);
            Codex.stopPreview("toc_slipped");},
                              500);}

    /* Slice handlers */

    function getCard(target){
        return ((hasClass(target,"codexcard"))?(target):
                (getParent(target,".codexcard")))||
            getChild(target,".codexcard");}

    function slice_tapped(evt){
        var target=fdjtUI.T(evt);
        if (Codex.Trace.gestures)
            fdjtLog("slice_tapped %o: %o",evt,target);
        if (Codex.previewing) {
            // Because we're previewing, this slice is invisible, so
            //  the user really meant to tap on the body underneath,
            //  so we stop previewing and jump there We might try to
            //  figure out exactly which element was tapped somehow
            Codex.stopPreview("slice_tapped",true);
            fdjtUI.cancel(evt);
            return;}
        if ((getParent(target,".ellipsis"))&&
            ((getParent(target,".elision"))||
             (getParent(target,".delision")))){
            fdjtUI.Ellipsis.toggle(target);
            fdjtUI.cancel(evt);
            return;}
        if (getParent(target,".tochead")) {
            var anchor=getParent(target,".tocref");
            var href=(anchor)&&(anchor.getAttribute("data-tocref"));
            Codex.GoTOC(href);
            fdjtUI.cancel(evt);
            return;}
        var card=getCard(target);
        var passage=cxID(card.getAttribute("data-passage"));
        var glossid=card.getAttribute("data-gloss");
        var gloss=((glossid)&&(Codex.glossdb.ref(glossid)));
        if (getParent(target,".detail")) {
            var detail=((gloss)&&(gloss.detail));
            if (!(detail)) return;
            else if (detail[0]==='<')
                fdjt.ID("CODEXGLOSSDETAIL").innerHTML=gloss.detail;
            else if (detail.search(/^{(md|markdown)}/)===0) {
                var close=detail.indexOf('}');
                fdjt.ID("CODEXGLOSSDETAIL").innerHTML=
                    Codex.md2HTML(detail.slice(close+1));}
            else fdjt.ID("CODEXGLOSSDETAIL").innerHTML=Codex.md2HTML(detail);
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
            Codex.Scan(passage,card,false);
            return fdjtUI.cancel(evt);}
        else return;}
    function slice_held(evt){
        evt=evt||event;
        var slice_target=fdjtUI.T(evt), card=getCard(slice_target);
        if (Codex.Trace.gestures)
            fdjtLog("slice_held %o: %o, skimming=%o",
                    evt,card,Codex.skimming);
        if (!(card)) return;
        // Put a clone of the card in the scanner
        var clone=card.cloneNode(true);
        clone.id="CODEXSKIM"; fdjtDOM.replace("CODEXSKIM",clone);
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
        var passage=cxID(passageid), show_target=false;
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
            fdjtLog("slice_released %o: %o, skimming=%o",evt,card);}
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
    function slice_touchtoo(evt){
        evt=evt||event;
        if (preview_timer) {
            clearTimeout(preview_timer); preview_timer=false;}
        if (!(Codex.previewing)) return;
        else if (Codex.Trace.gestures) {
            fdjtLog("slice_touchtoo %o noabout",evt);
            Codex.stopPreview("toc_touchtoo",true);}
        else {
            Codex.stopPreview("toc_touchtoo",true);}
        fdjtUI.cancel(evt);}

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

    /* Highlighting terms in passages (for skimming, etc) */

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
            var pattern=new RegExp(fdjtDOM.textRegExp(word),"gim");
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
            if (Codex.mode==="addgloss") Codex.cancelGloss();
            if (Codex.mode) {
                Codex.last_mode=Codex.mode;
                Codex.setMode(false);
                Codex.setTarget(false);
                fdjtID("CODEXSEARCHINPUT").blur();}
            else {}
            return;}
        else if ((target.tagName==="TEXTAREA")||
                 (target.tagName==="INPUT")||
                 (target.tagName==="BUTTON"))
            return;
        else if ((evt.altKey)||(evt.ctrlKey)||(evt.metaKey)) return true;
        else if (Codex.previewing) {
            // Any key stops a preview and goes to the target
            Codex.stopPreview("onkeydown");
            fdjtUI.TapHold.clear();
            Codex.setHUD(false);
            fdjt.UI.cancel(evt);
            return false;}
        else if (hasClass(document.body,"cxCOVER")) {
            Codex.hideCover();
            fdjt.UI.cancel(evt);
            return false;}
        else if (Codex.glossform) {
            var input=fdjt.DOM.getInput(Codex.glossform,"NOTE");
            glossform_focus(Codex.glossform); Codex.setFocus(input); input.focus();
            var new_evt=document.createEvent("UIEvent");
            new_evt.initUIEvent("keydown",true,true,window); new_evt.keyCode=kc;
            input.dispatchEvent(new_evt);
            fdjtUI.cancel(evt);
            return;}
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
            var form=(formdiv)&&(getChild(formdiv,"FORM"));
            if (!(form)) return;
            if (kc===13) { // return/newline
                submitEvent(form);}
            else if ((kc===35)||(kc===91)) // # or [
                Codex.setGlossMode("addtag",form);
            else if (kc===32) // Space
                Codex.setGlossMode("editnote",form);
            else if ((kc===47)||(kc===58)) // /or :
                Codex.setGlossMode("attach",form);
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
        110: "overtoc",78: "overtoc",
        116: "statictoc",84: "statictoc", 72: "help", 
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
            Codex.hideCover();
            fdjtDOM.toggleClass(document.body,'codexhelp');
            return false;}
        else if ((ch===67)||(ch===99)) { // 'C' or 'c'
            Codex.toggleCover();
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
        else Codex.clearFocus(fdjtID("CODEXSEARCHINPUT"));
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
        else if (target.name==='GOTOPAGE') {
            min=1; max=Codex.pagecount;}
        else if (ch===13) fdjtUI.cancel(evt);
        if (ch===13) {
            if (target.name==='GOTOPAGE') {
                var num=parseInt(target.value,10);
                if (typeof num === 'number') {
                    handled=true; Codex.GoToPage(num);}
                else {}}
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
                    if (rendering.id==='CODEXSKIM')
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
                "https://"+Codex.server+"/1/delete",
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
                    form,share_cloud.selection.getAttribute("data-value"));
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
                    form,completions[0].getAttribute("data-value"));
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

    var attach_types=/\b(uploading|linking|dropbox|gdrive|usebox)\b/g;
    function changeAttachment(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var form=getParent(target,'form');
        if (target.checked)
            fdjtDOM.swapClass(form,attach_types,target.value);
        else dropClass(form,target.value);}
    Codex.UI.changeAttachment=changeAttachment;

    function attach_action(evt){
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
    function attach_submit(evt){
        evt=evt||event;
        var form=fdjtUI.T(evt);
        var livegloss=fdjtID("CODEXLIVEGLOSS");
        var liveglossid=fdjtDOM.getInput(livegloss,"UUID");
        var glossid=liveglossid.value;
        var linkinput=fdjtDOM.getInput(form,"URL");
        var fileinput=fdjtDOM.getInput(form,"UPLOAD");
        var glossidinput=fdjtDOM.getInput(form,"GLOSSID");
        var itemidinput=fdjtDOM.getInput(form,"ITEMID");
        var titleinput=fdjtDOM.getInput(form,"TITLE");
        var title=(titleinput.value)&&(fdjtString.stdspace(titleinput.value));
        var isokay=fdjtDOM.getInput(form,"FILEOKAY");
        var itemid=fdjt.State.getUUID();
        var path=linkinput.value;
        if (hasClass("CODEXHUD","glossattach")) {
            if (!(fileinput.files.length)) {
                fdjtUI.cancel(evt);
                fdjtUI.alert("You need to specify a file!");
                return;}
            else path=fileinput.files[0].name;
            if (!(isokay.checked)) {
                fdjtUI.cancel(evt);
                fdjtUI.alert(
                    "You need to confirm that the file satisfies our restrictions!");
                return;}
            glossidinput.value=glossid;
            itemidinput.value=itemid;}
        else fdjtUI.cancel(evt);
        if (!(title)) {
            var namestart=((path.indexOf('/')>=0)?(path.search(/\/[^\/]+$/)):(0));
            if (namestart<0) title="attachment";
            else title=path.slice(namestart);}
        if (!(livegloss)) return;
        var glossform=getChild(livegloss,"FORM");
        if (hasClass("CODEXHUD","glossattach")) {
            var glossdata_url="https://glossdata.sbooks.net/"+glossid+"/"+itemid+"/"+path;
            var commframe=fdjtID("CODEXGLOSSCOMM");
            var listener=function(evt){
                evt=evt||event;
                Codex.addLink2Form(glossform,glossdata_url,title);
                titleinput.value="";
                fileinput.value="";
                isokay.checked=false;
                fdjtDOM.removeListener(commframe,"load",listener);
                Codex.submitGloss(glossform,true);
                Codex.setGlossMode("editnote");};
            fdjtDOM.addListener(commframe,"load",listener);}
        else {
            Codex.addLink2Form(glossform,linkinput.value,title);
            Codex.setGlossMode("editnote");}}
    function attach_cancel(evt){
        var linkinput=fdjtID("CODEXATTACHURL");
        var titleinput=fdjtID("CODEXATTACHTITLE");
        var livegloss=fdjtID("CODEXLIVEGLOSS");
        if (!(livegloss)) return;
        linkinput.value="";
        titleinput.value="";
        Codex.setGlossMode("editnote");
        fdjtUI.cancel(evt);}
    function attach_keydown(evt){
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

    function hudmodebutton(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var mode=target.getAttribute("hudmode");
        if (Codex.Trace.gestures)
            fdjtLog("hudmodebutton() %o mode=%o cl=%o scan=%o sbh=%o mode=%o",
                    evt,mode,(isClickable(target)),
                    Codex.skimming,Codex.hudup,Codex.setMode());
        if (reticle.live) reticle.flash();
        fdjtUI.cancel(evt);
        if (!(mode)) return;
        if ((evt.type==='click')||
            (evt.type==='tap')||
            (evt.type==='release')) {
            dropClass(document.body,"cxHOLDING");
            if ((Codex.skimming)&&(!(Codex.hudup))) {
                if (mode==="refinesearch") {
                    Codex.setMode("searchresults"); return;}
                else if (mode==="allglosses") {
                    Codex.setMode("allglosses"); return;}}
            if (Codex.skimming) Codex.updateSkimScroll();
            if (fdjtDOM.hasClass(Codex.HUD,mode))
                Codex.setMode(false,true);
            else if ((mode==="search")&&
                     (fdjtDOM.hasClass(Codex.HUD,Codex.searchModes)))
                Codex.setMode(false,true);
            else Codex.setMode(mode);}
        else if (evt.type==="tap")
            Codex.setHUD(true);
        else if (evt.type==="hold") 
            addClass(document.body,"cxHOLDING");
        else dropClass(document.body,"cxHOLDING");}
    Codex.UI.hudmodebutton=hudmodebutton;

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
                    ((Codex.skimming)?"skimming ":""),
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
                     ((Codex.skimming)?"skimming ":""),
                     touch.clientX,touch.clientY,touch.screenX,touch.screenY,
                     touch_started,evt.type,target,ref);
        if (ref) fdjtLog("%s(%o) ref=%o from %o",handler,evt,ref,target);}


    /* Default click/tap */
    function default_tap(evt){
        var target=fdjtUI.T(evt);
        if (Codex.Trace.gestures)
            fdjtLog("default_tap %o (%o) %s%s%s",evt,target,
                    ((fdjtUI.isClickable(target))?(" clickable"):("")),
                    (((hasParent(target,Codex.HUD))||
                      (hasParent(target,Codex.uiclasses)))?
                     (" inhud"):("")),
                    ((Codex.mode)?(" "+Codex.mode):
                     (Codex.hudup)?(" hudup"):""));
        if (fdjtUI.isClickable(target)) return;
        else if ((hasParent(target,Codex.HUD))||
                 (hasParent(target,Codex.uiclasses)))
            return;
        else if (Codex.previewing) {
            Codex.stopPreview("default_tap");
            cancel(evt);
            return;}
        else if (((Codex.hudup)||(Codex.mode))) {
            Codex.setMode(false);
            cancel(evt);}
        else if (false) {
            var cx=evt.clientX, cy=evt.clientY;
            var w=fdjtDOM.viewWidth(), h=fdjtDOM.viewHeight();
            if ((cy<60)||(cy>(h-60))) return;
            if (cx<w/3) Codex.Backward(evt);
            else if (cx>w/2) Codex.Forward(evt);}
        else {}}

    /* Glossmarks */
    
    function glossmark_tapped(evt){
        evt=evt||event||null;
        if (held) clear_hold("glossmark_tapped");
        if ((evt.ctrlKey)||(evt.altKey)||(evt.metaKey)||(evt.shiftKey))
            return;
        var target=fdjtUI.T(evt);
        var glossmark=getParent(target,".codexglossmark");
        var passage=
            ((glossmark.name)&&
             (glossmark.name.search("GLOSSMARK_NAME_")===0)&&
             (fdjt.ID(glossmark.name.slice(15))))||
            getTarget(glossmark.parentNode,true);
        if ((passage)&&(passage.getAttribute("data-baseid"))) 
            passage=cxID(passage.getAttribute("data-baseid"));
        if (Codex.Trace.gestures)
            fdjtLog("glossmark_tapped (%o) on %o gmark=%o passage=%o mode=%o target=%o",
                    evt,target,glossmark,passage,Codex.mode,Codex.target);
        if (!(glossmark)) return false;
        fdjtUI.cancel(evt);
        if ((Codex.mode==='openglossmark')&&
            (Codex.target===passage)) {
            Codex.setMode(false);
            Codex.clearGlossmark();
            return;}
        else if (Codex.select_target) return;
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
            var wedge=getChild(glossmark,"img.wedge");
            if (!(wedge)) return;
            animated_glossmark=glossmark;
            glossmark_image=wedge;
            glossmark_animated=fdjtUI.ImageSwap(wedge,750);}
        else {
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
            var glossmark=getChild(target,".codexglossmark");
            if (glossmark) animate_glossmark(glossmark,true);
            else animate_glossmark(false,false);}
        else animate_glossmark(false,false);}
    Codex.UI.setTarget=setTargetUI;

    /* Various actions */

    function clearOfflineAction(evt){
        evt=evt||event;
        fdjtUI.cancel(evt);
        Codex.clearOffline(true);
        // We change this here, so we don't save what's cached in
        //  memory now, but it doesn't change the saved setting (so we
        //  might still be persisting).
        Codex.nocache=true;
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
    function right_margin_tap(evt){
        if (Codex.Trace.gestures) tracetouch("right_margin",evt);
        if (Codex.page_turner) {
            clearInterval(Codex.page_turner);
            Codex.page_turner=false;}
        if (Codex.previewing) {
            Codex.stopPreview("right_margin_tap");
            if (Codex.hudup) {
                Codex.setHUD(false);
                Codex.setMode(false);}
            cancel(evt);
            return;}
        if ((Codex.hudup)&&(!(hasClass(document.body,"cxSKIMMING"))))
            Codex.setMode(false);
        else if (hasClass(document.body,"cxSKIMMING"))
            scanForward(evt);
        else forward(evt);
        cancel(evt);}
    function right_margin_hold(evt){
        if (Codex.Trace.gestures) tracetouch("right_margin",evt);
        if ((Codex.hudup)&&(!(hasClass(document.body,"cxSKIMMING"))))
            Codex.setMode(false);
        if (Codex.page_turner) {
            clearInterval(Codex.page_turner);
            Codex.page_turner=false;}
        // Codex.page_turner=setInterval(function(){forward();},800);
        cancel(evt);}
    function right_margin_release(evt){
        if (Codex.Trace.gestures) tracetouch("right_margin",evt);
        if (Codex.page_turner) {
            clearInterval(Codex.page_turner);
            Codex.page_turner=false;}
        cancel(evt);}
    function right_margin_swipe(evt){
        var dx=evt.deltaX, dy=evt.deltaY;
        var adx=((dx<0)?(-dx):(dx)), ady=((dy<0)?(-dy):(dy));
        if (Codex.Trace.gestures)
            fdjtLog("Right margin swiped %o dx=%o, dy=%o, adx=%o, ady=%o",
                    evt,dx,dy,adx,ady);
        if (adx>(ady*2)) {
            // Horizontal swipe
            if (adx<10) return;
            else if (hasClass(document.body,"cxSKIMMING"))
                scanForward(evt);
            else forward(evt);}
        else if (ady>(adx*2)) {
            // Vertical swipe
            if (!(Codex.hudup)) {
                if (ady<=10) return; // Ignore really short swipes 
                else if (dy<-10) Codex.setMode("allglosses");
                else if (dy>10) Codex.setMode("search");
                else {}}}
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
    function left_margin_tap(evt){
	if (Codex.Trace.gestures) tracetouch("left_margin",evt);
        stopPageTurner();
        if (Codex.previewing) {
            Codex.stopPreview("left_margin_tap");
            if (Codex.hudup) {
                Codex.setHUD(false);
                Codex.setMode(false);}
            cancel(evt);
            return;}
        if ((Codex.hudup)&&(!(hasClass(document.body,"cxSKIMMING"))))
            Codex.setMode(false);
        else if (hasClass(document.body,"cxSKIMMING"))
            scanBackward(evt);
        else backward(evt);
        cancel(evt);}
    function left_margin_hold(evt){
        if (Codex.Trace.gestures) tracetouch("left_margin",evt);
        if ((Codex.hudup)&&(!(hasClass(document.body,"cxSKIMMING"))))
            Codex.setMode(false);
        stopPageTurner();
        // Codex.page_turner=setInterval(function(){backward();},800);
        cancel(evt);}
    function left_margin_release(evt){
        if (Codex.Trace.gestures) tracetouch("left_margin",evt);
        stopPageTurner();
        cancel(evt);}
    function left_margin_swipe(evt){
        var dx=evt.deltaX, dy=evt.deltaY;
        var adx=((dx<0)?(-dx):(dx)), ady=((dy<0)?(-dy):(dy));
        if (Codex.Trace.gestures)
            fdjtLog("Right margin swiped %o dx=%o, dy=%o, adx=%o, ady=%o",
                    evt,dx,dy,adx,ady);
        stopPageTurner();
        if (adx>(ady*2)) {
            // Horizontal swipe
            if (adx<10) return;
            else if (hasClass(document.body,"cxSKIMMING"))
                scanForward(evt);
            else forward(evt);}
        else if (ady>(adx*2)) {
            // Vertical swipe
            if (!(Codex.hudup)) {
                if (ady<=10) return; // Ignore really short swipes 
                else if (dy<-10) Codex.setMode("help");
                else if (dy>10) Codex.setMode("statictoc");
                else {}}}
        cancel(evt);}

    function preview_touchmove_nodefault(evt){
        if (Codex.previewing) fdjtUI.noDefault(evt);}

    function stopPageTurner(){
        if (Codex.page_turner) {
            clearInterval(Codex.page_turner);
            Codex.page_turner=false;}}

    function pageForward(evt){
        evt=evt||event;
        if (Codex.booksound)
            fdjtDOM.playAudio("CODEXPAGEFLIPAUDIO");
        if ((Codex.Trace.gestures)||(Codex.Trace.flips))
            fdjtLog("pageForward (on %o) c=%o n=%o",
                    evt,Codex.curpage,Codex.pagecount);
        if (Codex.clearGlossmark) Codex.clearGlossmark();
        if ((Codex.bypage)&&(typeof Codex.curpage === "number")) {
            var pagemax=((Codex.bypage)&&
                         ((Codex.pagecount)||(Codex.layout.pagenum-1)));
            var newpage=false;
            if (Codex.curpage>=pagemax) {}
            else Codex.GoToPage(
                newpage=Codex.curpage+1,"pageForward",true,false);}
        else {
            var delta=fdjtDOM.viewHeight()-50;
            if (delta<0) delta=fdjtDOM.viewHeight();
            var newy=fdjtDOM.viewTop()+delta;
            window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    Codex.pageForward=pageForward;

    function pageBackward(evt){
        evt=evt||event;
        if (Codex.booksound)
            fdjtDOM.playAudio("CODEXPAGEFLIPAUDIO");
        if ((Codex.Trace.gestures)||(Codex.Trace.flips))
            fdjtLog("pageBackward (on %o) c=%o n=%o",
                    evt,Codex.curpage,Codex.pagecount);
        if (Codex.clearGlossmark) Codex.clearGlossmark();
        if ((Codex.bypage)&&(typeof Codex.curpage === "number")) {
            var newpage=false;
            if (Codex.curpage===0) {}
            else {
                newpage=Codex.curpage-1;
                Codex.GoToPage(newpage,"pageBackward",true,false);}}
        else {
            var delta=fdjtDOM.viewHeight()-50;
            if (delta<0) delta=fdjtDOM.viewHeight();
            var newy=fdjtDOM.viewTop()-delta;
            window.scrollTo(fdjtDOM.viewLeft(),newy);}}
    Codex.pageBackward=pageBackward;

    function scanForward(evt){
        evt=evt||event;
        if (hasClass(document.body,"cxSKIMMING")) {}
        else if (Codex.mode==="openglossmark") {
            var ids=Codex.docinfo._ids;
            var id=((Codex.target)&&(Codex.target.id));
            var glossdb=Codex.glossdb;
            var i, lim=ids.length;
            if ((id)&&((i=RefDB.position(ids,id))>0)) {
                i++; while (i<lim) {
                    var g=glossdb.find('frag',ids[i]);
                    if ((g)&&(g.length)) {
                        var passage=cxID(ids[i]);
                        var glossmark=getChild(passage,".codexglossmark");
                        Codex.GoTo(passage,"scanForward/glosses",true);
                        Codex.showGlossmark(passage,glossmark);
                        return;}
                    else i++;}}
            Codex.setMode(false);
            return;}
        else if (Codex.skimming) {}
        else return; /* Need default */
        addClass("CODEXSKIMMER","flash");
        addClass("CODEXNEXTSCAN","flash");
        setTimeout(function(){
            dropClass("CODEXSKIMMER","flash");
            dropClass("CODEXNEXTSCAN","flash");},
                   200);
        if (Codex.mode==="statictoc") {
            var head=Codex.head;
            var headid=head.codexbaseid||head.id;
            var headinfo=Codex.docinfo[headid];
            if (Codex.Trace.nav) 
                fdjtLog("scanForward/toc() head=%o info=%o n=%o h=%o",
                        head,headinfo,headinfo.next,headinfo.head);
            if (headinfo.next) Codex.GoTo(headinfo.next.frag,"scanForward");
            else if ((headinfo.head)&&(headinfo.head.next)) 
                Codex.GoTo(headinfo.head.next.frag,"scanForward");
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
        var start=Codex.skimming;
        var scan=Codex.nextSlice(start);
        var ref=((scan)&&(Codex.getRef(scan)));
        if ((Codex.Trace.gestures)||(Codex.Trace.flips)||(Codex.Trace.nav)) 
            fdjtLog("scanForward (on %o) from %o/%o to %o/%o under %o",
                    evt,start,Codex.getRef(start),scan,ref,Codex.skimming);
        if ((ref)&&(scan)) Codex.Scan(ref,scan);
        return scan;}
    Codex.scanForward=scanForward;

    function scanBackward(evt){
        if (hasClass(document.body,"cxSKIMMING")) {}
        else if (Codex.mode==="openglossmark") {
            var ids=Codex.docinfo._ids;
            var id=((Codex.target)&&(Codex.target.id));
            var glossdb=Codex.glossdb;
            var i=ids.length;
            if ((id)&&((i=RefDB.position(ids,id))>0)) {
                i--; while (i>=0) {
                    var g=glossdb.find('frag',ids[i]);
                    if ((g)&&(g.length)) {
                        var passage=cxID(ids[i]);
                        var glossmark=getChild(passage,".codexglossmark");
                        Codex.GoTo(passage,"scanBackward/glosses",true);
                        Codex.showGlossmark(passage,glossmark);
                        return;}
                    else i--;}}
            Codex.setMode(false);
            return;}
        else if (Codex.skimming) {}
        else return false;
        addClass("CODEXPREVSCAN","flash");
        addClass("CODEXSKIMMER","flash");
        setTimeout(function(){
            dropClass("CODEXSKIMMER","flash");
            dropClass("CODEXPREVSCAN","flash");},
                   200);
        if (Codex.mode==="statictoc") {
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
        var start=Codex.skimming;
        var scan=Codex.prevSlice(start);
        var ref=((scan)&&(Codex.getRef(scan)));
        if ((Codex.Trace.gestures)||(Codex.Trace.flips)||(Codex.Trace.nav))
            fdjtLog("scanBackward (on %o) from %o/%o to %o/%o under %o",
                    evt,start,Codex.getRef(start),scan,ref,Codex.skimming);
        if ((ref)&&(scan)) Codex.Scan(ref,scan,true);
        return scan;}
    Codex.scanBackward=scanBackward;

    function scanner_tapped(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if (isClickable(target)) return;
        if ((getParent(target,".ellipsis"))&&
            ((getParent(target,".elision"))||
             (getParent(target,".delision")))){
            fdjtDOM.toggleClass("CODEXSKIMMER","expanded");
            // fdjtUI.Ellipsis.toggle(target);
            fdjtUI.cancel(evt);
            return;}
        if ((getParent(target,".tool"))) {
            var card=getCard(target);
            if ((card)&&((card.name)||(card.getAttribute("name")))) {
                var name=(card.name)||(card.getAttribute("name"));
                var gloss=RefDB.resolve(name,Codex.glossdb);
                if (!(gloss)) return;
                var form=Codex.setGlossTarget(gloss);
                if (!(form)) return;
                Codex.stopSkimming();
                Codex.setMode("addgloss");
                return;}
            else return;}
        if (getParent(target,".codexskiminfo"))
            Codex.stopSkimming();
        else if (getParent(target,".tochead")) {
            var anchor=getParent(target,".tocref");
            var href=(anchor)&&(anchor.getAttribute("data-tocref"));
            Codex.GoTOC(href);}
        else toggleClass("CODEXSKIMMER","expanded");
        fdjtUI.cancel(evt);
        return;}

    function scanner_held(evt){
        evt=evt||event;
        Codex.stopSkimming();
        cancel(evt);
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
        Codex.toggleMode("gotoloc");}
    
    /* Other handlers */

    function flyleaf_tap(evt){
        if (isClickable(evt)) return;
        else Codex.setMode(false);}

    function head_tap(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if (Codex.Trace.gestures) fdjtLog("head_tap %o t=%o",evt,target);
        if (Codex.previewing) {
            Codex.stopPreview("head_tap");
            cancel(evt);
            return;}
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
        if (Codex.previewing) {
            Codex.stopPreview("foot_tap");
            cancel(evt);
            return;}
        if (isClickable(evt)) return;
        else if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}}

    function getGoPage(target){
        return parseInt(target.innerHTML,10);}

    var previewing_page=false, preview_start_page=false;
    function pagebar_hold(evt,target){
        evt=evt||event; if (!(target)) target=fdjtUI.T(evt);
        var pagebar=fdjtID("CODEXPAGEBAR");
        if (preview_timer) {
            clearTimeout(preview_timer);
            preview_timer=false;}
        if ((Codex.hudup)||(Codex.mode)) {
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}
        if (target.nodeType===3) target=target.parentNode;
        if (((hasParent(target,pagebar))&&(target.tagName==="span")))
            return;
        var gopage=getGoPage(target,evt);
        if ((Codex.Trace.gestures)||(hasClass(pagebar,"codextrace")))
            fdjtLog("pagebar_span_hold %o t=%o gopage: %o=>%o/%o, start=%o",
                    evt,target,previewing_page,gopage,Codex.pagecount,
                   preview_start_page);
        if (!(preview_start_page)) preview_start_page=gopage;
        if (previewing_page===gopage) return;
        if (!(gopage)) {
            // fdjtLog.warn("Couldn't get page from CODEXPAGEBAR");
            return;}
        if (previewing_page)
            pagebar.title=fdjtString(
                "Release to go to this page (%d), move away to return to page %d",
                gopage,Codex.curpage);
        else pagebar.title=fdjtString(
            ((Codex.touch)?
             ("Release to return to page %d, tap the content or margin to settle here (page %d)"):
             ("Release to return to page %d, tap a key to settle here (page %d)")),
            Codex.curpage,gopage);
        previewing_page=gopage;
        Codex.startPreview("CODEXPAGE"+previewing_page,"pagebar_span_hold/timeout");}
    function pagebar_tap(evt,target){
        evt=evt||event; if (!(target)) target=fdjtUI.T(evt);
        var pagebar=fdjtID("CODEXPAGEBAR");
        if ((Codex.Trace.gestures)||(hasClass(pagebar,"codextrace")))
            fdjtLog("pagebar_tap %o",evt);
        if (preview_timer) {
            clearTimeout(preview_timer);
            preview_timer=false;}
        if ((Codex.hudup)||(Codex.mode)||(Codex.cxthelp)) {
            if (Codex.Trace.gestures)
                fdjtLog("clearHUD %s %s %s",Codex.mode,
                        ((Codex.hudup)?"hudup":""),
                        ((Codex.cxthelp)?"hudup":""));
            fdjtUI.cancel(evt);
            Codex.setMode(false);
            return;}
        if (target.nodeType===3) target=target.parentNode;
        if (((hasParent(target,pagebar))&&(target.tagName==="span")))
            return;
        var gopage=getGoPage(target,evt);
        if (previewing_page===gopage) return;
        Codex.GoToPage(gopage,"pagebar_tap",true);
        Codex.setMode(false);}
    function pagebar_release(evt,target){
        evt=evt||event; if (!(target)) target=fdjtUI.T(evt);
        var pagebar=fdjtID("CODEXPAGEBAR");
        if ((Codex.Trace.gestures)||(hasClass(pagebar,"codextrace")))
            fdjtLog("pagebar_release %o, previewing=%o, ptarget=%o start=%o",
                    evt,Codex.previewing,Codex.previewTarget,
                    preview_start_page);
        if (preview_timer) {
            clearTimeout(preview_timer);
            preview_timer=false;}
        if (target.nodeType===3) target=target.parentNode;
        if (!(Codex.previewing)) {preview_start_page=false; return;}
        dropClass(target,"preview");
        Codex.stopPreview("pagebar_release",true);
        preview_start_page=false;
        previewing_page=false;
        fdjtUI.cancel(evt);
        if (((hasParent(target,pagebar))&&(target.tagName==="span"))) {
            return;}}
    function pagebar_slip(evt,target){
        evt=evt||event; if (!(target)) target=fdjtUI.T(evt);
        var rel=evt.relatedTarget;
        var pagebar=fdjtID("CODEXPAGEBAR");
        if (preview_timer) {
            clearTimeout(preview_timer);
            preview_timer=false;}
        if ((Codex.Trace.gestures)||(hasClass(pagebar,"codextrace")))
            fdjtLog("pagebar_slip %o, previewing=%o, target=%o start=%o",
                    evt,Codex.previewing,Codex.previewTarget,
                    preview_start_page);
        if (!(Codex.previewing)) return;
        if ((rel)&&(hasParent(rel,Codex.body)))
            preview_timer=setTimeout(function(){
                var pagebar=fdjtID("CODEXPAGEBAR");
                pagebar.title=""; preview_timer=false;
                Codex.GoTo(rel,evt);},
                                     400);
        else preview_timer=setTimeout(function(){
            var pagebar=fdjtID("CODEXPAGEBAR");
            pagebar.title=""; preview_timer=false;
            Codex.stopPagePreview("pagebar_slip/timeout");},
                                      400);
        previewing_page=false;}
    function pagebar_touchtoo(evt,target){
        evt=evt||event; if (!(target)) target=fdjtUI.T(evt);
        if (Codex.previewing) {
            Codex.stopPreview("touchtoo");
            fdjtUI.TapHold.clear();
            Codex.setHUD(false);
            fdjt.UI.cancel(evt);
            return false;}}
    
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
        var outletspan=getParent(target,'.outlet');
        if (!(outletspan)) return;
        var live=fdjtID("CODEXLIVEGLOSS");
        var form=((live)&&(getChild(live,"form")));
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

        var menu=getParent(target,'.addglossmenu');
        var form=getParent(target,'form');
        var div=getParent(form,"div.codexglossform");
        
        if (alt==="hamburger") {
            Codex.setGlossMode(false,form);
            toggleClass(menu,"expanded");}
        else if (alt==="glossdelete") 
            addgloss_delete(menu,form);
        else if (alt==="glosscancel") 
            addgloss_cancel(menu,form,div);
        else if (alt==="glosspush") {
            Codex.submitGloss(form,false);
            dropClass(menu,"expanded");}
        else if (alt==="glossupdate") {
            Codex.submitGloss(form,false);
            dropClass(menu,"expanded");}
        else if (alt==="glossrespond") 
            addgloss_respond(menu,form);
        else if (alt==="glosscancel") {
            addgloss_cancel(menu,form,div);}
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

        var menu=getParent(target,'.addglossmenu');
        
        addClass(target,"held");

        addClass(menu,"expanded");}

    function glossmode_release(evt) {
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var menu=getParent(target,'.addglossmenu');
        var form=getParent(target,'form');
        var div=getParent(form,"div.codexglossform");
        var alt=target.alt;
        dropClass(target,"held");
        if (alt==="glossdelete") 
            addgloss_delete(menu,form);
        else if (alt==="glosscancel") 
            addgloss_cancel(menu,form,div);
        else if (alt==="glosspush")
            Codex.submitGloss(form,false);
        else if (alt==="glossupdate") {
            Codex.submitGloss(form,false);
            dropClass(menu,"expanded");}
        else if (alt==="glossrespond") 
            addgloss_respond(menu,form);
        else if (Codex.glossmodes.exec(alt))
            Codex.setGlossMode(alt,form);
        else fdjtLog.warn("Bad alt=%s in glossmode_release",alt);
        dropClass(menu,"expanded");}

    function glossmode_slip(evt) {
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var menu=getParent(target,'.addglossmenu');
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
        var uuid=getInputValues(form,"UUID")[0];
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

    function addgloss_cancel(menu,form,div){
        if (!(form)) form=getParent(menu,"FORM");
        if (!(div)) div=getParent(form,".codexglossform");
        Codex.cancelGloss();
        Codex.setMode(false);
        fdjtDOM.remove(div);
        Codex.setGlossTarget(false);
        Codex.setTarget(false);
        return;}

    function addgloss_respond(target){
        var block=getParent(target,".codexglossform");
        if (!(block)) return;
        var glosselt=getInput(block,'UUID');
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
        var doppels=getInputsFor(alternate,'NETWORK',target.value);
        fdjtUI.CheckSpan.set(doppels,target.checked);}
    Codex.UI.changeGlossNetwork=changeGlossNetwork;

    function changeGlossPosting(evt){
        var target=fdjtUI.T(evt=(evt||event));
        var glossdiv=getParent(target,".codexglossform");
        if (target.checked) fdjtDOM.addClass(glossdiv,"posted");
        else fdjtDOM.dropClass(glossdiv,"posted");}
    Codex.UI.changeGlossPosting=changeGlossPosting;

    function changeGlossPrivacy(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt=(evt||event));
        var glossdiv=getParent(target,".codexglossform");
        var postgloss=getChild(glossdiv,".postgloss");
        var postinput=(postgloss)&&(getInput(postgloss,"POSTGLOSS"));
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
        if (Codex.mode==="addgloss") 
            Codex.cancelGloss();
        Codex.setMode(false);
        fdjtDOM.dropClass(document.body,"codexhelp");}

    function clearMode(evt){
        evt=evt||event; Codex.setMode(false);}

    /* Tracking text input */

    function setFocus(target){
        if (!(target)) {
            var cur=Codex.textinput;
            Codex.textinput=false;
            Codex.freezelayout=false;
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
            Codex.freezelayout=true;
            target.focus();}}
    Codex.setFocus=setFocus;
    function clearFocus(target){
        if (!(target)) target=Codex.textinput;
        if ((target)&&(Codex.textinput===target)) {
            Codex.textinput=false;
            Codex.freezelayout=false;
            target.blur();}}
    Codex.clearFocus=clearFocus;

    function codexfocus(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        var input=getParent(target,'textarea');
        if (!(input)) input=getParent(target,'input');
        if ((!(input))||(typeof input.type !== "string")||
            (input.type.search(fdjtDOM.text_types)!==0))
            return;
        setFocus(input);}
    Codex.UI.focus=codexfocus;
    function codexblur(evt){
        evt=evt||event;
        var target=((evt.nodeType)?(evt):(fdjtUI.T(evt)));
        var input=getParent(target,'textarea');
        if (!(input)) input=getParent(target,'input');
        if ((!(input))||(typeof input.type !== "string")||
            (input.type.search(fdjtDOM.text_types)!==0))
            return;
        clearFocus(input);}
    Codex.UI.blur=codexblur;

    /* Rules */

    var noDefault=fdjt.UI.noDefault;
    var cancel=fdjtUI.cancel;
    
    function generic_cancel(evt){
        evt=evt||event;
        var target=fdjtUI.T(evt);
        if (fdjtUI.isClickable(target)) return;
        else cancel(evt);}

    function setHelp(flag){
        if (flag) {
            fdjtDOM.addClass(document.body,"codexhelp");
            Codex.cxthelp=true;}
        else {
            fdjtDOM.dropClass(document.body,"codexhelp");
            Codex.cxthelp=false;}
        return false;}
    Codex.setHelp=setHelp;
    
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

    function handleXTarget(evt){
        evt=evt||event;
        var anchor=fdjtUI.T(evt);
        if ((anchor.href)&&(anchor.href[0]==='#')&&
            (Codex.xtargets[anchor.href.slice(1)])) {
            var fn=Codex.xtargets[anchor.href.slice(1)];
            fdjtUI.cancel(evt);
            fn();}}

    function unhighlightSettings(){
        dropClass(fdjtDOM.$(".codexhighlightsetting"),"codexhighlightsetting");}
    function highlightSetting(id,evt){
        var setting=fdjtID(id);
        if (evt) fdjt.UI.cancel(evt);
        if (!(id)) {
            fdjtLog.warn("Couldn't resolve setting %s",id);
            dropClass(fdjtDOM.$(".codexhighlightsetting"),"codexhighlightsetting");
            Codex.setMode("device");
            return;}
        addClass(setting,"codexhighlightsetting");
        if (Codex.mode!=="device") {
            if (Codex.popmode) {
                var fn=Codex.popmode; Codex.popmode=unhighlightSettings(); fn();}
            Codex.setMode("device");}}
    Codex.UI.highlightSetting=highlightSetting;

    function showcover_tapped(evt){
        evt=evt||event;
        if ((Codex.touch)&&(!(Codex.hudup))) return;
        if (!((evt.shiftKey)||((evt.touches)&&(evt.touches.length>=2)))) {
            var opened=Codex.readLocal("codex.opened("+Codex.docuri+")",true);
            if ((opened)&&((opened-fdjtTime())>(60*10*1000))) {
                if (fdjtID("CODEXBOOKCOVERHOLDER"))
                    fdjtID("CODEXCOVER").className="bookcover";
                else fdjtID("CODEXCOVER").className="titlepage";}}
        Codex.showCover();
        fdjtUI.cancel(evt);}
    function showcover_released(evt){
        evt=evt||event;
        if (!((evt.shiftKey)||((evt.touches)&&(evt.touches.length>=2))))
            fdjtID("CODEXCOVER").className="bookcover";
        Codex.showCover();
        fdjtUI.cancel(evt);}

    function global_mouseup(evt){
        evt=evt||event;
        if (Codex.page_turner) {
            clearInterval(Codex.page_turner);
            Codex.page_turner=false;
            return;}
        if (Codex.select_target) {
            startAddGloss(Codex.select_target,
                          ((evt.shiftKey)&&("addtag")),evt);
            Codex.select_target=false;}}
        
    function raiseHUD(evt){
        evt=evt||event;
        Codex.setHUD(true);
        fdjt.UI.cancel(evt);
        fdjt.UI.cancel(evt);return false;}
    Codex.raiseHUD=raiseHUD;
    function lowerHUD(evt){
        evt=evt||event;
        Codex.setHUD(false);
        fdjt.UI.cancel(evt);
        return false;}
    Codex.lowerHUD=lowerHUD;

    function saveGloss(evt){
        Codex.submitGloss();}
    function refreshLayout(evt){
        evt=evt||event; cancel(evt); Codex.refreshLayout();}
    function refreshOffline(evt){
        evt=evt||event; cancel(evt); Codex.refreshOffline();}
    function clearOffline(evt){
        evt=evt||event; cancel(evt); Codex.clearOffline();}
    function consolefn(evt){
        evt=evt||event; Codex.consolefn();}
    function saveSettings(evt){
        evt=evt||event; Codex.UI.settingsSave();}
    function resetSettings(evt){
        evt=evt||event; Codex.UI.settingsReset();}
    function updateSettings(evt){
        evt=evt||event; Codex.UI.settingsUpdate();}

    fdjt.DOM.defListeners(
        Codex.UI.handlers.mouse,
        {window: {
            keyup: onkeyup,
            keydown: onkeydown,
            keypress: onkeypress,
            mouseup: global_mouseup,
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
         hud: {click: handleXTarget, tap: handleXTarget},
         "#CODEXSTARTPAGE": {click: Codex.UI.dropHUD},
         "#CODEXHEAD": {tap: raiseHUD},
         "#CODEXSHOWCOVER": {tap: showcover_tapped, release: showcover_released},
         "#CODEXHUDHELP": {click: Codex.UI.dropHUD},
         ".helphud": {click: Codex.UI.dropHUD},
         ".codexheart": {tap: flyleaf_tap},
         "#CODEXPAGEBAR": {tap: pagebar_tap,
                            hold: pagebar_hold,
                            release: pagebar_release,
                            slip: pagebar_slip,
                            click: cancel},
         "#CODEXPAGENOTEXT": {tap: enterPageNum},
         "#CODEXLOCPCT": {tap: enterPercentage},
         "#CODEXLOCOFF": {tap: enterLocation},
         // Return to scan
         "#CODEXSKIMMER": {tap: scanner_tapped, hold: scanner_held},
         // Expanding/contracting the scanner
         // Raise and lower HUD
         "#CODEXPAGEHEAD": {click: head_tap},
         "#CODEXTABS": {click: head_tap},
         "#CODEXTOP": {click: head_tap},
         "#CODEXPAGEFOOT": {tap: foot_tap},
         // Forward and backwards
         "#CODEXPAGELEFT": {tap: left_margin_tap,
                            hold: left_margin_hold,
                            release: left_margin_release},
         "#CODEXPAGERIGHT": {tap: right_margin_tap,
                             hold: right_margin_hold,
                             release: right_margin_release},
         "#CODEXTAGINPUT": {keydown: addtag_keydown},
         "#CODEXOUTLETINPUT": {keydown: addoutlet_keydown},
         "#CODEXATTACHFORM": {submit: attach_submit},
         "#CODEXATTACHURL": {keydown: attach_keydown},
         "#CODEXATTACHTITLE": {keydown: attach_keydown},
         "#CODEXATTACHOK": {click: attach_action},
         "#CODEXATTACHCANCEL": {click: attach_cancel},
         "#CODEXGLOSSCLOUD": {click: Codex.UI.handlers.glosscloud_ontap},
         "#CODEXSHARECLOUD": {click: outlet_tapped},
         "#CODEXALLTAGS": {click: Codex.UI.handlers.searchcloud_ontap},
         "#CODEXSEARCHCLOUD": {click: Codex.UI.handlers.searchcloud_ontap},
         "#CODEXHELPBUTTON": {
             tap: toggleHelp,
             hold: function(evt){setHelp(true); cancel(evt);},
             release: function(evt){setHelp(false); cancel(evt);},
             slip: function(evt){setHelp(false); cancel(evt);}},
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
         "#CODEXGLOSSDETAIL": {click: Codex.UI.dropHUD},
         "#CODEXNOTETEXT": {click: jumpToNote},
         ".hudmodebutton": {
             tap: hudmodebutton,hold: hudmodebutton,
             slip: hudmodebutton,release: hudmodebutton},
         ".hudbutton[alt='save gloss']": {
             tap: saveGloss,hold: saveGloss},
         // GLOSSFORM rules
         ".codexglossform": {click: glossform_touch,touchstart: glossform_touch},
         "span.codexsharegloss": {
             tap: fdjt.UI.CheckSpan.onclick},
         ".codexclosehud": {click: back_to_reading},
         ".codexglossform .response": {click: Codex.toggleHUD},
         ".addglossmenu": {
             tap: glossmode_tap,
             hold: glossmode_hold,
             slip: glossmode_slip,
             release: glossmode_release,
             click: cancel},
         "div.glossetc": {},
         "div.glossetc div.sharing": {click: glossform_outlets_tapped},
         "div.glossetc div.notetext": {click: editglossnote},
         // For checkspans
         ".codexglossform, #CODEXSETTINGS": {click: fdjt.UI.CheckSpan.onclick},
         ".codextogglehelp": {click: Codex.toggleHelp},
         "#CODEXCONSOLEBUTTON": {click: consolefn},
         "#CODEXSAVESETTINGS": {click: saveSettings},
         "#CODEXRESETSETTINGS": {click: resetSettings},
         "#CODEXSETTINGSTABLE": {click: updateSettings, blur: updateSettings},
         "#CODEXREFRESHOFFLINE": {click: refreshOffline},
         "#CODEXREFRESHLAYOUT": {click: refreshLayout},
         ".clearoffline": {click: clearOffline},
         ".codexclearmode": {click: clearMode},
         "#CODEXGOTOPAGEHELP": {click: clearMode},
         "#CODEXGOTOLOCHELP": {click: clearMode},
         ".codexshowsearch": {click: function(evt){
             Codex.showSearchResults(); fdjt.UI.cancel(evt);}},
         ".codexrefinesearch": {click: function(evt){
             Codex.setMode('refinesearch'); fdjt.UI.cancel(evt);}},
         ".codexexpandsearch": {click: function(evt){
             Codex.setMode('expandsearch'); fdjt.UI.cancel(evt);}},
         ".codexclearsearch": {click: function(evt){
             evt=evt||event;
             Codex.UI.handlers.clearSearch(evt);
             fdjt.UI.cancel(evt);
             return false;}},
         "#CODEXSOURCES .button.everyone": {
             click: function(evt){
                 evt=evt||event;
                 Codex.UI.handlers.everyone_ontap(evt);
                 fdjt.UI.cancel(event);}},
         "#CODEXSKIMMER .codexskiminfo": {
             click: function(evt){
                 evt=evt||event; Codex.stopSkimming(); cancel(evt);}}});

    fdjt.DOM.defListeners(
        Codex.UI.handlers.touch,
        {window: {
            keyup: onkeyup,
            keydown: onkeydown,
            keypress: onkeypress,
            // touchstart: default_tap,
            // touchmove: noDefault,
            touchend: stopPageTurner,
            touchmove: preview_touchmove_nodefault,
            focus: codexfocus,
            blur: codexblur},
         content: {tap: content_tapped,
                   hold: content_held,
                   slip: content_slipped,
                   release: content_released,
                   swipe: content_swiped,
                   touchmove: noDefault,
                   click: content_click},
         hud: {click: handleXTarget, tap: handleXTarget},
         toc: {tap: toc_tapped,hold: toc_held,
               slip: toc_slipped, release: toc_released,
               touchtoo: toc_touchtoo,
               touchmove: preview_touchmove_nodefault},
         glossmark: {touchstart: glossmark_tapped,touchend: cancel},
         // glossbutton: {mouseup: glossbutton_ontap,mousedown: cancel},
         summary: {tap: slice_tapped,
                   hold: slice_held,
                   release: slice_released,
                   touchtoo: slice_touchtoo,
                   touchmove: preview_touchmove_nodefault,
                   slip: slice_slipped},
         // "#CODEXHEART": {touchstart: heart_touched},
         // "#CODEXFRAME": {touchstart: noDefault,touchmove: noDefault,touchend: noDefault},
         "#CODEXSTARTPAGE": {touchend: Codex.UI.dropHUD},
         "#CODEXHEAD": {tap: raiseHUD},
         "#CODEXSHOWCOVER": {tap: showcover_tapped, release: showcover_released},
         "#CODEXSOURCES": {
             touchstart: cancel,
             touchend: Codex.UI.handlers.sources_ontap},
         "#CODEXHUDHELP": {touchend: Codex.UI.dropHUD},
         ".helphud": {touchend: Codex.UI.dropHUD},
         "#CODEXPAGEFOOT": {},
         "#CODEXPAGEBAR": {tap: pagebar_tap,
                            hold: pagebar_hold,
                            release: pagebar_release,
                            slip: pagebar_slip,
                            touchtoo: pagebar_touchtoo,
                            click: cancel},
         "#CODEXPAGENOTEXT": {tap: enterPageNum},
         "#CODEXLOCPCT": {tap: enterPercentage},
         "#CODEXLOCOFF": {tap: enterLocation},
         // Return to scan
         "#CODEXSKIMMER": {tap: scanner_tapped,hold: scanner_held},
         // Expanding/contracting the scanner
         // Raise and lower HUD
         "#CODEXPAGEHEAD": {touchstart: head_tap},
         "#CODEXTABS": {touchstart: head_tap},
         "#CODEXTOP": {touchend: head_tap},
         "#CODEXFOOT": {tap: foot_tap,touchstart: noDefault,touchmove: noDefault},
         // Forward and backwards
         "#CODEXPAGELEFT": {tap: left_margin_tap,
                            hold: left_margin_hold,
                            release: left_margin_release,
                            swipe: left_margin_swipe},
         "#CODEXPAGERIGHT": {tap: right_margin_tap,
                             hold: right_margin_hold,
                             release: right_margin_release,
                             swipe: right_margin_swipe},
         "#CODEXTAGINPUT": {keydown: addtag_keydown},
         "#CODEXOUTLETINPUT": {keydown: addoutlet_keydown},
         "#CODEXATTACHFORM": {submit: attach_submit},
         "#CODEXATTACHURL": {keydown: attach_keydown},
         "#CODEXATTACHTITLE": {keydown: attach_keydown},
         "#CODEXATTACHOK": {click: attach_action},
         "#CODEXATTACHCANCEL": {click: attach_cancel},
         "#CODEXGLOSSCLOUD": {touchend: Codex.UI.handlers.glosscloud_ontap},
         "#CODEXALLTAGS": {touchend: Codex.UI.handlers.searchcloud_ontap},
         "#CODEXSEARCHCLOUD": {touchend: Codex.UI.handlers.searchcloud_ontap},
         "#CODEXSHARECLOUD": {touchend: outlet_tapped},
         "#CODEXNEXTPAGE": {touchstart: function(evt){
             Codex.pageForward(evt); cancel(evt);}},
         "#CODEXPREVPAGE": {touchstart: function(evt){
             Codex.pageBackward(evt); cancel(evt);}},
         "#CODEXNEXTSCAN": {touchstart: function(evt){
             Codex.scanForward(evt); cancel(evt);}},
         "#CODEXPREVSCAN": {touchstart: function(evt){
             Codex.scanBackward(evt); cancel(evt);}},
         "#CODEXHELPBUTTON": {
             tap: toggleHelp,
             hold: function(evt){setHelp(true); cancel(evt);},
             release: function(evt){setHelp(false); cancel(evt);},
             slip: function(evt){setHelp(false); cancel(evt);}},
         "#CODEXHELP": {touchstart: toggleHelp},
         "#CODEXNOTETEXT": {touchend: jumpToNote,click: cancel},
         "#CODEXSHOWTEXT": {
             touchstart: back_to_reading,
             touchmove: cancel,
             touchend: cancel},
         "#CODEXGLOSSDETAIL": {touchend: Codex.UI.dropHUD,click: cancel},
         ".hudmodebutton": {
             tap: hudmodebutton,hold: hudmodebutton,release: hudmodebutton,
             slip: hudmodebutton},
         ".hudbutton[alt='save gloss']": {
             tap: saveGloss,hold: saveGloss},
         // GLOSSFORM rules
         ".codexglossform": {click: cancel,touchstart: glossform_touch},
         "span.codexsharegloss": {},
         ".codexclosehud": {
             click: back_to_reading,
             touchmove: cancel,
             touchend: cancel},
         ".codexglossform .response": {click: Codex.toggleHUD},
         ".addglossmenu": {
             tap: glossmode_tap,
             hold: glossmode_hold,
             slip: glossmode_slip,
             release: glossmode_release,
             click: cancel},
         "div.glossetc": {},
         "div.glossetc div.sharing": {
             touchend: glossform_outlets_tapped,
             click: cancel},
         "div.glossetc div.notetext": {
             touchend: editglossnote,
             click: cancel},
         ".codexglossform, #CODEXSETTINGS": {
             touchstart: cancel,
             touchend: fdjt.UI.CheckSpan.onclick},
         ".codextogglehelp": {
             touchstart: cancel,
             touchend: Codex.toggleHelp},
        
         "#CODEXCONSOLEBUTTON": {touchstart: cancel, touchend: consolefn},
         "#CODEXSAVESETTINGS": {touchstart: cancel, touchend: saveSettings},
         "#CODEXRESETSETTINGS": {touchstart: cancel, touchend: resetSettings},
         "#CODEXSETTINGSTABLE": {
             touchstart:cancel,
             touchend: updateSettings,
             blur: updateSettings},
         "#CODEXREFRESHOFFLINE": {touchstart: cancel, touchend: refreshOffline},
         "#CODEXREFRESHLAYOUT": {touchstart: cancel, touchend: refreshLayout},
         ".clearoffline": {touchstart: cancel, touchend: clearOffline},
         ".codexclearmode": {touchstart: cancel, touchend: clearMode},
         "#CODEXGOTOPAGEHELP": {touchstart: cancel, touchend: clearMode},
         "#CODEXGOTOLOCHELP": {touchstart: cancel, touchend: clearMode},
         ".codexshowsearch": {
             touchstart: cancel,
             touchend: function(evt){
                 Codex.showSearchResults(); fdjt.UI.cancel(evt);}},
         ".codexrefinesearch": {
             touchstart: cancel,
             touchend: function(evt){
                 Codex.setMode('refinesearch'); fdjt.UI.cancel(evt);}},
         ".codexexpandsearch": {
             touchstart: cancel,
             touchend: function(evt){
                 Codex.setMode('expandsearch'); fdjt.UI.cancel(evt);}},
         ".codexclearsearch": {
             touchstart: cancel,
             touchend: function(evt){
                 evt=evt||event;
                 Codex.UI.handlers.clearSearch(evt);
                 fdjt.UI.cancel(evt);
                 return false;}},
         "#CODEXSOURCES .button.everyone": {
             touchstart: cancel,
             touchend: function(evt){
                 evt=evt||event;
                 Codex.UI.handlers.everyone_ontap(evt);
                 fdjt.UI.cancel(event);}},
         "#CODEXSKIMMER .codexskiminfo": {
             touchstart: cancel,
             touchend: function(evt){
                 evt=evt||event; Codex.stopSkimming(); cancel(evt);}}});
    
})();

/* Emacs local variables
   ;;;  Local variables: ***
   ;;;  compile-command: "cd ..; make" ***
   ;;;  indent-tabs-mode: nil ***
   ;;;  End: ***
*/

